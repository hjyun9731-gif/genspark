# -*- coding: utf-8 -*-
"""
MISU 4TH REMAINING PATCH
남은 미동작 항목 중심 보정.
"""
from pathlib import Path
import re

ROOT = Path.cwd()

def p(rel): return ROOT / rel

def read(rel): return p(rel).read_text(encoding="utf-8")

def write(rel, s):
    path = p(rel)
    if path.exists():
        bak = path.with_suffix(path.suffix + ".bak_4th")
        if not bak.exists():
            bak.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    path.write_text(s, encoding="utf-8")
    print(f"- patched {rel}")

def ensure_import(s, name):
    if re.search(rf"(?m)^import\s+{re.escape(name)}\b", s):
        return s
    m = re.search(r"(?m)^import\s+[^\n]+", s)
    if m:
        return s[:m.end()] + f"\nimport {name}" + s[m.end():]
    return f"import {name}\n" + s

# 1) imports.py: 전체면허자현황 주소/공문주소/주민번호/자격증명번호 memo 저장
rel = "backend/app/routers/imports.py"
if p(rel).exists():
    s = read(rel)
    helper = '''

def _member_info_note(row: dict[str, Any]) -> str | None:
    """전체면허자현황의 기본정보를 Member.memo에 구조화 보존한다."""
    parts: list[str] = []
    pairs = [
        ("주소", row.get("주소")),
        ("공문주소", row.get("공문 주소") or row.get("공문주소")),
        ("주민등록번호", row.get("주민등록번호")),
        ("자격증명 발급번호", row.get("자격증명 발급번호")),
        ("전화번호", row.get("전화번호")),
        ("운전면허증번호", row.get("운전면허증번호")),
        ("사업자등록번호", row.get("사업자등록번호")),
        ("소속업체", row.get("소속업체")),
        ("대리인", row.get("대리인")),
        ("구조변경", row.get("구조변경")),
    ]
    for label, value in pairs:
        v = _clean(value)
        if v:
            parts.append(f"{label}:{v}")
    for k in ["비고", "비고2", "비고3", "전화 메모"]:
        v = _clean(row.get(k))
        if v:
            parts.append(f"원장 {k}:{v}")
    return " / ".join(parts)[:1800] if parts else None
'''
    if "def _member_info_note" not in s:
        s = s.replace("def _is_contact_problem_note", helper + "\n\ndef _is_contact_problem_note", 1)
    s = s.replace("공문\\s*주소", "공문\\s*주소|공문주소")
    s = s.replace("            memo = _ledger_note(row)\n", "            memo = _member_info_note(row)\n")
    old = '''                cleaned_memo = _strip_generated_member_memo(m.memo)
                if memo:
                    m.memo = _append_unique_note(cleaned_memo, "원장 비고", memo)
                else:
                    m.memo = cleaned_memo
'''
    new = '''                cleaned_memo = _strip_generated_member_memo(m.memo)
                parts = [x for x in [cleaned_memo, memo] if x]
                m.memo = " / ".join(parts)[:1800] if parts else None
'''
    if old in s:
        s = s.replace(old, new)
    write(rel, s)

# 2) members.py: memo 파싱 응답 + summary endpoint
rel = "backend/app/routers/members.py"
if p(rel).exists():
    s = read(rel)
    s = ensure_import(s, "re")
    helper = '''

def _memo_field(raw: str | None, labels: list[str]) -> str:
    text = raw or ""
    if not text:
        return ""
    parts = [p.strip() for p in re.split(r"\\s*/\\s*", text) if p.strip()]
    norm_labels = [re.sub(r"\\s+", "", x) for x in labels]
    for part in parts:
        if "=" in part and ":" not in part:
            key, val = part.split("=", 1)
        elif ":" in part:
            key, val = part.split(":", 1)
        elif "：" in part:
            key, val = part.split("：", 1)
        else:
            continue
        if re.sub(r"\\s+", "", key) in norm_labels:
            return val.strip()
    return ""
'''
    if "def _memo_field" not in s:
        s = s.replace("def _open_items", helper + "\n\ndef _open_items", 1)
    if "address_from_memo = _memo_field" not in s:
        s = s.replace("    out = {\n", '''    memo_text = member.memo or ""
    address_from_memo = _memo_field(memo_text, ["주소", "일반주소", "주 소"])
    public_address_from_memo = _memo_field(memo_text, ["공문주소", "공문 주소", "공문"])
    resident_no_from_memo = _memo_field(memo_text, ["주민등록번호", "주민번호"])
    cert_issue_no_from_memo = _memo_field(memo_text, ["자격증명 발급번호", "자격증명번호"])
    tel_from_memo = _memo_field(memo_text, ["전화번호"])

    out = {
''', 1)
    if '"publicAddress": public_address_from_memo' not in s:
        s = s.replace('''        "memo": member.memo,
''', '''        "memo": member.memo,
        "address": address_from_memo,
        "public_address": public_address_from_memo,
        "publicAddress": public_address_from_memo,
        "resident_no": resident_no_from_memo,
        "residentNo": resident_no_from_memo,
        "cert_issue_no": cert_issue_no_from_memo,
        "certIssueNo": cert_issue_no_from_memo,
        "tel": tel_from_memo,
''', 1)
    if '@router.get("/summary")' not in s:
        summary = '''

@router.get("/summary")
def members_summary(
    q: str | None = Query(None),
    sigun: str | None = None,
    member_type: str | None = None,
    membership: str | None = None,
    status: str | None = Query("정상"),
    has_arrears: bool | None = Query(True),
    min_balance: int | None = None,
    max_balance: int | None = None,
    include_zero: bool = Query(False),
    include_prepaid: bool = Query(False),
    min_months: int | None = None,
    max_months: int | None = None,
    db: Session = Depends(get_db),
):
    data = list_members(q=q, sigun=sigun, member_type=member_type, membership=membership, status=status,
                        has_arrears=has_arrears, min_balance=min_balance, max_balance=max_balance,
                        include_zero=include_zero, include_prepaid=include_prepaid,
                        min_months=min_months, max_months=max_months, page=1, size=20000, db=db)
    total_balance = sum(max(int(x.get("arrears_amount") or x.get("totalArrears") or 0), 0) for x in data)
    return {
        "totalCount": len(data),
        "currentPageCount": len(data),
        "totalBalance": total_balance,
        "unpaidCount": sum(1 for x in data if int(x.get("arrears_amount") or 0) > 0),
        "paidOrZeroCount": sum(1 for x in data if int(x.get("arrears_amount") or 0) == 0),
        "prepaidCount": sum(1 for x in data if int(x.get("arrears_amount") or 0) < 0),
        "over300kCount": sum(1 for x in data if int(x.get("arrears_amount") or 0) >= 300000),
        "over12MonthsCount": sum(1 for x in data if int(x.get("arrears_months") or x.get("arrearsMonths") or 0) >= 12),
    }
'''
        s = s.replace("@router.get(\"/{member_id}\")", summary + "\n\n@router.get(\"/{member_id}\")", 1)
    write(rel, s)

