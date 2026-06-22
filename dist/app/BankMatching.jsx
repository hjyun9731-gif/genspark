// 통장매칭 — 입금자명·입금액을 회원 미수금과 대조해 수납 반영 (Genspark 기능 이식)
const { Card, Icon, Button } = window.PayroleDesignSystem_9db006;

const BANK_STATUS_STYLE = {
  "자동매칭": { bg:"var(--green-50)", fg:"var(--green-500)" },
  "후보확인": { bg:"#FFF3DC",         fg:"#B9791A" },
  "중복후보": { bg:"#EFEEFD",         fg:"var(--violet-500)" },
  "미매칭":   { bg:"var(--red-50)",   fg:"var(--red-500)" },
  "매칭완료": { bg:"var(--blue-100)", fg:"var(--blue-600)" },
  "제외":     { bg:"var(--grey-50)",  fg:"var(--grey-400)" },
};
function BankStatusBadge({ status }){
  const s = BANK_STATUS_STYLE[status] || BANK_STATUS_STYLE["미매칭"];
  return <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:"var(--radius-pill)", background:s.bg, color:s.fg, font:"var(--fw-demibold) 12px/1 var(--font-sans)", whiteSpace:"nowrap" }}><span style={{ width:6, height:6, borderRadius:"50%", background:s.fg }} />{status}</span>;
}
function diffText(diff){ if(diff==null) return "—"; if(Number(diff)===0) return "일치"; return Number(diff)>0 ? `초과 ${window.PMData.won(diff)}` : `부족 ${window.PMData.won(Math.abs(diff))}`; }

// 수납 반영 액션 — 회비반영(차감) / 가수금 / 잡수입 / 기타 (미차감 기록)
const INCOME_ACTIONS = [
  { value:null,           label:"회비반영", green:true },
  { value:"협회가입비",     label:"가수금" },
  { value:"자격증명발급비", label:"잡수입" },
  { value:"기타",          label:"기타" },
];
function IncomeActions({ onPick }){
  return (
    <div style={{ display:"inline-flex", gap:5, flexWrap:"wrap", justifyContent:"flex-end" }}>
      {INCOME_ACTIONS.map(a=>(
        <button key={a.label} type="button" onClick={()=>onPick(a.value)} style={{ height:28, padding:"0 10px", borderRadius:"var(--radius-pill)", border: a.green?"none":"1px solid var(--border-default)", cursor:"pointer",
          background: a.green?"var(--green-500)":"var(--white)", color: a.green?"#fff":"var(--text-secondary)", font:"var(--fw-demibold) 12px/1 var(--font-sans)", whiteSpace:"nowrap" }}>{a.label}</button>
      ))}
    </div>
  );
}

