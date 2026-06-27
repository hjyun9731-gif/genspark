"""폐업현황 라우터 — 처리 이력/수정/복귀/삭제."""

import math
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Closure, MemberHistory, Member

router = APIRouter(prefix="/api/closures", tags=["closures"])


def _memo_field(memo: str | None, labels: list[str]) -> str | None:
    raw = str(memo or "")
    for label in labels:
        m = re.search(rf"(?:^|\s*/\s*){re.escape(label)}\s*[:：]\s*([^/]+)", raw)
        if m and m.group(1).strip():
            return m.group(1).strip()[:300]
    return None


def _closure_unpaid_info(m: Member | None) -> tuple[int, str, int]:
    if not m:
        return 0, "-", 0
    items = [x for x in (m.receivable_items or []) if (not x.is_paid) and int(x.amount or 0) > 0]
    total = int(sum(int(x.amount or 0) for x in items))
    item_names = sorted({(x.charge_item or m.charge_item or "미분류") for x in items})
    monthly = int(m.monthly_charge or 0)
    amount_months = math.ceil(total / monthly) if monthly > 0 and total > 0 else 0
    return total, "/".join(item_names) if item_names else (m.charge_item or "-"), max(len(items), amount_months)



class ClosureStatusUpdate(BaseModel):
    type: str | None = None
    collect_status: str | None = None
    memo: str | None = None


class ClosureUpdate(BaseModel):
    type: str | None = None
    process_date: str | None = None
    doc_no: str | None = None
    content: str | None = None
    unpaid_balance: int | None = None
    notify_later: bool | None = None


def _closure_dict(c: Closure) -> dict:
    m = c.member
    calc_unpaid, unpaid_item, unpaid_months = _closure_unpaid_info(m)
    collect_st = getattr(c, "collect_status", None) or "안내전"
    last_notice = getattr(c, "last_notice_date", None)
    return {
        "id": c.id,
        "member_id": c.member_id,
        "memberId": c.member_id,
        "name": m.name if m else "",
        "vehicleNo": m.vehicle_no if m else "",
        "vehicle_no": m.vehicle_no if m else "",
        "mgmtNo": m.mgmt_no if m else "",
        "mgmt_no": m.mgmt_no if m else "",
        "sigun": m.sigun if m else "",
        "phone": m.phone if m else "",
        "address": _memo_field(m.memo if m else "", ["주소", "주 소"]),
        "publicAddress": _memo_field(m.memo if m else "", ["공문 주소", "공문주소"]),
        "memberType": m.member_type if m else "",
        "membership": m.membership if m else "",
        "birthYear": m.birth_year if m else None,
        "certIssueDate": m.cert_issue_date.isoformat() if (m and m.cert_issue_date) else "",
        "assocJoinDate": m.assoc_join_date.isoformat() if (m and m.assoc_join_date) else "",
        "memo": m.memo if m else "",
        "type": c.type,
        "processDate": c.process_date.isoformat() if c.process_date else "",
        "process_date": c.process_date.isoformat() if c.process_date else "",
        "docNo": c.doc_no,
        "doc_no": c.doc_no,
        "content": c.content,
        "unpaidBalance": int(c.unpaid_balance or calc_unpaid or 0),
        "unpaid_balance": int(c.unpaid_balance or calc_unpaid or 0),
        "unpaidItem": unpaid_item,
        "unpaid_item": unpaid_item,
        "unpaidItems": unpaid_item,
        "unpaidMonths": unpaid_months,
        "unpaid_months": unpaid_months,
        "unpaidPeriod": f"{unpaid_months}개월" if unpaid_months > 0 else "—",
        "collectStatus": collect_st,
        "collect_status": collect_st,
        "lastNoticeDate": last_notice.isoformat() if last_notice else None,
        "last_notice_date": last_notice.isoformat() if last_notice else None,
        "notifyLater": c.notify_later,
        "notify_later": c.notify_later,
        "memberStatus": m.status if m else "",
    }


