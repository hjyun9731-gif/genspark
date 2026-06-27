"""신규·예정자 라우터 — 등록/수정/삭제/전체자명단 전환."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Member, MemberHistory, Pending
from ..schemas import PendingOut

router = APIRouter(prefix="/api/pending", tags=["pending"])


class PendingPayload(BaseModel):
    name: str | None = None
    vehicle_no: str | None = None
    vehicleNo: str | None = None
    phone: str | None = None
    address: str | None = None
    public_address: str | None = None
    publicAddress: str | None = None
    resident_no: str | None = None
    residentNo: str | None = None
    cert_issue_no: str | None = None
    certIssueNo: str | None = None
    doc_no: str | None = None
    docNo: str | None = None
    sigun: str | None = None
    member_type: str | None = None
    memberType: str | None = None
    membership: str | None = None
    reg_type: str | None = None
    regType: str | None = None
    kind: str | None = None         # 신규/예정 (프론트 UI 구분값, reg_type으로 저장)
    reason: str | None = None       # 확인사항/비고 (note 내 비고: 로 저장)
    cert_issue_date: date | None = None
    certIssueDate: date | None = None
    billing_start_ym: str | None = None
    billingStartYm: str | None = None
    mgmt_no: str | None = None
    mgmtNo: str | None = None
    note: str | None = None
    step: str | None = None


class PromotePayload(BaseModel):
    mgmt_no: str | None = None
    mgmtNo: str | None = None
    membership: str | None = None
    member_type: str | None = None
    memberType: str | None = None
    monthly_charge: int | None = None
    monthlyCharge: int | None = None
    charge_item: str | None = None
    chargeItem: str | None = None
    billing_start_ym: str | None = None
    billingStartYm: str | None = None
    phone: str | None = None
    address: str | None = None
    public_address: str | None = None
    publicAddress: str | None = None
    resident_no: str | None = None
    residentNo: str | None = None
    cert_issue_no: str | None = None
    certIssueNo: str | None = None
    doc_no: str | None = None
    docNo: str | None = None
    note: str | None = None


def _next_member_id(db: Session) -> str:
    rows = db.scalars(select(Member.id).where(Member.id.like("M%"))).all()
    max_no = 0
    for mid in rows:
        try:
            max_no = max(max_no, int(str(mid).replace("M", "")))
        except Exception:
            pass
    return f"M{max_no + 1:05d}"


def _next_mgmt_no(db: Session) -> str:
    yy = str(date.today().year)[2:]
    prefix = f"신{yy}-"
    rows = db.scalars(select(Member.mgmt_no).where(Member.mgmt_no.like(prefix + "%"))).all()
    rows += [p for p in db.scalars(select(Pending.mgmt_no).where(Pending.mgmt_no.like(prefix + "%"))).all() if p]
    max_no = 0
    for no in rows:
        try:
            max_no = max(max_no, int(str(no).split("-")[-1]))
        except Exception:
            pass
    return f"{prefix}{max_no + 1:03d}"


def _billing_start_date(d: date | None) -> date:
    d = d or date.today()
    y, m = d.year, d.month + 1
    if m == 13:
        y += 1
        m = 1
    import calendar
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


def _charge_item(membership: str) -> str:
    return "협회비" if membership == "협회가입" else "관리비"


def _monthly_charge(membership: str) -> int:
    return 10000 if membership == "협회가입" else 5000



def _extract_note_field(note: str | None, label: str) -> str | None:
    import re
    if not note:
        return None
    m = re.search(rf"(?:^|\s*/\s*){re.escape(label)}\s*:\s*([^/]+)", note)
    if m:
        v = m.group(1).strip()
        return v if v else None
    return None


def _pending_note(payload: PendingPayload) -> str | None:
    parts = []
    for label, value in [
        ("주소", payload.address),
        ("공문 주소", payload.public_address or payload.publicAddress),
        ("주민등록번호", payload.resident_no or payload.residentNo),
        ("자격증명 발급번호", payload.cert_issue_no or payload.certIssueNo),
        ("공문/접수번호", payload.doc_no or payload.docNo),
        ("비고", payload.reason or payload.note),
    ]:
        if value:
            parts.append(f"{label}:{value}")
    return " / ".join(parts) if parts else None

def _pending_dict(p: Pending) -> dict:
    billing_start = _billing_start_date(p.cert_issue_date) if p.cert_issue_date else None
    monthly = 10000 if p.membership == "협회가입" else 5000
    # kind: reg_type이 "신규"/"예정"이면 그대로, 아니면 "신규"로 표시
    kind = p.reg_type if p.reg_type in ("신규", "예정") else "신규"
    return {
        "id": p.id,
        "name": p.name,
        "vehicle_no": p.vehicle_no,
        "vehicleNo": p.vehicle_no,
        "phone": p.phone,
        "sigun": p.sigun,
        "member_type": p.member_type,
        "memberType": p.member_type,
        "membership": p.membership,
        "reg_type": p.reg_type,
        "regType": p.reg_type,
        "kind": kind,
        "cert_issue_date": p.cert_issue_date.isoformat() if p.cert_issue_date else None,
        "certIssueDate": p.cert_issue_date.isoformat() if p.cert_issue_date else None,
        "step": p.step,
        "step_index": p.step_index,
        "stepIndex": p.step_index,
        "mgmt_no": p.mgmt_no,
        "mgmtNo": p.mgmt_no,
        "expected_charge": p.expected_charge,
        "expectedCharge": p.expected_charge,
        "monthlyCharge": monthly,
        "monthly_charge": monthly,
        "billingStartDate": billing_start.isoformat() if billing_start else None,
        "billingStartYm": billing_start.strftime("%Y-%m") if billing_start else None,
        "billing_start_ym": billing_start.strftime("%Y-%m") if billing_start else None,
        "note": p.note,
        "address": _extract_note_field(p.note, "주소"),
        "public_address": _extract_note_field(p.note, "공문 주소"),
        "resident_no": _extract_note_field(p.note, "주민등록번호"),
        "cert_issue_no": _extract_note_field(p.note, "자격증명 발급번호"),
        "doc_no": _extract_note_field(p.note, "공문/접수번호"),
        "reason": _extract_note_field(p.note, "비고"),
        "promoted_member_id": p.promoted_member_id,
        "promotedMemberId": p.promoted_member_id,
    }


@router.get("")
def list_pending(db: Session = Depends(get_db)):
    stmt = select(Pending).order_by(Pending.step_index, Pending.created_at.desc())
    return [_pending_dict(p) for p in db.scalars(stmt).all()]


@router.post("")
def create_pending(payload: PendingPayload, db: Session = Depends(get_db)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="이름은 필수입니다.")
    cert_date = payload.cert_issue_date or payload.certIssueDate
    membership = payload.membership or "협회미가입"
    # kind(신규/예정) → reg_type으로 저장
    reg_type = payload.reg_type or payload.regType or payload.kind or "신규"
    p = Pending(
        name=name,
        vehicle_no=payload.vehicle_no or payload.vehicleNo,
        phone=payload.phone,
        sigun=payload.sigun or "춘천시",
        member_type=payload.member_type or payload.memberType or "택배",
        membership=membership,
        reg_type=reg_type,
        cert_issue_date=cert_date,
        step=payload.step or "예정자 등록",
        step_index=1,
        mgmt_no=payload.mgmt_no or payload.mgmtNo,
        expected_charge=_charge_item(membership),
        note=_pending_note(payload),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _pending_dict(p)


@router.patch("/{pending_id}")
def update_pending(pending_id: int, payload: PendingPayload, db: Session = Depends(get_db)):
    p = db.get(Pending, pending_id)
    if p is None:
        raise HTTPException(status_code=404, detail="예정자를 찾을 수 없습니다.")
    new_reg_type = payload.reg_type or payload.regType or payload.kind
    for attr, val in [
        ("name", payload.name),
        ("vehicle_no", payload.vehicle_no or payload.vehicleNo),
        ("phone", payload.phone),
        ("sigun", payload.sigun),
        ("member_type", payload.member_type or payload.memberType),
        ("membership", payload.membership),
        ("reg_type", new_reg_type),
        ("cert_issue_date", payload.cert_issue_date or payload.certIssueDate),
        ("mgmt_no", payload.mgmt_no or payload.mgmtNo),
        ("step", payload.step),
    ]:
        if val is not None:
            setattr(p, attr, val)
    # note 재구성: address, public_address, reason 등 구조화 필드가 있으면 재조합
    new_note = _pending_note(payload)
    if new_note is not None:
        p.note = new_note
    elif payload.note is not None:
        p.note = payload.note
    p.expected_charge = _charge_item(p.membership)
    db.commit()
    db.refresh(p)
    return _pending_dict(p)


@router.delete("/{pending_id}")
def delete_pending(pending_id: int, db: Session = Depends(get_db)):
    p = db.get(Pending, pending_id)
    if p is None:
        raise HTTPException(status_code=404, detail="예정자를 찾을 수 없습니다.")
    db.delete(p)
    db.commit()
    return {"ok": True, "deleted": True}


@router.post("/{pending_id}/promote")
def promote_pending(pending_id: int, payload: PromotePayload | None = None, db: Session = Depends(get_db)):
    payload = payload or PromotePayload()
    p = db.get(Pending, pending_id)
    if p is None:
        raise HTTPException(status_code=404, detail="예정자를 찾을 수 없습니다.")
    if p.promoted_member_id:
        raise HTTPException(status_code=400, detail="이미 전체자명단으로 전환된 예정자입니다.")

    membership = payload.membership or p.membership
    member_type = payload.member_type or payload.memberType or p.member_type
    cert_date = p.cert_issue_date or date.today()
    charge_item = payload.charge_item or payload.chargeItem or _charge_item(membership)
    monthly_charge = payload.monthly_charge or payload.monthlyCharge or _monthly_charge(membership)
    billing_start_ym = payload.billing_start_ym or payload.billingStartYm or _billing_start_date(cert_date).strftime("%Y-%m")
    mgmt_no = payload.mgmt_no or payload.mgmtNo or p.mgmt_no or _next_mgmt_no(db)

    if db.scalar(select(Member).where(Member.mgmt_no == mgmt_no)):
        raise HTTPException(status_code=400, detail="이미 사용 중인 관리번호입니다.")

    member = Member(
        id=_next_member_id(db),
        mgmt_no=mgmt_no,
        reg_type=p.reg_type or "신규",
        name=p.name,
        vehicle_no=p.vehicle_no or "",
        phone=payload.phone or p.phone,
        sigun=p.sigun,
        region_raw=p.region_raw,
        member_type=member_type,
        membership=membership,
        cert_issue_date=cert_date,
        assoc_join_date=cert_date if membership == "협회가입" else None,
        billing_start_ym=billing_start_ym,
        charge_item=charge_item,
        monthly_charge=monthly_charge,
        status="정상",
        memo=payload.note or p.note,
    )
    db.add(member)
    db.flush()
    p.step = "전환완료"
    p.step_index = 9
    p.promoted_member_id = member.id
    p.mgmt_no = mgmt_no
    db.add(MemberHistory(member_id=member.id, content=f"예정자에서 전체자명단 전환 / 부과시작 {billing_start_ym}", actor="system"))
    db.commit()
    return {"ok": True, "member_id": member.id, "memberId": member.id, "pending": _pending_dict(p)}
