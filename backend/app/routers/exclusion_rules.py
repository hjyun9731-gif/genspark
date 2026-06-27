"""제외자/지로희망자 관리 라우터."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ExclusionRule

router = APIRouter(prefix="/api/members/exclusion-rules", tags=["exclusion_rules"])


class ExclusionRulePayload(BaseModel):
    exclusion_type: str | None = None
    exclusionType: str | None = None
    name: str | None = None
    vehicle_no: str | None = None
    vehicleNo: str | None = None
    mgmt_no: str | None = None
    mgmtNo: str | None = None
    phone: str | None = None
    sigun: str | None = None
    memo: str | None = None
    member_id: str | None = None
    memberId: str | None = None


def _rule_dict(r: ExclusionRule) -> dict:
    return {
        "id": r.id,
        "exclusionType": r.exclusion_type,
        "exclusion_type": r.exclusion_type,
        "name": r.name,
        "vehicleNo": r.vehicle_no,
        "vehicle_no": r.vehicle_no,
        "mgmtNo": r.mgmt_no,
        "mgmt_no": r.mgmt_no,
        "phone": r.phone,
        "sigun": r.sigun,
        "memo": r.memo,
        "memberId": r.member_id,
        "member_id": r.member_id,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("")
def list_exclusion_rules(db: Session = Depends(get_db)):
    stmt = select(ExclusionRule).order_by(ExclusionRule.exclusion_type, ExclusionRule.id)
    return [_rule_dict(r) for r in db.scalars(stmt).all()]


@router.post("")
def create_exclusion_rule(payload: ExclusionRulePayload, db: Session = Depends(get_db)):
    exc_type = payload.exclusion_type or payload.exclusionType
    if not exc_type:
        raise HTTPException(status_code=400, detail="제외유형은 필수입니다.")
    r = ExclusionRule(
        exclusion_type=exc_type,
        name=payload.name,
        vehicle_no=payload.vehicle_no or payload.vehicleNo,
        mgmt_no=payload.mgmt_no or payload.mgmtNo,
        phone=payload.phone,
        sigun=payload.sigun,
        memo=payload.memo,
        member_id=payload.member_id or payload.memberId,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _rule_dict(r)


@router.patch("/{rule_id}")
def update_exclusion_rule(rule_id: int, payload: ExclusionRulePayload, db: Session = Depends(get_db)):
    r = db.get(ExclusionRule, rule_id)
    if r is None:
        raise HTTPException(status_code=404, detail="제외 규칙을 찾을 수 없습니다.")
    exc_type = payload.exclusion_type or payload.exclusionType
    if exc_type is not None:
        r.exclusion_type = exc_type
    if payload.name is not None:
        r.name = payload.name
    vno = payload.vehicle_no or payload.vehicleNo
    if vno is not None:
        r.vehicle_no = vno
    mno = payload.mgmt_no or payload.mgmtNo
    if mno is not None:
        r.mgmt_no = mno
    if payload.phone is not None:
        r.phone = payload.phone
    if payload.sigun is not None:
        r.sigun = payload.sigun
    if payload.memo is not None:
        r.memo = payload.memo
    mid = payload.member_id or payload.memberId
    if mid is not None:
        r.member_id = mid
    db.commit()
    db.refresh(r)
    return _rule_dict(r)


@router.delete("/{rule_id}")
def delete_exclusion_rule(rule_id: int, db: Session = Depends(get_db)):
    r = db.get(ExclusionRule, rule_id)
    if r is None:
        raise HTTPException(status_code=404, detail="제외 규칙을 찾을 수 없습니다.")
    db.delete(r)
    db.commit()
    return {"ok": True, "deleted": True}
