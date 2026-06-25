from __future__ import annotations
import re
import shutil
from pathlib import Path

ROOT = Path.cwd()


def read(p: Path) -> str:
    return p.read_text(encoding='utf-8')


def write(p: Path, s: str) -> None:
    p.write_text(s, encoding='utf-8', newline='\n')


def backup(p: Path) -> None:
    b = p.with_name(p.name + '.bak_realuse')
    if not b.exists():
        shutil.copy2(p, b)


def patch_dashboard():
    p = ROOT/'backend'/'app'/'routers'/'dashboard.py'
    if not p.exists():
        print('! dashboard.py 없음 - 건너뜀')
        return
    backup(p)
    t = read(p)
    if 'from sqlalchemy.orm import Session, selectinload' not in t:
        t = t.replace('from sqlalchemy.orm import Session', 'from sqlalchemy.orm import Session, selectinload')
    if 'MISU_REALUSE_SUMMARY_V2' not in t:
        new_summary = r'''@router.get("/summary")
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


'''
        t = re.sub(r'@router\.get\("/summary"\)\ndef summary\(db: Session = Depends\(get_db\)\):\n.*?\n\n(?=@router\.get\("/by-sigun"\))', new_summary, t, flags=re.S)
    write(p,t)
    print('- dashboard.py: 대시보드 전체 DB 기준 집계/계정별/미수개월/선납/수납률 보정')


def patch_members():
    p = ROOT/'backend'/'app'/'routers'/'members.py'
    if not p.exists():
        print('! members.py 없음 - 건너뜀')
        return
    backup(p)
    t = read(p)
    # import re 보강
    if not re.search(r'(?m)^import re$', t):
        if re.search(r'(?m)^import math$', t):
            t = re.sub(r'(?m)^import math$', 'import math\nimport re', t, count=1)
        else:
            t = t.replace('from datetime import date\n', 'from datetime import date\nimport re\n')
    # _member_dict에 address fallback이 없으면 memo 파서 주입
    if 'def _memo_field(' not in t:
        marker = 'def _open_items(member: Member) -> list[ReceivableItem]:\n'
        helper = '''def _memo_field(memo: str | None, labels: list[str]) -> str | None:\n    raw = str(memo or "")\n    if not raw:\n        return None\n    for label in labels:\n        m = re.search(rf"(?:^|\\s*/\\s*){re.escape(label)}\\s*[:：]\\s*([^/]+)", raw)\n        if m:\n            v = m.group(1).strip()\n            if v:\n                return v[:300]\n    return None\n\n\n'''
        if marker in t:
            t = t.replace(marker, helper + marker, 1)
    if '"address": _memo_field(member.memo' not in t and '"memo": member.memo,' in t:
        t = t.replace('        "memo": member.memo,\n        # 프론트 기존 화면 호환 camelCase 필드\n', '''        "memo": member.memo,\n        "address": _memo_field(member.memo, ["주소", "주 소"]),\n        "public_address": _memo_field(member.memo, ["공문 주소", "공문주소"]),\n        "publicAddress": _memo_field(member.memo, ["공문 주소", "공문주소"]),\n        "resident_no": _memo_field(member.memo, ["주민등록번호", "주민번호"]),\n        "residentNo": _memo_field(member.memo, ["주민등록번호", "주민번호"]),\n        "cert_issue_no": _memo_field(member.memo, ["자격증명 발급번호", "자격증명발급번호"]),\n        "certIssueNo": _memo_field(member.memo, ["자격증명 발급번호", "자격증명발급번호"]),\n        # 프론트 기존 화면 호환 camelCase 필드\n''')
    # summary headers 추가
    if 'X-Total-Balance' not in t and 'response.headers["X-Total-Count"]' in t:
        t = t.replace('        response.headers["X-Total-Count"] = str(total)\n', '''        response.headers["X-Total-Count"] = str(total)\n        response.headers["X-Total-Balance"] = str(sum(max(int(x.get("arrears_amount") or 0), 0) for x in filtered))\n        response.headers["X-Unpaid-Count"] = str(sum(1 for x in filtered if int(x.get("arrears_amount") or 0) > 0))\n        response.headers["X-Zero-Count"] = str(sum(1 for x in filtered if int(x.get("arrears_amount") or 0) == 0))\n        response.headers["X-Prepaid-Count"] = str(sum(1 for x in filtered if int(x.get("arrears_amount") or 0) < 0))\n        response.headers["X-Over-300k"] = str(sum(1 for x in filtered if int(x.get("arrears_amount") or 0) >= 300000))\n        response.headers["X-Over-12Months"] = str(sum(1 for x in filtered if int(x.get("arrears_months") or 0) >= 12))\n''')
    # closure content optional default
    t = t.replace('content=payload.content or "미수금명단에서 이탈 처리",', 'content=payload.content or "",')
    write(p,t)
    print('- members.py: import re/address/meta headers/폐업 사유 선택 처리')


