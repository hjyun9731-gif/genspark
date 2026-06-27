// 지역별 미수금 추출 + 문자 대상 + 알토란 추출 + 제외자 관리
const { Card, Icon, Toggle, Button } = window.PayroleDesignSystem_9db006;

const TABS_NAV = ["지역별 문자 발송", "문자 대상 추출", "알토란 추출하기", "제외자/지로희망자 관리"];

function OptToggle({ label, sub, checked, onChange }) {
  return (
    <label style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, cursor:"pointer", padding:"8px 0" }}>
      <span>
        <div style={{ font:"var(--fw-medium) 14px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{label}</div>
        {sub && <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:2 }}>{sub}</div>}
      </span>
      <Toggle checked={checked} onChange={onChange} />
    </label>
  );
}

function RChip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      height:32, padding:"0 12px", borderRadius:"var(--radius-pill)", cursor:"pointer", whiteSpace:"nowrap",
      border: active ? "1px solid var(--brand)" : "1px solid var(--border-default)",
      background: active ? "var(--brand)" : "var(--white)",
      color: active ? "#fff" : "var(--text-secondary)",
      font:"var(--fw-medium) 12.5px/1 var(--font-sans)", transition:"all .12s",
    }}>{children}</button>
  );
}

function isExcludedByRules(m, rules, type) {
  return rules.filter(r => !type || r.exclusionType === type || r.exclusion_type === type).some(r => {
    const rVno = r.vehicleNo || r.vehicle_no;
    const rMno = r.mgmtNo || r.mgmt_no;
    const mVno = m.vehicleNo || m.vehicle_no;
    const mMno = m.mgmtNo || m.mgmt_no;
    if (r.memberId && r.memberId === m.id) return true;
    if (r.member_id && r.member_id === m.id) return true;
    if (rVno && rVno === mVno) return true;
    if (rMno && rMno === mMno) return true;
    if (r.name && r.name === m.name && r.phone && r.phone === m.phone) return true;
    return false;
  });
}

