"""회원 / 미수금명단 라우터 — 실제 DB 기반 목록/상세/수납/폐업."""

from datetime import date

import math
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Closure, Member, MemberHistory, Payment, ReceivableItem
from ..schemas import ClosureCreate, MemberUpdate, PaymentApply

router = APIRouter(prefix="/api/members", tags=["members"])


def _fix_reversed_future_date(d: date | None) -> date | None:
    """이미 DB에 들어간 2030/2031식 뒤집힌 날짜를 화면 출력에서 보정한다.

    원본 엑셀의 20.10.30, 21.03.31 같은 값을 2030-10-20, 2031-03-21로
    잘못 저장한 경우가 있어 2020-10-30, 2021-03-31로 되돌린다.
    """
    if not d:
        return None
    yy = d.year % 100
    if d.year > date.today().year and 1 <= yy <= 31 and 1 <= d.day <= 31:
        try:
            fixed = date(2000 + d.day, d.month, yy)
            if fixed.year <= date.today().year:
                return fixed
        except Exception:
            pass
    return d


def _date_iso(d: date | None) -> str | None:
    fixed = _fix_reversed_future_date(d)
    return fixed.isoformat() if fixed else None


def _memo_field(memo: str | None, labels: list[str]) -> str | None:
    raw = str(memo or "")
    if not raw:
        return None
    for label in labels:
        # 메모에 저장된 "주소:... / 공문 주소:..." 형태를 다시 화면 필드로 복원한다.
        m = re.search(rf"(?:^|\s*/\s*){re.escape(label)}\s*[:：]\s*([^/]+)", raw)
        if m:
            v = m.group(1).strip()
            if v:
                return v[:300]
    return None


def _open_items(member: Member) -> list[ReceivableItem]:
    return sorted([x for x in member.receivable_items if (not x.is_paid) and x.amount > 0], key=lambda x: x.ym)


def _member_dict(member: Member, detail: bool = False) -> dict:
    open_items = _open_items(member)  # 실제 수납 처리 대상: 양수 미수항목만
    balance_items = sorted([x for x in member.receivable_items if (not x.is_paid) and x.amount != 0], key=lambda x: x.ym)
    paid_items = [x for x in member.receivable_items if x.is_paid]
    # 미수금명단 표시용 현재잔액: 0원/선입금(-금액)도 회원이 사라지면 안 되므로 음수까지 반영한다.
    arrears_amount = sum(x.amount for x in balance_items)
    # MISU_CRITICAL_PATCH_ARREARS_MONTHS: 미수월수는 화면별 계산 금지.
    # 2026 미수금이 한 줄 현재잔액으로 들어온 경우 len(open_items)=1이 되므로,
    # 금액/monthly_charge 기준도 함께 적용해 목록/상세/대시보드 값을 통일한다.
    monthly_charge_for_months = int(member.monthly_charge or 0)
    amount_based_months = math.ceil(max(int(arrears_amount or 0), 0) / monthly_charge_for_months) if monthly_charge_for_months > 0 else 0
    arrears_months_common = max(len(open_items), amount_based_months)

    out = {
        # DB 원본 필드
        "id": member.id,
        "mgmt_no": member.mgmt_no,
        "reg_type": member.reg_type,
        "name": member.name,
        "vehicle_no": member.vehicle_no,
        "phone": member.phone,
        "sigun": member.sigun,
        "region_raw": member.region_raw,
        "member_type": member.member_type,
        "membership": member.membership,
        "birth_year": member.birth_year,
        "cert_issue_date": _date_iso(member.cert_issue_date),
        "assoc_join_date": _date_iso(member.assoc_join_date),
        "billing_start_ym": member.billing_start_ym,
        "charge_item": member.charge_item,
        "monthly_charge": member.monthly_charge,
        "last_payment_ym": member.last_payment_ym,
        "status": member.status,
        "is_disconnected": member.is_disconnected,
        "cert_missing": member.cert_missing,
        "memo": member.memo,
        "address": _memo_field(member.memo, ["주소", "주 소"]),
        "public_address": _memo_field(member.memo, ["공문 주소", "공문주소"]),
        "publicAddress": _memo_field(member.memo, ["공문 주소", "공문주소"]),
        "resident_no": _memo_field(member.memo, ["주민등록번호", "주민번호"]),
        "residentNo": _memo_field(member.memo, ["주민등록번호", "주민번호"]),
        "cert_issue_no": _memo_field(member.memo, ["자격증명 발급번호", "자격증명발급번호"]),
        "certIssueNo": _memo_field(member.memo, ["자격증명 발급번호", "자격증명발급번호"]),
        # 프론트 기존 화면 호환 camelCase 필드
        "mgmtNo": member.mgmt_no,
        "vehicleNo": member.vehicle_no,
        "memberType": member.member_type,
        "regionRaw": member.region_raw,
        "certIssueDate": _date_iso(member.cert_issue_date),
        "assocJoinDate": _date_iso(member.assoc_join_date),
        "billingStartYm": member.billing_start_ym,
        "chargeItem": member.charge_item,
        "monthlyCharge": member.monthly_charge,
        "lastPaymentYm": member.last_payment_ym,
        "disconnected": member.is_disconnected,
        "certMissing": member.cert_missing,
        "arrears_months": arrears_months_common,
        "arrears_amount": arrears_amount,
        "arrearsMonths": arrears_months_common,
        "totalArrears": arrears_amount,
        "age": (date.today().year - member.birth_year) if member.birth_year else None,
        "updatedAt": member.updated_at.isoformat() if member.updated_at else "",
    }
    if detail:
        out["receivable_items"] = [
            {"id": x.id, "ym": x.ym, "label": f"현재잔액({x.ym})", "charge_item": x.charge_item, "item": x.charge_item, "amount": x.amount, "is_paid": x.is_paid, "paid": x.is_paid}
            for x in sorted(member.receivable_items, key=lambda x: x.ym)
        ]
        out["arrears"] = [
            {"id": x.id, "ym": x.ym, "label": f"현재잔액({x.ym})", "charge_item": x.charge_item, "item": x.charge_item, "amount": x.amount, "is_paid": x.is_paid, "paid": x.is_paid}
            for x in sorted(member.receivable_items, key=lambda x: x.ym)
        ]
        out["payments"] = [
            {"id": p.id, "memberId": p.member_id, "paid_for_ym": p.paid_for_ym, "paidForYm": p.paid_for_ym, "charge_item": p.charge_item, "chargeItem": p.charge_item, "amount": p.amount, "method": p.method, "paid_date": p.paid_date.isoformat(), "paidDate": p.paid_date.isoformat()}
            for p in sorted(member.payments, key=lambda p: p.paid_date, reverse=True)
        ]
    else:
        out["arrears"] = [
            {"id": x.id, "ym": x.ym, "label": f"현재잔액({x.ym})", "item": x.charge_item, "amount": x.amount, "paid": x.is_paid}
            for x in balance_items[:12]
        ]
    return out