def patch_closures():
    p = ROOT/'backend'/'app'/'routers'/'closures.py'
    if not p.exists():
        print('! closures.py 없음 - 건너뜀')
        return
    backup(p)
    t = read(p)
    if 'from ..models import Closure, MemberHistory, Member' not in t:
        t = t.replace('from ..models import Closure, MemberHistory', 'from ..models import Closure, MemberHistory, Member')
    if 'import math' not in t:
        t = t.replace('"""폐업현황 라우터 — 처리 이력/수정/복귀/삭제."""\n', '"""폐업현황 라우터 — 처리 이력/수정/복귀/삭제."""\n\nimport math\nimport re\n')
    if 'def _memo_field(' not in t:
        t = t.replace('router = APIRouter(prefix="/api/closures", tags=["closures"])\n', '''router = APIRouter(prefix="/api/closures", tags=["closures"])\n\n\ndef _memo_field(memo: str | None, labels: list[str]) -> str | None:\n    raw = str(memo or "")\n    for label in labels:\n        m = re.search(rf"(?:^|\\s*/\\s*){re.escape(label)}\\s*[:：]\\s*([^/]+)", raw)\n        if m and m.group(1).strip():\n            return m.group(1).strip()[:300]\n    return None\n\n\ndef _closure_unpaid_info(m: Member | None) -> tuple[int, str, int]:\n    if not m:\n        return 0, "-", 0\n    items = [x for x in (m.receivable_items or []) if (not x.is_paid) and int(x.amount or 0) > 0]\n    total = int(sum(int(x.amount or 0) for x in items))\n    item_names = sorted({(x.charge_item or m.charge_item or "미분류") for x in items})\n    monthly = int(m.monthly_charge or 0)\n    amount_months = math.ceil(total / monthly) if monthly > 0 and total > 0 else 0\n    return total, "/".join(item_names) if item_names else (m.charge_item or "-"), max(len(items), amount_months)\n\n''')
    if 'unpaidItem' not in t:
        t = t.replace('def _closure_dict(c: Closure) -> dict:\n    m = c.member\n    return {', 'def _closure_dict(c: Closure) -> dict:\n    m = c.member\n    calc_unpaid, unpaid_item, unpaid_months = _closure_unpaid_info(m)\n    return {')
        t = t.replace('        "phone": m.phone if m else "",\n', '''        "phone": m.phone if m else "",\n        "address": _memo_field(m.memo if m else "", ["주소", "주 소"]),\n        "publicAddress": _memo_field(m.memo if m else "", ["공문 주소", "공문주소"]),\n''')
        t = t.replace('        "unpaidBalance": c.unpaid_balance,\n        "unpaid_balance": c.unpaid_balance,\n', '''        "unpaidBalance": int(c.unpaid_balance or calc_unpaid or 0),\n        "unpaid_balance": int(c.unpaid_balance or calc_unpaid or 0),\n        "unpaidItem": unpaid_item,\n        "unpaid_item": unpaid_item,\n        "unpaidMonths": unpaid_months,\n        "unpaid_months": unpaid_months,\n        "collectStatus": getattr(c, "collect_status", None) or "안내전",\n        "collect_status": getattr(c, "collect_status", None) or "안내전",\n''')
    t = t.replace('.options(selectinload(Closure.member))', '.options(selectinload(Closure.member).selectinload(Member.receivable_items))')
    write(p,t)
    print('- closures.py: 폐업현황 주소/미납항목/미납기간/추심상태 응답 보강')


