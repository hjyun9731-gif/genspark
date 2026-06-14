"""수납내역 라우터 — 목록/수정/취소."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Member, MemberHistory, Payment, ReceivableItem

router = APIRouter(prefix="/api/payments", tags=["payments"])


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


class PaymentUpdate(BaseModel):
    paid_for_ym: str | None = None
    charge_item: str | None = None
    amount: int | None = None
    method: str | None = None
    paid_date: date | None = None


def _payment_dict(p: Payment) -> dict:
    m: Member | None = p.member
    return {
        "id": p.id,
        "memberId": p.member_id,
        "member_id": p.member_id,
        "name": m.name if m else "",
        "vehicleNo": m.vehicle_no if m else "",
        "vehicle_no": m.vehicle_no if m else "",
        "sigun": m.sigun if m else "",
        "region": m.sigun if m else "",
        "paidForYm": p.paid_for_ym,
        "paid_for_ym": p.paid_for_ym,
        "chargeItem": p.charge_item,
        "charge_item": p.charge_item,
        "accountingType": _accounting_type(p.charge_item),
        "accounting_type": _accounting_type(p.charge_item),
        "amount": p.amount,
        "method": p.method,
        "paidDate": p.paid_date.isoformat(),
        "paid_date": p.paid_date.isoformat(),
        "deposit_id": p.deposit_id,
        "createdAt": p.created_at.isoformat() if p.created_at else "",
        "memo": f"{p.method} 반영" + (f" / {_accounting_type(p.charge_item)}" if _accounting_type(p.charge_item) != "회비수입" else "") + (f" / 입금ID {p.deposit_id}" if p.deposit_id else ""),
    }


@router.get("")
def list_payments(
    member_id: str | None = None,
    page: int = 1,
    size: int = Query(500, le=5000),
    db: Session = Depends(get_db),
):
    stmt = select(Payment).options(selectinload(Payment.member))
    if member_id:
        stmt = stmt.where(Payment.member_id == member_id)
    stmt = stmt.order_by(Payment.paid_date.desc(), Payment.id.desc()).offset((page - 1) * size).limit(size)
    return [_payment_dict(p) for p in db.scalars(stmt).all()]


@router.patch("/{payment_id}")
def update_payment(payment_id: int, payload: PaymentUpdate, db: Session = Depends(get_db)):
    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="수납내역을 찾을 수 없습니다.")
    before = p.amount
    if payload.paid_for_ym is not None:
        p.paid_for_ym = payload.paid_for_ym
    if payload.charge_item is not None:
        p.charge_item = payload.charge_item
    if payload.amount is not None:
        p.amount = int(payload.amount or 0)
    if payload.method is not None:
        p.method = payload.method
    if payload.paid_date is not None:
        p.paid_date = payload.paid_date
    db.add(MemberHistory(member_id=p.member_id, content=f"수납내역 수정: {before:,}원 → {p.amount:,}원", actor="system"))
    db.commit()
    db.refresh(p)
    return {"ok": True, "payment": _payment_dict(p)}


@router.post("/{payment_id}/cancel")
def cancel_payment(payment_id: int, db: Session = Depends(get_db)):
    """수납 취소: 결제액을 해당 기준월 미수 항목에 복구하고 payment 기록 삭제."""
    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="수납내역을 찾을 수 없습니다.")

    if not _is_non_arrears_income(p.charge_item):
        item = db.scalar(
            select(ReceivableItem).where(
                ReceivableItem.member_id == p.member_id,
                ReceivableItem.ym == p.paid_for_ym,
            )
        )
        if item is None:
            item = ReceivableItem(
                member_id=p.member_id,
                ym=p.paid_for_ym,
                charge_item=p.charge_item,
                amount=p.amount,
                is_paid=False,
            )
            db.add(item)
        else:
            item.is_paid = False
            item.amount = int(item.amount or 0) + int(p.amount or 0)
        history = f"수납 취소: {p.paid_for_ym} {p.amount:,}원 미수금 복구"
    else:
        history = f"{p.charge_item}({_accounting_type(p.charge_item)}) 수납 취소: {p.amount:,}원 / 미수금 복구 없음"

    if p.deposit:
        p.deposit.status = "대기"
        p.deposit.matched_member_id = None

    db.add(MemberHistory(member_id=p.member_id, content=history, actor="system"))
    db.delete(p)
    db.commit()
    return {"ok": True, "cancelled": True}
