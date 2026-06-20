// 폐업현황 — 기간별 폐업/양도/이관/탈퇴 + 추심/정산 관리
const { Card, Icon, Button } = window.PayroleDesignSystem_9db006;

const CTYPE_STYLE = {
  "폐업": { bg:"var(--grey-50)",  fg:"var(--text-secondary)" },
  "양도": { bg:"#EAF3FF",         fg:"var(--blue-600)" },
  "이관": { bg:"#FBF3DA",         fg:"#9A7B12" },
  "탈퇴": { bg:"var(--red-50)",   fg:"var(--red-500)" },
};
const CHASE = ["추심대상","안내완료","문자완료","지로발송","연락불가","정산완료","보류","정상복구"];
function CTypeBadge({ type }){
  const s = CTYPE_STYLE[type] || CTYPE_STYLE["폐업"];
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:"var(--radius-pill)", background:s.bg, color:s.fg, font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>{type}</span>;
}
function ChaseBadge({ status }){
  const color = status==="정산완료"?"var(--green-500)":status==="연락불가"?"var(--red-500)":status==="보류"?"#B9791A":"var(--brand)";
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:"var(--radius-pill)", background:"var(--grey-25)", border:"1px solid var(--border-subtle)", color, font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>{status||"추심대상"}</span>;
}