# 3) closures.py: 폐업현황 미납항목/기간/주소 보강
rel = "backend/app/routers/closures.py"
if p(rel).exists():
    s = read(rel)
    s = ensure_import(s, "math")
    s = ensure_import(s, "re")
    s = s.replace("from ..models import Closure, MemberHistory", "from ..models import Closure, Member, MemberHistory, ReceivableItem")
    helper = '''

def _memo_field(raw: str | None, labels: list[str]) -> str:
    text = raw or ""
    parts = [p.strip() for p in re.split(r"\\s*/\\s*", text) if p.strip()]
    norm_labels = [re.sub(r"\\s+", "", x) for x in labels]
    for part in parts:
        if ":" in part:
            key, val = part.split(":", 1)
        elif "：" in part:
            key, val = part.split("：", 1)
        else:
            continue
        if re.sub(r"\\s+", "", key) in norm_labels:
            return val.strip()
    return ""
'''
    if "def _memo_field" not in s:
        s = s.replace("def _closure_dict", helper + "\n\ndef _closure_dict", 1)
    s = s.replace(".options(selectinload(Closure.member))", ".options(selectinload(Closure.member).selectinload(Member.receivable_items))")
    if "open_items = [x for x in m.receivable_items" not in s:
        s = s.replace('''def _closure_dict(c: Closure) -> dict:
    m = c.member
    return {
''', '''def _closure_dict(c: Closure) -> dict:
    m = c.member
    open_items = [x for x in m.receivable_items if (not x.is_paid) and x.amount > 0] if m else []
    unpaid_balance = sum(int(x.amount or 0) for x in open_items) if open_items else int(c.unpaid_balance or 0)
    monthly = int(getattr(m, "monthly_charge", 0) or 0) if m else 0
    unpaid_months = max(len(open_items), math.ceil(unpaid_balance / monthly) if monthly > 0 and unpaid_balance > 0 else 0)
    unpaid_items = ", ".join(sorted({(x.charge_item or getattr(m, "charge_item", "")) for x in open_items if (x.charge_item or getattr(m, "charge_item", ""))})) or (getattr(m, "charge_item", "") if m else "")
    memo_text = m.memo if m else ""
    address = _memo_field(memo_text, ["주소", "일반주소"])
    public_address = _memo_field(memo_text, ["공문주소", "공문 주소"])
    collect_status = _memo_field(c.content, ["추심상태"]) or _memo_field(memo_text, ["추심상태"]) or "안내전"
    last_notice = _memo_field(c.content, ["마지막안내일"]) or ""
    return {
''', 1)
    if '"unpaidItem": unpaid_items' not in s:
        s = s.replace('''        "phone": m.phone if m else "",
''', '''        "phone": m.phone if m else "",
        "address": address,
        "publicAddress": public_address,
        "public_address": public_address,
        "unpaidItem": unpaid_items,
        "unpaid_item": unpaid_items,
        "unpaidMonths": unpaid_months,
        "unpaid_months": unpaid_months,
        "collectStatus": collect_status,
        "collect_status": collect_status,
        "lastNoticeDate": last_notice,
        "last_notice_date": last_notice,
''', 1)
        s = s.replace('''        "unpaidBalance": c.unpaid_balance,
        "unpaid_balance": c.unpaid_balance,
''', '''        "unpaidBalance": unpaid_balance,
        "unpaid_balance": unpaid_balance,
''', 1)
    write(rel, s)