def patch_pending():
    p = ROOT/'backend'/'app'/'routers'/'pending.py'
    if not p.exists():
        print('! pending.py 없음 - 건너뜀')
        return
    backup(p)
    t = read(p)
    # Payload fields in note fallback
    if 'address: str | None = None' not in t:
        t = t.replace('    phone: str | None = None\n', '    phone: str | None = None\n    address: str | None = None\n    public_address: str | None = None\n    publicAddress: str | None = None\n    resident_no: str | None = None\n    residentNo: str | None = None\n    cert_issue_no: str | None = None\n    certIssueNo: str | None = None\n    doc_no: str | None = None\n    docNo: str | None = None\n')
    if 'def _billing_start_date' not in t:
        t = t.replace('def _next_month_ym(d: date | None) -> str:\n', '''def _billing_start_date(d: date | None) -> date:\n    d = d or date.today()\n    y, m = d.year, d.month + 1\n    if m == 13:\n        y += 1\n        m = 1\n    # 다음달 같은 일자가 없으면 말일로 보정\n    import calendar\n    day = min(d.day, calendar.monthrange(y, m)[1])\n    return date(y, m, day)\n\n\n''')
    if 'billingStartDate' not in t:
        t = t.replace('        "expectedCharge": p.expected_charge,\n', '        "expectedCharge": p.expected_charge,\n        "billingStartDate": _billing_start_date(p.cert_issue_date).isoformat() if p.cert_issue_date else None,\n')
    if 'parts = []\n    for label, value' not in t:
        helper = '''\ndef _pending_note(payload: PendingPayload) -> str | None:\n    parts = []\n    for label, value in [\n        ("주소", payload.address),\n        ("공문 주소", payload.public_address or payload.publicAddress),\n        ("주민등록번호", payload.resident_no or payload.residentNo),\n        ("자격증명 발급번호", payload.cert_issue_no or payload.certIssueNo),\n        ("공문/접수번호", payload.doc_no or payload.docNo),\n        ("비고", payload.note),\n    ]:\n        if value:\n            parts.append(f"{label}:{value}")\n    return " / ".join(parts) if parts else None\n'''
        t = t.replace('def _pending_dict(p: Pending) -> dict:\n', helper + '\ndef _pending_dict(p: Pending) -> dict:\n')
        t = t.replace('        note=payload.note,', '        note=_pending_note(payload),')
    # promote note preserves p.note and billing_start_ym from date
    t = t.replace('    billing_start_ym = payload.billing_start_ym or payload.billingStartYm or _next_month_ym(cert_date)\n', '    billing_start_ym = payload.billing_start_ym or payload.billingStartYm or _billing_start_date(cert_date).strftime("%Y-%m")\n')
    write(p,t)
    print('- pending.py: 예정자 주소/공문주소/주민번호/부과시작일 메모 보강')