// ── 탭1: 지역별 문자 발송 ──────────────────────────────────────────
function TabRegional({ members, exclusionRules, onToast }) {
  const D = window.PMData;
  const { won, REGIONS } = D;
  const { ChargeTag } = window.PMUI;
  const [regions, setRegions] = React.useState([]);
  const [charges, setCharges] = React.useState(["협회비","관리비"]);
  const [senior, setSenior] = React.useState(true);
  const [incZero, setIncZero] = React.useState(true);
  const [incPrepaid, setIncPrepaid] = React.useState(true);
  const [minAmt, setMinAmt] = React.useState(0);
  const [maxAmtInput, setMaxAmtInput] = React.useState("");
  const [excludeGiro, setExcludeGiro] = React.useState(false);

  const toggleRegion = r => setRegions(rs => rs.includes(r) ? rs.filter(x=>x!==r) : [...rs,r]);
  const toggleCharge = c => setCharges(cs => cs.includes(c) ? cs.filter(x=>x!==c) : [...cs,c]);
  const maxAmt = maxAmtInput !== "" ? parseInt(maxAmtInput, 10) : null;

  const filtered = React.useMemo(() => members.filter(m => {
    if (m.status !== "정상") return false;
    if (regions.length && !regions.includes(m.sigun)) return false;
    if (!charges.includes(m.chargeItem)) return false;
    if (!senior && m.isSenior) return false;
    const out = D.outstanding(m);
    if (!incZero && out===0) return false;
    if (!incPrepaid && out<0) return false;
    if (minAmt && out<minAmt) return false;
    if (maxAmt !== null && !isNaN(maxAmt) && out>maxAmt) return false;
    if (excludeGiro && isExcludedByRules(m, exclusionRules, "지로희망")) return false;
    return true;
  }), [members,regions,charges,senior,incZero,incPrepaid,minAmt,maxAmt,excludeGiro,exclusionRules]);

  const groups = React.useMemo(() => {
    const order = REGIONS.filter(r => !regions.length || regions.includes(r));
    return order.map(r => ({ region:r, rows: filtered.filter(m=>m.sigun===r) })).filter(g=>g.rows.length);
  }, [filtered,regions]);

  const total = filtered.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);

  const exportCSV = () => {
    const head = ["지역","관리번호","성명","차량번호","회원구분","부과항목","미수금","전화번호","주소","비고"];
    const lines = [head.join(",")];
    groups.forEach(g => g.rows.forEach(m => {
      const out = D.outstanding(m);
      lines.push([g.region,m.mgmtNo,m.name,(m.vehicleNo||m.vehicle_no),m.membership,(m.chargeItem||m.charge_item),out,m.phone||"-",m.address,m.note].map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(","));
    }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿"+lines.join("\n")],{type:"text/csv;charset=utf-8"}));
    a.download = "지역별미수금.csv"; a.click();
    onToast(`지역별 미수금 다운로드 완료 · ${groups.length}개 지역 ${filtered.length}명`);
  };

  const sectionTitle = { font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", letterSpacing:"0.02em", marginBottom:10 };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:24, alignItems:"start" }}>
      <Card style={{ position:"sticky", top:0 }}>
        <div style={sectionTitle}>지역 선택</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:18 }}>
          <RChip active={regions.length===0} onClick={()=>setRegions([])}>전체</RChip>
          {REGIONS.map(r => <RChip key={r} active={regions.includes(r)} onClick={()=>toggleRegion(r)}>{r}</RChip>)}
        </div>
        <div style={sectionTitle}>부과항목</div>
        <div style={{ display:"flex", gap:7, marginBottom:8, flexWrap:"wrap" }}>
          {["협회비","관리비"].map(c=><RChip key={c} active={charges.includes(c)} onClick={()=>toggleCharge(c)}>{c}</RChip>)}
          <RChip active={senior} onClick={()=>setSenior(!senior)}>70세 포함</RChip>
        </div>
        <div style={{ height:1, background:"var(--border-subtle)", margin:"14px 0" }} />
        <div style={sectionTitle}>금액 기준</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {[["전체",0],["50원↑",50],["3만원↑",30000],["30만원↑",300000]].map(([l,v])=>(
            <RChip key={l} active={minAmt===v} onClick={()=>setMinAmt(v)}>{l}</RChip>
          ))}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8 }}>
          <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>최대금액</span>
          <input type="number" placeholder="제한없음" value={maxAmtInput} onChange={e=>setMaxAmtInput(e.target.value)}
            style={{ flex:1, height:32, padding:"0 8px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"var(--body-sm)", color:"var(--text-primary)", textAlign:"right" }} />
          {maxAmtInput && <button type="button" onClick={()=>setMaxAmtInput("")} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-tertiary)", fontSize:12 }}>✕</button>}
        </div>
        <div style={{ height:1, background:"var(--border-subtle)", margin:"10px 0 4px" }} />
        <OptToggle label="0원 포함" checked={incZero} onChange={setIncZero} />
        <OptToggle label="선납 포함" checked={incPrepaid} onChange={setIncPrepaid} />
        <OptToggle label="지로희망자 제외" sub="DB 제외 규칙 기준" checked={excludeGiro} onChange={setExcludeGiro} />
      </Card>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"16px 20px", boxShadow:"var(--shadow-xs)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:24 }}>
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>대상 인원</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{filtered.length}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>명</span></div></div>
            <div style={{ width:1, height:34, background:"var(--border-default)" }} />
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>미수금 합계</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--red-500)" }}>{won(total)}</div></div>
            <div style={{ width:1, height:34, background:"var(--border-default)" }} />
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>지역 수</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{groups.length}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>개</span></div></div>
          </div>
          <window.PMUI.DownloadBtn onClick={exportCSV} label="지역별 엑셀 다운로드" />
        </div>
        {groups.map(g => {
          const sub = g.rows.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);
          return (
            <Card key={g.region} padded={false}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid var(--border-subtle)", background:"var(--grey-25)", borderTopLeftRadius:"var(--radius-lg)", borderTopRightRadius:"var(--radius-lg)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--brand)" }} />
                  <span style={{ font:"var(--fw-demibold) 15px/1 var(--font-sans)", color:"var(--text-primary)" }}>{g.region}</span>
                  <span style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>· {g.rows.length}명</span>
                </div>
                <span style={{ font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>소계 {won(sub)}</span>
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>
                  {["관리번호","성명","차량번호","회원구분","부과항목","미수금","전화번호","비고"].map((h,i)=>(
                    <th key={h} style={{ textAlign:i===5?"right":"left", padding:"9px 20px", whiteSpace:"nowrap", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {g.rows.map((m,i) => {
                    const out = D.outstanding(m);
                    return (
                      <tr key={m.id} style={{ borderBottom: i<g.rows.length-1?"1px solid var(--border-subtle)":"none" }}>
                        <td style={{ padding:"10px 20px", font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{m.mgmtNo}</td>
                        <td style={{ padding:"10px 20px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{m.name}</td>
                        <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.vehicleNo||m.vehicle_no}</td>
                        <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.membership}</td>
                        <td style={{ padding:"10px 20px" }}><ChargeTag item={m.chargeItem} /></td>
                        <td style={{ padding:"10px 20px", textAlign:"right", whiteSpace:"nowrap", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:out>0?"var(--red-500)":out<0?"var(--violet-500)":"var(--text-tertiary)" }}>{won(out)}</td>
                        <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.phone||"—"}</td>
                        <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{m.note||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          );
        })}
        {groups.length===0 && <Card><div style={{ padding:"40px", textAlign:"center", color:"var(--text-tertiary)" }}>조건에 해당하는 대상이 없습니다.</div></Card>}
      </div>
    </div>
  );
}

// ── 탭2: 문자 대상 추출 ────────────────────────────────────────────
function TabSms({ members, exclusionRules, onToast }) {
  const D = window.PMData;
  const { won, REGIONS } = D;
  const [regions, setRegions] = React.useState([]);
  const [minAmt, setMinAmt] = React.useState(30000);
  const [minAmtInput, setMinAmtInput] = React.useState("30000");
  const [maxAmtInput, setMaxAmtInput] = React.useState("");
  const [excludeNoPhone, setExcludeNoPhone] = React.useState(true);
  const [excludeDisconnected, setExcludeDisconnected] = React.useState(true);
  const [excludeAutoPay, setExcludeAutoPay] = React.useState(true);
  const [excludeGiro, setExcludeGiro] = React.useState(true);
  const [excludeSms, setExcludeSms] = React.useState(true);

  const toggleRegion = r => setRegions(rs => rs.includes(r) ? rs.filter(x=>x!==r) : [...rs,r]);
  const maxAmt = maxAmtInput !== "" ? parseInt(maxAmtInput, 10) : null;

  const filtered = React.useMemo(() => members.filter(m => {
    if (m.status !== "정상") return false;
    if (regions.length && !regions.includes(m.sigun)) return false;
    const out = D.outstanding(m);
    if (out < (minAmt||0)) return false;
    if (maxAmt !== null && !isNaN(maxAmt) && out > maxAmt) return false;
    if (excludeNoPhone && !m.phone) return false;
    if (excludeDisconnected && m.disconnected) return false;
    if (excludeAutoPay && m.note==="자동이체") return false;
    if (excludeGiro && isExcludedByRules(m, exclusionRules, "지로희망")) return false;
    if (excludeSms && isExcludedByRules(m, exclusionRules, "문자제외")) return false;
    return true;
  }), [members,regions,minAmt,maxAmt,excludeNoPhone,excludeDisconnected,excludeAutoPay,excludeGiro,excludeSms,exclusionRules]);

  const groups = React.useMemo(() => {
    const order = REGIONS.filter(r => !regions.length || regions.includes(r));
    return order.map(r => ({ region:r, rows: filtered.filter(m=>m.sigun===r) })).filter(g=>g.rows.length);
  }, [filtered,regions]);

  const exportCSV = () => {
    const head = ["지역","성명","차량번호","전화번호","미수금","문자문구"];
    const lines = [head.join(",")];
    groups.forEach(g => g.rows.forEach(m => {
      const out = D.outstanding(m);
      lines.push([g.region,m.name,(m.vehicleNo||m.vehicle_no),m.phone||"-",out,`[화물협회] ${m.name}님 미수금 ${won(out)} 납부 안내드립니다.`].map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(","));
    }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿"+lines.join("\n")],{type:"text/csv;charset=utf-8"}));
    a.download = "문자발송대상.csv"; a.click();
    onToast(`문자 대상 다운로드 완료 · ${filtered.length}명`);
  };

  const sectionTitle = { font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", letterSpacing:"0.02em", marginBottom:10 };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:24, alignItems:"start" }}>
      <Card style={{ position:"sticky", top:0 }}>
        <div style={sectionTitle}>지역 선택</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:18 }}>
          <RChip active={regions.length===0} onClick={()=>setRegions([])}>전체</RChip>
          {REGIONS.map(r => <RChip key={r} active={regions.includes(r)} onClick={()=>toggleRegion(r)}>{r}</RChip>)}
        </div>
        <div style={{ height:1, background:"var(--border-subtle)", margin:"14px 0" }} />
        <div style={sectionTitle}>금액 기준 (최소 미수금)</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
          {[["1만원↑",10000],["3만원↑",30000],["10만원↑",100000],["30만원↑",300000]].map(([l,v])=>(
            <RChip key={l} active={minAmt===v} onClick={()=>{ setMinAmt(v); setMinAmtInput(String(v)); }}>{l}</RChip>
          ))}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6 }}>
          <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>최소</span>
          <input type="number" value={minAmtInput} onChange={e=>{ setMinAmtInput(e.target.value); setMinAmt(e.target.value ? parseInt(e.target.value,10) : 0); }}
            style={{ flex:1, height:32, padding:"0 8px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"var(--body-sm)", color:"var(--text-primary)", textAlign:"right" }} />
          <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>최대</span>
          <input type="number" placeholder="제한없음" value={maxAmtInput} onChange={e=>setMaxAmtInput(e.target.value)}
            style={{ flex:1, height:32, padding:"0 8px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"var(--body-sm)", color:"var(--text-primary)", textAlign:"right" }} />
        </div>
        <div style={{ height:1, background:"var(--border-subtle)", margin:"10px 0 4px" }} />
        <div style={sectionTitle}>제외 조건</div>
        <OptToggle label="전화번호 없는 사람 제외" checked={excludeNoPhone} onChange={setExcludeNoPhone} />
        <OptToggle label="결번/반송 제외" checked={excludeDisconnected} onChange={setExcludeDisconnected} />
        <OptToggle label="자동이체자 제외" checked={excludeAutoPay} onChange={setExcludeAutoPay} />
        <OptToggle label="지로희망자 제외" sub="DB 제외 규칙 기준" checked={excludeGiro} onChange={setExcludeGiro} />
        <OptToggle label="문자제외자 제외" sub="DB 제외 규칙 기준" checked={excludeSms} onChange={setExcludeSms} />
      </Card>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"16px 20px", boxShadow:"var(--shadow-xs)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:24 }}>
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>문자 대상</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{filtered.length}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>명</span></div></div>
            <div style={{ width:1, height:34, background:"var(--border-default)" }} />
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>지역 수</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{groups.length}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>개</span></div></div>
          </div>
          <window.PMUI.DownloadBtn onClick={exportCSV} label="문자 대상 엑셀" />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", background:"var(--brand-subtle)", borderRadius:"var(--radius-md)" }}>
          <Icon name="mail" size={18} color="var(--brand)" />
          <span style={{ font:"var(--body-sm)", color:"var(--brand-active)" }}>전화번호·미수금 기준으로 문자 발송 대상을 추출합니다. 엑셀에 문자 문구 복사용 데이터가 함께 출력됩니다.</span>
        </div>
        {groups.map(g => (
          <Card key={g.region} padded={false}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid var(--border-subtle)", background:"var(--grey-25)", borderTopLeftRadius:"var(--radius-lg)", borderTopRightRadius:"var(--radius-lg)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--brand)" }} />
                <span style={{ font:"var(--fw-demibold) 15px/1 var(--font-sans)", color:"var(--text-primary)" }}>{g.region}</span>
                <span style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>· {g.rows.length}명</span>
              </div>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>
                {["성명","차량번호","전화번호","미수금"].map((h,i)=>(
                  <th key={h} style={{ textAlign:i===3?"right":"left", padding:"9px 20px", whiteSpace:"nowrap", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {g.rows.map((m,i)=>{
                  const out = D.outstanding(m);
                  return (
                    <tr key={m.id} style={{ borderBottom: i<g.rows.length-1?"1px solid var(--border-subtle)":"none" }}>
                      <td style={{ padding:"10px 20px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{m.name}{m.isSenior&&<span style={{marginLeft:6,fontSize:10,color:"var(--green-500)",fontWeight:700}}>70세</span>}</td>
                      <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.vehicleNo||m.vehicle_no}</td>
                      <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{m.phone||"—"}</td>
                      <td style={{ padding:"10px 20px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--red-500)", whiteSpace:"nowrap" }}>{won(out)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ))}
        {groups.length===0&&<Card><div style={{padding:"40px",textAlign:"center",color:"var(--text-tertiary)"}}>조건에 해당하는 문자 대상이 없습니다.</div></Card>}
      </div>
    </div>
  );
}

// ── 탭3: 알토란 추출하기 ──────────────────────────────────────────
function TabAltoran({ members, exclusionRules, onToast }) {
  const D = window.PMData;
  const { REGIONS, won } = D;
  const today = new Date();
  const [issueMonth, setIssueMonth] = React.useState(String(today.getMonth()+1));
  const [issueYear, setIssueYear] = React.useState(String(today.getFullYear()));
  const [issueDate, setIssueDate] = React.useState(
    `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}.`
  );
  const [excludeNoPhone, setExcludeNoPhone] = React.useState(true);
  const [excludeJiro, setExcludeJiro] = React.useState(true);

  const eligible = React.useMemo(() => {
    return (members||[]).filter(m => {
      if (m.status !== "정상") return false;
      const amt = m.arrears_amount ?? m.totalArrears ?? 0;
      if (amt <= 0) return false;
      if (excludeNoPhone && !m.phone) return false;
      // DB 규칙 기준 지로희망자 제외
      if (excludeJiro && isExcludedByRules(m, exclusionRules, "지로희망")) return false;
      return true;
    });
  }, [members, excludeNoPhone, excludeJiro, exclusionRules]);

  const noPhone = React.useMemo(() => (members||[]).filter(m => m.status==="정상" && (m.arrears_amount??m.totalArrears??0)>0 && !m.phone).length, [members]);

  const groups = React.useMemo(() => {
    const byRegion = {};
    eligible.forEach(m => {
      const r = m.sigun || "미분류";
      if (!byRegion[r]) byRegion[r] = [];
      byRegion[r].push(m);
    });
    const result = REGIONS.filter(r=>byRegion[r]?.length).map(r=>({region:r,rows:byRegion[r]}));
    const others = Object.keys(byRegion).filter(r=>!REGIONS.includes(r));
    others.forEach(r => result.push({region:r,rows:byRegion[r]}));
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
      const amt = m.arrears_amount ?? m.totalArrears ?? 0;
      const chargeItem = m.chargeItem || m.charge_item || "협회비";
      if (chargeMap.hasOwnProperty(chargeItem)) chargeMap[chargeItem] += amt;
      sheet1Data.push([
        String(idx + 1).padStart(6,"0"),
        m.vehicleNo || m.vehicle_no || "",
        m.name || "",
        chargeItem,
        (m.phone || m.mobile || m.tel || ""),
        "S", "00005", chargeItem, monthLabel, issueDate, amt,
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    const range = XLSX.utils.decode_range(ws1["!ref"]);
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws1[XLSX.utils.encode_cell({r, c: 10})];
      if (cell) cell.z = "#,##0";
    }

    const totalAmt = eligible.reduce((s,m) => s + (m.arrears_amount ?? m.totalArrears ?? 0), 0);
    const summaryData = [
      ["항목", "건수/금액"],
      ["입력 건수", eligible.length],
      ["협회비", chargeMap["협회비"]],
      ["관리비", chargeMap["관리비"]],
      ["70세", chargeMap["70세"]],
      ["발행금액 합계", totalAmt],
      ["핸드폰번호 없음 제외", noPhone],
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

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <Card>
        <div style={{ font:"var(--fw-demibold) 15px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:14 }}>알토란 엑셀 추출 설정</div>
        <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <label style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>발행월</label>
            <select value={issueYear} onChange={e=>setIssueYear(e.target.value)} style={{ height:34, padding:"0 8px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"13px/1 var(--font-sans)" }}>
              {[today.getFullYear()-1, today.getFullYear(), today.getFullYear()+1].map(y=><option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={issueMonth} onChange={e=>setIssueMonth(e.target.value)} style={{ height:34, padding:"0 8px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"13px/1 var(--font-sans)" }}>
              {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}
            </select>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <label style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>발행연월일</label>
            <input type="text" value={issueDate} onChange={e=>setIssueDate(e.target.value)} placeholder="2026.06.22." style={{ height:34, padding:"0 10px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"13px/1 var(--font-sans)", width:120 }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
          <OptToggle label="핸드폰 없는 회원 제외" checked={excludeNoPhone} onChange={setExcludeNoPhone} />
          <OptToggle label="지로희망자 제외 (DB 규칙 기준)" checked={excludeJiro} onChange={setExcludeJiro} />
        </div>
      </Card>

      {eligible.length > 0 && (
        <>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"16px 20px", boxShadow:"var(--shadow-xs)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:24 }}>
              <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>추출 인원</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{eligible.length}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>명</span></div></div>
              <div style={{ width:1, height:34, background:"var(--border-default)" }} />
              <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>발행금액합계</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--red-500)" }}>{won(eligible.reduce((s,m)=>s+(m.arrears_amount??m.totalArrears??0),0))}</div></div>
              <div style={{ width:1, height:34, background:"var(--border-default)" }} />
              <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>핸드폰없음 (제외됨)</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:noPhone>0?"var(--amber-500)":"var(--text-tertiary)" }}>{noPhone}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>명</span></div></div>
            </div>
            <window.PMUI.DownloadBtn onClick={exportXlsx} label="알토란 엑셀 다운로드" />
          </div>

          {groups.map(g => (
            <Card key={g.region} padded={false}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 20px", borderBottom:"1px solid var(--border-subtle)", background:"var(--grey-25)", borderTopLeftRadius:"var(--radius-lg)", borderTopRightRadius:"var(--radius-lg)" }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--brand)" }} />
                <span style={{ font:"var(--fw-demibold) 15px/1 var(--font-sans)", color:"var(--text-primary)" }}>{g.region}</span>
                <span style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>· {g.rows.length}명</span>
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>
                  {["순번","성명","차량번호","부과항목","핸드폰","발행금액"].map((h,i)=>(
                    <th key={h} style={{ textAlign:i===5?"right":"left", padding:"9px 20px", whiteSpace:"nowrap", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {g.rows.map((r,i)=>(
                    <tr key={r.id||i} style={{ borderBottom:i<g.rows.length-1?"1px solid var(--border-subtle)":"none", background:!r.phone?"var(--amber-25,#FFFBEB)":"" }}>
                      <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{i+1}</td>
                      <td style={{ padding:"10px 20px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{r.name||"—"}</td>
                      <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.vehicleNo||r.vehicle_no||"—"}</td>
                      <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.chargeItem||r.charge_item||"—"}</td>
                      <td style={{ padding:"10px 20px", font:"var(--body-sm)", whiteSpace:"nowrap", color:r.phone?"var(--text-primary)":"var(--amber-500)" }}>{r.phone||"전화없음"}</td>
                      <td style={{ padding:"10px 20px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--red-500)", whiteSpace:"nowrap" }}>{won(r.arrears_amount??r.totalArrears??0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </>
      )}

      {eligible.length === 0 && (
        <Card><div style={{ padding:"40px", textAlign:"center", color:"var(--text-tertiary)" }}>미수금이 있는 정상 회원이 없거나 필터 조건에 해당하는 회원이 없습니다.</div></Card>
      )}
    </div>
  );
}

// ── 탭4: 제외자/지로희망자 관리 (DB CRUD) ────────────────────────
function ExclusionRuleModal({ mode, rule, onClose, onSave }) {
  const [f, setF] = React.useState({ ...rule });
  const set = (k,v) => setF(s=>({...s,[k]:v}));
  const label = { font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", marginBottom:7, display:"block" };
  const inp = { width:"100%", height:42, padding:"0 14px", boxSizing:"border-box", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"var(--fw-medium) 14px/1 var(--font-sans)", color:"var(--text-primary)", outline:"none", background:"var(--white)" };
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(10,17,47,0.38)", display:"flex", justifyContent:"center", alignItems:"center", backdropFilter:"blur(2px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:480, background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--border-subtle)" }}>
          <div style={{ font:"var(--fw-bold) 18px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{mode==="add"?"제외 규칙 추가":"제외 규칙 수정"}</div>
          <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} /></button>
        </div>
        <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:14 }}>
          <div><label style={label}>제외유형</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["지로희망","문자제외","자동이체","기타"].map(t=>(
                <button key={t} type="button" onClick={()=>set("exclusion_type",t)} style={{ flex:"1 1 calc(50% - 3px)", height:38, borderRadius:"var(--radius-md)", cursor:"pointer", border: f.exclusion_type===t?"1.5px solid var(--brand)":"1px solid var(--border-default)", background: f.exclusion_type===t?"var(--brand-subtle)":"var(--white)", color: f.exclusion_type===t?"var(--brand-active)":"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)" }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={label}>성명</label><input value={f.name||""} onChange={e=>set("name",e.target.value)} style={inp} placeholder="성명" /></div>
            <div style={{ flex:1 }}><label style={label}>차량번호</label><input value={f.vehicle_no||""} onChange={e=>set("vehicle_no",e.target.value)} style={inp} placeholder="차량번호" /></div>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={label}>핸드폰번호</label><input value={f.phone||""} onChange={e=>set("phone",e.target.value)} style={inp} placeholder="010-0000-0000" /></div>
            <div style={{ flex:1 }}><label style={label}>관리번호</label><input value={f.mgmt_no||""} onChange={e=>set("mgmt_no",e.target.value)} style={inp} placeholder="관리번호" /></div>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={label}>지역</label><input value={f.sigun||""} onChange={e=>set("sigun",e.target.value)} style={inp} placeholder="춘천시" /></div>
            <div style={{ flex:1 }}><label style={label}>사유</label><input value={f.reason||""} onChange={e=>set("reason",e.target.value)} style={inp} placeholder="제외 사유" /></div>
          </div>
          <div><label style={label}>메모</label><input value={f.memo||""} onChange={e=>set("memo",e.target.value)} style={inp} placeholder="메모 (선택)" /></div>
        </div>
        <div style={{ display:"flex", gap:10, padding:"16px 24px", borderTop:"1px solid var(--border-subtle)" }}>
          <Button variant="tertiary" size="medium" fullWidth onClick={onClose}>취소</Button>
          <Button variant="primary" size="medium" fullWidth disabled={!f.exclusion_type} onClick={()=>onSave(f)}>{mode==="add"?"추가":"저장"}</Button>
        </div>
      </div>
    </div>
  );
}

function TabExcluded({ exclusionRules, onRulesChange, onToast }) {
  const [editing, setEditing] = React.useState(null);

  const deleteRule = async (rule) => {
    const label = rule.name || rule.vehicleNo || rule.vehicle_no || rule.phone || "규칙";
    if (!confirm(`"${label}" 제외 규칙을 삭제할까요?`)) return;
    try {
      const res = await fetch(`/api/members/exclusion-rules/${rule.id}`, { method:'DELETE' });
      if (res.ok) { onRulesChange(); onToast("삭제되었습니다."); }
      else { const j = await res.json().catch(()=>{}); onToast(j?.detail||"삭제 실패"); }
    } catch(e) { onToast("오류: "+e.message); }
  };

  const saveRule = async (ruleData) => {
    const isEdit = ruleData.id != null;
    const url = isEdit ? `/api/members/exclusion-rules/${ruleData.id}` : '/api/members/exclusion-rules';
    const method = isEdit ? 'PATCH' : 'POST';
    try {
      const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(ruleData) });
      if (res.ok) { onRulesChange(); onToast(isEdit ? "수정되었습니다." : "추가되었습니다."); setEditing(null); }
      else { const j = await res.json().catch(()=>{}); onToast(j?.detail||"저장 실패"); }
    } catch(e) { onToast("오류: "+e.message); }
  };

  const TYPE_STYLE = {
    "지로희망": { bg:"#FBF3DA", fg:"#9A7B12" },
    "문자제외": { bg:"var(--grey-50)", fg:"var(--text-secondary)" },
    "자동이체": { bg:"#EAF3FF", fg:"var(--blue-600)" },
    "기타":     { bg:"var(--green-50)", fg:"var(--green-600)" },
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"var(--grey-25)", borderRadius:"var(--radius-md)", border:"1px solid var(--border-subtle)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="warning" size={16} color="#B9791A" />
          <span style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>문자 발송·지역 추출에서 제외할 회원을 DB에 등록합니다. 지로희망자·문자제외자를 관리하세요.</span>
        </div>
        <button type="button" onClick={()=>setEditing({ mode:'add', rule:{exclusion_type:'지로희망',name:'',vehicle_no:'',phone:'',mgmt_no:'',sigun:'',reason:'',memo:''} })} style={{ height:34, padding:"0 14px", borderRadius:"var(--radius-pill)", border:"none", background:"var(--brand)", color:"#fff", cursor:"pointer", font:"var(--fw-demibold) 13px/1 var(--font-sans)" }}>+ 규칙 추가</button>
      </div>
      <Card padded={false}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            {["제외유형","성명","차량번호","핸드폰번호","관리번호","지역","사유","메모","등록일","처리"].map((h,i)=>(
              <th key={h} style={{ textAlign:i===9?"right":"left", padding:"10px 18px", whiteSpace:"nowrap", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {exclusionRules.length===0 && <tr><td colSpan={10} style={{ padding:"40px", textAlign:"center", color:"var(--text-tertiary)" }}>등록된 제외 규칙이 없습니다. 위 "+ 규칙 추가" 버튼으로 추가하세요.</td></tr>}
            {exclusionRules.map((rule,i)=>{
              const t = rule.exclusionType || rule.exclusion_type || "";
              const ts = TYPE_STYLE[t] || { bg:"var(--grey-50)", fg:"var(--text-secondary)" };
              return (
                <tr key={rule.id} style={{ borderBottom:i<exclusionRules.length-1?"1px solid var(--border-subtle)":"none" }}>
                  <td style={{ padding:"10px 18px" }}>
                    <span style={{ padding:"3px 10px", borderRadius:"var(--radius-pill)", background:ts.bg, color:ts.fg, font:"var(--fw-medium) 11px/1 var(--font-sans)" }}>{t||"—"}</span>
                  </td>
                  <td style={{ padding:"10px 18px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{rule.name||"—"}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{rule.vehicleNo||rule.vehicle_no||"—"}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{rule.phone||"—"}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{rule.mgmtNo||rule.mgmt_no||"—"}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{rule.sigun||"—"}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-tertiary)", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={rule.reason||""}>{rule.reason||"—"}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-tertiary)", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={rule.memo||""}>{rule.memo||"—"}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-xs)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{rule.createdAt ? rule.createdAt.slice(0,10) : "—"}</td>
                  <td style={{ padding:"10px 18px", textAlign:"right", whiteSpace:"nowrap" }}>
                    <div style={{ display:"inline-flex", gap:6 }}>
                      <button type="button" onClick={()=>setEditing({ mode:'edit', rule })} style={{ height:26, padding:"0 9px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", cursor:"pointer", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 11px/1 var(--font-sans)" }}>수정</button>
                      <button type="button" onClick={()=>deleteRule(rule)} style={{ height:26, padding:"0 9px", borderRadius:"var(--radius-pill)", border:"1px solid var(--red-100, #FBD5D5)", cursor:"pointer", background:"var(--red-50)", color:"var(--red-500)", font:"var(--fw-medium) 11px/1 var(--font-sans)" }}>삭제</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {editing && <ExclusionRuleModal mode={editing.mode} rule={editing.rule} onClose={()=>setEditing(null)} onSave={saveRule} />}
    </div>
  );
}

// ── 메인 Regional 컴포넌트 ────────────────────────────────────────
function Regional({ members, onToast }) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [regionalMembers, setRegionalMembers] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [exclusionRules, setExclusionRules] = React.useState([]);

  const refetchRules = React.useCallback(() => {
    fetch('/api/members/exclusion-rules')
      .then(r => r.ok ? r.json() : [])
      .then(data => setExclusionRules(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch('/api/members?status=정상&size=6000&include_zero=true&include_prepaid=true')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { if (alive) setRegionalMembers(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setRegionalMembers(members || []); })
      .finally(() => { if (alive) setLoading(false); });
    refetchRules();
    return () => { alive = false; };
  }, []);

  const sourceMembers = regionalMembers || members || [];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {loading && <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>지역별·문자 대상 전체 데이터를 불러오는 중입니다...</div>}
      <div style={{ display:"flex", gap:0, borderBottom:"2px solid var(--border-subtle)" }}>
        {TABS_NAV.map((t,i)=>(
          <button key={t} type="button" onClick={()=>setActiveTab(i)} style={{
            padding:"10px 20px", border:"none", borderBottom: activeTab===i?"2px solid var(--brand)":"2px solid transparent",
            marginBottom:-2, background:"none", cursor:"pointer",
            font:`var(--fw-${activeTab===i?"demibold":"medium"}) 14px/1 var(--font-sans)`,
            color: activeTab===i?"var(--brand)":"var(--text-secondary)",
            transition:"all .12s", whiteSpace:"nowrap",
          }}>{t}</button>
        ))}
      </div>

      {activeTab===0 && <TabRegional members={sourceMembers} exclusionRules={exclusionRules} onToast={onToast} />}
      {activeTab===1 && <TabSms members={sourceMembers} exclusionRules={exclusionRules} onToast={onToast} />}
      {activeTab===2 && <TabAltoran members={sourceMembers} exclusionRules={exclusionRules} onToast={onToast} />}
      {activeTab===3 && <TabExcluded exclusionRules={exclusionRules} onRulesChange={refetchRules} onToast={onToast} />}
    </div>
  );
}

window.Regional = Regional;