# 4) pending.py: 예정자 backend 메모/부과시작일 보강
rel = "backend/app/routers/pending.py"
if p(rel).exists():
    s = read(rel)
    s = ensure_import(s, "calendar")
    s = ensure_import(s, "re")
    if "address: str | None = None" not in s:
        s = s.replace('''    step: str | None = None
''', '''    step: str | None = None
    address: str | None = None
    public_address: str | None = None
    publicAddress: str | None = None
    resident_no: str | None = None
    residentNo: str | None = None
    cert_issue_no: str | None = None
    certIssueNo: str | None = None
    doc_no: str | None = None
    docNo: str | None = None
''')
    helper = '''

def _next_month_same_day(d: date | None) -> date:
    d = d or date.today()
    y, m = d.year, d.month + 1
    if m == 13:
        y += 1
        m = 1
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


def _memo_field(raw: str | None, labels: list[str]) -> str:
    text = raw or ""
    for part in re.split(r"\\s*/\\s*", text):
        if ":" in part:
            k, v = part.split(":", 1)
        elif "：" in part:
            k, v = part.split("：", 1)
        else:
            continue
        if re.sub(r"\\s+", "", k) in [re.sub(r"\\s+", "", x) for x in labels]:
            return v.strip()
    return ""


def _pending_note(payload, existing: str | None = None, cert_date: date | None = None) -> str | None:
    parts = [p.strip() for p in re.split(r"\\s*/\\s*", existing or "") if p.strip()]
    remove = {"주소", "공문주소", "주민등록번호", "자격증명발급번호", "접수공문번호", "부과시작일"}
    kept = []
    for part in parts:
        key = part.split(":", 1)[0].split("：", 1)[0]
        if re.sub(r"\\s+", "", key) not in remove:
            kept.append(part)
    vals = {
        "주소": getattr(payload, "address", None),
        "공문주소": getattr(payload, "public_address", None) or getattr(payload, "publicAddress", None),
        "주민등록번호": getattr(payload, "resident_no", None) or getattr(payload, "residentNo", None),
        "자격증명발급번호": getattr(payload, "cert_issue_no", None) or getattr(payload, "certIssueNo", None),
        "접수공문번호": getattr(payload, "doc_no", None) or getattr(payload, "docNo", None),
        "부과시작일": _next_month_same_day(cert_date).isoformat() if cert_date else None,
    }
    for k, v in vals.items():
        if v:
            kept.append(f"{k}:{v}")
    note = getattr(payload, "note", None)
    if note:
        kept.append(str(note))
    return " / ".join(kept)[:1800] if kept else None
'''
    if "def _next_month_same_day" not in s:
        s = s.replace("def _next_member_id", helper + "\n\ndef _next_member_id", 1)
    if '"address": _memo_field' not in s:
        s = s.replace('''        "note": p.note,
''', '''        "note": p.note,
        "address": _memo_field(p.note, ["주소"]),
        "publicAddress": _memo_field(p.note, ["공문주소", "공문 주소"]),
        "public_address": _memo_field(p.note, ["공문주소", "공문 주소"]),
        "residentNo": _memo_field(p.note, ["주민등록번호", "주민번호"]),
        "resident_no": _memo_field(p.note, ["주민등록번호", "주민번호"]),
        "certIssueNo": _memo_field(p.note, ["자격증명발급번호", "자격증명 발급번호"]),
        "cert_issue_no": _memo_field(p.note, ["자격증명발급번호", "자격증명 발급번호"]),
        "docNo": _memo_field(p.note, ["접수공문번호", "공문번호", "접수번호"]),
        "doc_no": _memo_field(p.note, ["접수공문번호", "공문번호", "접수번호"]),
        "billingStartDate": _memo_field(p.note, ["부과시작일"]),
        "billing_start_date": _memo_field(p.note, ["부과시작일"]),
''', 1)
    s = s.replace("        note=payload.note,", "        note=_pending_note(payload, payload.note, cert_date),")
    s = s.replace('''        ("note", payload.note),
''', '''        ("note", _pending_note(payload, p.note, payload.cert_issue_date or payload.certIssueDate or p.cert_issue_date)),
''')
    s = s.replace("        memo=payload.note or p.note,", "        memo=_pending_note(payload, payload.note or p.note, cert_date),")
    s = s.replace("content=f\"예정자에서 전체자명단 전환 / 부과시작 {billing_start_ym}\"", "content=f\"예정자에서 전체자명단 전환 / 부과시작월 {billing_start_ym} / 부과시작일 {_next_month_same_day(cert_date).isoformat()}\"")
    write(rel, s)

