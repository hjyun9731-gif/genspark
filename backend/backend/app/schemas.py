"""
Pydantic 스키마 (schemas)
-------------------------
API 입출력 형태. 골격 단계라 핵심 응답/요청만 정의하고,
화면 구현 단계에서 필요에 따라 확장한다.
"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


# ---------- 공통 ----------
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- 회원 ----------
class MemberBase(ORMModel):
    id: str
    mgmt_no: str
    reg_type: str
    name: str
    vehicle_no: str
    phone: str | None = None
    sigun: str
    member_type: str
    membership: str
    charge_item: str
    monthly_charge: int
    status: str
    last_payment_ym: str | None = None
    memo: str | None = None


class ReceivableItemOut(ORMModel):
    ym: str
    charge_item: str
    amount: int
    is_paid: bool


class PaymentOut(ORMModel):
    id: int
    member_id: str
    paid_for_ym: str
    charge_item: str
    amount: int
    method: str
    paid_date: date
    deposit_id: int | None = None


class MemberDetail(MemberBase):
    """드로어용 상세 — 미수목록/납부이력 포함. (집계값은 서비스에서 계산)"""
    birth_year: int | None = None
    cert_issue_date: date | None = None
    assoc_join_date: date | None = None
    billing_start_ym: str | None = None
    arrears_months: int = 0          # 파생: 미수월수
    arrears_amount: int = 0          # 파생: 미수금액
    receivable_items: list[ReceivableItemOut] = []
    payments: list[PaymentOut] = []


class MemberUpdate(BaseModel):
    """PATCH /members/{id} — 회원정보 부분 수정."""
    mgmt_no: str | None = None
    reg_type: str | None = None
    name: str | None = None
    vehicle_no: str | None = None
    phone: str | None = None
    sigun: str | None = None
    region_raw: str | None = None
    member_type: str | None = None
    membership: str | None = None
    birth_year: int | None = None
    cert_issue_date: date | None = None
    assoc_join_date: date | None = None
    billing_start_ym: str | None = None
    charge_item: str | None = None
    monthly_charge: int | None = None
    last_payment_ym: str | None = None
    status: str | None = None
    is_disconnected: bool | None = None
    cert_missing: bool | None = None
    memo: str | None = None


# ---------- 수납 ----------
class PaymentApply(BaseModel):
    """POST /members/{id}/payments — 수납 반영 요청."""
    amount: int
    method: str = "통장매칭"
    paid_date: date | None = None
    deposit_id: int | None = None
    charge_item: str | None = None   # 수납 항목(협회비/관리비/가수금/잡수입/기타)
    deduct: bool = True              # False면 미수금 차감 없이 수납내역만 기록


# ---------- 폐업/처리 ----------
class ClosureCreate(BaseModel):
    """POST /members/{id}/closure — 폐업/양도/이관/탈퇴 등록."""
    type: str                        # 폐업/양도/이관/탈퇴
    process_date: date
    doc_no: str | None = None
    content: str | None = None
    unpaid_balance: int = 0
    notify_later: bool = False


class ClosureOut(ORMModel):
    id: int
    member_id: str
    type: str
    process_date: date
    doc_no: str | None = None
    content: str | None = None
    unpaid_balance: int
    notify_later: bool
    created_at: datetime


# ---------- 통장 입금 ----------
class DepositOut(ORMModel):
    id: int
    deposit_date: date
    depositor_name: str
    amount: int
    memo: str | None = None
    status: str
    matched_member_id: str | None = None
    is_excluded: bool
    hint: str | None = None


class DepositMatch(BaseModel):
    """POST /deposits/{id}/match — 입금건을 회원에 매칭."""
    member_id: str
    charge_item: str | None = None  # 협회비/관리비/협회가입비/자격증명발급비/기타


# ---------- 예정자 ----------
class PendingOut(ORMModel):
    id: int
    name: str
    vehicle_no: str | None = None
    phone: str | None = None
    sigun: str
    member_type: str
    membership: str
    reg_type: str
    step: str
    step_index: int
    mgmt_no: str | None = None
    expected_charge: str | None = None
    note: str | None = None


# ---------- 대시보드 ----------
class DashboardSummary(BaseModel):
    total_members: int = 0
    arrears_members: int = 0
    total_arrears_amount: int = 0
    month_payment: int = 0
    closure_count: int = 0
