// 지역별 미수금 추출 + 문자 대상 + 알토란 추출 + 제외자 관리
const { Card, Icon, Toggle } = window.PayroleDesignSystem_9db006;

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

// ── 탭1: 지역별 문자 발송 (기존 지역 모드) ──────────────────────────
function TabRegional({ members, onToast }) {
  const D = window.PMData;
  const { won, REGIONS } = D;
  const { ChargeTag } = window.PMUI;
  const [regions, setRegions] = React.useState([]);
  const [charges, setCharges] = React.useState(["협회비","관리비"]);
  const [senior, setSenior] = React.useState(true);
  const [incZero, setIncZero] = React.useState(true);
  const [incPrepaid, setIncPrepaid] = React.useState(true);
  const [minAmt, setMinAmt] = React.useState(0);

  const toggleRegion = r => setRegions(rs => rs.includes(r) ? rs.filter(x=>x!==r) : [...rs,r]);
  const toggleCharge = c => setCharges(cs => cs.includes(c) ? cs.filter(x=>x!==c) : [...cs,c]);

  const filtered = React.useMemo(() => members.filter(m => {
    if (m.status !== "정상") return false;
    if (regions.length && !regions.includes(m.sigun)) return false;
    if (!charges.includes(m.chargeItem)) return false;
    if (!senior && m.isSenior) return false;
    const out = D.outstanding(m);
    if (!incZero && out===0) return false;
    if (!incPrepaid && out<0) return false;
    if (minAmt && out<minAmt) return false;
    return true;
  }), [members,regions,charges,senior,incZero,incPrepaid,minAmt]);

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
      lines.push([g.region,m.mgmtNo,m.name,m.vehicleNo,m.membership,m.chargeItem,out,m.phone||"-",m.address,m.note].map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(","));
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
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
          {[["전체",0],["50원↑",50],["3만원↑",30000],["30만원↑",300000]].map(([l,v])=>(
            <RChip key={l} active={minAmt===v} onClick={()=>setMinAmt(v)}>{l}</RChip>
          ))}
        </div>
        <div style={{ height:1, background:"var(--border-subtle)", margin:"10px 0 4px" }} />
        <OptToggle label="0원 포함" checked={incZero} onChange={setIncZero} />
        <OptToggle label="선납 포함" checked={incPrepaid} onChange={setIncPrepaid} />
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
                        <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.vehicleNo}</td>
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
function TabSms({ members, onToast }) {
  const D = window.PMData;
  const { won, REGIONS } = D;
  const [regions, setRegions] = React.useState([]);
  const [minAmt, setMinAmt] = React.useState(30000);
  const [excludeNoPhone, setExcludeNoPhone] = React.useState(true);
  const [excludeDisconnected, setExcludeDisconnected] = React.useState(true);
  const [excludeAutoPay, setExcludeAutoPay] = React.useState(true);

  const toggleRegion = r => setRegions(rs => rs.includes(r) ? rs.filter(x=>x!==r) : [...rs,r]);

  const filtered = React.useMemo(() => members.filter(m => {
    if (m.status !== "정상") return false;
    if (regions.length && !regions.includes(m.sigun)) return false;
    const out = D.outstanding(m);
    if (out < (minAmt||30000)) return false;
    if (excludeNoPhone && !m.phone) return false;
    if (excludeDisconnected && m.disconnected) return false;
    if (excludeAutoPay && m.note==="자동이체") return false;
    return true;
  }), [members,regions,minAmt,excludeNoPhone,excludeDisconnected,excludeAutoPay]);

  const groups = React.useMemo(() => {
    const order = REGIONS.filter(r => !regions.length || regions.includes(r));
    return order.map(r => ({ region:r, rows: filtered.filter(m=>m.sigun===r) })).filter(g=>g.rows.length);
  }, [filtered,regions]);

  const exportCSV = () => {
    const head = ["지역","성명","차량번호","전화번호","미수금","문자문구"];
    const lines = [head.join(",")];
    groups.forEach(g => g.rows.forEach(m => {
      const out = D.outstanding(m);
      lines.push([g.region,m.name,m.vehicleNo,m.phone||"-",out,`[화물협회] ${m.name}님 미수금 ${won(out)} 납부 안내드립니다.`].map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(","));
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
        <div style={sectionTitle}>최소 미수금</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {[["1만원↑",10000],["3만원↑",30000],["10만원↑",100000],["30만원↑",300000]].map(([l,v])=>(
            <RChip key={l} active={minAmt===v} onClick={()=>setMinAmt(v)}>{l}</RChip>
          ))}
        </div>
        <div style={{ height:1, background:"var(--border-subtle)", margin:"10px 0 4px" }} />
        <div style={sectionTitle}>제외 조건</div>
        <OptToggle label="전화번호 없는 사람 제외" checked={excludeNoPhone} onChange={setExcludeNoPhone} />
        <OptToggle label="결번/반송 제외" checked={excludeDisconnected} onChange={setExcludeDisconnected} />
        <OptToggle label="자동이체자 제외" checked={excludeAutoPay} onChange={setExcludeAutoPay} />
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
                      <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.vehicleNo}</td>
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
function parseAltoranText(raw) {
  const lines = raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const cols = line.split(/\t/);
    if (cols.length < 2) continue;
    const row = {
      region: "",
      name: "",
      vehicleNo: "",
      phone: "",
      phone2: "",
      address: "",
      note: "",
      _raw: line,
    };
    cols.forEach((v,i)=>{
      const s = v.trim();
      if (!s) return;
      if (!row.region && /시$|군$/.test(s)) { row.region = s; return; }
      if (!row.name && /^[가-힣]{2,5}$/.test(s) && s.length<=4) { row.name = s; return; }
      if (!row.vehicleNo && /[가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후]/.test(s) && /\d{4}/.test(s)) { row.vehicleNo = s; return; }
      if (/^0\d{9,10}$/.test(s.replace(/-/g,""))) {
        const clean = s.replace(/-/g,"").replace(/(\d{3})(\d{3,4})(\d{4})/,"$1-$2-$3");
        if (!row.phone) row.phone = clean;
        else if (!row.phone2) row.phone2 = clean;
        return;
      }
      if (!row.address && (s.includes("시")||s.includes("군")||s.includes("도")||s.includes("리")||s.includes("읍")||s.includes("면")||s.length>6)) { row.address = s; return; }
      if (!row.note && s.length > 1) row.note = s;
    });
    if (row.name || row.vehicleNo) rows.push(row);
  }
  return rows;
}

function inferRegion(row, REGIONS) {
  if (row.region) {
    const found = REGIONS.find(r => row.region.includes(r.replace("시","").replace("군","")));
    if (found) return found;
  }
  if (row.address) {
    const found = REGIONS.find(r => row.address.includes(r.replace("시","").replace("군","")));
    if (found) return found;
  }
  return row.region || "미분류";
}

function TabAltoran({ members, onToast }) {
  const D = window.PMData;
  const { REGIONS, won, outstanding } = D;
  const today = new Date();
  const [issueMonth, setIssueMonth] = React.useState(String(today.getMonth()+1));
  const [issueYear, setIssueYear] = React.useState(String(today.getFullYear()));
  const [issueDate, setIssueDate] = React.useState(
    `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}.`
  );
  const [excludeNoPhone, setExcludeNoPhone] = React.useState(true);
  const [excludeJiro, setExcludeJiro] = React.useState(true);

  // 미수금 있는 정상 회원만
  const eligible = React.useMemo(() => {
    return (members||[]).filter(m => {
      if (m.status !== "정상") return false;
      const amt = m.arrears_amount ?? m.totalArrears ?? 0;
      if (amt <= 0) return false;
      if (excludeNoPhone && !m.phone) return false;
      if (excludeJiro && (m.memo||"").includes("지로")) return false;
      return true;
    });
  }, [members, excludeNoPhone, excludeJiro]);

  const noPhone = React.useMemo(() => (members||[]).filter(m => m.status==="정상" && (m.arrears_amount??m.totalArrears??0)>0 && !m.phone).length, [members]);

  const groups = React.useMemo(() => {
    const regionOrder = REGIONS;
    const byRegion = {};
    eligible.forEach(m => {
      const r = m.sigun || "미분류";
      if (!byRegion[r]) byRegion[r] = [];
      byRegion[r].push(m);
    });
    const result = regionOrder.filter(r=>byRegion[r]?.length).map(r=>({region:r,rows:byRegion[r]}));
    const others = Object.keys(byRegion).filter(r=>!regionOrder.includes(r));
    others.forEach(r => result.push({region:r,rows:byRegion[r]}));
    return result;
  }, [eligible, REGIONS]);

  const exportXlsx = () => {
    if (!eligible.length) { onToast("추출된 데이터가 없습니다."); return; }
    if (typeof XLSX === "undefined") { onToast("엑셀 라이브러리가 로드되지 않았습니다. 페이지를 새로고침 해주세요."); return; }

    const monthLabel = `${issueMonth}월분`;
    const chargeMap = { "협회비": 0, "관리비": 0, "70세": 0 };

    // Sheet1
    const sheet1Headers = ["코드","상호","대표자명","기타사원","핸드폰","거래처구분","품목코드","지로발행명목","규격","발행연월일","발행금액"];
    const sheet1Data = [sheet1Headers];
    eligible.forEach((m, idx) => {
      const amt = m.arrears_amount ?? m.totalArrears ?? 0;
      const chargeItem = m.chargeItem || m.charge_item || "협회비";
      if (chargeMap.hasOwnProperty(chargeItem)) chargeMap[chargeItem] += amt;
      sheet1Data.push([
        idx + 1,
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
    // 발행금액 열(K) 숫자 서식
    const range = XLSX.utils.decode_range(ws1["!ref"]);
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws1[XLSX.utils.encode_cell({r, c: 10})];
      if (cell) cell.z = "#,##0";
    }

    // 요약 시트
    const totalAmt = eligible.reduce((s,m) => s + (m.arrears_amount ?? m.totalArrears ?? 0), 0);
    const summaryData = [
      ["항목", "건수/금액"],
      ["입력건수", eligible.length],
      ["협회비 합계", chargeMap["협회비"]],
      ["관리비 합계", chargeMap["관리비"]],
      ["70세 합계", chargeMap["70세"]],
      ["발행금액합계", totalAmt],
      ["핸드폰없음 제외", noPhone],
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
          <OptToggle label="지로희망자 제외 (메모 기준)" checked={excludeJiro} onChange={setExcludeJiro} />
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

// ── 탭4: 제외자/지로희망자 관리 ──────────────────────────────────
function TabExcluded({ members, onToast }) {
  const D = window.PMData;
  const { won } = D;
  const excluded = members.filter(m => m.note==="자동이체" || m.note==="지로희망" || m.excluded);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", background:"var(--grey-25)", borderRadius:"var(--radius-md)", border:"1px solid var(--border-subtle)" }}>
        <Icon name="warning" size={16} color="#B9791A" />
        <span style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>문자 발송·지역 추출에서 제외된 회원 목록입니다. 지로희망자, 자동이체, 수동 제외자를 관리합니다.</span>
      </div>
      <Card padded={false}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            {["지역","성명","차량번호","관리번호","제외사유","미수금","전화번호"].map((h,i)=>(
              <th key={h} style={{ textAlign:i===5?"right":"left", padding:"10px 18px", whiteSpace:"nowrap", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {excluded.length===0 && (
              <tr><td colSpan={7} style={{ padding:"40px", textAlign:"center", color:"var(--text-tertiary)" }}>제외자가 없습니다.</td></tr>
            )}
            {excluded.map((m,i)=>{
              const out = D.outstanding(m);
              return (
                <tr key={m.id} style={{ borderBottom:i<excluded.length-1?"1px solid var(--border-subtle)":"none" }}>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{m.sigun||"—"}</td>
                  <td style={{ padding:"10px 18px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{m.name}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.vehicleNo||"—"}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{m.mgmtNo||"—"}</td>
                  <td style={{ padding:"10px 18px" }}>
                    <span style={{ padding:"3px 10px", borderRadius:"var(--radius-pill)", background:"var(--grey-50)", color:"var(--text-secondary)", font:"var(--fw-medium) 11px/1 var(--font-sans)" }}>{m.note||"제외"}</span>
                  </td>
                  <td style={{ padding:"10px 18px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:out>0?"var(--red-500)":"var(--text-tertiary)", whiteSpace:"nowrap" }}>{won(out)}</td>
                  <td style={{ padding:"10px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{m.phone||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── 메인 Regional 컴포넌트 ────────────────────────────────────────
function Regional({ members, onToast }) {
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* 탭 네비게이션 */}
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

      {activeTab===0 && <TabRegional members={members} onToast={onToast} />}
      {activeTab===1 && <TabSms members={members} onToast={onToast} />}
      {activeTab===2 && <TabAltoran members={members} onToast={onToast} />}
      {activeTab===3 && <TabExcluded members={members} onToast={onToast} />}
    </div>
  );
}

window.Regional = Regional;
