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
        if arrears <= 0:
            continue

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
        display_status = _display_status(d, candidates)
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
            "bestCandidate": _member_candidate_dict(best) if best else None,
            "currentArrears": best.arrears_amount if best else 0,
            "difference": best.diff if best else None,
            "candidateCount": len(candidates),
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


def _apply_deposit_to_member(db: Session, deposit: Deposit, member: Member) -> dict:
    """통장 입금 1건을 회원 미수금에 반영한다.

    자동매칭 전체반영과 개별 반영이 같은 로직을 쓰도록 분리했다.
    여기서는 commit 하지 않는다. 호출자가 일괄 commit 한다.
    """
    if deposit is None or member is None:
        raise ValueError("deposit/member required")
    if deposit.is_excluded or deposit.status in {"매칭완료", "반영완료", "제외"}:
        raise ValueError("이미 처리된 입금건입니다.")

    remain = int(deposit.amount or 0)
    applied = 0
    for item in _open_items(member):
        if remain <= 0:
            break
        pay_amount = min(remain, int(item.amount or 0))
        if pay_amount <= 0:
            continue
        db.add(Payment(
            member_id=member.id,
            paid_for_ym=item.ym,
            charge_item=item.charge_item,
            amount=pay_amount,
            method="통장매칭",
            paid_date=_safe_deposit_date(deposit.deposit_date),
            deposit_id=deposit.id,
        ))
        applied += pay_amount
        remain -= pay_amount
        if pay_amount >= item.amount:
            item.is_paid = True
        else:
            item.amount -= pay_amount
        member.last_payment_ym = item.ym

    if applied <= 0:
        raise ValueError("반영할 미수금이 없습니다.")

    deposit.status = "매칭완료"
    deposit.matched_member_id = member.id
    deposit.hint = f"{member.name} / {member.vehicle_no} / 반영 {applied:,}원"
    db.add(MemberHistory(
        member_id=member.id,
        content=f"통장매칭 수납 반영 {applied:,}원 (입금자 {deposit.depositor_name}, 차액 {remain:,}원)",
        actor="system",
    ))
    return {"deposit_id": deposit.id, "member_id": member.id, "applied": applied, "remain": remain}


@router.post("/auto-match-all")
def auto_match_all(db: Session = Depends(get_db)):
    """현재 자동매칭으로 판정되는 입금건을 서버에서 일괄 반영한다.

    프론트가 수십/수백 건을 1건씩 연속 요청하면 화면이 멈추거나
    중간 실패 때 빈 화면처럼 보일 수 있어 서버 일괄 처리로 고정한다.
    """
    deposits = db.scalars(select(Deposit).order_by(Deposit.deposit_date.asc(), Deposit.id.asc())).all()
    members = db.scalars(
        select(Member).options(selectinload(Member.receivable_items)).where(Member.status == "정상")
    ).unique().all()

    applied_rows = []
    skipped_rows = []
    for deposit in deposits:
        if deposit.status in {"매칭완료", "반영완료", "제외"} or deposit.is_excluded:
            continue
        candidates = _match_candidates(deposit, members)
        if _display_status(deposit, candidates) != "자동매칭" or not candidates:
            continue
        best = candidates[0].member
        try:
            applied_rows.append(_apply_deposit_to_member(db, deposit, best))
        except Exception as exc:
            skipped_rows.append({"deposit_id": deposit.id, "reason": str(exc)})

    db.commit()
    return {
        "ok": True,
        "matched": len(applied_rows),
        "skipped": len(skipped_rows),
        "applied": applied_rows[:100],
        "skipped_rows": skipped_rows[:100],
    }


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

    try:
        result = _apply_deposit_to_member(db, deposit, member)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    db.commit()
    return {"ok": True, **result}


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
