"""통장매칭 라우터 — 입금내역 조회 + 자동후보/수동매칭/묶음수납/제외."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Deposit, Member, MemberHistory, Payment
from ..schemas import DepositMatch

router = APIRouter(prefix="/api/deposits", tags=["deposits"])

NON_ARREARS_INCOME_ITEMS = {"협회가입비", "자격증명발급비", "기타", "선납/초과입금"}


def _accounting_type(charge_item: str | None) -> str:
    if charge_item == "협회가입비":
        return "가수금"
    if charge_item == "자격증명발급비":
        return "잡수입"
    if charge_item == "기타":
        return "기타수입"
    if charge_item == "선납/초과입금":
        return "선납"
    return "회비수입"


def _is_non_arrears_income(charge_item: str | None) -> bool:
    return (charge_item or "") in NON_ARREARS_INCOME_ITEMS


def _safe_deposit_date(d: date | None) -> date:
    if not d:
        return date.today()
    yy = d.year % 100
    if d.year > date.today().year and 1 <= yy <= 31 and 1 <= d.day <= 31:
        try:
            return date(2000 + d.day, d.month, yy)
        except Exception:
            return d
    return d


def _ym_from_date(d: date | None) -> str:
    return _safe_deposit_date(d).strftime("%Y-%m")


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


def _digits(text: str | None) -> str:
    return re.sub(r"\D", "", text or "")


def _vehicle_last4(vehicle_no: str | None) -> str:
    d = _digits(vehicle_no)
    return d[-4:] if len(d) >= 4 else ""


def _name_norm(text: str | None) -> str:
    return re.sub(r"\s+", "", text or "").lower()


def _text_for_match(deposit: Deposit) -> str:
    return _name_norm(f"{deposit.depositor_name or ''} {deposit.memo or ''}")


def _open_items(member: Member):
    return sorted([x for x in member.receivable_items if (not x.is_paid) and int(x.amount or 0) > 0], key=lambda x: x.ym)


def _arrears_amount(member: Member) -> int:
    return int(sum(int(x.amount or 0) for x in _open_items(member)))


def _current_balance(member: Member) -> int:
    # 선납(-5,000)도 통장매칭/미수금명단에서 빠지면 안 된다.
    return int(sum(int(x.amount or 0) for x in member.receivable_items if not x.is_paid and int(x.amount or 0) != 0))


def _visible_bank_memo(text: str | None) -> str:
    """통장매칭 화면에는 미수금 파일의 비고만 보여준다.

    주소/사업자등록번호/공문주소/붙여넣기 입력/관리번호 같은 잡메모는 표시하지 않는다.
    imports.py에서 저장한 "미수금 비고: ..." 라인만 노출한다.
    """
    raw = str(text or "")
    lines = []
    for line in re.split(r"[\n\r]+", raw):
        s = line.strip()
        if not s:
            continue
        if s.startswith("미수금 비고"):
            lines.append(s)
    return " / ".join(lines[:3])


def _memo_aliases(text: str | None) -> list[str]:
    raw = _visible_bank_memo(text) or str(text or "").strip()
    if not raw:
        return []

    blocked = {
        "이체", "계좌", "계좌적기", "계좌번호적기", "지로", "지로x", "전화", "문자", "결번",
        "반송", "확인", "입금", "납부", "수납", "자동", "수동", "메모", "비고",
        "15일이체", "20일이체", "25일이체", "1일이체", "5일이체", "10일이체",
        "cms", "자동이체", "신평", "주신평", "붙여넣기입력",
    }
    out: list[str] = []
    parts = re.split(r"[,/|;·\n\r]+", raw)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if re.match(r"^(주소|사업자등록번호|소속업체|공문\s*주소|대리인|구조변경|전화\s*메모|관리번호)\s*[:：]", part):
            continue
        part = re.sub(r"^(미수금\s*비고|원장\s*비고|비고|비고2|비고3)\s*[:：]", "", part, flags=re.I).strip()
        part = re.sub(r"^(공|입금자|입금|이체|대리|대표)\s*[:：-]?", "", part.strip(), flags=re.I).strip()
        norm = _name_norm(part)
        norm = re.sub(r"[()\[\]{}:：'\"`~!@#$%^&*_+=<>?\-]", "", norm)
        if len(norm) < 2 or norm in blocked:
            continue
        # 숫자만/주소처럼 긴 내용은 별칭 제외
        if re.fullmatch(r"\d+", norm):
            continue
        if any(k in norm for k in ["사업자등록번호", "주소", "강원", "춘천", "원주", "강릉"] ) and len(norm) > 8:
            continue
        if norm not in [_name_norm(x) for x in out]:
            out.append(part)
    return out[:8]


def _infer_income_item(deposit: Deposit, member: Member | None = None) -> str:
    text = f"{deposit.depositor_name or ''} {deposit.memo or ''}"
    if any(k in text for k in ["가입비", "협회가입", "신규가입"]):
        return "협회가입비"
    if any(k in text for k in ["자격증명", "증명발급", "발급비", "재발급"]):
        return "자격증명발급비"
    return (member.charge_item if member and member.charge_item else "관리비")


@dataclass
class Candidate:
    member: Member
    score: int
    reasons: list[str]
    arrears_amount: int
    diff: int


def _member_candidate_dict(c: Candidate) -> dict:
    m = c.member
    memo = _visible_bank_memo(m.memo)
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
        "memo": memo,
        "note": memo,
        "arrears_amount": c.arrears_amount,
        "totalArrears": c.arrears_amount,
        "diff": c.diff,
        "score": c.score,
        "reasons": c.reasons,
        "reason": " · ".join(c.reasons),
    }


# 허장덕/조철만/주신평/합동 대납 묶음. 금액이 다르면 가장 가까운 묶음을 후보로 잡는다.
GROUP_PAYER_PRESETS = [
    {
        "code": "조철만",
        "title": "조철만 · 합동",
        "aliases": ["조철만", "합동1", "합동", "화물유지계약"],
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
        "title": "허장덕 · 합동",
        "aliases": ["허장덕", "합동2", "합동", "화물유지계약"],
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
        "title": "주신평 · 합동/3개월분",
        "aliases": ["주신평", "주신평3개월", "주신평(3개월)", "합동", "화물유지계약"],
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
    matched.sort(key=lambda p: abs(amount - int(p.get("expected_amount") or 0)))
    return matched[0]


def _find_member_for_group_target(target: dict, members: list[Member]) -> Member | None:
    target_name = _name_norm(target.get("name"))
    target_last4 = _digits(target.get("vehicle_last4"))[-4:]
    exact, by_last4, by_name = [], [], []
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
        bal = _current_balance(m) if m else 0
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
            "currentArrears": bal,
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
        "reason": "대납자/합동 묶음수납 사전 일치",
    }


def _match_candidates(deposit: Deposit, members: list[Member]) -> list[Candidate]:
    text = _text_for_match(deposit)
    dep_digits = _digits(text)
    amount = int(deposit.amount or 0)
    out: list[Candidate] = []
    for member in members:
        if member.status != "정상":
            continue
        bal = _current_balance(member)
        score = 0
        reasons: list[str] = []
        primary_match = False

        nm = _name_norm(member.name)
        last4 = _vehicle_last4(member.vehicle_no)
        phone4 = _digits(member.phone)[-4:] if member.phone else ""
        mgmt = _name_norm(member.mgmt_no)
        memo_aliases = _memo_aliases(member.memo)

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
        for alias in memo_aliases:
            alias_norm = _name_norm(alias)
            if alias_norm and (alias_norm in text or text in alias_norm):
                score += 62
                primary_match = True
                reasons.append(f"미수금비고일치:{alias}")
                break

        if bal > 0:
            if amount == bal:
                score += 25
                reasons.append("금액일치")
            elif amount and amount < bal:
                score += 8
                reasons.append("부분납부가능")
            elif amount and amount > bal:
                score += 4
                reasons.append("초과입금확인")
        elif bal < 0:
            score += 6
            reasons.append("선납회원")
        else:
            score += 2
            reasons.append("0원회원")

        if not primary_match:
            continue
        out.append(Candidate(member=member, score=score, reasons=reasons, arrears_amount=bal, diff=amount - bal))

    out.sort(key=lambda c: (c.score, -abs(c.diff), c.arrears_amount), reverse=True)
    return out[:8]


def _is_auto_candidate(c: Candidate, candidates: list[Candidate]) -> bool:
    reasons = set(c.reasons)
    if len(candidates) != 1:
        if not ({"이름일치", "차량뒤4자리"} <= reasons and all(x.score < c.score for x in candidates[1:])):
            return False
    if {"이름일치", "차량뒤4자리"} <= reasons:
        return True
    if "관리번호일치" in reasons and len(candidates) == 1:
        return True
    if {"이름일치", "금액일치"} <= reasons and len(candidates) == 1:
        return True
    return False


def _display_status(deposit: Deposit, candidates: list[Candidate], group_candidate: dict | None = None) -> str:
    if deposit.status in {"매칭완료", "반영완료", "제외"}:
        return deposit.status
    if group_candidate:
        return "후보확인"
    if not candidates:
        return "미매칭"
    top = candidates[0]
    same_top = [c for c in candidates if c.score == top.score]
    if len(same_top) > 1:
        return "중복후보"
    if _is_auto_candidate(top, candidates):
        return "자동매칭"
    return "후보확인"


def _apply_member_amount(db: Session, member: Member, amount: int, charge_item: str, paid_date: date, deposit: Deposit, note: str) -> int:
    remain = max(0, int(amount or 0))
    applied = 0
    if not _is_non_arrears_income(charge_item):
        for item in _open_items(member):
            if remain <= 0:
                break
            pay_amount = min(remain, int(item.amount or 0))
            if pay_amount <= 0:
                continue
            db.add(Payment(member_id=member.id, paid_for_ym=item.ym, charge_item=item.charge_item, amount=pay_amount, method="통장매칭", paid_date=paid_date, deposit_id=deposit.id))
            applied += pay_amount
            remain -= pay_amount
            if pay_amount >= int(item.amount or 0):
                item.is_paid = True
            else:
                item.amount = int(item.amount or 0) - pay_amount
            member.last_payment_ym = item.ym
    if remain > 0:
        # 미수보다 큰 금액, 선납/0원 회원, 또는 잡수입/가수금은 기록만 남긴다.
        item_label = charge_item if _is_non_arrears_income(charge_item) else "선납/초과입금"
        db.add(Payment(member_id=member.id, paid_for_ym=_ym_from_date(paid_date), charge_item=item_label, amount=remain, method="통장매칭", paid_date=paid_date, deposit_id=deposit.id))
        applied += remain
    db.add(MemberHistory(member_id=member.id, content=f"{note}: {applied:,}원", actor="system"))
    return applied


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
        group_candidate = _group_candidate_dict(d, members) if d.status not in {"매칭완료", "제외"} else None
        candidates = [] if group_candidate else (_match_candidates(d, members) if d.status not in {"매칭완료", "제외"} else [])
        display_status = _display_status(d, candidates, group_candidate)
        if status and display_status != status and d.status != status:
            continue
        best = candidates[0] if candidates else None
        matched = next((m for m in members if m.id == d.matched_member_id), None) if d.matched_member_id else None
        if matched and not best:
            bal = _current_balance(matched)
            best = Candidate(matched, 999, ["반영완료"], bal, int(d.amount or 0) - bal)
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
            "groupCandidate": group_candidate,
            "groupCandidates": [group_candidate] if group_candidate else [],
            "currentArrears": group_candidate.get("expectedAmount") if group_candidate else (best.arrears_amount if best else 0),
            "difference": group_candidate.get("diff") if group_candidate else (best.diff if best else None),
            "candidateCount": 1 if group_candidate else len(candidates),
        })
    return rows


@router.post("/bulk")
def create_deposits(payload: dict = Body(...), db: Session = Depends(get_db)):
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


def _apply_deposit_to_member(db: Session, deposit: Deposit, member: Member, charge_item: str | None = None) -> dict:
    if deposit is None or member is None:
        raise ValueError("deposit/member required")
    if deposit.is_excluded or deposit.status in {"매칭완료", "반영완료", "제외"}:
        raise ValueError("이미 처리된 입금건입니다.")

    paid_date = _safe_deposit_date(deposit.deposit_date)
    item_label = charge_item or _infer_income_item(deposit, member)
    applied = _apply_member_amount(
        db,
        member,
        int(deposit.amount or 0),
        item_label,
        paid_date,
        deposit,
        f"통장매칭 {item_label} 반영",
    )
    deposit.status = "매칭완료"
    deposit.matched_member_id = member.id
    deposit.hint = f"{member.name} / {member.vehicle_no} / {item_label}({_accounting_type(item_label)}) {applied:,}원"
    return {"deposit_id": deposit.id, "member_id": member.id, "applied": applied, "remain": 0, "charge_item": item_label, "accounting_type": _accounting_type(item_label)}


@router.post("/auto-match-all")
def auto_match_all(db: Session = Depends(get_db)):
    deposits = db.scalars(select(Deposit).order_by(Deposit.deposit_date.asc(), Deposit.id.asc())).all()
    members = db.scalars(select(Member).options(selectinload(Member.receivable_items)).where(Member.status == "정상")).unique().all()

    applied_rows = []
    skipped_rows = []
    for deposit in deposits:
        if deposit.status in {"매칭완료", "반영완료", "제외"} or deposit.is_excluded:
            continue
        # 묶음수납은 자동 전체반영에서 제외한다. 사람이 확인 후 묶음반영해야 안전하다.
        if _group_candidate_dict(deposit, members):
            skipped_rows.append({"deposit_id": deposit.id, "reason": "묶음수납 후보는 확인 후 반영"})
            continue
        candidates = _match_candidates(deposit, members)
        if _display_status(deposit, candidates) != "자동매칭" or not candidates:
            continue
        try:
            applied_rows.append(_apply_deposit_to_member(db, deposit, candidates[0].member))
        except Exception as exc:
            skipped_rows.append({"deposit_id": deposit.id, "reason": str(exc)})

    db.commit()
    return {"ok": True, "matched": len(applied_rows), "skipped": len(skipped_rows), "applied": applied_rows[:100], "skipped_rows": skipped_rows[:100]}


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
        result = _apply_deposit_to_member(db, deposit, member, payload.charge_item)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    db.commit()
    return {"ok": True, **result}


@router.post("/{deposit_id}/group-match")
def match_deposit_group(deposit_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    deposit = db.get(Deposit, deposit_id)
    if deposit is None:
        raise HTTPException(status_code=404, detail="입금내역을 찾을 수 없습니다.")
    if deposit.is_excluded:
        raise HTTPException(status_code=400, detail="제외 처리된 입금건은 반영할 수 없습니다.")
    if deposit.status in {"매칭완료", "반영완료"}:
        raise HTTPException(status_code=400, detail="이미 반영된 입금건입니다.")
    members = db.scalars(select(Member).options(selectinload(Member.receivable_items)).where(Member.status == "정상")).unique().all()
    requested = (payload or {}).get("group_code")
    preset = next((p for p in GROUP_PAYER_PRESETS if p.get("code") == requested), None) if requested else None
    if preset is None:
        preset = _find_group_preset(deposit)
    if preset is None:
        raise HTTPException(status_code=400, detail="등록된 대납자/합동 묶음수납 사전과 일치하지 않습니다.")

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
        applied = _apply_member_amount(db, member, amount, target.get("charge_item") or member.charge_item or "협회비", paid_date, deposit, f"{preset.get('title') or preset.get('code')} 묶음수납")
        applied_total += applied
        applied_rows.append({"member_id": member.id, "name": member.name, "vehicle_no": member.vehicle_no, "amount": applied})
    if not applied_rows:
        raise HTTPException(status_code=400, detail="묶음수납 대상 회원을 찾지 못했습니다. 회원 원장/차량번호를 확인하세요.")
    deposit.status = "매칭완료"
    deposit.matched_member_id = applied_rows[0]["member_id"]
    expected = sum(int(x.get("amount") or 0) for x in preset.get("targets", []))
    deposit.hint = f"{preset.get('title') or preset.get('code')} 묶음수납 {applied_total:,}원 / 대상 {len(applied_rows)}명 / 차액 {int(deposit.amount or 0)-expected:,}원"
    db.commit()
    return {"ok": True, "deposit_id": deposit.id, "group_code": preset.get("code"), "group_title": preset.get("title"), "applied": applied_total, "applied_rows": applied_rows, "unresolved": unresolved, "diff": int(deposit.amount or 0) - expected}


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
    rows = db.scalars(select(Deposit)).all()
    count = len(rows)
    for payment in db.scalars(select(Payment).where(Payment.deposit_id.is_not(None))).all():
        payment.deposit_id = None
    for row in rows:
        db.delete(row)
    db.commit()
    return {"ok": True, "deleted": count}