@router.get("")
def list_members(
    q: str | None = Query(None, description="이름/차량번호/관리번호 검색"),
    sigun: str | None = None,
    member_type: str | None = None,
    membership: str | None = None,
    status: str | None = Query(None, description="정상/폐업/양도/이관/탈퇴"),
    has_arrears: bool | None = Query(None, description="미수금명단=True"),
    min_balance: int | None = Query(None, description="현재잔액 최솟값"),
    max_balance: int | None = Query(None, description="현재잔액 최댓값"),
    include_zero: bool = Query(True, description="0원 포함"),
    include_prepaid: bool = Query(True, description="선납(-) 포함"),
    min_months: int | None = Query(None, description="미수개월 최솟값"),
    max_months: int | None = Query(None, description="미수개월 최댓값"),
    page: int = 1,
    size: int = 1000,
    db: Session = Depends(get_db),
    response: Response = None,
):
    stmt = select(Member).options(selectinload(Member.receivable_items), selectinload(Member.payments))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Member.name.like(like)) | (Member.vehicle_no.like(like)) |
            (Member.mgmt_no.like(like)) | (Member.phone.like(like)) | (Member.memo.like(like))
        )
    if sigun:
        stmt = stmt.where(Member.sigun == sigun)
    if member_type:
        stmt = stmt.where(Member.member_type == member_type)
    if membership:
        stmt = stmt.where(Member.membership == membership)
    if status:
        stmt = stmt.where(Member.status == status)

    if has_arrears is True:
        stmt = stmt.join(ReceivableItem, isouter=False).where(
            ReceivableItem.is_paid == False,  # noqa: E712
            ReceivableItem.amount > 0,
            Member.status == "정상",
        )
    elif has_arrears is False:
        arrears_subq = (
            select(ReceivableItem.member_id)
            .where(ReceivableItem.is_paid == False, ReceivableItem.amount > 0)  # noqa: E712
            .distinct()
        )
        stmt = stmt.where(Member.id.not_in(arrears_subq))

    # Python 레벨 금액/개월 필터를 정확히 적용하기 위해 먼저 전체 후보를 계산하고,
    # 그 다음 페이지네이션한다. 3~4천 명 규모라 충분히 안전하며 X-Total-Count로 전체 건수를 내려준다.
    stmt = stmt.order_by(Member.sigun, Member.name)
    filtered = []
    for m in db.scalars(stmt).unique().all():
        d = _member_dict(m)
        bal = d["arrears_amount"]
        months = d["arrears_months"]
        if min_balance is not None and bal < min_balance:
            continue
        if max_balance is not None and bal > max_balance:
            continue
        if not include_zero and bal == 0:
            continue
        if not include_prepaid and bal < 0:
            continue
        if min_months is not None and months < min_months:
            continue
        if max_months is not None and months > max_months:
            continue
        filtered.append(d)
    total = len(filtered)
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page"] = str(page)
        response.headers["X-Page-Size"] = str(size)
    start = max(page - 1, 0) * size
    return filtered[start:start + size]