# 5) Regional.jsx 전체 교체: 지역별/알토란/제외자 관리
rel = "frontend/static/app/Regional.jsx"
if p(rel).exists():
    regional_js = r'''// 지역별·문자 / 알토란 / 제외자 관리 — 실사용 보강판
const { Card, Icon, Toggle } = window.PayroleDesignSystem_9db006;
const TABS_NAV = ["문자 대상 추출", "알토란 엑셀 추출", "제외자/지로희망자 관리"];
const EXCLUSION_API = "/api/members/exclusion-rules";
function OptToggle({ label, sub, checked, onChange }) { return <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,cursor:"pointer",padding:"8px 0"}}><span><div style={{font:"var(--fw-medium) 13px/1.3 var(--font-sans)",color:"var(--text-primary)"}}>{label}</div>{sub&&<div style={{font:"var(--body-xs)",color:"var(--text-tertiary)",marginTop:2}}>{sub}</div>}</span><Toggle checked={checked} onChange={onChange}/></label>; }
function RChip({ active, onClick, children }) { return <button type="button" onClick={onClick} style={{height:31,padding:"0 11px",borderRadius:"var(--radius-pill)",cursor:"pointer",whiteSpace:"nowrap",border:active?"1px solid var(--brand)":"1px solid var(--border-default)",background:active?"var(--brand)":"var(--white)",color:active?"#fff":"var(--text-secondary)",font:"var(--fw-medium) 12px/1 var(--font-sans)"}}>{children}</button>; }
function Field({label, children}){ return <div style={{display:"flex",flexDirection:"column",gap:6}}><label style={{font:"var(--fw-medium) 12px/1 var(--font-sans)",color:"var(--text-tertiary)"}}>{label}</label>{children}</div>; }
const inputStyle={height:34,padding:"0 10px",border:"1px solid var(--border-default)",borderRadius:"var(--radius-md)",font:"13px/1 var(--font-sans)",boxSizing:"border-box",background:"var(--white)",color:"var(--text-primary)"};
function norm(v){return String(v||"").replace(/[\s\-]/g,"").trim();}
function moneyValue(v){ const n=parseInt(String(v??"").replace(/,/g,""),10); return Number.isFinite(n)?n:0; }
function exclusionKey(x){ return [norm(x.mgmtNo||x.mgmt_no), norm(x.vehicleNo||x.vehicle_no), norm(x.name), norm(x.phone)].join("|"); }
function ruleMatches(rule, m){ const a=[norm(rule.mgmtNo||rule.mgmt_no), norm(rule.vehicleNo||rule.vehicle_no), norm(rule.name), norm(rule.phone)].filter(Boolean); const b=[norm(m.mgmtNo||m.mgmt_no), norm(m.vehicleNo||m.vehicle_no), norm(m.name), norm(m.phone)]; return a.some(v=>b.includes(v)); }
function downloadCsv(filename, rows){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\ufeff"+rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n")],{type:"text/csv;charset=utf-8"})); a.download=filename; a.click(); }
function RegionalFilters({ D, regions, setRegions, chargeItems, setChargeItems, minAmt, setMinAmt, maxAmt, setMaxAmt, includeZero, setIncludeZero, includePrepaid, setIncludePrepaid, excludeNoPhone, setExcludeNoPhone, excludeJiro, setExcludeJiro, excludeSms, setExcludeSms }){ const toggleRegion=r=>setRegions(rs=>rs.includes(r)?rs.filter(x=>x!==r):[...rs,r]); const toggleCharge=c=>setChargeItems(cs=>cs.includes(c)?cs.filter(x=>x!==c):[...cs,c]); return <Card style={{position:"sticky",top:0}}><div style={{font:"var(--fw-demibold) 12px/1 var(--font-sans)",color:"var(--text-tertiary)",marginBottom:10}}>지역</div><div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}><RChip active={!regions.length} onClick={()=>setRegions([])}>전체</RChip>{D.REGIONS.map(r=><RChip key={r} active={regions.includes(r)} onClick={()=>toggleRegion(r)}>{r}</RChip>)}</div><div style={{font:"var(--fw-demibold) 12px/1 var(--font-sans)",color:"var(--text-tertiary)",marginBottom:10}}>부과항목</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>{["협회비","관리비","70세"].map(c=><RChip key={c} active={chargeItems.includes(c)} onClick={()=>toggleCharge(c)}>{c}</RChip>)}</div><div style={{height:1,background:"var(--border-subtle)",margin:"12px 0"}}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><Field label="최소금액"><input value={minAmt} onChange={e=>setMinAmt(e.target.value)} placeholder="예: 30000" style={inputStyle}/></Field><Field label="최대금액"><input value={maxAmt} onChange={e=>setMaxAmt(e.target.value)} placeholder="예: 300000" style={inputStyle}/></Field></div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{[["3만원↑",30000],["5만원↑",50000],["30만원↑",300000]].map(([l,v])=><RChip key={l} active={moneyValue(minAmt)===v} onClick={()=>setMinAmt(String(v))}>{l}</RChip>)}<RChip active={!minAmt&&!maxAmt} onClick={()=>{setMinAmt("");setMaxAmt("");}}>금액전체</RChip></div><OptToggle label="0원 포함" checked={includeZero} onChange={setIncludeZero}/><OptToggle label="선납 포함" checked={includePrepaid} onChange={setIncludePrepaid}/><OptToggle label="전화번호 없는 사람 제외" checked={excludeNoPhone} onChange={setExcludeNoPhone}/><OptToggle label="지로희망자 제외" checked={excludeJiro} onChange={setExcludeJiro}/><OptToggle label="문자제외자 제외" checked={excludeSms} onChange={setExcludeSms}/></Card>; }
function useRegionalData(membersProp, onToast){ const [allMembers,setAllMembers]=React.useState(membersProp||[]); const [rules,setRules]=React.useState([]); const [loading,setLoading]=React.useState(false); const load=React.useCallback(async()=>{ setLoading(true); try{ const [mRes,rRes]=await Promise.all([fetch('/api/members?page=1&size=20000&status=정상&has_arrears=true&include_zero=false&include_prepaid=false'), fetch(EXCLUSION_API).catch(()=>null)]); if(mRes.ok) setAllMembers(await mRes.json()); if(rRes&&rRes.ok){ const data=await rRes.json(); setRules(Array.isArray(data)?data:(data.items||[])); } else setRules(JSON.parse(localStorage.getItem('misuExclusionRules')||'[]')); }catch(e){ onToast&&onToast('지역별 데이터 로드 실패'); setRules(JSON.parse(localStorage.getItem('misuExclusionRules')||'[]')); } finally{setLoading(false);} },[]); React.useEffect(()=>{load();},[load]); return {allMembers, rules, setRules, reload:load, loading}; }
function filterMembers({members,D,rules,regions,chargeItems,minAmt,maxAmt,includeZero,includePrepaid,excludeNoPhone,excludeJiro,excludeSms}){ const min=moneyValue(minAmt), max=moneyValue(maxAmt); return (members||[]).filter(m=>{ if(m.status && m.status!=="정상") return false; const out=D.outstanding(m); if(out<=0 && !includeZero) return false; if(out<0 && !includePrepaid) return false; if(min && out<min) return false; if(max && out>max) return false; if(regions.length && !regions.includes(m.sigun)) return false; const item=m.chargeItem||m.charge_item||""; if(chargeItems.length && !chargeItems.includes(item)) return false; if(excludeNoPhone && !m.phone) return false; const matched=rules.filter(r=>r.active!==false && ruleMatches(r,m)); const memo=String(m.memo||m.note||""); if(excludeJiro && (matched.some(r=>(r.type||r.exclude_type||"").includes("지로")) || memo.includes("지로"))) return false; if(excludeSms && matched.some(r=>(r.type||r.exclude_type||"").includes("문자"))) return false; return true; }); }
function SummaryBar({D, rows, label, onDownload}){ const total=rows.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0); return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--white)",border:"1px solid var(--border-subtle)",borderRadius:"var(--radius-lg)",padding:"14px 18px",boxShadow:"var(--shadow-xs)"}}><div style={{display:"flex",gap:24}}><div><div style={{font:"var(--body-xs)",color:"var(--text-tertiary)"}}>{label}</div><div style={{font:"var(--fw-bold) 22px/1.1 var(--font-sans)"}}>{rows.length}<span style={{fontSize:14,color:"var(--text-tertiary)",fontWeight:500}}>명</span></div></div><div><div style={{font:"var(--body-xs)",color:"var(--text-tertiary)"}}>미수금 합계</div><div style={{font:"var(--fw-bold) 22px/1.1 var(--font-sans)",color:"var(--red-500)"}}>{D.won(total)}</div></div></div><window.PMUI.DownloadBtn onClick={onDownload} label="엑셀 다운로드"/></div>; }
function MemberTable({D, rows}){ return <Card padded={false}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["지역","관리번호","성명","차량번호","항목","현재잔액","핸드폰","주소"].map((h,i)=><th key={h} style={{textAlign:i===5?"right":"left",padding:"9px 14px",font:"var(--fw-demibold) 11px/1 var(--font-sans)",color:"var(--text-tertiary)",background:"var(--grey-25)",borderBottom:"1px solid var(--border-subtle)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{rows.slice(0,500).map((m,i)=><tr key={m.id||i} style={{borderBottom:"1px solid var(--border-subtle)"}}><td style={{padding:"9px 14px",font:"var(--body-sm)"}}>{m.sigun||"—"}</td><td style={{padding:"9px 14px",font:"var(--body-sm)",color:"var(--text-tertiary)"}}>{m.mgmtNo||m.mgmt_no||"—"}</td><td style={{padding:"9px 14px",font:"var(--fw-demibold) 13px/1 var(--font-sans)"}}>{m.name}</td><td style={{padding:"9px 14px",font:"var(--body-sm)"}}>{m.vehicleNo||m.vehicle_no}</td><td style={{padding:"9px 14px",font:"var(--body-sm)"}}>{m.chargeItem||m.charge_item}</td><td style={{padding:"9px 14px",textAlign:"right",font:"var(--fw-demibold) 13px/1 var(--font-sans)",color:"var(--red-500)"}}>{D.won(D.outstanding(m))}</td><td style={{padding:"9px 14px",font:"var(--body-sm)"}}>{m.phone||"—"}</td><td style={{padding:"9px 14px",font:"var(--body-xs)",color:"var(--text-tertiary)",maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.address||m.publicAddress||m.public_address||"—"}</td></tr>)}</tbody></table>{rows.length>500&&<div style={{padding:"10px 14px",font:"var(--body-xs)",color:"var(--text-tertiary)"}}>화면에는 500명까지만 미리보기 표시됩니다. 엑셀에는 전체가 반영됩니다.</div>}</Card> }
function TabExtract({ mode, members, rules, D, onToast }){ const [regions,setRegions]=React.useState([]), [chargeItems,setChargeItems]=React.useState(["협회비","관리비","70세"]), [minAmt,setMinAmt]=React.useState("30000"), [maxAmt,setMaxAmt]=React.useState(""), [includeZero,setIncludeZero]=React.useState(false), [includePrepaid,setIncludePrepaid]=React.useState(false), [excludeNoPhone,setExcludeNoPhone]=React.useState(true), [excludeJiro,setExcludeJiro]=React.useState(true), [excludeSms,setExcludeSms]=React.useState(true); const today=new Date(); const [issueMonth,setIssueMonth]=React.useState(String(today.getMonth()+1)); const [issueDate,setIssueDate]=React.useState(`${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}.`); const rows=React.useMemo(()=>filterMembers({members,D,rules,regions,chargeItems,minAmt,maxAmt,includeZero,includePrepaid,excludeNoPhone,excludeJiro,excludeSms}),[members,rules,regions,chargeItems,minAmt,maxAmt,includeZero,includePrepaid,excludeNoPhone,excludeJiro,excludeSms]); const exportRows=()=>{ if(mode==='altoran'){ if(typeof XLSX==='undefined'){ onToast('엑셀 라이브러리 로드 실패. 새로고침 후 다시 시도하세요.'); return; } const head=["코드","상호","대표자명","기타사원","핸드폰","거래처구분","품목 코드","지로발행명목","규격(월분)","발행연월일","발행금액"]; const data=[head]; rows.forEach((m,i)=>data.push([String(i+1).padStart(6,'0'),m.vehicleNo||m.vehicle_no||"",m.name||"",m.chargeItem||m.charge_item||"",m.phone||"","S","00005",m.chargeItem||m.charge_item||"",`${issueMonth}월분`,issueDate,D.outstanding(m)])); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'Sheet1'); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["항목","건수/금액"],["입력 건수",rows.length],["발행금액 합계",rows.reduce((s,m)=>s+D.outstanding(m),0)],["발행월",`${issueMonth}월분`],["발행연월일",issueDate]]),'요약'); XLSX.writeFile(wb,`(문자)${issueMonth}월_알토란추출.xlsx`); onToast(`알토란 추출 완료 · ${rows.length}명`); } else { downloadCsv('문자대상추출.csv', [["지역","성명","차량번호","핸드폰","항목","현재잔액"],...rows.map(m=>[m.sigun,m.name,m.vehicleNo||m.vehicle_no,m.phone,m.chargeItem||m.charge_item,D.outstanding(m)])]); onToast(`문자 대상 추출 완료 · ${rows.length}명`); } }; return <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:20,alignItems:"start"}}><div><RegionalFilters D={D} regions={regions} setRegions={setRegions} chargeItems={chargeItems} setChargeItems={setChargeItems} minAmt={minAmt} setMinAmt={setMinAmt} maxAmt={maxAmt} setMaxAmt={setMaxAmt} includeZero={includeZero} setIncludeZero={setIncludeZero} includePrepaid={includePrepaid} setIncludePrepaid={setIncludePrepaid} excludeNoPhone={excludeNoPhone} setExcludeNoPhone={setExcludeNoPhone} excludeJiro={excludeJiro} setExcludeJiro={setExcludeJiro} excludeSms={excludeSms} setExcludeSms={setExcludeSms}/>{mode==='altoran'&&<Card style={{marginTop:12}}><div style={{font:"var(--fw-demibold) 12px/1 var(--font-sans)",color:"var(--text-tertiary)",marginBottom:10}}>알토란 발행정보</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Field label="발행월"><input value={issueMonth} onChange={e=>setIssueMonth(e.target.value)} style={inputStyle}/></Field><Field label="발행연월일"><input value={issueDate} onChange={e=>setIssueDate(e.target.value)} style={inputStyle}/></Field></div></Card>}</div><div style={{display:"flex",flexDirection:"column",gap:14}}><SummaryBar D={D} rows={rows} label={mode==='altoran'?"알토란 대상":"문자 대상"} onDownload={exportRows}/><MemberTable D={D} rows={rows}/></div></div>; }
function TabExcluded({ rules, setRules, reload, onToast }){ const empty={type:"문자제외",sigun:"",name:"",vehicleNo:"",mgmtNo:"",phone:"",reason:"",startDate:new Date().toISOString().slice(0,10),memo:"",active:true}; const [form,setForm]=React.useState(empty); const [editing,setEditing]=React.useState(null); const save=async()=>{ const payload={...form, id:editing||form.id, active:true}; try{ const res=await fetch(editing?`${EXCLUSION_API}/${editing}`:EXCLUSION_API,{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(res.ok){await reload(); onToast(editing?'제외자 수정 완료':'제외자 추가 완료'); setEditing(null); setForm(empty); return;} }catch(e){} const next=editing?rules.map(r=>r.id===editing?payload:r):[{...payload,id:Date.now()},...rules]; setRules(next); localStorage.setItem('misuExclusionRules',JSON.stringify(next)); setEditing(null); setForm(empty); onToast('브라우저 저장으로 제외자 반영 완료'); }; const remove=async(r)=>{ try{ const res=await fetch(`${EXCLUSION_API}/${r.id}`,{method:'DELETE'}); if(res.ok){await reload(); onToast('제외자 해제 완료'); return;} }catch(e){} const next=rules.filter(x=>x.id!==r.id); setRules(next); localStorage.setItem('misuExclusionRules',JSON.stringify(next)); onToast('제외자 해제 완료'); }; const startEdit=r=>{setEditing(r.id); setForm({...empty,...r, vehicleNo:r.vehicleNo||r.vehicle_no||"", mgmtNo:r.mgmtNo||r.mgmt_no||""});}; const set=(k,v)=>setForm(f=>({...f,[k]:v})); return <div style={{display:"flex",flexDirection:"column",gap:14}}><Card><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{font:"var(--fw-bold) 16px/1 var(--font-sans)"}}>제외자/지로희망자 추가·수정</div><button onClick={()=>{setEditing(null);setForm(empty);}} style={{...inputStyle,cursor:"pointer"}}>새로 입력</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}><Field label="제외유형"><select value={form.type} onChange={e=>set('type',e.target.value)} style={inputStyle}>{["문자제외","지로희망","자동이체","기타"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="지역"><input value={form.sigun||""} onChange={e=>set('sigun',e.target.value)} style={inputStyle}/></Field><Field label="성명"><input value={form.name||""} onChange={e=>set('name',e.target.value)} style={inputStyle}/></Field><Field label="차량번호"><input value={form.vehicleNo||""} onChange={e=>set('vehicleNo',e.target.value)} style={inputStyle}/></Field><Field label="관리번호"><input value={form.mgmtNo||""} onChange={e=>set('mgmtNo',e.target.value)} style={inputStyle}/></Field><Field label="핸드폰"><input value={form.phone||""} onChange={e=>set('phone',e.target.value)} style={inputStyle}/></Field><Field label="시작일"><input type="date" value={form.startDate||""} onChange={e=>set('startDate',e.target.value)} style={inputStyle}/></Field><Field label="사유"><input value={form.reason||""} onChange={e=>set('reason',e.target.value)} style={inputStyle}/></Field></div><div style={{marginTop:10}}><Field label="메모"><input value={form.memo||""} onChange={e=>set('memo',e.target.value)} style={{...inputStyle,width:"100%"}}/></Field></div><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}><button onClick={save} style={{height:36,padding:"0 16px",border:"none",borderRadius:"var(--radius-md)",background:"var(--brand)",color:"#fff",font:"var(--fw-demibold) 13px/1 var(--font-sans)",cursor:"pointer"}}>{editing?'수정 저장':'추가'}</button></div></Card><Card padded={false}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["유형","지역","성명","차량번호","관리번호","핸드폰","사유/메모","처리"].map(h=><th key={h} style={{padding:"9px 14px",textAlign:"left",font:"var(--fw-demibold) 11px/1 var(--font-sans)",color:"var(--text-tertiary)",background:"var(--grey-25)",borderBottom:"1px solid var(--border-subtle)"}}>{h}</th>)}</tr></thead><tbody>{rules.length===0&&<tr><td colSpan={8} style={{padding:30,textAlign:"center",color:"var(--text-tertiary)"}}>등록된 제외자가 없습니다.</td></tr>}{rules.map(r=><tr key={r.id||exclusionKey(r)} style={{borderBottom:"1px solid var(--border-subtle)"}}><td style={{padding:"9px 14px"}}>{r.type||r.exclude_type}</td><td style={{padding:"9px 14px"}}>{r.sigun}</td><td style={{padding:"9px 14px",fontWeight:700}}>{r.name}</td><td style={{padding:"9px 14px"}}>{r.vehicleNo||r.vehicle_no}</td><td style={{padding:"9px 14px"}}>{r.mgmtNo||r.mgmt_no}</td><td style={{padding:"9px 14px"}}>{r.phone}</td><td style={{padding:"9px 14px",color:"var(--text-tertiary)"}}>{r.reason||r.memo}</td><td style={{padding:"9px 14px",whiteSpace:"nowrap"}}><button onClick={()=>startEdit(r)} style={{marginRight:6}}>수정</button><button onClick={()=>remove(r)}>해제</button></td></tr>)}</tbody></table></Card></div>; }
function Regional({ members, onToast }){ const D=window.PMData; const [activeTab,setActiveTab]=React.useState(Number(localStorage.getItem('misuRegionalTab')||0)); const {allMembers,rules,setRules,reload,loading}=useRegionalData(members,onToast); const setTab=i=>{setActiveTab(i);localStorage.setItem('misuRegionalTab',String(i));}; return <div style={{display:"flex",flexDirection:"column",gap:18}}><div style={{display:"flex",gap:0,borderBottom:"2px solid var(--border-subtle)"}}>{TABS_NAV.map((t,i)=><button key={t} type="button" onClick={()=>setTab(i)} style={{padding:"10px 18px",border:"none",borderBottom:activeTab===i?"2px solid var(--brand)":"2px solid transparent",marginBottom:-2,background:"none",cursor:"pointer",font:`var(--fw-${activeTab===i?'demibold':'medium'}) 14px/1 var(--font-sans)`,color:activeTab===i?"var(--brand)":"var(--text-secondary)"}}>{t}</button>)}</div>{loading&&<div style={{font:"var(--body-sm)",color:"var(--text-tertiary)"}}>전체 대상 불러오는 중…</div>}{activeTab===0&&<TabExtract mode="sms" members={allMembers} rules={rules} D={D} onToast={onToast}/>} {activeTab===1&&<TabExtract mode="altoran" members={allMembers} rules={rules} D={D} onToast={onToast}/>} {activeTab===2&&<TabExcluded rules={rules} setRules={setRules} reload={reload} onToast={onToast}/>}</div>; }
window.Regional = Regional;
'''
    write(rel, regional_js)