def patch_app():
    p = ROOT/'frontend'/'static'/'app'/'App.jsx'
    if not p.exists():
        print('! App.jsx 없음 - 건너뜀')
        return
    backup(p)
    t = read(p)
    t = t.replace('const [route, setRoute] = React.useState("dashboard");', 'const [route, setRoute] = React.useState(()=>localStorage.getItem("misu.route") || "dashboard");')
    if 'localStorage.setItem("misu.route"' not in t:
        t = t.replace('  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 3200); };', '  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 3200); };\n  React.useEffect(()=>{ localStorage.setItem("misu.route", route); }, [route]);')
    # dashboard aggregation fields
    old = '''        thisMonthCharge: 0,\n        thisMonthCollected: dashboardData.thisMonthPayments || dashboardData.month_payment || 0,\n        prepaid: 0,\n        highValue: dashboardData.highAmount || dashboardData.high_amount || 0,\n        longOverdue: dashboardData.longOverdue || dashboardData.long_overdue || 0,\n        seniors: 0,\n'''
    new = '''        thisMonthCharge: dashboardData.thisMonthCharge || dashboardData.this_month_charge || 0,\n        thisMonthCollected: dashboardData.thisMonthPayments || dashboardData.month_payment || 0,\n        prepaid: dashboardData.prepaidCount || dashboardData.prepaid || 0,\n        highValue: dashboardData.highAmount || dashboardData.high_amount || 0,\n        longOverdue: dashboardData.longOverdue || dashboardData.long_overdue || 0,\n        seniors: dashboardData.seniorCount || dashboardData.seniors || 0,\n'''
    t = t.replace(old,new)
    t = t.replace('        byAccount: {},\n        buckets: [],', '        byAccount: dashboardData.byAccount || dashboardData.by_account || {},\n        buckets: dashboardData.monthBuckets || dashboardData.buckets || [],')
    t = t.replace('onNavigate={(id)=>{ setRoute(id); setDrill(null); }}', 'onNavigate={(id)=>{ setRoute(id); setDrill(null); localStorage.setItem("misu.route", id); }}')
    write(p,t)
    print('- App.jsx: 새로고침 시 현재 화면 유지 + 대시보드 상세 집계 연결')