@router.get("/{member_id}")
def get_member(member_id: str, db: Session = Depends(get_db)):
    stmt = select(Member).options(selectinload(Member.receivable_items), selectinload(Member.payments)).where(Member.id == member_id)
    member = db.scalar(stmt)
    if member is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    return _member_dict(member, detail=True)


@router.patch("/{member_id}")
def update_member(member_id: str, payload: MemberUpdate, db: Session = Depends(get_db)):
    member = db.get(Member, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    before_summary = f"{member.name}/{member.vehicle_no}/{member.mgmt_no}"
    editable_fields = [
        "mgmt_no",
        "reg_type",
        "name",
        "vehicle_no",
        "phone",
        "sigun",
        "region_raw",
        "member_type",
        "membership",
        "birth_year",
        "cert_issue_date",
        "assoc_join_date",
        "billing_start_ym",
        "charge_item",
        "monthly_charge",
        "last_payment_ym",
        "status",
        "is_disconnected",
        "cert_missing",
        "memo",
    ]
    changed = []
    for field in editable_fields:
        value = getattr(payload, field, None)
        if value is not None:
            old = getattr(member, field)
            if old != value:
                setattr(member, field, value)
                changed.append(field)

    if changed:
        db.add(MemberHistory(
            member_id=member.id,
            content=f"회원정보 수정: {before_summary} / 변경필드 {', '.join(changed)}",
            actor="system",
        ))
    db.commit()
    db.refresh(member)
    return _member_dict(member)


@router.post("/{member_id}/payments")
def apply_payment(member_id: str, payload: PaymentApply, db: Session = Depends(get_db)):
    stmt = select(Member).options(selectinload(Member.receivable_items)).where(Member.id == member_id)
    member = db.scalar(stmt)
    if member is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    remain = payload.amount
    if remain <= 0:
        raise HTTPException(status_code=400, detail="수납액은 0원보다 커야 합니다.")

    # 가수금/잡수입/기타 등 '기록만' 항목: 미수금 차감 없이 수납내역 1건만 남긴다.
    if payload.deduct is False:
        item_label = payload.charge_item or "기타"
        db.add(Payment(
            member_id=member.id,
            paid_for_ym=(payload.paid_date or date.today()).strftime("%Y-%m"),
            charge_item=item_label,
            amount=remain,
            method=payload.method,
            paid_date=payload.paid_date or date.today(),
            deposit_id=payload.deposit_id,
        ))
        db.add(MemberHistory(member_id=member.id, content=f"{item_label} 수납 {remain:,}원 (미수금 미차감)", actor="system"))
        db.commit()
        return {"ok": True, "paid_count": 0, "applied": remain, "remain": 0, "member": get_member(member_id, db)}

    paid_count = 0
    applied = 0
    item_override = payload.charge_item
    for item in _open_items(member):
        if remain <= 0:
            break
        pay_amount = min(remain, item.amount)
        if pay_amount <= 0:
            continue
        db.add(Payment(member_id=member.id, paid_for_ym=item.ym, charge_item=item_override or item.charge_item, amount=pay_amount, method=payload.method, paid_date=payload.paid_date or date.today(), deposit_id=payload.deposit_id))
        applied += pay_amount
        remain -= pay_amount
        if pay_amount >= item.amount:
            item.is_paid = True
            paid_count += 1
        else:
            item.amount -= pay_amount
        member.last_payment_ym = item.ym
    db.add(MemberHistory(member_id=member.id, content=f"수납 반영 {applied:,}원 / 미수항목 {paid_count}건 완납", actor="system"))
    db.commit()
    return {"ok": True, "paid_count": paid_count, "applied": applied, "remain": remain, "member": get_member(member_id, db)}


@router.get("/{member_id}/history")
def get_member_history(member_id: str, db: Session = Depends(get_db)):
    stmt = select(MemberHistory).where(MemberHistory.member_id == member_id).order_by(MemberHistory.at.desc()).limit(100)
    rows = db.scalars(stmt).all()
    return [{"id": h.id, "content": h.content, "actor": h.actor, "created_at": h.at.isoformat() if h.at else None} for h in rows]


@router.post("/{member_id}/closure")
def register_closure(member_id: str, payload: ClosureCreate, db: Session = Depends(get_db)):
    stmt = select(Member).options(selectinload(Member.receivable_items)).where(Member.id == member_id)
    member = db.scalar(stmt)
    if member is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    unpaid = sum(x.amount for x in _open_items(member))
    closure = Closure(
        member_id=member.id,
        type=payload.type,
        process_date=payload.process_date,
        doc_no=payload.doc_no,
        content=payload.content or "미수금명단에서 이탈 처리",
        unpaid_balance=unpaid,
        notify_later=unpaid > 0 or payload.notify_later,
    )
    member.status = payload.type
    db.add(closure)
    db.add(MemberHistory(member_id=member.id, content=f"{payload.type} 처리 / 미수잔액 {unpaid:,}원", actor="system"))
    db.commit()
    return {"ok": True, "closure_id": closure.id, "unpaid_balance": unpaid, "notify_later": closure.notify_later}
