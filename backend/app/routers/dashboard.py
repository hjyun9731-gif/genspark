"""대시보드 라우터 — 실제 DB 기준 집계.

대시보드, 미수금명단 MAIN, 지역별 TOP이 모두 같은 기준을 쓰도록 통일한다.
공통 미수금 기준: 정상 회원 + 미납 항목 + amount > 0.
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

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
    """MISU_REALUSE_SUMMARY_V2
    대시보드 집계는 목록 50건이 아니라 DB 전체 정상 회원 기준으로 계산한다.
    current_balance = 미납이고 amount != 0인 항목 합계
    arrears_amount = 미납이고 amount > 0인 항목 합계
    arrears_months = max(양수 미수항목 개수, 금액/월부과금 추정 개월)
    """
    today = date.today()
    ym = today.strftime("%Y-%m")
    members = db.scalars(
        select(Member).options(selectinload(Member.receivable_items), selectinload(Member.payments))
    ).unique().all()

    total_members = len(members)
    active = [m for m in members if (m.status or "정상") == "정상"]
    active_members = len(active)

    arrears_members = 0
    total_arrears_amount = 0
    high_amount = 0
    long_overdue = 0
    prepaid = 0
    seniors = 0
    by_account: dict[str, int] = {}
    bucket_map = {
        "1개월": {"count": 0, "amount": 0},
        "2-3개월": {"count": 0, "amount": 0},
        "4-6개월": {"count": 0, "amount": 0},
        "7-11개월": {"count": 0, "amount": 0},
        "12개월 이상": {"count": 0, "amount": 0},
    }

    def put_bucket(months: int, amount: int):
        if months <= 1:
            key = "1개월"
        elif months <= 3:
            key = "2-3개월"
        elif months <= 6:
            key = "4-6개월"
        elif months <= 11:
            key = "7-11개월"
        else:
            key = "12개월 이상"
        bucket_map[key]["count"] += 1
        bucket_map[key]["amount"] += int(amount or 0)

    for m in active:
        balance_items = [x for x in (m.receivable_items or []) if (not x.is_paid) and int(x.amount or 0) != 0]
        positive_items = [x for x in balance_items if int(x.amount or 0) > 0]
        current_balance = int(sum(int(x.amount or 0) for x in balance_items))
        positive_balance = int(sum(int(x.amount or 0) for x in positive_items))
        monthly = int(m.monthly_charge or 0)
        amount_months = ((positive_balance + monthly - 1) // monthly) if monthly > 0 and positive_balance > 0 else 0
        arrears_months = max(len(positive_items), amount_months)

        if m.birth_year and today.year - int(m.birth_year) >= 70:
            seniors += 1
        if current_balance < 0:
            prepaid += 1
        if positive_balance > 0:
            arrears_members += 1
            total_arrears_amount += positive_balance
            if positive_balance >= 300000:
                high_amount += 1
            if arrears_months >= 12:
                long_overdue += 1
            put_bucket(arrears_months, positive_balance)
            for it in positive_items:
                k = it.charge_item or m.charge_item or "미분류"
                by_account[k] = by_account.get(k, 0) + int(it.amount or 0)

    this_month_charge = int(sum(int(m.monthly_charge or 0) for m in active))
    month_payment = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            func.to_char(Payment.paid_date, "YYYY-MM") == ym
        )
    ) or 0
    collection_rate = round((int(month_payment or 0) / this_month_charge) * 100, 1) if this_month_charge else None

    closure_count = db.scalar(select(func.count()).select_from(Closure)) or 0
    disconnected = db.scalar(select(func.count()).select_from(Member).where(Member.status == "정상", Member.is_disconnected == True)) or 0  # noqa: E712
    cert_missing = db.scalar(select(func.count()).select_from(Member).where(Member.status == "정상", Member.cert_missing == True)) or 0  # noqa: E712
    bank_pending = db.scalar(select(func.count()).select_from(Deposit).where(Deposit.status.notin_(["매칭완료", "제외"]))) or 0
    pending_count = db.scalar(select(func.count()).select_from(Pending)) or 0
    buckets = [{"key": k, "count": v["count"], "amount": v["amount"]} for k, v in bucket_map.items()]

    return {
        "total_members": int(total_members),
        "active_members": int(active_members),
        "arrears_members": int(arrears_members),
        "total_arrears_amount": int(total_arrears_amount),
        "month_payment": int(month_payment or 0),
        "this_month_charge": int(this_month_charge),
        "collection_rate": collection_rate,
        "closure_count": int(closure_count),
        "high_amount": int(high_amount),
        "long_overdue": int(long_overdue),
        "prepaid": int(prepaid),
        "seniors": int(seniors),
        "disconnected": int(disconnected),
        "cert_missing": int(cert_missing),
        "bank_pending": int(bank_pending),
        "pending_count": int(pending_count),
        "by_account": by_account,
        "buckets": buckets,
        "totalMembers": int(total_members),
        "activeMembers": int(active_members),
        "arrearsCount": int(arrears_members),
        "totalArrears": int(total_arrears_amount),
        "thisMonthPayments": int(month_payment or 0),
        "thisMonthCharge": int(this_month_charge),
        "collectionRate": collection_rate,
        "closures": int(closure_count),
        "highAmount": int(high_amount),
        "longOverdue": int(long_overdue),
        "prepaidCount": int(prepaid),
        "seniorCount": int(seniors),
        "bankPending": int(bank_pending),
        "pending": int(pending_count),
        "certMissing": int(cert_missing),
        "byAccount": by_account,
        "monthBuckets": buckets,
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