# 6) Receivables.jsx 기본값/전체 통계 표시
rel = "frontend/static/app/Receivables.jsx"
if p(rel).exists():
    s = read(rel)
    s = s.replace('React.useState("전체");', 'React.useState("미수있음");', 1)
    s = s.replace('const [inclZero, setInclZero] = React.useState(true);', 'const [inclZero, setInclZero] = React.useState(false);')
    s = s.replace('const [inclPrepaid, setInclPrepaid] = React.useState(true);', 'const [inclPrepaid, setInclPrepaid] = React.useState(false);')
    s = s.replace('setMinAmt(""); setMaxAmt(""); setInclZero(true); setInclPrepaid(true);', 'setMinAmt(""); setMaxAmt(""); setInclZero(false); setInclPrepaid(false);')
    s = s.replace('const [serverTotal, setServerTotal] = React.useState(0);', 'const [serverTotal, setServerTotal] = React.useState(0);\n  const [serverSummary, setServerSummary] = React.useState(null);')
    if "/api/members/summary" not in s:
        old = '''    setServerLoading(true);
    fetch(`/api/members?${params.toString()}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { setServerRows(data); setServerTotal(data.length + (page - 1) * PAGE_SIZE); setServerLoading(false); })
      .catch(() => { setServerLoading(false); });
'''
        new = '''    setServerLoading(true);
    const pageParams = new URLSearchParams(params);
    const summaryParams = new URLSearchParams(params);
    summaryParams.delete("page");
    summaryParams.delete("size");
    Promise.all([
      fetch(`/api/members?${pageParams.toString()}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(`/api/members/summary?${summaryParams.toString()}`).then(r => r.ok ? r.json() : null).catch(()=>null),
    ]).then(([data, summary]) => {
      setServerRows(data);
      setServerSummary(summary);
      setServerTotal(summary?.totalCount ?? (data.length + (page - 1) * PAGE_SIZE));
      setServerLoading(false);
    }).catch(() => { setServerLoading(false); });
'''
        if old in s:
            s = s.replace(old, new)
    s = s.replace('const sumOut = rows.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);', 'const pageSumOut = rows.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);\n  const sumOut = serverSummary?.totalBalance ?? pageSumOut;')
    s = s.replace('const over300 = rows.filter(m=>D.outstanding(m)>=300000).length;', 'const over300 = serverSummary?.over300kCount ?? rows.filter(m=>D.outstanding(m)>=300000).length;')
    s = s.replace('const longCnt = rows.filter(m=>D.arrearsMonths(m)>=12).length;', 'const longCnt = serverSummary?.over12MonthsCount ?? rows.filter(m=>D.arrearsMonths(m)>=12).length;')
    s = re.sub(r'  const countByAmount = \(key\)=> \(membersProp\|\|\[\]\)\.filter\(m=>\{[\s\S]*?  \}\)\.length;', '  const countByAmount = (key)=> (key === amount && serverSummary ? serverSummary.totalCount : null);', s, count=1)
    s = s.replace('function resetFilters(){ setQuery(""); setRegion(""); setMembership(""); setAccount(""); setAmount("전체"); setStatus("정상"); setSpecial(""); setSort({key:"outstanding",dir:"desc"}); setMinAmt(""); setMaxAmt(""); setInclZero(true); setInclPrepaid(true); setPage(1); }', 'function resetFilters(){ setQuery(""); setRegion(""); setMembership(""); setAccount(""); setAmount("미수있음"); setStatus("정상"); setSpecial(""); setSort({key:"outstanding",dir:"desc"}); setMinAmt(""); setMaxAmt(""); setInclZero(false); setInclPrepaid(false); setPage(1); }')
    s = s.replace('["검색 결과",`${num(rows.length)}명`', '["검색 결과",`현재 ${num(rows.length)}명 / 전체 ${num(serverTotal||rows.length)}명`')
    s = s.replace('["현재잔액 합계",won(sumOut)', '["전체 조건 합계",won(sumOut)')
    if '현재 페이지 합계' not in s:
        s = s.replace('["12개월 이상",`${num(longCnt)}명`,"#B9791A"]].map(([l,v,c])=>(', '["12개월 이상",`${num(longCnt)}명`,"#B9791A"],["현재 페이지 합계",won(pageSumOut),"var(--text-secondary)"]].map(([l,v,c])=>(')
        s = s.replace('gridTemplateColumns:"repeat(4,1fr)"', 'gridTemplateColumns:"repeat(5,1fr)"')
    write(rel, s)