@router.get("")
def list_closures(page: int = 1, size: int = 5000, db: Session = Depends(get_db)):
    stmt = (
        select(Closure)
        .options(selectinload(Closure.member).selectinload(Member.receivable_items))
        .order_by(Closure.process_date.desc(), Closure.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    return [_closure_dict(c) for c in db.scalars(stmt).all()]


@router.patch("/{closure_id}")
def update_closure(closure_id: int, payload: ClosureUpdate, db: Session = Depends(get_db)):
    c = db.get(Closure, closure_id)
    if c is None:
        raise HTTPException(status_code=404, detail="폐업/이탈 기록을 찾을 수 없습니다.")
    if payload.type is not None:
        c.type = payload.type
        if c.member:
            c.member.status = payload.type
    if payload.process_date is not None:
        from datetime import date
        c.process_date = date.fromisoformat(payload.process_date)
    if payload.doc_no is not None:
        c.doc_no = payload.doc_no
    if payload.content is not None:
        c.content = payload.content
    if payload.unpaid_balance is not None:
        c.unpaid_balance = int(payload.unpaid_balance or 0)
    if payload.notify_later is not None:
        c.notify_later = bool(payload.notify_later)
    db.add(MemberHistory(member_id=c.member_id, content=f"폐업/이탈 기록 수정: {c.type} / 잔액 {c.unpaid_balance:,}원", actor="system"))
    db.commit()
    db.refresh(c)
    return {"ok": True, "closure": _closure_dict(c)}


@router.patch("/{closure_id}/status")
def update_closure_status(closure_id: int, payload: ClosureStatusUpdate, db: Session = Depends(get_db)):
    from datetime import date as _date
    c = db.get(Closure, closure_id)
    if c is None:
        raise HTTPException(status_code=404, detail="폐업/이탈 기록을 찾을 수 없습니다.")
    if payload.type is not None:
        c.type = payload.type
        if c.member:
            c.member.status = payload.type
    if payload.collect_status is not None:
        try:
            c.collect_status = payload.collect_status
        except AttributeError:
            pass
        # 추심 상태가 변경될 때 마지막안내일 자동 업데이트
        try:
            if payload.collect_status not in (None, "안내전"):
                c.last_notice_date = _date.today()
        except AttributeError:
            pass
    history_note = "상태변경"
    if payload.type:
        history_note += f" → {payload.type}"
    if payload.collect_status:
        history_note += f" / 추심상태: {payload.collect_status}"
    if payload.memo:
        history_note += f" / {payload.memo}"
    db.add(MemberHistory(member_id=c.member_id, content=history_note, actor="system"))
    db.commit()
    db.refresh(c)
    return {"ok": True, "closure": _closure_dict(c)}


@router.post("/{closure_id}/cancel")
def cancel_closure(closure_id: int, db: Session = Depends(get_db)):
    c = db.get(Closure, closure_id)
    if c is None:
        raise HTTPException(status_code=404, detail="폐업/이탈 기록을 찾을 수 없습니다.")
    if c.member:
        c.member.status = "정상"
    db.add(MemberHistory(member_id=c.member_id, content=f"{c.type} 처리 취소 — 정상으로 복귀 (이력 보존)", actor="system"))
    db.delete(c)
    db.commit()
    return {"ok": True, "cancelled": True}


@router.post("/{closure_id}/restore")
def restore_closure(closure_id: int, db: Session = Depends(get_db)):
    c = db.get(Closure, closure_id)
    if c is None:
        raise HTTPException(status_code=404, detail="폐업/이탈 기록을 찾을 수 없습니다.")
    if c.member:
        c.member.status = "정상"
    db.add(MemberHistory(member_id=c.member_id, content=f"폐업/이탈 복귀 처리: {c.type} 기록에서 정상 회원으로 복귀", actor="system"))
    db.delete(c)
    db.commit()
    return {"ok": True, "restored": True}


@router.delete("/{closure_id}")
def delete_closure(closure_id: int, restore_member: bool = False, db: Session = Depends(get_db)):
    c = db.get(Closure, closure_id)
    if c is None:
        raise HTTPException(status_code=404, detail="폐업/이탈 기록을 찾을 수 없습니다.")
    member_id = c.member_id
    if restore_member and c.member:
        c.member.status = "정상"
    db.add(MemberHistory(member_id=member_id, content=f"폐업/이탈 기록 삭제" + (" 및 정상 복귀" if restore_member else ""), actor="system"))
    db.delete(c)
    db.commit()
    return {"ok": True, "deleted": True, "restored": restore_member}
