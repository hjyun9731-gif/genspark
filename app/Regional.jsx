// 지역별 미수금 추출 + 문자 발송 대상 추출 (Genspark 데이터 모델 + 문자대상 필터 이식)
const { Card, Icon, Toggle } = window.PayroleDesignSystem_9db006;

function OptToggle({ label, sub, checked, onChange }){
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

function Regional({ members, onToast }){
  const D = window.PMData; const { won, REGIONS } = D;
  const { ChargeTag } = window.PMUI;

  const [mode, setMode] = React.useState("지역");   // 지역 | 문자
  const [regions, setRegions] = React.useState([]);
  const [charges, setCharges] = React.useState(["협회비","관리비"]);
  const [senior, setSenior] = React.useState(true);
  const [incZero, setIncZero] = React.useState(true);
  const [incPrepaid, setIncPrepaid] = React.useState(true);
  const [minAmt, setMinAmt] = React.useState(0);     // 0/50/30000/300000
  // 문자 대상 옵션
  const [excludeNoPhone, setExcludeNoPhone] = React.useState(true);
  const [excludeDisconnected, setExcludeDisconnected] = React.useState(true);
  const [excludeAutoPay, setExcludeAutoPay] = React.useState(true);

  const toggleRegion = (r)=> setRegions(rs=> rs.includes(r)?rs.filter(x=>x!==r):[...rs,r]);
  const toggleCharge = (c)=> setCharges(cs=> cs.includes(c)?cs.filter(x=>x!==c):[...cs,c]);
  const isSms = mode==="문자";

  const filtered = React.useMemo(()=>{
    return members.filter(m=>{
      if (m.status!=="정상") return false;
      if (regions.length && !regions.includes(m.sigun)) return false;
      if (!charges.includes(m.chargeItem)) return false;
      if (!senior && m.isSenior) return false;
      const out = D.outstanding(m);
      if (isSms){
        // 문자 대상: 미수있는 사람 + 제외 옵션
        if (out < (minAmt||30000)) return false;
        if (excludeNoPhone && !m.phone) return false;
        if (excludeDisconnected && m.disconnected) return false;
        if (excludeAutoPay && m.note==="자동이체") return false;
      } else {
        if (!incZero && out===0) return false;
        if (!incPrepaid && out<0) return false;
        if (minAmt && out<minAmt) return false;
      }
      return true;
    });
  }, [members,regions,charges,senior,incZero,incPrepaid,minAmt,isSms,excludeNoPhone,excludeDisconnected,excludeAutoPay]);

  const groups = React.useMemo(()=>{
    const order = REGIONS.filter(r=> !regions.length || regions.includes(r));
    return order.map(r=>({ region:r, rows: filtered.filter(m=>m.sigun===r) })).filter(g=>g.rows.length);
  }, [filtered,regions]);

  const total = filtered.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);

  function exportCSV(){
    const head = isSms
      ? ["지역","성명","차량번호","전화번호","미수금","문자문구"]
      : ["지역","관리번호","성명","차량번호","회원구분","부과항목","미수금","전화번호","주소","비고"];
    const lines = [head.join(",")];
    groups.forEach(g=> g.rows.forEach(m=>{
      const out = D.outstanding(m);
      const row = isSms
        ? [g.region, m.name, m.vehicleNo, m.phone||"-", out, `[화물협회] ${m.name}님 미수금 ${won(out)} 납부 안내드립니다.`]
        : [g.region, m.mgmtNo, m.name, m.vehicleNo, m.membership, m.chargeItem, out, m.phone||"-", m.address, m.note];
      lines.push(row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(","));
    }));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff"+lines.join("\n")], { type:"text/csv;charset=utf-8" }));
    link.download = isSms ? "문자발송대상.csv" : "지역별미수금.csv"; link.click();
    onToast(`${isSms?"문자발송대상":"지역별 미수금"} 엑셀 다운로드 완료 · ${groups.length}개 지역 ${filtered.length}명`);
  }

  const sectionTitle = { font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", letterSpacing:"0.02em", marginBottom:10 };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:24, alignItems:"start" }}>
      {/* 설정 레일 */}
      <Card style={{ position:"sticky", top:0 }}>
        {/* 모드 토글 */}
        <div style={{ display:"flex", gap:6, padding:4, background:"var(--grey-50)", borderRadius:"var(--radius-pill)", marginBottom:16 }}>
          {[["지역","지역별 추출"],["문자","문자 대상"]].map(([k,l])=>(
            <button key={k} type="button" onClick={()=>setMode(k)} style={{ flex:1, height:34, borderRadius:"var(--radius-pill)", border:"none", cursor:"pointer",
              background: mode===k?"var(--white)":"transparent", color: mode===k?"var(--brand)":"var(--text-tertiary)",
              boxShadow: mode===k?"var(--shadow-xs)":"none", font:"var(--fw-demibold) 13px/1 var(--font-sans)" }}>{l}</button>
          ))}
        </div>

        <div style={sectionTitle}>지역 선택</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:18 }}>
          <RChip active={regions.length===0} onClick={()=>setRegions([])}>전체</RChip>
          {REGIONS.map(r=><RChip key={r} active={regions.includes(r)} onClick={()=>toggleRegion(r)}>{r}</RChip>)}
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

        {!isSms ? (
          <>
            <div style={{ height:1, background:"var(--border-subtle)", margin:"10px 0 4px" }} />
            <OptToggle label="0원 포함" checked={incZero} onChange={setIncZero} />
            <OptToggle label="선납 포함" checked={incPrepaid} onChange={setIncPrepaid} />
          </>
        ) : (
          <>
            <div style={{ height:1, background:"var(--border-subtle)", margin:"10px 0 4px" }} />
            <div style={sectionTitle}>문자 발송 제외 조건</div>
            <OptToggle label="전화번호 없는 사람 제외" checked={excludeNoPhone} onChange={setExcludeNoPhone} />
            <OptToggle label="결번/반송 제외" checked={excludeDisconnected} onChange={setExcludeDisconnected} />
            <OptToggle label="자동이체자 제외" checked={excludeAutoPay} onChange={setExcludeAutoPay} />
          </>
        )}
      </Card>

      {/* 결과 */}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"16px 20px", boxShadow:"var(--shadow-xs)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:24 }}>
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{isSms?"문자 대상":"대상 인원"}</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{filtered.length}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>명</span></div></div>
            <div style={{ width:1, height:34, background:"var(--border-default)" }} />
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>미수금 합계</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--red-500)" }}>{won(total)}</div></div>
            <div style={{ width:1, height:34, background:"var(--border-default)" }} />
            <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>지역 수</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{groups.length}<span style={{ fontSize:14, color:"var(--text-tertiary)", fontWeight:500 }}>개</span></div></div>
          </div>
          <window.PMUI.DownloadBtn onClick={exportCSV} label={isSms?"문자 대상 엑셀":"지역별 엑셀 다운로드"} />
        </div>

        {isSms && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", background:"var(--brand-subtle)", borderRadius:"var(--radius-md)" }}>
            <Icon name="mail" size={18} color="var(--brand)" />
            <span style={{ font:"var(--body-sm)", color:"var(--brand-active)" }}>전화번호·미수금 기준으로 문자 발송 대상을 추출합니다. 엑셀에 문자 문구 복사용 데이터가 함께 출력됩니다.</span>
          </div>
        )}

        {groups.map(g=>{
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
                  {(isSms ? ["성명","차량번호","전화번호","미수금"] : ["관리번호","성명","차량번호","회원구분","부과항목","미수금","전화번호","비고"]).map((h,i)=>(
                    <th key={h} style={{ textAlign:(isSms?i===3:i===5)?"right":"left", padding:"9px 20px", whiteSpace:"nowrap", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>))}
                </tr></thead>
                <tbody>
                  {g.rows.map((m,i)=>{
                    const out = D.outstanding(m);
                    return (
                      <tr key={m.id} style={{ borderBottom: i<g.rows.length-1?"1px solid var(--border-subtle)":"none" }}>
                        {isSms ? (
                          <>
                            <td style={{ padding:"10px 20px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{m.name}{m.isSenior && <span style={{ marginLeft:6, font:"10px/1 var(--font-sans)", color:"var(--green-500)", fontWeight:700 }}>70세</span>}</td>
                            <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.vehicleNo}</td>
                            <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-primary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{m.phone||"—"}</td>
                            <td style={{ padding:"10px 20px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--red-500)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{won(out)}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding:"10px 20px", font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{m.mgmtNo}</td>
                            <td style={{ padding:"10px 20px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{m.name}</td>
                            <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.vehicleNo}</td>
                            <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.membership}</td>
                            <td style={{ padding:"10px 20px" }}><ChargeTag item={m.chargeItem} /></td>
                            <td style={{ padding:"10px 20px", textAlign:"right", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:out>0?"var(--red-500)":out<0?"var(--violet-500)":"var(--text-tertiary)" }}>{won(out)}</td>
                            <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.phone||"—"}</td>
                            <td style={{ padding:"10px 20px", font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{m.note||"—"}</td>
                          </>
                        )}
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

function RChip({ active, onClick, children }){
  return (
    <button type="button" onClick={onClick} style={{
      height:32, padding:"0 12px", borderRadius:"var(--radius-pill)", cursor:"pointer", whiteSpace:"nowrap",
      border: active?"1px solid var(--brand)":"1px solid var(--border-default)",
      background: active?"var(--brand)":"var(--white)", color: active?"#fff":"var(--text-secondary)",
      font:"var(--fw-medium) 12.5px/1 var(--font-sans)", transition:"all .12s" }}>{children}</button>
  );
}

window.Regional = Regional;