def patch_receivables():
    p = ROOT/'frontend'/'static'/'app'/'Receivables.jsx'
    if not p.exists():
        print('! Receivables.jsx 없음 - 건너뜀')
        return
    backup(p)
    t = read(p)
    t = t.replace('const [amount, setAmount] = React.useState("전체");', 'const [amount, setAmount] = React.useState("미수있음");')
    t = t.replace('const [inclZero, setInclZero] = React.useState(true);', 'const [inclZero, setInclZero] = React.useState(false);')
    t = t.replace('const [inclPrepaid, setInclPrepaid] = React.useState(true);', 'const [inclPrepaid, setInclPrepaid] = React.useState(false);')
    if 'const [serverMeta, setServerMeta]' not in t:
        t = t.replace('const [serverTotal, setServerTotal] = React.useState(0);', 'const [serverTotal, setServerTotal] = React.useState(0);\n  const [serverMeta, setServerMeta] = React.useState(null);')
    t = t.replace('setMinAmt(""); setMaxAmt(""); setInclZero(true); setInclPrepaid(true);', 'setMinAmt(""); setMaxAmt(""); setInclZero(false); setInclPrepaid(false);')
    t = t.replace('function resetFilters(){ setQuery(""); setRegion(""); setMembership(""); setAccount(""); setAmount("전체"); setStatus("정상"); setSpecial(""); setSort({key:"outstanding",dir:"desc"}); setMinAmt(""); setMaxAmt(""); setInclZero(true); setInclPrepaid(true); setPage(1); }', 'function resetFilters(){ setQuery(""); setRegion(""); setMembership(""); setAccount(""); setAmount("미수있음"); setStatus("정상"); setSpecial(""); setSort({key:"outstanding",dir:"desc"}); setMinAmt(""); setMaxAmt(""); setInclZero(false); setInclPrepaid(false); setPage(1); }')
    # fetch handling patch old or followup style
    if 'X-Total-Balance' not in t:
        t = t.replace('''      .then(r => {\n        if (!r.ok) return Promise.reject(r.status);\n        const total = parseInt(r.headers.get("X-Total-Count") || "", 10);\n        return r.json().then(data => ({ data, total: Number.isFinite(total) ? total : data.length }));\n      })\n      .then(({data,total}) => { setServerRows(data); setServerTotal(total); setServerLoading(false); })''', '''      .then(r => {\n        if (!r.ok) return Promise.reject(r.status);\n        const numHeader = (name) => { const n = parseInt(r.headers.get(name) || "", 10); return Number.isFinite(n) ? n : null; };\n        const meta = {\n          totalCount: numHeader("X-Total-Count"),\n          totalBalance: numHeader("X-Total-Balance"),\n          unpaidCount: numHeader("X-Unpaid-Count"),\n          zeroCount: numHeader("X-Zero-Count"),\n          prepaidCount: numHeader("X-Prepaid-Count"),\n          over300kCount: numHeader("X-Over-300k"),\n          over12MonthsCount: numHeader("X-Over-12Months"),\n        };\n        return r.json().then(data => ({ data, meta }));\n      })\n      .then(({data,meta}) => { const items = Array.isArray(data) ? data : (data.items || []); const m = data.meta || meta || {}; setServerRows(items); setServerMeta(m); setServerTotal(m.totalCount || items.length); setServerLoading(false); })''')
        t = t.replace('''      .then(r => r.ok ? r.json() : Promise.reject(r.status))\n      .then(data => { setServerRows(data); setServerTotal(data.length + (page - 1) * PAGE_SIZE); setServerLoading(false); })''', '''      .then(r => {\n        if (!r.ok) return Promise.reject(r.status);\n        const numHeader = (name) => { const n = parseInt(r.headers.get(name) || "", 10); return Number.isFinite(n) ? n : null; };\n        const meta = {\n          totalCount: numHeader("X-Total-Count"), totalBalance: numHeader("X-Total-Balance"),\n          unpaidCount: numHeader("X-Unpaid-Count"), zeroCount: numHeader("X-Zero-Count"),\n          prepaidCount: numHeader("X-Prepaid-Count"), over300kCount: numHeader("X-Over-300k"), over12MonthsCount: numHeader("X-Over-12Months"),\n        };\n        return r.json().then(data => ({ data, meta }));\n      })\n      .then(({data,meta}) => { const items = Array.isArray(data) ? data : (data.items || []); const m = data.meta || meta || {}; setServerRows(items); setServerMeta(m); setServerTotal(m.totalCount || items.length); setServerLoading(false); })''')
    t = t.replace('const sumOut = rows.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);\n  const over300 = rows.filter(m=>D.outstanding(m)>=300000).length;\n  const longCnt = rows.filter(m=>D.arrearsMonths(m)>=12).length;', 'const sumOut = serverMeta?.totalBalance ?? rows.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);\n  const over300 = serverMeta?.over300kCount ?? rows.filter(m=>D.outstanding(m)>=300000).length;\n  const longCnt = serverMeta?.over12MonthsCount ?? rows.filter(m=>D.arrearsMonths(m)>=12).length;')
    # countByAmount body replace with meta-aware
    t = re.sub(r'const countByAmount = \(key\)=> \(membersProp\|\|\[\]\)\.filter\(m=>\{.*?\}\)\.length;', '''const countByAmount = (key)=> {
    if (serverMeta) {
      if(key==="전체") return serverMeta.totalCount ?? rows.length;
      if(key==="미수있음") return serverMeta.unpaidCount ?? rows.filter(m=>D.outstanding(m)>0).length;
      if(key==="완납") return serverMeta.zeroCount ?? rows.filter(m=>D.outstanding(m)===0).length;
      if(key==="선납") return serverMeta.prepaidCount ?? rows.filter(m=>D.outstanding(m)<0).length;
      if(key==="30만원이상") return serverMeta.over300kCount ?? rows.filter(m=>D.outstanding(m)>=300000).length;
    }
    return (membersProp||[]).filter(m=>{
      if (status!=="전체" && m.status!=="정상") return false;
      const out=D.outstanding(m);
      if(key==="전체") return true;
      if(key==="미수있음") return out>0;
      if(key==="완납") return out===0;
      if(key==="선납") return out<0;
      if(key==="30만원이상") return out>=300000;
      return true;
    }).length;
  };''', t, flags=re.S)
    t = t.replace('["검색 결과",`${num(rows.length)}명`', '["현재 표시",`${num(rows.length)}명 / 전체 ${num(serverTotal || rows.length)}명`')
    t = t.replace('["현재잔액 합계",won(sumOut)', '["전체 조건 합계",won(sumOut)')
    t = t.replace('미수 합계 <b style={{ color:"var(--red-500)" }}>{won(sumOut)}</b>', '전체 조건 미수 합계 <b style={{ color:"var(--red-500)" }}>{won(sumOut)}</b>')
    write(p,t)
    print('- Receivables.jsx: 기본 미납/0원·선납 제외 + 전체조건 meta 표시 보정')