function BankMatching({ deposits, members, onMatch, onGroupMatch, onExclude, onReset, onPaste, onToast }){
  const D = window.PMData; const { won, num } = D;
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("전체");
  const [modal, setModal] = React.useState(null);
  const [paste, setPaste] = React.useState(false);

  const summary = React.useMemo(()=>{
    const c = (st)=>deposits.filter(d=>d.status===st).length;
    return { total:deposits.length, auto:c("자동매칭"), confirm:c("후보확인")+c("중복후보"), unmatched:c("미매칭"), done:c("매칭완료")+c("제외") };
  }, [deposits]);

  const rows = React.useMemo(()=>{
    const nq = q.trim().toLowerCase();
    return deposits.filter(d=>{
      const best = d.candidates && d.candidates[0];
      const text = [d.depositorName, d.memo, d.description, d.status, best?.name, best?.vehicleNo].join(" ").toLowerCase();
      const okQ = !nq || text.includes(nq);
      const okS = status==="전체" || d.status===status || (status==="처리대기" && !["매칭완료","제외"].includes(d.status)) || (status==="확인필요" && ["후보확인","중복후보"].includes(d.status));
      return okQ && okS;
    }).sort((a,b)=>{ const rank={"자동매칭":1,"후보확인":2,"중복후보":3,"미매칭":4,"매칭완료":9,"제외":10}; return (rank[a.status]||8)-(rank[b.status]||8); });
  }, [deposits,q,status]);

  function autoAll(){
    const targets = rows.filter(d=>d.status==="자동매칭" && d.candidates[0]);
    if(!targets.length){ onToast("자동매칭 대상이 없습니다."); return; }
    if(!confirm(`자동매칭 ${targets.length}건을 수납 반영할까요?`)) return;
    targets.forEach(d=>onMatch(d, d.candidates[0]));
    onToast(`자동매칭 ${targets.length}건 수납 반영 완료`);
  }

  const Th = ({label,align="left"})=>(
    <th style={{ textAlign:align, padding:"11px 16px", whiteSpace:"nowrap", font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-default)", position:"sticky", top:0, zIndex:1 }}>{label}</th>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* 요약 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
        {[["전체 거래",summary.total,"var(--text-primary)","업로드 원본"],
          ["자동매칭",summary.auto,"var(--green-500)","바로 반영 후보"],
          ["확인 필요",summary.confirm,"#B9791A","후보확인/중복"],
          ["미매칭",summary.unmatched,"var(--red-500)","수동검색 필요"],
          ["완료/제외",summary.done,"var(--text-secondary)","처리 끝"]].map(([l,v,c,s])=>(
          <div key={l} style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"14px 16px", boxShadow:"var(--shadow-xs)" }}>
            <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div>
            <div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:c, marginTop:6 }}>{num(v)}<span style={{ fontSize:13, color:"var(--text-tertiary)", fontWeight:500 }}>건</span></div>
            <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:4 }}>{s}</div>
          </div>
        ))}
      </div>

      {/* 필터 + 액션 */}
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <window.PMUI.SearchBox value={q} onChange={setQ} width={340} placeholder="입금자명 · 거래기록 · 회원명 · 차량번호 검색" />
        <select value={status} onChange={e=>setStatus(e.target.value)} style={{ appearance:"none", height:42, padding:"0 32px 0 14px", borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)", background:"var(--white)", cursor:"pointer", font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-primary)", backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 6 12' fill='%239096A2'><path d='M0 4l3 4 3-4'/></svg>\")", backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center" }}>
          {["전체","처리대기","자동매칭","확인필요","미매칭","매칭완료","제외"].map(s=><option key={s}>{s}</option>)}
        </select>
        <div style={{ marginLeft:"auto", display:"flex", gap:10 }}>
          <Button variant="tertiary" size="medium" leadingIcon="notes" onClick={()=>setPaste(true)}>붙여넣기 입력</Button>
          <Button variant="tertiary" size="medium" leadingIcon="check" onClick={autoAll}>자동매칭 전체 반영</Button>
          <button type="button" onClick={()=>{ if(confirm("현재 통장매칭 결과를 초기화합니다. 수납 반영되지 않은 거래가 대기 상태로 돌아갑니다. 계속하시겠습니까?")) onReset(); }}
            style={{ height:42, padding:"0 16px", borderRadius:"var(--radius-pill)", border:"1px solid var(--red-100, #FBD5D5)", background:"var(--red-50)", color:"var(--red-500)", cursor:"pointer", font:"var(--fw-medium) 14px/1 var(--font-sans)" }}>매칭결과 초기화</button>
        </div>
      </div>

      {/* 테이블 */}
      <div style={{ border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", overflow:"hidden", background:"var(--white)", boxShadow:"var(--shadow-xs)" }}>
        <div style={{ maxHeight:"calc(100vh - 400px)", overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1080 }}>
            <thead><tr>
              <Th label="거래일자" /><Th label="입금자명" /><Th label="거래기록사항" /><Th label="입금액" align="right" />
              <Th label="상태" /><Th label="추천회원" /><Th label="차량번호" /><Th label="현재미수 / 차액" align="right" /><Th label="처리" align="right" />
            </tr></thead>
            <tbody>
              {rows.map(d=>{
                const group = d.groupCandidates && d.groupCandidates[0];
                const best = d.candidates && d.candidates[0];
                const done = ["매칭완료","제외"].includes(d.status);
                const arrears = group ? group.expectedAmount : best ? best.totalArrears : 0;
                const diff = group ? group.diff : best ? (d.amount - arrears) : null;
                return (
                  <tr key={d.id} style={{ borderBottom:"1px solid var(--border-subtle)", opacity:done?0.6:1 }}>
                    <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{d.depositDate}</td>
                    <td style={{ padding:"12px 16px", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{d.depositorName}</td>
                    <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-tertiary)", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={d.memo}>{d.memo || d.description}</td>
                    <td style={{ padding:"12px 16px", textAlign:"right", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{won(d.amount)}</td>
                    <td style={{ padding:"12px 16px" }}>
                      <BankStatusBadge status={d.status} />
                      {group && <div style={{ display:"inline-flex", marginLeft:6, padding:"3px 8px", borderRadius:"var(--radius-pill)", background:"#EFEEFD", color:"var(--violet-500)", font:"var(--fw-demibold) 11px/1 var(--font-sans)" }}>묶음</div>}
                      {!group && d.candidates && d.candidates.length>1 && <div style={{ font:"10px/1.4 var(--font-sans)", color:"var(--text-tertiary)", marginTop:3 }}>후보 {d.candidates.length}명</div>}
                    </td>
                    <td style={{ padding:"12px 16px", whiteSpace:"nowrap" }}>
                      {group ? <span><b style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{group.title}</b><div style={{ font:"10px/1.4 var(--font-sans)", color:"var(--text-tertiary)" }}>묶음 {group.resolvedCount}/{group.targetCount}명 · 대납</div></span>
                        : best ? <span><b style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{best.name}</b><div style={{ font:"10px/1.4 var(--font-sans)", color:"var(--text-tertiary)" }}>{best.mgmtNo}</div></span>
                        : <span style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>수동매칭 필요</span>}
                    </td>
                    <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{group ? "대납자 묶음" : best?.vehicleNo || "—"}</td>
                    <td style={{ padding:"12px 16px", textAlign:"right", whiteSpace:"nowrap" }}>
                      {(group||best) ? <span><b style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", fontVariantNumeric:"tabular-nums" }}>{won(arrears)}</b><div style={{ font:"10px/1.4 var(--font-sans)", color: diff===0?"var(--green-500)":"var(--text-tertiary)" }}>{diffText(diff)}</div></span> : "—"}
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"right", whiteSpace:"nowrap" }}>
                      {!done ? (
                        <div style={{ display:"inline-flex", gap:6 }}>
                          {group
                            ? <button type="button" onClick={()=>{ onGroupMatch(d, group); onToast(`${group.title} ${won(d.amount)} 묶음수납 반영`); }} style={{ height:28, padding:"0 11px", borderRadius:"var(--radius-pill)", border:"none", cursor:"pointer", background:"var(--violet-500)", color:"#fff", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>묶음반영</button>
                            : <button type="button" disabled={!best} onClick={()=>{ onMatch(d, best); onToast(`${best.name} 님 ${won(d.amount)} 수납 반영`); }} style={{ height:28, padding:"0 11px", borderRadius:"var(--radius-pill)", border:"none", cursor:best?"pointer":"default", background:best?"var(--green-500)":"var(--grey-100)", color:best?"#fff":"var(--text-muted)", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>반영</button>}
                          <button type="button" onClick={()=>setModal(d)} style={{ height:28, padding:"0 11px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", cursor:"pointer", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>{(group||best)?"후보":"수동"}</button>
                          <button type="button" onClick={()=>onExclude(d)} style={{ height:28, padding:"0 11px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", cursor:"pointer", background:"var(--white)", color:"var(--text-tertiary)", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>제외</button>
                        </div>
                      ) : <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>처리완료</span>}
                    </td>
                  </tr>
                );
              })}
              {rows.length===0 && <tr><td colSpan={9} style={{ padding:"60px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-md)" }}>매칭할 거래내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ManualMatchModal deposit={modal} members={members} onClose={()=>setModal(null)}
        onMatch={(d,m,chargeItem)=>{ onMatch(d,{ id:m.id, name:m.name, vehicleNo:m.vehicleNo, mgmtNo:m.mgmtNo, totalArrears:D.outstanding(m), chargeItem: chargeItem||m.chargeItem }, chargeItem); onToast(`${m.name} 님 ${won(d.amount)} ${chargeItem?chargeItem:"수납"} 반영`); setModal(null); }}
        onGroupMatch={(d,g)=>{ onGroupMatch(d,g); onToast(`${g.title} 묶음수납 반영`); setModal(null); }} />}
      {paste && <PasteModal onClose={()=>setPaste(false)} onSave={(rows)=>{ onPaste(rows); setPaste(false); onToast(`붙여넣기 ${rows.length}건 통장매칭 대기로 저장`); }} />}
    </div>
  );
}

function ManualMatchModal({ deposit, members, onClose, onMatch, onGroupMatch }){
  const D = window.PMData; const { won } = D;
  const [q, setQ] = React.useState("");
  const groupCands = deposit.groupCandidates || [];
  const rows = React.useMemo(()=>{
    const base = members.filter(m=>m.status==="정상");
    if(!q.trim()) return base.slice(0,80);
    const nq = q.trim().toLowerCase(); const nv = D.normVehicle(q);
    return base.filter(m=>[m.name,m.vehicleNo,m.mgmtNo,m.phone].join(" ").toLowerCase().includes(nq) || (nv && D.normVehicle(m.vehicleNo).includes(nv))).slice(0,80);
  }, [members,q]);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:120, background:"rgba(10,17,47,0.38)", display:"flex", justifyContent:"center", alignItems:"center", backdropFilter:"blur(2px)", animation:"pmFade .15s ease" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:720, maxHeight:"86vh", background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden", display:"flex", flexDirection:"column", animation:"pmPop .18s ease" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ font:"var(--fw-bold) 18px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>후보 확인 / 수동매칭</div>
            <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:4 }}>{deposit.depositorName} · {won(deposit.amount)} · {deposit.depositDate}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} /></button>
        </div>
        <div style={{ padding:"18px 24px", overflow:"auto" }}>
          {groupCands.length>0 && (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)" }}>묶음수납 후보</div>
                <span style={{ font:"var(--body-xs)", color:"var(--violet-500)" }}>한 입금으로 여러 회원 대납</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
                {groupCands.map((g)=>(
                  <div key={g.code} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"1px solid #E3E1FB", background:"#F7F6FE", borderRadius:"var(--radius-md)" }}>
                    <div style={{ flex:1 }}>
                      <b style={{ font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>{g.title}</b>
                      <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:3 }}>{g.reason} · {(g.members||[]).map(m=>m.name).join(", ")}</div>
                    </div>
                    <div style={{ textAlign:"right" }}><div style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{won(g.expectedAmount)}</div><div style={{ font:"10px/1.4 var(--font-sans)", color:"var(--text-tertiary)" }}>{g.resolvedCount}/{g.targetCount}명</div></div>
                    <button type="button" onClick={()=>onGroupMatch(deposit, g)} style={{ height:32, padding:"0 14px", borderRadius:"var(--radius-pill)", border:"none", cursor:"pointer", background:"var(--violet-500)", color:"#fff", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>묶음반영</button>
                  </div>
                ))}
              </div>
            </>
          )}
          {deposit.candidates && deposit.candidates.length>0 && (
            <>
              <div style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", marginBottom:8 }}>추천 후보 · 수납항목 선택</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
                {deposit.candidates.map((c,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <b style={{ font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>{c.name}</b>
                      <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:3 }}>{c.vehicleNo} · {c.mgmtNo} · 미수 {won(c.totalArrears)}</div>
                    </div>
                    <IncomeActions onPick={(item)=>onMatch(deposit, members.find(m=>m.id===c.id) || c, item)} />
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", marginBottom:8 }}>회원 검색</div>
          <window.PMUI.SearchBox value={q} onChange={setQ} width="100%" placeholder="이름 · 차량번호 · 관리번호 · 전화번호 검색" />
          <div style={{ marginTop:12, border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-md)", overflow:"hidden" }}>
            <div style={{ maxHeight:260, overflow:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>{["이름","지역","차량번호","현재미수","수납항목"].map((h,i)=><th key={h} style={{ textAlign:i===3?"right":"left", padding:"9px 14px", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)", position:"sticky", top:0 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map(m=>(
                    <tr key={m.id} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                      <td style={{ padding:"9px 14px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{m.name}</td>
                      <td style={{ padding:"9px 14px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{m.sigun}</td>
                      <td style={{ padding:"9px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{m.vehicleNo}</td>
                      <td style={{ padding:"9px 14px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", fontVariantNumeric:"tabular-nums" }}>{won(D.outstanding(m))}</td>
                      <td style={{ padding:"9px 14px", textAlign:"right" }}><IncomeActions onPick={(item)=>onMatch(deposit, m, item)} /></td>
                    </tr>
                  ))}
                  {rows.length===0 && <tr><td colSpan={5} style={{ padding:"30px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>검색 결과가 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 통장거래 붙여넣기 — 은행/엑셀 거래내역을 붙여넣으면 대기 거래로 파싱
function parsePasted(text){
  const lines = String(text||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  const out=[];
  for(const line of lines){
    const cols = line.includes("\t") ? line.split("\t").map(v=>v.trim()) : line.split(/\s{2,}/).map(v=>v.trim());
    const joined = cols.join(" ");
    if(/거래일자/.test(joined) && /입금/.test(joined)) continue;
    if(/합계|잔액조회/.test(joined)) continue;
    const date = (cols.find(c=>/\d{2,4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(c))||"").replace(/\./g,"-");
    const amount = Math.max(...cols.map(c=>Number(String(c).replace(/[^0-9]/g,""))||0));
    if(!date || amount<=0) continue;
    const memo = cols[cols.length-1] || "";
    const depositorName = memo.replace(/[0-9,원]/g,"").trim() || "미확인";
    out.push({ depositDate:date, amount, memo, depositorName, description: cols.length>=6?cols[cols.length-2]:"" });
  }
  return out;
}

function PasteModal({ onClose, onSave }){
  const { won } = window.PMData;
  const [text, setText] = React.useState("");
  const parsed = React.useMemo(()=>parsePasted(text), [text]);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:120, background:"rgba(10,17,47,0.38)", display:"flex", justifyContent:"center", alignItems:"center", backdropFilter:"blur(2px)", animation:"pmFade .15s ease" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:680, maxHeight:"86vh", background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden", display:"flex", flexDirection:"column", animation:"pmPop .18s ease" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ font:"var(--fw-bold) 18px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>통장거래 붙여넣기</div>
            <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:4 }}>은행/엑셀 거래내역을 복사해 붙여넣으면 통장매칭 대기 거래로 저장됩니다.</div>
          </div>
          <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} /></button>
        </div>
        <div style={{ padding:"18px 24px", overflow:"auto" }}>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={"구분\t거래일자\t출금금액\t입금금액\t거래 후 잔액\t거래내용\t거래기록사항\n1\t2026-03-30\t\t30,000\t...\t신한은행\t김태형"} style={{ width:"100%", height:140, padding:"12px 14px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"var(--fw-regular) 13px/1.6 var(--font-mono, monospace)", resize:"vertical", outline:"none", boxSizing:"border-box" }} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", margin:"14px 0 8px" }}>
            <b style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>인식 결과 {parsed.length}건</b>
            <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>입금액이 있는 행만 저장됩니다.</span>
          </div>
          <div style={{ border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-md)", overflow:"hidden", maxHeight:200, overflowY:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>{["거래일자","입금자/기록","입금액"].map((h,i)=><th key={h} style={{ textAlign:i===2?"right":"left", padding:"8px 14px", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)", position:"sticky", top:0 }}>{h}</th>)}</tr></thead>
              <tbody>
                {parsed.slice(0,30).map((r,i)=>(
                  <tr key={i} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                    <td style={{ padding:"8px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.depositDate}</td>
                    <td style={{ padding:"8px 14px", font:"var(--body-sm)", color:"var(--text-primary)" }}><b>{r.depositorName}</b> <span style={{ color:"var(--text-tertiary)" }}>{r.memo}</span></td>
                    <td style={{ padding:"8px 14px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", fontVariantNumeric:"tabular-nums" }}>{won(r.amount)}</td>
                  </tr>
                ))}
                {parsed.length===0 && <tr><td colSpan={3} style={{ padding:"24px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>붙여넣은 거래내역이 아직 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
            <Button variant="tertiary" size="medium" onClick={onClose}>취소</Button>
            <Button variant="primary" size="medium" disabled={!parsed.length} onClick={()=>onSave(parsed)}>통장매칭에 저장</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.BankMatching = BankMatching;
