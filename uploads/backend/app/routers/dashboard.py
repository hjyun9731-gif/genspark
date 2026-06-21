"""대시보드 라우터 — 실제 DB 기준 집계.

대시보드, 미수금명단 MAIN, 지역별 TOP이 모두 같은 기준을 쓰도록 통일한다.
공통 미수금 기준: 정상 회원 + 미납 항목 + amount > 0.
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Closure, Deposit, Member, Payment, Pending, ReceivableItem

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _arrears_filters():
    return (
        ReceivableItem.is_paid == False,  # noqa: E712
        ReceivableItem.amount > 0,
        Member.status == "정상",
    )


def _cutoff_ym(months: int = 12) -> str:
    """오늘 기준 N개월 전 YYYY-MM. ym 문자열 비교가 가능하도록 0패딩 유지."""
    today = date.today()
    month_index = today.year * 12 + today.month - months
    year = (month_index - 1) // 12
    month = (month_index - 1) % 12 + 1
    return f"{year:04d}-{month:02d}"


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    total_members = db.scalar(select(func.count()).select_from(Member)) or 0
    active_members = db.scalar(
        select(func.count()).select_from(Member).where(Member.status == "정상")
    ) or 0
    closure_count = db.scalar(select(func.count()).select_from(Closure)) or 0

    base = select(ReceivableItem).join(Member, ReceivableItem.member_id == Member.id).where(*_arrears_filters()).subquery()

    total_arrears_amount = db.scalar(
        select(func.coalesce(func.sum(base.c.amount), 0))
    ) or 0
    arrears_members = db.scalar(
        select(func.count(func.distinct(base.c.member_id)))
    ) or 0

    ym = date.today().strftime("%Y-%m")
    month_payment = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            func.to_char(Payment.paid_date, "YYYY-MM") == ym
        )
    ) or 0

    high_amount = db.scalar(
        select(func.count(func.distinct(ReceivableItem.member_id)))
        .join(Member, ReceivableItem.member_id == Member.id)
        .where(
            ReceivableItem.is_paid == False,  # noqa: E712
            ReceivableItem.amount >= 300000,
            Member.status == "정상",
        )
    ) or 0

    # 장기미납: 현재잔액 기준월(ym)이 12개월 이상 오래된 미수자.
    # ym이 YYYY-MM 문자열이므로 같은 포맷끼리는 문자열 비교가 안전하다.
    cutoff = _cutoff_ym(12)
    long_overdue = db.scalar(
        select(func.count(func.distinct(ReceivableItem.member_id)))
        .join(Member, ReceivableItem.member_id == Member.id)
        .where(
            ReceivableItem.is_paid == False,  # noqa: E712
            ReceivableItem.amount > 0,
            ReceivableItem.ym <= cutoff,
            Member.status == "정상",
        )
    ) or 0

    disconnected = db.scalar(
        select(func.count()).select_from(Member).where(
            Member.status == "정상", Member.is_disconnected == True  # noqa: E712
        )
    ) or 0
    cert_missing = db.scalar(
        select(func.count()).select_from(Member).where(
            Member.status == "정상", Member.cert_missing == True  # noqa: E712
        )
    ) or 0
    bank_pending = db.scalar(
        select(func.count()).select_from(Deposit).where(
            Deposit.status.notin_(["매칭완료", "제외"])
        )
    ) or 0
    pending_count = db.scalar(select(func.count()).select_from(Pending)) or 0

    return {
        # snake_case: API 원본
        "total_members": int(total_members),
        "active_members": int(active_members),
        "arrears_members": int(arrears_members),
        "total_arrears_amount": int(total_arrears_amount),
        "month_payment": int(month_payment),
        "closure_count": int(closure_count),
        "high_amount": int(high_amount),
        "long_overdue": int(long_overdue),
        "disconnected": int(disconnected),
        "cert_missing": int(cert_missing),
        "bank_pending": int(bank_pending),
        "pending_count": int(pending_count),
        # camelCase: 프론트 호환
        "totalMembers": int(total_members),
        "activeMembers": int(active_members),
        "arrearsCount": int(arrears_members),
        "totalArrears": int(total_arrears_amount),
        "thisMonthPayments": int(month_payment),
        "closures": int(closure_count),
        "highAmount": int(high_amount),
        "longOverdue": int(long_overdue),
        "bankPending": int(bank_pending),
        "pending": int(pending_count),
        "certMissing": int(cert_missing),
    }


@router.get("/by-sigun")
def by_sigun(db: Session = Depends(get_db)):
    """지역별 미수금 TOP.

    PostgreSQL에서는 SELECT의 coalesce()와 GROUP BY의 coalesce()가
    서로 다른 바인드 파라미터로 컴파일되면 같은 식으로 인정하지 않아
    grouping error가 날 수 있다. 먼저 subquery에서 sigun을 확정한 뒤
    그 컬럼으로 group by 하도록 분리한다.
    """
    base = (
        select(
            func.coalesce(Member.sigun, "미분류").label("sigun"),
            ReceivableItem.member_id.label("member_id"),
            ReceivableItem.amount.label("amount"),
        )
        .select_from(ReceivableItem)
        .join(Member, ReceivableItem.member_id == Member.id)
        .where(*_arrears_filters())
        .subquery()
    )

    rows = db.execute(
        select(
            base.c.sigun,
            func.count(func.distinct(base.c.member_id)).label("member_count"),
            func.coalesce(func.sum(base.c.amount), 0).label("total"),
        )
        .group_by(base.c.sigun)
        .order_by(func.sum(base.c.amount).desc())
        .limit(10)
    ).all()

    return [
        {
            "sigun": r.sigun or "미분류",
            "region": r.sigun or "미분류",
            "member_count": int(r.member_count or 0),
            "memberCount": int(r.member_count or 0),
            "total": int(r.total or 0),
            "amount": int(r.total or 0),
        }
        for r in rows
    ]
