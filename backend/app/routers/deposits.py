"""통장매칭 라우터 — 입금내역 조회 + 자동후보/수동매칭/제외.

통장매칭 화면은 원본 엑셀 미리보기가 아니라 아래 흐름을 지원한다.
입금자명/적요/입금액 → 회원 원장 + 현재 미수금 비교 → 자동매칭/후보확인/중복후보/미매칭 → 수납반영.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Deposit, Member, MemberHistory, Payment
from ..schemas import DepositMatch

router = APIRouter(prefix="/api/deposits", tags=["deposits"])


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


def _infer_income_item(deposit: Deposit, member: Member | None = None) -> str:
    text = f"{deposit.depositor_name or ''} {deposit.memo or ''}"
    if any(k in text for k in ["가입비", "협회가입", "신규가입"]):
        return "협회가입비"
    if any(k in text for k in ["자격증명", "증명발급", "발급비", "재발급"]):
        return "자격증명발급비"
    return (member.charge_item if member and member.charge_item else "관리비")




def _ensure_income_member(db: Session) -> Member:
    """회원과 무관한 잡수입/기타수입을 수납내역에 남기기 위한 내부용 가상 회원."""
    member = db.get(Member, "SYS-INCOME")
    if member is not None:
        return member
    member = Member(
        id="SYS-INCOME",
        mgmt_no="수입-0000",
        reg_type="기타",
        name="회원외 수입",
        vehicle_no="-",
        phone=None,
        sigun="기타",
        region_raw="기타",
        member_type="기타",
        membership="기타",
        birth_year=None,
        cert_issue_date=None,
        assoc_join_date=None,
        billing_start_ym=None,
        charge_item="기타",
        monthly_charge=0,
        last_payment_ym=None,
        status="수입",
        is_disconnected=False,
        cert_missing=False,
        memo="회원 선택 없이 처리한 잡수입/기타수입 전용 내부 계정",
    )
    db.add(member)
    db.flush()
    return member

def _ym_from_date(d: date | None) -> str:
    d = _safe_deposit_date(d) if d else date.today()
    return d.strftime("%Y-%m")


def _safe_deposit_date(d: date) -> date:
    """이미 잘못 저장된 2030-12-25 같은 날짜를 화면/수납반영 기준에서 보정한다.

    원본 카드/통장 파일의 25.12.30, 26.03.31 형식이 pandas에서
    2030-12-25, 2031-03-26처럼 뒤집힌 경우를 되돌린다.
    """
    if not d:
        return date.today()
    yy = d.year % 100
    if d.year > date.today().year and 1 <= yy <= 31 and 1 <= d.day <= 31:
        try:
            return date(2000 + d.day, d.month, yy)
        except Exception:
            return d
    return d






# 대납자/묶음수납 사전
# - 입금자 한 명이 여러 회원 회비를 한 번에 내는 고정 패턴
# - 금액만으로 자동 후보를 만들지 않고, 이 사전에 등록된 입금자명일 때만 묶음수납 후보로 표시한다.
GROUP_PAYER_PRESETS = [
    {
        "code": "조철만",
        "title": "조철만 · 합동1",
        "aliases": ["조철만", "합동1"],
        "expected_amount": 110000,
        "targets": [
            {"name": "이상오", "vehicle_last4": "6140", "amount": 10000, "charge_item": "협회비"},
            {"name": "김민종", "vehicle_last4": "6152", "amount": 10000, "charge_item": "협회비"},
            {"name": "이창환", "vehicle_last4": "6160", "amount": 10000, "charge_item": "협회비"},
            {"name": "문용빈", "vehicle_last4": "6212", "amount": 10000, "charge_item": "협회비"},
            {"name": "이기석", "vehicle_last4": "8681", "amount": 10000, "charge_item": "협회비"},
            {"name": "김형철", "vehicle_last4": "2388", "amount": 10000, "charge_item": "협회비"},
            {"name": "이현정", "vehicle_last4": "2423", "amount": 10000, "charge_item": "협회비"},
            {"name": "조철만", "vehicle_last4": "6209", "amount": 10000, "charge_item": "협회비"},
            {"name": "김창진", "vehicle_last4": "8656", "amount": 5000, "charge_item": "협회비"},
            {"name": "함영근", "vehicle_last4": "2340", "amount": 5000, "charge_item": "협회비"},
            {"name": "박준형", "vehicle_last4": "6165", "amount": 10000, "charge_item": "협회비"},
            {"name": "조현우", "vehicle_last4": "6170", "amount": 10000, "charge_item": "협회비"},
        ],
    },
    {
        "code": "허장덕",
        "title": "허장덕 · 합동2",
        "aliases": ["허장덕", "합동2"],
        "expected_amount": 70000,
        "targets": [
            {"name": "이주석", "vehicle_last4": "2087", "amount": 10000, "charge_item": "협회비"},
            {"name": "이상천", "vehicle_last4": "6208", "amount": 10000, "charge_item": "협회비"},
            {"name": "고장영", "vehicle_last4": "6323", "amount": 10000, "charge_item": "협회비"},
            {"name": "장상봉", "vehicle_last4": "8662", "amount": 10000, "charge_item": "협회비"},
            {"name": "김동규", "vehicle_last4": "2424", "amount": 10000, "charge_item": "협회비"},
            {"name": "허장덕", "vehicle_last4": "2106", "amount": 10000, "charge_item": "협회비"},
            {"name": "박유호", "vehicle_last4": "8524", "amount": 5000, "charge_item": "협회비"},
            {"name": "김두후", "vehicle_last4": "8671", "amount": 5000, "charge_item": "협회비"},
        ],
    },
    {
        "code": "주신평",
        "title": "주신평 · 3개월분",
        "aliases": ["주신평", "주신평3개월", "주신평(3개월)"],
        "expected_amount": 210000,
        "targets": [
            {"name": "김영관", "vehicle_last4": "1518", "amount": 30000, "charge_item": "협회비"},
            {"name": "장형일", "vehicle_last4": "1289", "amount": 30000, "charge_item": "협회비"},
            {"name": "임종표", "vehicle_last4": "1251", "amount": 30000, "charge_item": "협회비"},
            {"name": "박민경", "vehicle_last4": "1154", "amount": 30000, "charge_item": "협회비"},
            {"name": "김성섭", "vehicle_last4": "1150", "amount": 30000, "charge_item": "협회비"},
            {"name": "이용희", "vehicle_last4": "1130", "amount": 30000, "charge_item": "협회비"},
            {"name": "이민성", "vehicle_last4": "1841", "amount": 30000, "charge_item": "협회비"},
        ],
    },
]


def _find_group_preset(deposit: Deposit) -> dict | None:
    text = _name_norm(f"{deposit.depositor_name or ''} {deposit.memo or ''}")
    amount = int(deposit.amount or 0)
    matched = []
    for preset in GROUP_PAYER_PRESETS:
        if any(_name_norm(a) and _name_norm(a) in text for a in preset.get("aliases", [])):
            matched.append(preset)
    if not matched:
        return None
    # 같은 별칭이 여러 개 걸리면 입금액이 가장 가까운 묶음을 우선한다.
    matched.sort(key=lambda p: abs(amount - int(p.get("expected_amount") or 0)))
    return matched[0]


def _find_member_for_group_target(target: dict, members: list[Member]) -> Member | None:
    target_name = _name_norm(target.get("name"))
    target_last4 = _digits(target.get("vehicle_last4"))[-4:]
    exact = []
    by_last4 = []
    by_name = []
    for m in members:
        if m.status != "정상":
            continue
        name_ok = target_name and target_name in _name_norm(m.name)
        last4_ok = target_last4 and _vehicle_last4(m.vehicle_no) == target_last4
        if name_ok and last4_ok:
            exact.append(m)
        elif last4_ok:
            by_last4.append(m)
        elif name_ok:
            by_name.append(m)
    if len(exact) == 1:
        return exact[0]
    if len(by_last4) == 1:
        return by_last4[0]
    if len(by_name) == 1:
        return by_name[0]
    return None


def _group_candidate_dict(deposit: Deposit, members: list[Member]) -> dict | None:
    preset = _find_group_preset(deposit)
    if not preset:
        return None
    targets = []
    resolved = 0
    for t in preset.get("targets", []):
        m = _find_member_for_group_target(t, members)
        arrears = _arrears_amount(m) if m else 0
        if m:
            resolved += 1
        targets.append({
            "name": t.get("name"),
            "vehicleLast4": t.get("vehicle_last4"),
            "amount": int(t.get("amount") or 0),
            "chargeItem": t.get("charge_item") or "협회비",
            "memberId": m.id if m else None,
            "memberName": m.name if m else None,
            "vehicleNo": m.vehicle_no if m else None,
            "mgmtNo": m.mgmt_no if m else None,
            "currentArrears": arrears,
            "resolved": bool(m),
        })
    expected = sum(int(x.get("amount") or 0) for x in preset.get("targets", []))
    return {
        "code": preset.get("code"),
        "title": preset.get("title") or preset.get("code"),
        "expectedAmount": expected,
        "depositAmount": int(deposit.amount or 0),
        "diff": int(deposit.amount or 0) - expected,
        "resolvedCount": resolved,
        "targetCount": len(targets),
        "targets": targets,
        "reason": "대납자/묶음수납 사전 일치",
    }


def _apply_member_amount(db: Session, member: Member, amount: int, charge_item: str, paid_date: date, deposit: Deposit, note: str) -> int:
    """묶음수납 1명분을 반영한다. 미수가 없거나 남은 금액은 선납/추가입금으로 남긴다."""
    remain = max(0, int(amount or 0))
    applied = 0
    for item in _open_items(member):
        if remain <= 0:
            break
        pay_amount = min(remain, item.amount)
        if pay_amount <= 0:
            continue
        db.add(Payment(member_id=member.id, paid_for_ym=item.ym, charge_item=item.charge_item, amount=pay_amount, method="통장매칭", paid_date=paid_date, deposit_id=deposit.id))
        applied += pay_amount
        remain -= pay_amount
        if pay_amount >= item.amount:
            item.is_paid = True
        else:
            item.amount -= pay_amount
        member.last_payment_ym = item.ym
    if remain > 0:
        db.add(Payment(member_id=member.id, paid_for_ym=_ym_from_date(paid_date), charge_item=charge_item or member.charge_item or "협회비", amount=remain, method="통장매칭", paid_date=paid_date, deposit_id=deposit.id))
        applied += remain
    db.add(MemberHistory(member_id=member.id, content=f"{note}: {applied:,}원", actor="system"))
    return applied


def _parse_deposit_date(v) -> date:
    if isinstance(v, date):
        return _safe_deposit_date(v)
    s = str(v or "").strip()
    m = re.search(r"(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})", s)
    if m:
        a, b, c = map(int, m.groups())
        try:
            if a < 100:
                d = date(2000 + a if a < 80 else 1900 + a, b, c)
            else:
                d = date(a, b, c)
            return _safe_deposit_date(d)
        except Exception:
            pass
    return date.today()


def _short(v, n=60):
    s = str(v or "").strip()
    return s[:n] if s else None


def _open_items(member: Member):
    return sorted([x for x in member.receivable_items if (not x.is_paid) and x.amount > 0], key=lambda x: x.ym)


def _arrears_amount(member: Member) -> int:
    return sum(x.amount for x in _open_items(member))


def _digits(text: str | None) -> str:
    return re.sub(r"\D", "", text or "")


def _vehicle_last4(vehicle_no: str | None) -> str:
    d = _digits(vehicle_no)
    return d[-4:] if len(d) >= 4 else ""


def _name_norm(text: str | None) -> str:
    return re.sub(r"\s+", "", text or "")


def _text_for_match(deposit: Deposit) -> str:
    return _name_norm(f"{deposit.depositor_name or ''} {deposit.memo or ''}")


@dataclass
class Candidate:
    member: Member
    score: int
    reasons: list[str]
    arrears_amount: int
    diff: int


def _member_candidate_dict(c: Candidate) -> dict:
    m = c.member
    return {
        "id": m.id,
        "member_id": m.id,
        "name": m.name,
        "vehicle_no": m.vehicle_no,
        "vehicleNo": m.vehicle_no,
        "mgmt_no": m.mgmt_no,
        "mgmtNo": m.mgmt_no,
        "sigun": m.sigun,
        "membership": m.membership,
        "member_type": m.member_type,
        "status": m.status,
        "phone": m.phone,
        "arrears_amount": c.arrears_amount,
        "totalArrears": c.arrears_amount,
        "diff": c.diff,
        "score": c.score,
        "reasons": c.reasons,
        "reason": " · ".join(c.reasons),
    }


def _match_candidates(deposit: Deposit, members: list[Member]) -> list[Candidate]:
    """입금자명/메모/금액을 현재 미수 회원과 비교해 후보를 점수화한다.

    핵심 원칙:
    - 금액일치만으로는 후보가 될 수 없다.
    - 이름/차량번호 뒤4자리/전화번호 뒤4자리/관리번호 중 하나 이상 맞아야 한다.
    - 금액일치는 보조 점수로만 사용한다.
    """
    text = _text_for_match(deposit)
    dep_digits = _digits(text)
    amount = int(deposit.amount or 0)
    out: list[Candidate] = []
    for member in members:
        if member.status != "정상":
            continue
        arrears = _arrears_amount(member)

        score = 0
        reasons: list[str] = []
        primary_match = False

        nm = _name_norm(member.name)
        last4 = _vehicle_last4(member.vehicle_no)
        phone4 = _digits(member.phone)[-4:] if member.phone else ""
        mgmt = _name_norm(member.mgmt_no)

        if nm and nm in text:
            score += 55
            primary_match = True
            reasons.append("이름일치")
        if last4 and last4 in dep_digits:
            score += 50
            primary_match = True
            reasons.append("차량뒤4자리")
        if phone4 and phone4 in dep_digits:
            score += 30
            primary_match = True
            reasons.append("전화뒤4자리")
        if mgmt and mgmt in text:
            score += 70
            primary_match = True
            reasons.append("관리번호일치")

        # 금액은 보조 점수다. 금액만 맞는 회원은 후보 제외.
        if amount == arrears:
            score += 25
            reasons.append("금액일치")
        elif amount and arrears and amount < arrears:
            score += 8
            reasons.append("부분납부가능")
        elif amount and arrears and amount > arrears:
            score += 4
            reasons.append("초과입금확인")

        if not primary_match:
            continue

        out.append(Candidate(member=member, score=score, reasons=reasons, arrears_amount=arrears, diff=amount - arrears))

    out.sort(key=lambda c: (c.score, -abs(c.diff), c.arrears_amount), reverse=True)
    return out[:8]


def _is_auto_candidate(c: Candidate, candidates: list[Candidate]) -> bool:
    reasons = set(c.reasons)
    if len(candidates) != 1:
        # 이름+차량번호가 동시에 맞는 명확한 1순위는 자동 후보로 둔다.
        if not ({"이름일치", "차량뒤4자리"} <= reasons and all(x.score < c.score for x in candidates[1:])):
            return False
    if {"이름일치", "차량뒤4자리"} <= reasons:
        return True
    if "관리번호일치" in reasons and len(candidates) == 1:
        return True
    if {"이름일치", "금액일치"} <= reasons and len(candidates) == 1:
        return True
    return False


def _display_status(deposit: Deposit, candidates: list[Candidate]) -> str:
    if deposit.status in {"매칭완료", "반영완료", "제외"}:
        return deposit.status
    if not candidates:
        return "미매칭"
    top = candidates[0]
    same_top = [c for c in candidates if c.score == top.score]
    if len(same_top) > 1:
        return "중복후보"
    if _is_auto_candidate(top, candidates):
        return "자동매칭"
    return "후보확인"


@router.get("")
def list_deposits(
    status: str | None = Query(None, description="대기/자동매칭/후보확인/중복후보/미매칭/매칭완료/제외"),
    page: int = 1,
    size: int = 500,
    db: Session = Depends(get_db),
):
    stmt = select(Deposit).order_by(Deposit.deposit_date.desc(), Deposit.id.desc()).offset((page - 1) * size).limit(size)
    deposits = db.scalars(stmt).all()
    members = db.scalars(select(Member).options(selectinload(Member.receivable_items)).where(Member.status == "정상")).unique().all()

    rows = []
    for d in deposits:
        candidates = _match_candidates(d, members) if d.status not in {"매칭완료", "제외"} else []
        group_candidate = _group_candidate_dict(d, members) if d.status not in {"매칭완료", "제외"} else None
        display_status = _display_status(d, candidates)
        if group_candidate:
            display_status = "묶음수납"
        if status and display_status != status and d.status != status:
            continue
        best = candidates[0] if candidates else None
        matched = next((m for m in members if m.id == d.matched_member_id), None) if d.matched_member_id else None
        if matched and not best:
            best = Candidate(matched, 999, ["반영완료"], _arrears_amount(matched), int(d.amount or 0) - _arrears_amount(matched))
        rows.append({
            "id": d.id,
            "deposit_date": _safe_deposit_date(d.deposit_date).isoformat(),
            "depositDate": _safe_deposit_date(d.deposit_date).isoformat(),
            "depositor_name": d.depositor_name,
            "depositorName": d.depositor_name,
            "amount": d.amount,
            "memo": d.memo,
            "status": display_status,
            "rawStatus": d.status,
            "matched_member_id": d.matched_member_id,
            "candidateId": (best.member.id if best else None),
            "is_excluded": d.is_excluded,
            "hint": d.hint,
            "matchStatus": display_status,
            "candidates": [_member_candidate_dict(c) for c in candidates],
            "groupCandidate": group_candidate,
            "groupCandidates": [group_candidate] if group_candidate else [],
            "bestCandidate": _member_candidate_dict(best) if best else None,
            "currentArrears": (group_candidate.get("expectedAmount") if group_candidate else best.arrears_amount if best else 0),
            "difference": (group_candidate.get("diff") if group_candidate else best.diff if best else None),
            "candidateCount": (1 if group_candidate else len(candidates)),
        })
    return rows


@router.post("/bulk")
def create_deposits(payload: dict = Body(...), db: Session = Depends(get_db)):
    """붙여넣기/수동입력 거래내역을 통장매칭 임시거래로 저장한다."""
    rows = payload.get("rows") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=400, detail="저장할 거래내역이 없습니다.")
    inserted = 0
    skipped = 0
    for row in rows:
        if not isinstance(row, dict):
            skipped += 1
            continue
        amount = row.get("amount") or row.get("입금액") or 0
        try:
            amount = int(re.sub(r"[^0-9\-]", "", str(amount)) or 0)
        except Exception:
            amount = 0
        if amount <= 0:
            skipped += 1
            continue
        d = Deposit(
            deposit_date=_parse_deposit_date(row.get("deposit_date") or row.get("depositDate") or row.get("거래일자")),
            depositor_name=_short(row.get("depositor_name") or row.get("depositorName") or row.get("입금자명") or row.get("memo") or row.get("거래기록사항"), 40) or "미확인",
            amount=amount,
            memo=_short(row.get("memo") or row.get("거래기록사항") or row.get("description") or row.get("거래내용"), 60),
            status="대기",
            is_excluded=False,
            hint="붙여넣기 입력",
        )
        db.add(d)
        inserted += 1
    db.commit()
    return {"ok": True, "inserted": inserted, "skipped": skipped}


@router.post("/{deposit_id}/match")
def match_deposit(deposit_id: int, payload: DepositMatch, db: Session = Depends(get_db)):
    deposit = db.get(Deposit, deposit_id)
    if deposit is None:
        raise HTTPException(status_code=404, detail="입금내역을 찾을 수 없습니다.")
    if deposit.is_excluded:
        raise HTTPException(status_code=400, detail="제외 처리된 입금건은 매칭할 수 없습니다.")
    stmt = select(Member).options(selectinload(Member.receivable_items)).where(Member.id == payload.member_id)
    member = db.scalar(stmt)
    if member is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    remain = int(deposit.amount or 0)
    charge_item = payload.charge_item or _infer_income_item(deposit, member)
    paid_date = _safe_deposit_date(deposit.deposit_date)

    # 협회가입비(가수금), 자격증명발급비(잡수입), 기타는 미수금 차감 없이 수납내역만 남긴다.
    if _is_non_arrears_income(charge_item):
        db.add(Payment(member_id=member.id, paid_for_ym=_ym_from_date(paid_date), charge_item=charge_item, amount=remain, method="통장매칭", paid_date=paid_date, deposit_id=deposit.id))
        deposit.status = "매칭완료"
        deposit.matched_member_id = member.id
        deposit.hint = f"{member.name} / {member.vehicle_no} / {charge_item}({_accounting_type(charge_item)}) {remain:,}원"
        db.add(MemberHistory(member_id=member.id, content=f"통장매칭 {charge_item}({_accounting_type(charge_item)}) 수납 {remain:,}원 / 미수금 차감 없음", actor="system"))
        db.commit()
        return {"ok": True, "deposit_id": deposit.id, "member_id": member.id, "applied": remain, "remain": 0, "non_arrears": True, "accounting_type": _accounting_type(charge_item)}

    applied = 0
    for item in _open_items(member):
        if remain <= 0:
            break
        pay_amount = min(remain, item.amount)
        if pay_amount <= 0:
            continue
        db.add(Payment(member_id=member.id, paid_for_ym=item.ym, charge_item=item.charge_item, amount=pay_amount, method="통장매칭", paid_date=paid_date, deposit_id=deposit.id))
        applied += pay_amount
        remain -= pay_amount
        if pay_amount >= item.amount:
            item.is_paid = True
        else:
            item.amount -= pay_amount
        member.last_payment_ym = item.ym

    # 미수 0원 회원도 납부 가능하다. 협회비/관리비 추가입금은 선납/추가입금 수납내역으로 남긴다.
    if applied <= 0 and remain > 0:
        db.add(Payment(member_id=member.id, paid_for_ym=_ym_from_date(paid_date), charge_item=charge_item, amount=remain, method="통장매칭", paid_date=paid_date, deposit_id=deposit.id))
        applied = remain
        remain = 0
        history = f"통장매칭 {charge_item} 선납/추가입금 {applied:,}원"
    else:
        history = f"통장매칭 수납 반영 {applied:,}원 (입금자 {deposit.depositor_name}, 차액 {remain:,}원)"

    deposit.status = "매칭완료"
    deposit.matched_member_id = member.id
    deposit.hint = f"{member.name} / {member.vehicle_no} / {charge_item} 반영 {applied:,}원"
    db.add(MemberHistory(member_id=member.id, content=history, actor="system"))
    db.commit()
    return {"ok": True, "deposit_id": deposit.id, "member_id": member.id, "applied": applied, "remain": remain}


@router.post("/{deposit_id}/income")
def match_deposit_income_only(deposit_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    """회원 선택 없이 잡수입/기타수입/가수금으로 입금건을 반영한다.

    협회비/관리비처럼 미수금을 차감하는 항목은 회원이 필수이므로 이 API에서 막는다.
    """
    deposit = db.get(Deposit, deposit_id)
    if deposit is None:
        raise HTTPException(status_code=404, detail="입금내역을 찾을 수 없습니다.")
    if deposit.is_excluded:
        raise HTTPException(status_code=400, detail="제외 처리된 입금건은 반영할 수 없습니다.")

    charge_item = (payload or {}).get("charge_item") or "기타"
    if not _is_non_arrears_income(charge_item):
        raise HTTPException(status_code=400, detail="협회비/관리비는 회원 선택 후 반영해야 합니다.")

    paid_date = _safe_deposit_date(deposit.deposit_date)
    amount = int(deposit.amount or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="입금액이 0원인 거래는 반영할 수 없습니다.")

    income_member = _ensure_income_member(db)
    db.add(Payment(
        member_id=income_member.id,
        paid_for_ym=_ym_from_date(paid_date),
        charge_item=charge_item,
        amount=amount,
        method="통장매칭",
        paid_date=paid_date,
        deposit_id=deposit.id,
    ))
    deposit.status = "매칭완료"
    deposit.matched_member_id = income_member.id
    deposit.hint = f"회원 없이 {charge_item}({_accounting_type(charge_item)}) {amount:,}원 반영"
    db.add(MemberHistory(member_id=income_member.id, content=f"통장매칭 회원외 {charge_item}({_accounting_type(charge_item)}) 수납 {amount:,}원", actor="system"))
    db.commit()
    return {"ok": True, "deposit_id": deposit.id, "member_id": income_member.id, "applied": amount, "remain": 0, "non_arrears": True, "income_only": True, "accounting_type": _accounting_type(charge_item)}




@router.post("/{deposit_id}/group-match")
def match_deposit_group(deposit_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    """대납자/묶음수납 반영: 입금 1건을 여러 회원 수납내역으로 나눠 저장한다."""
    deposit = db.get(Deposit, deposit_id)
    if deposit is None:
        raise HTTPException(status_code=404, detail="입금내역을 찾을 수 없습니다.")
    if deposit.is_excluded:
        raise HTTPException(status_code=400, detail="제외 처리된 입금건은 반영할 수 없습니다.")
    if deposit.status in {"매칭완료", "반영완료"}:
        raise HTTPException(status_code=400, detail="이미 반영된 입금건입니다.")

    members = db.scalars(select(Member).options(selectinload(Member.receivable_items)).where(Member.status == "정상")).unique().all()
    preset = None
    requested = (payload or {}).get("group_code")
    if requested:
        preset = next((p for p in GROUP_PAYER_PRESETS if p.get("code") == requested), None)
    if preset is None:
        preset = _find_group_preset(deposit)
    if preset is None:
        raise HTTPException(status_code=400, detail="등록된 대납자 묶음수납 사전과 일치하지 않습니다.")

    paid_date = _safe_deposit_date(deposit.deposit_date)
    applied_total = 0
    unresolved = []
    applied_rows = []
    for target in preset.get("targets", []):
        member = _find_member_for_group_target(target, members)
        amount = int(target.get("amount") or 0)
        if member is None:
            unresolved.append({"name": target.get("name"), "vehicle_last4": target.get("vehicle_last4"), "amount": amount})
            continue
        applied = _apply_member_amount(
            db,
            member,
            amount,
            target.get("charge_item") or member.charge_item or "협회비",
            paid_date,
            deposit,
            f"{preset.get('title') or preset.get('code')} 묶음수납 반영",
        )
        applied_total += applied
        applied_rows.append({"member_id": member.id, "name": member.name, "vehicle_no": member.vehicle_no, "amount": applied})

    if not applied_rows:
        raise HTTPException(status_code=400, detail="묶음수납 대상 회원을 찾지 못했습니다. 회원 원장/차량번호를 확인하세요.")

    deposit.status = "매칭완료"
    deposit.matched_member_id = applied_rows[0]["member_id"]
    expected = sum(int(x.get("amount") or 0) for x in preset.get("targets", []))
    deposit.hint = f"{preset.get('title') or preset.get('code')} 묶음수납 {applied_total:,}원 / 대상 {len(applied_rows)}명 / 차액 {int(deposit.amount or 0)-expected:,}원"
    db.commit()
    return {
        "ok": True,
        "deposit_id": deposit.id,
        "group_code": preset.get("code"),
        "group_title": preset.get("title"),
        "applied": applied_total,
        "applied_rows": applied_rows,
        "unresolved": unresolved,
        "diff": int(deposit.amount or 0) - expected,
    }


@router.post("/{deposit_id}/exclude")
def exclude_deposit(deposit_id: int, db: Session = Depends(get_db)):
    deposit = db.get(Deposit, deposit_id)
    if deposit is None:
        raise HTTPException(status_code=404, detail="입금내역을 찾을 수 없습니다.")
    deposit.status = "제외"
    deposit.is_excluded = True
    deposit.hint = "사용자 제외 처리"
    db.commit()
    return {"ok": True, "deposit_id": deposit.id, "status": deposit.status}

@router.delete("/pending")
def reset_pending_deposits(db: Session = Depends(get_db)):
    """통장매칭 화면의 거래 목록을 전부 비운다.

    사용자가 말하는 초기화는 필터 초기화가 아니라 화면의 매칭결과를 0건으로 만드는 것이다.
    이미 생성된 수납내역(Payment)은 보존하고 deposit 연결만 끊은 뒤 Deposit 원본을 삭제한다.
    """
    rows = db.scalars(select(Deposit)).all()
    count = len(rows)
    for payment in db.scalars(select(Payment).where(Payment.deposit_id.is_not(None))).all():
        payment.deposit_id = None
    for row in rows:
        db.delete(row)
    db.commit()
    return {"ok": True, "deleted": count}
