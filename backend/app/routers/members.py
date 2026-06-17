"""회원 / 미수금명단 라우터 — 실제 DB 기반 목록/상세/수납/폐업."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
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


NON_ARREARS_INCOME_ITEMS = {"협회가입비", "자격증명발급비", "기타"}


def _accounting_type(charge_item: str | None) -> str:
    if charge_item == "협회가입비":
        return "가수금"
    if charge_item == "자격증명발급비":
        return "잡수입"
    if charge_item == "기타":
        return "기타수입"
    return "회비수입"


def _is_non_arrears_income(charge_item: str | None) -> bool:
    return (charge_item or "") in NON_ARREARS_INCOME_ITEMS


def _ym_from_date(d: date | None) -> str:
    d = d or date.today()
    return d.strftime("%Y-%m")


def _open_items(member: Member) -> list[ReceivableItem]:
    return sorted([x for x in member.receivable_items if (not x.is_paid) and x.amount > 0], key=lambda x: x.ym)


def _current_balance(member: Member) -> int:
    # 화면의 현재잔액과 동일한 기준: 미납/선납 포함, 납부완료 제외.
    # 폐업 처리 시 금액이 줄어들지 않도록 이 기준을 폐업현황에도 사용한다.
    return sum(int(x.amount or 0) for x in member.receivable_items if (not x.is_paid) and int(x.amount or 0) != 0)


def _member_dict(member: Member, detail: bool = False) -> dict:
    open_items = _open_items(member)  # 실제 수납 처리 대상: 양수 미수항목만
    balance_items = sorted([x for x in member.receivable_items if (not x.is_paid) and x.amount != 0], key=lambda x: x.ym)
    paid_items = [x for x in member.receivable_items if x.is_paid]
    # 미수금명단 표시용 현재잔액: 0원/선입금(-금액)도 회원이 사라지면 안 되므로 음수까지 반영한다.
    arrears_amount = _current_balance(member)
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
        "arrears_months": len(open_items),
        "arrears_amount": arrears_amount,
        "arrearsMonths": len(open_items),
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
    page: int = 1,
    size: int = 500,
    db: Session = Depends(get_db),
):
    stmt = select(Member).options(selectinload(Member.receivable_items), selectinload(Member.payments))
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Member.name.like(like)) | (Member.vehicle_no.like(like)) | (Member.mgmt_no.like(like)))
    if sigun:
        stmt = stmt.where(Member.sigun == sigun)
    if member_type:
        stmt = stmt.where(Member.member_type == member_type)
    if membership:
        stmt = stmt.where(Member.membership == membership)
    if status:
        stmt = stmt.where(Member.status == status)

    # 미수금명단 조회는 페이지를 자르기 전에 DB 기준으로 먼저 걸러야 한다.
    # 그렇지 않으면 첫 페이지/size 범위 안에 미수자가 없을 때 화면이 0명처럼 보일 수 있다.
    if has_arrears is True:
        stmt = stmt.join(ReceivableItem).where(
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

    stmt = stmt.order_by(Member.sigun, Member.name).offset((page - 1) * size).limit(size)
    members = [_member_dict(m) for m in db.scalars(stmt).unique().all()]
    return members


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
    remain = int(payload.amount or 0)
    if remain <= 0:
        raise HTTPException(status_code=400, detail="수납액은 0원보다 커야 합니다.")

    charge_item = payload.charge_item or member.charge_item or "관리비"
    paid_date = payload.paid_date or date.today()

    # 협회가입비(가수금), 자격증명발급비(잡수입), 기타는 미수금 차감 없이 수납내역만 남긴다.
    if _is_non_arrears_income(charge_item):
        paid_for_ym = payload.paid_for_ym or _ym_from_date(paid_date)
        db.add(Payment(member_id=member.id, paid_for_ym=paid_for_ym, charge_item=charge_item, amount=remain, method=payload.method, paid_date=paid_date, deposit_id=payload.deposit_id))
        db.add(MemberHistory(member_id=member.id, content=f"{charge_item}({_accounting_type(charge_item)}) 수납 {remain:,}원 / 미수금 차감 없음", actor="system"))
        db.commit()
        return {"ok": True, "paid_count": 0, "applied": remain, "remain": 0, "non_arrears": True, "accounting_type": _accounting_type(charge_item), "member": get_member(member_id, db)}

    paid_count = 0
    applied = 0
    for item in _open_items(member):
        if remain <= 0:
            break
        pay_amount = min(remain, item.amount)
        if pay_amount <= 0:
            continue
        db.add(Payment(member_id=member.id, paid_for_ym=item.ym, charge_item=item.charge_item, amount=pay_amount, method=payload.method, paid_date=paid_date, deposit_id=payload.deposit_id))
        applied += pay_amount
        remain -= pay_amount
        if pay_amount >= item.amount:
            item.is_paid = True
            paid_count += 1
        else:
            item.amount -= pay_amount
        member.last_payment_ym = item.ym

    # 미수 없는 회원에게 협회비/관리비를 추가로 받은 경우도 선납/추가입금으로 기록한다.
    if applied <= 0 and remain > 0:
        paid_for_ym = payload.paid_for_ym or _ym_from_date(paid_date)
        db.add(Payment(member_id=member.id, paid_for_ym=paid_for_ym, charge_item=charge_item, amount=remain, method=payload.method, paid_date=paid_date, deposit_id=payload.deposit_id))
        applied = remain
        remain = 0
        db.add(MemberHistory(member_id=member.id, content=f"{charge_item} 선납/추가입금 {applied:,}원", actor="system"))
    else:
        db.add(MemberHistory(member_id=member.id, content=f"수납 반영 {applied:,}원 / 미수항목 {paid_count}건 완납", actor="system"))
    db.commit()
    return {"ok": True, "paid_count": paid_count, "applied": applied, "remain": remain, "member": get_member(member_id, db)}


@router.post("/{member_id}/closure")
def register_closure(member_id: str, payload: ClosureCreate, db: Session = Depends(get_db)):
    stmt = select(Member).options(selectinload(Member.receivable_items)).where(Member.id == member_id)
    member = db.scalar(stmt)
    if member is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    server_unpaid = max(0, _current_balance(member))
    payload_unpaid = max(0, int(payload.unpaid_balance or 0))
    unpaid = payload_unpaid if payload_unpaid > 0 else server_unpaid
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