function Closures({ closures, onToast, onUpdate, onRestore, onPay }){
  const D = window.PMData; const { won, num } = D;
  const [type, setType] = React.useState("전체");
  const [region,setRegion]=React.useState("");
  const [chase,setChase]=React.useState("");
  const [minAmt,setMinAmt]=React.useState(0);
  const [from,setFrom]=React.useState("");
  const [to,setTo]=React.useState("");
  const [onlyDebt, setOnlyDebt] = React.useState(false);
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(()=>{
    const nq = q.trim().toLowerCase();
    return closures.filter(c=>{
      if (type!=="전체" && c.type!==type) return false;
      if(region && c.sigun!==region) return false;
      if(chase && (c.chaseStatus||"추심대상")!==chase) return false;
      if (onlyDebt && !(c.unpaidBalance>0)) return false;
      if (minAmt && !(c.unpaidBalance>=minAmt)) return false;
      if (from && String(c.processDate||"")<from) return false;
      if (to && String(c.processDate||"")>to) return false;
      if (nq && ![c.name,c.vehicleNo,c.mgmtNo,c.sigun,c.docNo,c.phone,c.address,c.chaseMemo].join(" ").toLowerCase().includes(nq)) return false;
      return true;
    }).sort((a,b)=>String(b.processDate||"").localeCompare(String(a.processDate||"")) || b.unpaidBalance-a.unpaidBalance);
  }, [closures,type,region,chase,onlyDebt,minAmt,from,to,q]);

  const debtTotal = rows.reduce((s,c)=>s+Math.max(c.unpaidBalance,0),0);
  const debtCount = rows.filter(c=>c.unpaidBalance>0).length;
  const countByType = (t)=> closures.filter(c=>t==="전체"||c.type===t).length;

  function changeStatus(c, st){
    onUpdate && onUpdate(c.id, { chaseStatus:st, lastNoticeDate:new Date().toISOString().slice(0,10) });
  }
  function memo(c){
    const m = prompt("추심메모를 입력하세요.", c.chaseMemo || c.content || "");
    if(m!==null) onUpdate && onUpdate(c.id, { chaseMemo:m });
  }
  function exportCSV(){
    const head=["처리일","지역","성명","차량번호","연락처","주소","처리구분","미납잔액","추심상태","최근안내일","메모","문서번호"];
    const lines=[head.join(",")].concat(rows.map(c=>[c.processDate,c.sigun,c.name,c.vehicleNo,c.phone||"",c.address||"",c.type,c.unpaidBalance,c.chaseStatus||"추심대상",c.lastNoticeDate||"",c.chaseMemo||c.content||"",c.docNo||""].map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")));
    const link=document.createElement("a"); link.href=URL.createObjectURL(new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"})); link.download="폐업현황_추심관리.csv"; link.click();
    onToast && onToast(`폐업현황 엑셀 다운로드 완료 · ${rows.length}건`);
  }

  const Th = ({label,align="left"})=>(
    <th style={{ textAlign:align, padding:"11px 14px", whiteSpace:"nowrap", font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-default)", position:"sticky", top:0, zIndex:1 }}>{label}</th>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[["폐업·이탈 회원",`${num(closures.length)}명`,"var(--text-primary)"],["추심 대상 (미납잔액)",`${num(debtCount)}명`,"var(--red-500)"],["미납잔액 합계",won(debtTotal),"var(--red-500)"],["조회 결과",`${num(rows.length)}건`,"var(--text-primary)"]].map(([l,v,c])=>(
          <div key={l} style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"14px 18px", boxShadow:"var(--shadow-xs)" }}>
            <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div>
            <div style={{ font:"var(--fw-bold) 20px/1.1 var(--font-sans)", color:c, marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        {["전체","폐업","양도","이관","탈퇴"].map(t=>(
          <window.PMUI.Chip key={t} active={type===t} count={countByType(t)} onClick={()=>setType(t)}>{t}</window.PMUI.Chip>
        ))}
        <window.PMUI.Chip active={onlyDebt} onClick={()=>setOnlyDebt(v=>!v)}>미납잔액만</window.PMUI.Chip>
        {[["전체",0],["5만원↑",50000],["20만원↑",200000],["30만원↑",300000]].map(([l,v])=><window.PMUI.Chip key={l} active={minAmt===v} onClick={()=>setMinAmt(v)}>{l}</window.PMUI.Chip>)}
        <window.FilterDropdown label="지역" value={region} onChange={setRegion} options={["",...D.REGIONS]} render={v=>v||"전체 지역"} />
        <window.FilterDropdown label="추심" value={chase} onChange={setChase} options={["",...CHASE]} render={v=>v||"추심상태"} />
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={closureInput()} />
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={closureInput()} />
        <window.PMUI.SearchBox value={q} onChange={setQ} width={260} placeholder="이름 · 차량번호 · 연락처 · 메모 검색" />
        <window.PMUI.DownloadBtn onClick={exportCSV} />
      </div>

      <Card padded={false}>
        <div style={{ maxHeight:"calc(100vh - 350px)", overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1280 }}>
            <thead>
              <tr>
                <Th label="처리일" /><Th label="지역" /><Th label="성명" /><Th label="차량번호" />
                <Th label="연락처" /><Th label="주소" /><Th label="처리구분" />
                <Th label="미납잔액" align="right" /><Th label="추심상태" /><Th label="최근안내일" /><Th label="메모" /><Th label="" align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c,i)=>(
                <tr key={c.id} style={{ borderBottom:i<rows.length-1?"1px solid var(--border-subtle)":"none" }}>
                  <td style={{ padding:"12px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{c.processDate}</td>
                  <td style={{ padding:"12px 14px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{c.sigun}</td>
                  <td style={{ padding:"12px 14px", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{c.name}</td>
                  <td style={{ padding:"12px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{c.vehicleNo}</td>
                  <td style={{ padding:"12px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{c.phone||"—"}</td>
                  <td style={{ padding:"12px 14px", font:"var(--body-xs)", color:"var(--text-tertiary)", minWidth:190 }}>{c.address||"—"}</td>
                  <td style={{ padding:"12px 14px" }}><CTypeBadge type={c.type} /></td>
                  <td style={{ padding:"12px 14px", textAlign:"right", font:"var(--fw-bold) 14px/1 var(--font-sans)", color:c.unpaidBalance>0?"var(--red-500)":"var(--green-500)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{won(c.unpaidBalance)}</td>
                  <td style={{ padding:"12px 14px" }}><ChaseBadge status={c.chaseStatus || (c.unpaidBalance>0?"추심대상":"정산완료")} /></td>
                  <td style={{ padding:"12px 14px", font:"var(--body-xs)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{c.lastNoticeDate||"—"}</td>
                  <td style={{ padding:"12px 14px", font:"var(--body-xs)", color:"var(--text-secondary)", minWidth:180 }}>{c.chaseMemo||c.content||"—"}</td>
                  <td style={{ padding:"12px 14px", textAlign:"right", whiteSpace:"nowrap" }}>
                    <button onClick={()=>memo(c)} style={closureBtn("var(--brand)")}>메모</button>
                    <button onClick={()=>changeStatus(c,"문자완료")} style={{...closureBtn("#B9791A"), marginLeft:6}}>문자</button>
                    <button onClick={()=>onPay&&onPay(c)} style={{...closureBtn("var(--green-500)"), marginLeft:6}}>수납</button>
                    <button onClick={()=>changeStatus(c,"정산완료")} style={{...closureBtn("var(--text-secondary)"), marginLeft:6}}>정산</button>
                    <button onClick={()=>onRestore&&onRestore(c)} style={{...closureBtn("var(--violet-500)"), marginLeft:6}}>복구</button>
                  </td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan={12} style={{ padding:"60px", textAlign:"center", color:"var(--text-tertiary)" }}>조건에 맞는 폐업현황이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
function closureInput(){ return { height:36, padding:"0 10px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-pill)", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)" }; }
function closureBtn(color){ return { border:"none", background:"transparent", cursor:"pointer", color, font:"var(--fw-demibold) 12px/1 var(--font-sans)", padding:"6px 2px" }; }

window.Closures = Closures;