# 7) Modals.jsx 중앙팝업/주소 fallback/폐업등록
rel = "frontend/static/app/Modals.jsx"
if p(rel).exists():
    s = read(rel)
    helper = '''
function memoField(obj, labels){
  const text = String(obj?.memo || obj?.note || "");
  const normLabels = labels.map(x=>String(x).replace(/\\s+/g,""));
  for (const part of text.split(/\\s*\\/\\s*/)) {
    const m = part.match(/^([^:：=]+)[:：=](.*)$/);
    if (m && normLabels.includes(m[1].replace(/\\s+/g,""))) return m[2].trim();
  }
  return "";
}
'''
    if "function memoField" not in s:
        s = s.replace("// ===== 수납 처리 모달 =====", helper + "\n// ===== 수납 처리 모달 =====", 1)
    s = s.replace('<Backdrop onClose={onClose} align="right">', '<Backdrop onClose={onClose}>')
    s = s.replace('style={{ width:580, background:"var(--white)", height:"100%", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)", animation:"pmSlide .22s ease" }}', 'style={{ width:"min(960px, calc(100vw - 32px))", maxHeight:"92vh", background:"var(--white)", borderRadius:"var(--radius-xl)", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)", animation:"pmPop .18s ease", overflow:"hidden" }}')
    s = s.replace('<InfoRow label="주소" value={member.address} />', '<InfoRow label="주소" value={member.address || memoField(member,["주소","일반주소"])} />')
    s = s.replace('<InfoRow label="공문주소" value={member.publicAddress||member.public_address} />', '<InfoRow label="공문주소" value={member.publicAddress||member.public_address || memoField(member,["공문주소","공문 주소"])} />')
    s = s.replace('>폐업/이탈</button>', '>폐업·이탈</button>')
    s = s.replace('placeholder="예: 접수2026-114"', 'placeholder={type==="폐업"?"예: 폐-26":type==="양도"?"예: 양-18":type==="이관"?"예: 이-8":"예: 탈-3"}')
    s = s.replace('<label style={fieldLabel}>처리내용 / 사유</label>', '<label style={fieldLabel}>메모 (선택)</label>')
    s = s.replace('placeholder="사유를 입력하면 처리이력에 기록됩니다"', 'placeholder="선택 입력"')
    s = s.replace('width:460, background', 'width:520, background')
    write(rel, s)

# 8) BankMatching.jsx 버튼/가독성
rel = "frontend/static/app/BankMatching.jsx"
if p(rel).exists():
    s = read(rel)
    if 'label:"카드결제"' not in s:
        s = s.replace('{ value:"기타",          label:"기타" },', '{ value:"카드결제",      label:"카드결제" },\n  { value:"현금결제",      label:"현금결제" },\n  { value:"기타",          label:"기타" },')
    s = s.replace('padding:"12px 16px"', 'padding:"9px 12px"')
    s = s.replace('padding:"11px 16px"', 'padding:"9px 12px"')
    s = s.replace('font:"var(--fw-demibold) 14px/1 var(--font-sans)"', 'font:"var(--fw-demibold) 13px/1 var(--font-sans)"')
    write(rel, s)

print("\n[MISU 4TH REMAINING PATCH] 완료")
print("적용 후 전체면허자현황, 2026미수금을 다시 업로드/반영하고 Ctrl+F5 하세요.")
