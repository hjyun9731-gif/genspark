# -*- coding: utf-8 -*-
"""
MISU 2차 패치
- 알토란 추출 필터/엑셀 양식 보강
- 제외자/지로희망자 관리 UI 추가(브라우저 저장 기반, 알토란 필터 연동)
- 통장매칭 수동처리 항목 확대(가수금/잡수입/카드결제/현금결제/기타/제외)
- 통장매칭 초기화 실제 DELETE 호출
- 폐업/이탈 등록 예시/필수항목 완화
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path.cwd()

def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")

def write(p: Path, s: str) -> None:
    bak = p.with_suffix(p.suffix + ".bak_2nd")
    if not bak.exists():
        bak.write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
    p.write_text(s, encoding="utf-8", newline="")

def replace_between(s: str, start: str, end: str, replacement: str, name: str) -> tuple[str, bool]:
    a = s.find(start)
    b = s.find(end, a + 1)
    if a == -1 or b == -1:
        print(f"- WARN {name}: 위치를 찾지 못했습니다")
        return s, False
    return s[:a] + replacement.rstrip() + "\n\n" + s[b:], True


def patch_regional():
    p = ROOT / "frontend/static/app/Regional.jsx"
    if not p.exists():
        print("- SKIP Regional.jsx 없음")
        return
    s = read(p)

    helper = r'''
// MISU_2ND_PATCH: 브라우저 저장 기반 제외자/지로희망자 관리
const EXCLUSION_STORE_KEY = "misu_exclusion_rules_v2";
function loadExclusionRules(){
  try { return JSON.parse(localStorage.getItem(EXCLUSION_STORE_KEY) || "[]"); } catch(e) { return []; }
}
function saveExclusionRules(rows){
  localStorage.setItem(EXCLUSION_STORE_KEY, JSON.stringify(rows || []));
  window.dispatchEvent(new CustomEvent("misu-exclusion-rules-changed"));
}
function memberKeyForExclusion(m){
  return [m?.id, m?.mgmtNo||m?.mgmt_no, m?.vehicleNo||m?.vehicle_no, m?.name].filter(Boolean).join("|");
}
function isExcludedByRule(m, type){
  const rules = loadExclusionRules();
  const name = String(m?.name || "").trim();
  const vehicle = String(m?.vehicleNo || m?.vehicle_no || "").replace(/\s/g,"");
  const mgmt = String(m?.mgmtNo || m?.mgmt_no || "").trim();
  const phone = String(m?.phone || "").replace(/\D/g,"");
  return rules.some(r => {
    if (type && r.excludeType && r.excludeType !== type && !(type === "문자제외" && r.excludeType === "지로희망")) return false;
    if (r.memberKey && r.memberKey === memberKeyForExclusion(m)) return true;
    if (r.mgmtNo && mgmt && r.mgmtNo === mgmt) return true;
    if (r.vehicleNo && vehicle && String(r.vehicleNo).replace(/\s/g,"") === vehicle) return true;
    if (r.phone && phone && String(r.phone).replace(/\D/g,"") === phone) return true;
    if (r.name && name && r.name === name) return true;
    return false;
  });
}
function inferExclusionType(m){
  const raw = `${m?.note||""} ${m?.memo||""}`;
  if (/지로|우편/.test(raw)) return "지로희망";
  if (/자동이체|CMS|자동/.test(raw)) return "자동이체";
  if (m?.excluded) return "문자제외";
  return "";
}
'''
    if "EXCLUSION_STORE_KEY" not in s:
        s = s.replace("function RChip({ active, onClick, children }) {", helper + "\nfunction RChip({ active, onClick, children }) {")

    new_altoran = r'''
function TabAltoran({ members, onToast }) {
  const D = window.PMData;
  const { REGIONS, won, outstanding } = D;
  const today = new Date();
  const [issueMonth, setIssueMonth] = React.useState(String(today.getMonth()+1));
  const [issueYear, setIssueYear] = React.useState(String(today.getFullYear()));
  const [issueDate, setIssueDate] = React.useState(
    `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}.`
  );
  const [regions, setRegions] = React.useState([]);
  const [charges, setCharges] = React.useState(["협회비","관리비","70세"]);
  const [minAmt, setMinAmt] = React.useState("30000");
  const [maxAmt, setMaxAmt] = React.useState("");
  const [includeZero, setIncludeZero] = React.useState(false);
  const [includePrepaid, setIncludePrepaid] = React.useState(false);
  const [excludeNoPhone, setExcludeNoPhone] = React.useState(true);
  const [excludeJiro, setExcludeJiro] = React.useState(true);
  const [excludeText, setExcludeText] = React.useState(true);
  const [, force] = React.useState(0);
  React.useEffect(()=>{ const h=()=>force(x=>x+1); window.addEventListener("misu-exclusion-rules-changed", h); return()=>window.removeEventListener("misu-exclusion-rules-changed", h); }, []);

  const toggleRegion = r => setRegions(rs => rs.includes(r) ? rs.filter(x=>x!==r) : [...rs,r]);
  const toggleCharge = c => setCharges(cs => cs.includes(c) ? cs.filter(x=>x!==c) : [...cs,c]);
  const parseAmt = v => {
    const n = Number(String(v||"").replace(/[^0-9\-]/g,""));
    return Number.isFinite(n) ? n : null;
  };
  const minA = parseAmt(minAmt);
  const maxA = parseAmt(maxAmt);

  const eligible = React.useMemo(() => {
    return (members||[]).filter(m => {
      if (m.status !== "정상") return false;
      const r = m.sigun || m.region || "";
      if (regions.length && !regions.includes(r)) return false;
      const chargeItem = m.chargeItem || m.charge_item || "협회비";
      const seniorItem = m.isSenior ? "70세" : chargeItem;
      if (!charges.includes(chargeItem) && !charges.includes(seniorItem)) return false;
      const amt = outstanding ? outstanding(m) : (m.current_balance ?? m.arrears_amount ?? m.totalArrears ?? 0);
      if (!includeZero && amt === 0) return false;
      if (!includePrepaid && amt < 0) return false;
      if (minA !== null && amt < minA) return false;
      if (maxA !== null && maxAmt !== "" && amt > maxA) return false;
      if (excludeNoPhone && !m.phone) return false;
      const raw = `${m.memo||""} ${m.note||""}`;
      if (excludeJiro && (/지로|우편/.test(raw) || isExcludedByRule(m, "지로희망"))) return false;
      if (excludeText && (m.excluded || isExcludedByRule(m, "문자제외"))) return false;
      return true;
    });
  }, [members, regions, charges, minAmt, maxAmt, includeZero, includePrepaid, excludeNoPhone, excludeJiro, excludeText, force]);

  const noPhone = React.useMemo(() => (members||[]).filter(m => m.status==="정상" && (outstanding ? outstanding(m) : (m.current_balance ?? m.arrears_amount ?? m.totalArrears ?? 0))>0 && !m.phone).length, [members]);
  const totalAmt = eligible.reduce((s,m)=>s+Math.max(outstanding ? outstanding(m) : (m.current_balance ?? m.arrears_amount ?? m.totalArrears ?? 0),0),0);

  const groups = React.useMemo(() => {
    const byRegion = {};
    eligible.forEach(m => { const r = m.sigun || "미분류"; (byRegion[r] ||= []).push(m); });
    const result = REGIONS.filter(r=>byRegion[r]?.length).map(r=>({region:r,rows:byRegion[r]}));
    Object.keys(byRegion).filter(r=>!REGIONS.includes(r)).forEach(r=>result.push({region:r,rows:byRegion[r]}));
    return result;
  }, [eligible, REGIONS]);

  const exportXlsx = () => {
    if (!eligible.length) { onToast("추출된 데이터가 없습니다."); return; }
    if (typeof XLSX === "undefined") { onToast("엑셀 라이브러리가 로드되지 않았습니다. 페이지를 새로고침 해주세요."); return; }
    const monthLabel = `${issueMonth}월분`;
    const chargeMap = { "협회비": 0, "관리비": 0, "70세": 0 };
    const sheet1Headers = ["코드","상호","대표자명","기타사원","핸드폰","거래처구분","품목 코드","지로발행명목","규격(월분)","발행연월일","발행금액"];
    const sheet1Data = [sheet1Headers];
    eligible.forEach((m, idx) => {
      const amt = Math.max(outstanding ? outstanding(m) : (m.current_balance ?? m.arrears_amount ?? m.totalArrears ?? 0),0);
      const chargeItem = m.isSenior ? "70세" : (m.chargeItem || m.charge_item || "협회비");
      if (chargeMap.hasOwnProperty(chargeItem)) chargeMap[chargeItem] += amt;
      sheet1Data.push([
        String(idx + 1).padStart(6,"0"),
        m.vehicleNo || m.vehicle_no || "",
        m.name || "",
        chargeItem,
        m.phone || "",
        "S",
        "00005",
        chargeItem,
        monthLabel,
        issueDate,
        amt,
      ]);
    });
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    const range = XLSX.utils.decode_range(ws1["!ref"]);
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws1[XLSX.utils.encode_cell({r, c: 10})];
      if (cell) cell.z = "#,##0";
    }
    ws1["!cols"] = [{wch:8},{wch:18},{wch:12},{wch:10},{wch:15},{wch:10},{wch:10},{wch:12},{wch:10},{wch:13},{wch:12}];
    const summaryData = [
      ["항목", "건수/금액"],
      ["입력 건수", eligible.length],
      ["협회비", chargeMap["협회비"]],
      ["관리비", chargeMap["관리비"]],
      ["70세", chargeMap["70세"]],
      ["발행금액 합계", totalAmt],
      ["핸드폰번호 없음 제외", noPhone],
      ["최소금액", minAmt || "제한없음"],
      ["최대금액", maxAmt || "제한없음"],
      ["발행월", monthLabel],
      ["발행연월일", issueDate],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Sheet1");
    XLSX.utils.book_append_sheet(wb, ws2, "요약");
    const fileName = `(문자)${issueMonth}월_핸드폰번호채움.xlsx`;
    XLSX.writeFile(wb, fileName);
    onToast(`알토란 추출 완료 · ${eligible.length}명 · ${fileName}`);
  };

  const inputStyle = { height:34, padding:"0 10px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"13px/1 var(--font-sans)", width:110 };
  const sectionTitle = { font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", letterSpacing:"0.02em", marginBottom:8 };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:24, alignItems:"start" }}>
      <Card style={{ position:"sticky", top:0 }}>
        <div style={sectionTitle}>발행 정보</div>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <select value={issueYear} onChange={e=>setIssueYear(e.target.value)} style={inputStyle}>{[today.getFullYear()-1,today.getFullYear(),today.getFullYear()+1].map(y=><option key={y} value={y}>{y}년</option>)}</select>
          <select value={issueMonth} onChange={e=>setIssueMonth(e.target.value)} style={inputStyle}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}</select>
        </div>
        <input type="text" value={issueDate} onChange={e=>setIssueDate(e.target.value)} placeholder="2026.06.22." style={{...inputStyle, width:"100%", boxSizing:"border-box", marginBottom:16}} />

        <div style={sectionTitle}>지역</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:14 }}>
          <RChip active={regions.length===0} onClick={()=>setRegions([])}>전체</RChip>
          {REGIONS.map(r => <RChip key={r} active={regions.includes(r)} onClick={()=>toggleRegion(r)}>{r}</RChip>)}
        </div>

        <div style={sectionTitle}>부과항목</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:14 }}>
          {["협회비","관리비","70세"].map(c=><RChip key={c} active={charges.includes(c)} onClick={()=>toggleCharge(c)}>{c}</RChip>)}
        </div>

        <div style={sectionTitle}>금액 기준</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
          {[ ["전체", ""], ["3만원↑", "30000"], ["5만원↑", "50000"], ["30만원↑", "300000"] ].map(([l,v])=><RChip key={l} active={minAmt===v && maxAmt===""} onClick={()=>{setMinAmt(v); setMaxAmt("");}}>{l}</RChip>)}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
          <input value={minAmt} onChange={e=>setMinAmt(e.target.value)} placeholder="최소금액" style={inputStyle} />
          <span style={{ color:"var(--text-tertiary)">~</span>
          <input value={maxAmt} onChange={e=>setMaxAmt(e.target.value)} placeholder="최대금액" style={inputStyle} />
        </div>
        <div style={{ height:1, background:"var(--border-subtle)", margin:"10px 0 4px" }} />
        <OptToggle label="0원 포함" checked={includeZero} onChange={setIncludeZero} />
        <OptToggle label="선납 포함" checked={includePrepaid} onChange={setIncludePrepaid} />
        <OptToggle label="전화번호 없는 사람 제외" checked={excludeNoPhone} onChange={setExcludeNoPhone} />
        <OptToggle label="지로희망자 제외" checked={excludeJiro} onChange={setExcludeJiro} />
        <OptToggle label="문자제외자 제외" checked={excludeText} onChange={setExcludeText} />
      </Card>

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"16px 20px", boxShadow:"var(--shadow-xs)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:24 }}>
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>추출 인원</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{eligible.length}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>명</span></div></div>
            <div style={{ width:1, height:34, background:"var(--border-default)" }} />
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>발행금액합계</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--red-500)" }}>{won(totalAmt)}</div></div>
            <div style={{ width:1, height:34, background:"var(--border-default)" }} />
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>지역 수</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{groups.length}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>개</span></div></div>
          </div>
          <window.PMUI.DownloadBtn onClick={exportXlsx} label="알토란 엑셀 다운로드" />
        </div>
        {groups.map(g => (
          <Card key={g.region} padded={false}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", borderBottom:"1px solid var(--border-subtle)", background:"var(--grey-25)", borderTopLeftRadius:"var(--radius-lg)", borderTopRightRadius:"var(--radius-lg)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ width:8, height:8, borderRadius:"50%", background:"var(--brand)" }} /><b>{g.region}</b><span style={{ color:"var(--text-tertiary)" }}>· {g.rows.length}명</span></div>
              <span style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>소계 {won(g.rows.reduce((s,m)=>s+Math.max(outstanding?outstanding(m):(m.current_balance??m.arrears_amount??m.totalArrears??0),0),0))}</span>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>{["코드","성명","차량번호","부과항목","핸드폰","발행금액"].map((h,i)=><th key={h} style={{ textAlign:i===5?"right":"left", padding:"9px 18px", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>)}</tr></thead>
              <tbody>{g.rows.map((r,i)=>{ const amt=Math.max(outstanding?outstanding(r):(r.current_balance??r.arrears_amount??r.totalArrears??0),0); return <tr key={r.id||i} style={{ borderBottom:i<g.rows.length-1?"1px solid var(--border-subtle)":"none" }}>
                <td style={{ padding:"9px 18px", font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{String(i+1).padStart(6,"0")}</td>
                <td style={{ padding:"9px 18px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{r.name}</td>
                <td style={{ padding:"9px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.vehicleNo||r.vehicle_no}</td>
                <td style={{ padding:"9px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.isSenior?"70세":(r.chargeItem||r.charge_item||"협회비")}</td>
                <td style={{ padding:"9px 18px", font:"var(--body-sm)", color:r.phone?"var(--text-primary)":"var(--amber-500)", whiteSpace:"nowrap" }}>{r.phone||"전화없음"}</td>
                <td style={{ padding:"9px 18px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--red-500)", whiteSpace:"nowrap" }}>{won(amt)}</td>
              </tr>;})}</tbody>
            </table>
          </Card>
        ))}
        {groups.length===0 && <Card><div style={{ padding:"40px", textAlign:"center", color:"var(--text-tertiary)" }}>조건에 해당하는 알토란 추출 대상이 없습니다.</div></Card>}
      </div>
    </div>
  );
}
'''
    s, ok1 = replace_between(s, "function TabAltoran", "// ── 탭4: 제외자/지로희망자 관리", new_altoran, "TabAltoran")

    new_excluded = r'''
function TabExcluded({ members, onToast }) {
  const D = window.PMData;
  const { won, REGIONS } = D;
  const [rules, setRules] = React.useState(loadExclusionRules());
  const [modal, setModal] = React.useState(null);
  const refreshRules = () => setRules(loadExclusionRules());
  const inferred = (members||[]).filter(m => inferExclusionType(m)).map(m => ({
    id: `auto-${m.id}`,
    source: "원장메모",
    memberKey: memberKeyForExclusion(m),
    region: m.sigun || "",
    name: m.name || "",
    vehicleNo: m.vehicleNo || m.vehicle_no || "",
    mgmtNo: m.mgmtNo || m.mgmt_no || "",
    phone: m.phone || "",
    excludeType: inferExclusionType(m),
    reason: m.note || m.memo || "원장 메모 기준",
    memo: "",
    amount: D.outstanding ? D.outstanding(m) : (m.current_balance ?? m.arrears_amount ?? m.totalArrears ?? 0),
  }));
  const manual = rules.map(r => ({...r, source:"수동등록"}));
  const rows = [...manual, ...inferred].sort((a,b)=>(a.region||"").localeCompare(b.region||"","ko") || (a.name||"").localeCompare(b.name||"","ko"));

  function saveRule(row){
    const next = row.id ? rules.map(r=>r.id===row.id ? row : r) : [{...row, id:Date.now()}, ...rules];
    saveExclusionRules(next); setRules(next); setModal(null); onToast(row.id ? "제외자 정보 수정" : "제외자 추가 완료");
  }
  function removeRule(row){
    if(!confirm(`${row.name || row.vehicleNo || "제외자"} 항목을 해제할까요?`)) return;
    const next = rules.filter(r=>r.id!==row.id);
    saveExclusionRules(next); setRules(next); onToast("제외자 해제 완료");
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"12px 16px", background:"var(--grey-25)", borderRadius:"var(--radius-md)", border:"1px solid var(--border-subtle)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="warning" size={16} color="#B9791A" />
          <span style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>문자·알토란 추출에서 제외할 회원을 직접 추가/수정/해제합니다. 지로희망자도 여기서 관리합니다.</span>
        </div>
        <button type="button" onClick={()=>setModal({excludeType:"문자제외", region:"춘천시", startDate:new Date().toISOString().slice(0,10)})} style={{ height:36, padding:"0 14px", borderRadius:"var(--radius-pill)", border:"none", background:"var(--brand)", color:"#fff", cursor:"pointer", font:"var(--fw-demibold) 13px/1 var(--font-sans)" }}>+ 제외자 추가</button>
      </div>
      <Card padded={false}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["구분","지역","성명","차량번호","관리번호","전화번호","제외유형","사유/메모","미수금","관리"].map((h,i)=><th key={h} style={{ textAlign:i===8?"right":"left", padding:"10px 14px", whiteSpace:"nowrap", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length===0 && <tr><td colSpan={10} style={{ padding:"40px", textAlign:"center", color:"var(--text-tertiary)" }}>제외자/지로희망자가 없습니다.</td></tr>}
            {rows.map((r,i)=><tr key={r.id||i} style={{ borderBottom:i<rows.length-1?"1px solid var(--border-subtle)":"none" }}>
              <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{r.source}</td>
              <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.region||"—"}</td>
              <td style={{ padding:"10px 14px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{r.name||"—"}</td>
              <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.vehicleNo||"—"}</td>
              <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{r.mgmtNo||"—"}</td>
              <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.phone||"—"}</td>
              <td style={{ padding:"10px 14px" }}><span style={{ padding:"3px 10px", borderRadius:"var(--radius-pill)", background:r.excludeType==="지로희망"?"#FFF3DC":"var(--grey-50)", color:r.excludeType==="지로희망"?"#B9791A":"var(--text-secondary)", font:"var(--fw-medium) 11px/1 var(--font-sans)" }}>{r.excludeType||"제외"}</span></td>
              <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", maxWidth:240, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={`${r.reason||""} ${r.memo||""}`}>{r.reason||r.memo||"—"}</td>
              <td style={{ padding:"10px 14px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:(r.amount||0)>0?"var(--red-500)":"var(--text-tertiary)", whiteSpace:"nowrap" }}>{r.amount==null?"—":won(r.amount)}</td>
              <td style={{ padding:"10px 14px", textAlign:"right", whiteSpace:"nowrap" }}>{r.source==="수동등록" ? <><button type="button" onClick={()=>setModal(r)} style={{ height:28, padding:"0 10px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", background:"var(--white)", cursor:"pointer", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-secondary)" }}>수정</button> <button type="button" onClick={()=>removeRule(r)} style={{ height:28, padding:"0 10px", borderRadius:"var(--radius-pill)", border:"1px solid var(--red-100,#FBD5D5)", background:"var(--red-50)", cursor:"pointer", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--red-500)" }}>해제</button></> : <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>원장메모</span>}</td>
            </tr>)}
          </tbody>
        </table>
      </Card>
      {modal && <ExclusionEditModal row={modal} regions={REGIONS} onClose={()=>setModal(null)} onSave={saveRule} />}
    </div>
  );
}

function ExclusionEditModal({ row, regions, onClose, onSave }){
  const [form, setForm] = React.useState({...row});
  const input = { height:38, padding:"0 10px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"13px/1 var(--font-sans)", boxSizing:"border-box", width:"100%" };
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));
  return <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:130, background:"rgba(10,17,47,0.38)", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(2px)" }}>
    <div onClick={e=>e.stopPropagation()} style={{ width:560, background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px", borderBottom:"1px solid var(--border-subtle)" }}><b style={{ font:"var(--fw-bold) 17px/1 var(--font-sans)" }}>{form.id?"제외자 수정":"제외자 추가"}</b><button onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:32, height:32, borderRadius:"50%", cursor:"pointer" }}>×</button></div>
      <div style={{ padding:22, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <label>지역<select value={form.region||""} onChange={e=>set("region",e.target.value)} style={input}>{regions.map(r=><option key={r}>{r}</option>)}</select></label>
        <label>제외유형<select value={form.excludeType||"문자제외"} onChange={e=>set("excludeType",e.target.value)} style={input}>{["문자제외","지로희망","자동이체","기타"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>성명<input value={form.name||""} onChange={e=>set("name",e.target.value)} style={input} /></label>
        <label>차량번호<input value={form.vehicleNo||""} onChange={e=>set("vehicleNo",e.target.value)} style={input} /></label>
        <label>관리번호<input value={form.mgmtNo||""} onChange={e=>set("mgmtNo",e.target.value)} style={input} /></label>
        <label>핸드폰번호<input value={form.phone||""} onChange={e=>set("phone",e.target.value)} style={input} /></label>
        <label>시작일<input type="date" value={form.startDate||new Date().toISOString().slice(0,10)} onChange={e=>set("startDate",e.target.value)} style={input} /></label>
        <label>사유<input value={form.reason||""} onChange={e=>set("reason",e.target.value)} placeholder="예: 지로 발송 희망" style={input} /></label>
        <label style={{ gridColumn:"1 / -1" }}>메모<textarea value={form.memo||""} onChange={e=>set("memo",e.target.value)} rows={3} style={{...input, height:76, padding:"10px", resize:"vertical"}} /></label>
      </div>
      <div style={{ display:"flex", gap:10, padding:"14px 22px", borderTop:"1px solid var(--border-subtle)" }}><button onClick={onClose} style={{ flex:1, height:42, borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", background:"var(--white)", cursor:"pointer" }}>취소</button><button onClick={()=>onSave(form)} style={{ flex:1, height:42, borderRadius:"var(--radius-pill)", border:"none", background:"var(--brand)", color:"#fff", cursor:"pointer", font:"var(--fw-demibold) 14px/1 var(--font-sans)" }}>저장</button></div>
    </div>
  </div>;
}
'''
    s, ok2 = replace_between(s, "function TabExcluded", "// ── 메인 Regional 컴포넌트", new_excluded, "TabExcluded")

    # Fix a typo introduced in JSX span if present
    s = s.replace('style={{ color:"var(--text-tertiary)">~</span>', 'style={{ color:"var(--text-tertiary)" }}>~</span>')
    write(p, s)
    print(f"- Regional.jsx: 알토란/제외자 관리 패치 {'완료' if (ok1 and ok2) else '일부 적용'}")


def patch_bankmatching():
    p = ROOT / "frontend/static/app/BankMatching.jsx"
    if not p.exists():
        print("- SKIP BankMatching.jsx 없음")
        return
    s = read(p)
    new_actions = '''const INCOME_ACTIONS = [
  { value:null,           label:"회비반영", green:true },
  { value:"협회가입비",     label:"가수금" },
  { value:"자격증명발급비", label:"잡수입" },
  { value:"카드결제",       label:"카드결제" },
  { value:"현금결제",       label:"현금결제" },
  { value:"기타",          label:"기타" },
];'''
    s2 = re.sub(r"const INCOME_ACTIONS = \[[\s\S]*?\];", new_actions, s, count=1)
    if s2 == s:
        print("- WARN BankMatching.jsx: INCOME_ACTIONS 위치 못 찾음")
    else:
        s = s2
    # Font and density quick improvements
    s = s.replace('font:"var(--fw-demibold) 14px/1 var(--font-sans)"', 'font:"var(--fw-demibold) 13px/1 var(--font-sans)"')
    s = s.replace('font:"var(--body-sm)"', 'font:"12.5px/1.45 var(--font-sans)"')
    write(p, s)
    print("- BankMatching.jsx: 수동처리 항목/가독성 패치 완료")


def patch_modals():
    p = ROOT / "frontend/static/app/Modals.jsx"
    if not p.exists():
        print("- SKIP Modals.jsx 없음")
        return
    s = read(p)
    s = s.replace('placeholder="예: 접수2026-114"', 'placeholder={type==="폐업"?"예: 폐-26":type==="양도"?"예: 양-18":type==="이관"?"예: 이-8":"예: 탈-3"}')
    s = s.replace('<label style={fieldLabel}>처리내용 / 사유</label>', '<label style={fieldLabel}>메모 (선택)</label>')
    s = s.replace('placeholder="사유를 입력하면 처리이력에 기록됩니다"', 'placeholder="필수 아님 · 필요한 내용만 입력"')
    s = s.replace('width:460,', 'width:520,')
    write(p, s)
    print("- Modals.jsx: 폐업/이탈 예시·선택 메모 패치 완료")


def patch_app():
    p = ROOT / "frontend/static/app/App.jsx"
    if not p.exists():
        print("- SKIP App.jsx 없음")
        return
    s = read(p)
    old = '''  const resetBank = async () => {
    await refetchDeposits();
    showToast('통장매칭 결과 새로고침');
  };'''
    new = '''  const resetBank = async () => {
    try {
      const res = await fetch('/api/deposits/pending', { method: 'DELETE' });
      if (res.ok) {
        setDeposits([]);
        await Promise.all([refetchDeposits(), refetchDashboard()]);
        showToast('통장매칭 결과 초기화 완료');
        return;
      }
      showToast(`초기화 실패: ${res.status}`);
    } catch(e) {
      setDeposits([]);
      showToast('통장매칭 화면 초기화 완료');
    }
  };'''
    if old in s:
        s = s.replace(old, new)
    else:
        print("- WARN App.jsx: resetBank 기본 패턴 못 찾음")
    # optimistic update for matchDeposit (minimal)
    s = s.replace("  const matchDeposit = async (deposit, candidate, chargeItemOverride) => {\n    if (!candidate) return;\n    try {", "  const matchDeposit = async (deposit, candidate, chargeItemOverride) => {\n    if (!candidate) return;\n    const prevDeposits = deposits;\n    setDeposits(ds => ds.map(d => d.id === deposit.id ? { ...d, status:'매칭완료', hint:'처리 중...' } : d));\n    try {")
    s = s.replace("if (!res.ok) { const e = await res.json().catch(()=>{}); showToast(`통장매칭 수납 실패: ${e?.detail||res.status}`); return; }", "if (!res.ok) { const e = await res.json().catch(()=>{}); setDeposits(prevDeposits); showToast(`통장매칭 수납 실패: ${e?.detail||res.status}`); return; }")
    s = s.replace("    } catch(e) {\n      showToast('통장매칭 처리 중 오류가 발생했습니다.');\n    }\n  };", "    } catch(e) {\n      setDeposits(prevDeposits);\n      showToast('통장매칭 처리 중 오류가 발생했습니다.');\n    }\n  };")
    write(p, s)
    print("- App.jsx: 통장매칭 초기화/즉시반영 패치 완료")


def patch_deposits_backend():
    p = ROOT / "backend/app/routers/deposits.py"
    if not p.exists():
        print("- SKIP deposits.py 없음")
        return
    s = read(p)
    s = s.replace('NON_ARREARS_INCOME_ITEMS = {"협회가입비", "자격증명발급비", "기타", "선납/초과입금"}', 'NON_ARREARS_INCOME_ITEMS = {"협회가입비", "자격증명발급비", "카드결제", "현금결제", "기타", "선납/초과입금"}')
    if 'if charge_item == "카드결제":' not in s:
        s = s.replace('''    if charge_item == "자격증명발급비":
        return "잡수입"''', '''    if charge_item == "자격증명발급비":
        return "잡수입"
    if charge_item == "카드결제":
        return "카드결제"
    if charge_item == "현금결제":
        return "현금결제"''')
    s = s.replace('if charge_item not in {"협회가입비", "자격증명발급비", "기타"}:', 'if charge_item not in {"협회가입비", "자격증명발급비", "카드결제", "현금결제", "기타"}:')
    s = s.replace('detail="가수금/잡수입/기타만 회원 없이 처리할 수 있습니다."', 'detail="가수금/잡수입/카드결제/현금결제/기타만 회원 없이 처리할 수 있습니다."')
    write(p, s)
    print("- deposits.py: 카드/현금/수동수입 backend 패치 완료")


def main():
    print(f"[MISU 2ND PATCH] repo: {ROOT}")
    patch_regional()
    patch_bankmatching()
    patch_modals()
    patch_app()
    patch_deposits_backend()
    print("\n완료. git status 확인 후 commit/push 하세요. 백업은 *.bak_2nd 로 생성됩니다.")

if __name__ == "__main__":
    main()