def patch_modals():
    p = ROOT/'frontend'/'static'/'app'/'Modals.jsx'
    if not p.exists():
        print('! Modals.jsx 없음 - 건너뜀')
        return
    backup(p)
    t = read(p)
    # member detail central modal
    t = t.replace('<Backdrop onClose={onClose} align="right">\n      <div onClick={e=>e.stopPropagation()} style={{ width:580, background:"var(--white)", height:"100%", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)", animation:"pmSlide .22s ease" }}>', '<Backdrop onClose={onClose}>\n      <div onClick={e=>e.stopPropagation()} style={{ width:"min(980px, calc(100vw - 48px))", maxHeight:"92vh", background:"var(--white)", borderRadius:"var(--radius-xl)", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)", animation:"pmPop .18s ease", overflow:"hidden" }}>')
    t = t.replace('폐업/이탈', '폐업·이탈')
    t = t.replace('placeholder="예: 접수2026-114"', 'placeholder={type==="폐업"?"예: 폐-26":type==="양도"?"예: 양-18":type==="이관"?"예: 이-8":"예: 탈-3"}')
    t = t.replace('<label style={fieldLabel}>처리내용 / 사유</label>', '<label style={fieldLabel}>메모 (선택)</label>')
    t = t.replace('placeholder="사유를 입력하면 처리이력에 기록됩니다"', 'placeholder="필수 아님. 필요할 때만 입력"')
    if '<InfoRow label="주민등록번호"' not in t:
        t = t.replace('<InfoRow label="공문주소" value={member.publicAddress||member.public_address} />', '<InfoRow label="공문주소" value={member.publicAddress||member.public_address} />\n                  <InfoRow label="주민등록번호" value={member.residentNo||member.resident_no} />\n                  <InfoRow label="자격증명 발급번호" value={member.certIssueNo||member.cert_issue_no} />')
    write(p,t)
    print('- Modals.jsx: 회원상세 중앙 모달/폐업번호 예시/사유 선택/상세필드 보강')


def patch_bank():
    p = ROOT/'frontend'/'static'/'app'/'BankMatching.jsx'
    if not p.exists():
        print('! BankMatching.jsx 없음 - 건너뜀')
        return
    backup(p)
    t = read(p)
    # Slight compact readability
    t = t.replace('padding:"12px 16px"', 'padding:"9px 12px"')
    t = t.replace('font:"var(--fw-demibold) 14px/1 var(--font-sans)"', 'font:"var(--fw-demibold) 13px/1 var(--font-sans)"')
    t = t.replace('font:"var(--body-sm)"', 'font:"13px/1.4 var(--font-sans)"')
    write(p,t)
    print('- BankMatching.jsx: 통장매칭 테이블 글씨/간격 압축')


def main():
    print('[MISU REALUSE PATCH] repo:', ROOT)
    for fn in [patch_dashboard, patch_members, patch_closures, patch_pending, patch_app, patch_receivables, patch_modals, patch_bank]:
        try:
            fn()
        except Exception as e:
            print(f'! {fn.__name__} 실패: {e}')
    print('\n완료. git status 확인 후 commit/push 하세요. 백업 파일은 *.bak_realuse 입니다.')

if __name__ == '__main__':
    main()
