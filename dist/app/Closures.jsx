// 폐업현황 — 폐업/양도/이관/탈퇴 회원과 미납잔액 추심 대상 (Genspark 기능 이식)
const { Card, Icon } = window.PayroleDesignSystem_9db006;

const CTYPE_STYLE = {
  "폐업": { bg:"var(--grey-50)",  fg:"var(--text-secondary)" },
  "양도": { bg:"#EAF3FF",         fg:"var(--blue-600)" },
  "이관": { bg:"#FBF3DA",         fg:"#9A7B12" },
  "탈퇴": { bg:"var(--red-50)",   fg:"var(--red-500)" },
};
function CTypeBadge({ type }){
  const s = CTYPE_STYLE[type] || CTYPE_STYLE["폐업"];
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:"var(--radius-pill)", background:s.bg, color:s.fg, font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>{type}</span>;
}

function Closures({ closures, onRestore, onDelete, onToast }){
  const D = window.PMData; const { won, num } = D;
  const [type, setType] = React.useState("전체");
  const [onlyDebt, setOnlyDebt] = React.useState(false);
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(()=>{
    const nq = q.trim().toLowerCase();
    return closures.filter(c=>{
      if (type!=="전체" && c.type!==type) return false;
      if (onlyDebt && !(c.unpaidBalance>0)) return false;
      if (nq && ![c.name,c.vehicleNo,c.mgmtNo,c.sigun,c.docNo].join(" ").toLowerCase().includes(nq)) return false;
      return true;
    }).sort((a,b)=>b.unpaidBalance-a.unpaidBalance);
  }, [closures,type,onlyDebt,q]);

  const debtTotal = rows.reduce((s,c)=>s+Math.max(c.unpaidBalance,0),0);
  const debtCount = rows.filter(c=>c.unpaidBalance>0).length;
  const countByType = (t)=> closures.filter(c=>t==="전체"||c.type===t).length;

  const Th = ({label,align="left"})=>(
    <th style={{ textAlign:align, padding:"11px 16px", whiteSpace:"nowrap", font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-default)", position:"sticky", top:0, zIndex:1 }}>{label}</th>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {[["폐업·이탈 회원",`${num(closures.length)}명`,"var(--text-primary)"],
          ["추심 대상 (미납잔액)",`${num(debtCount)}명`,"var(--red-500)"],
          ["미납잔액 합계",won(debtTotal),"var(--red-500)"]].map(([l,v,c])=>(
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
        <window.PMUI.Chip active={onlyDebt} onClick={()=>setOnlyDebt(!onlyDebt)}>미납잔액만</window.PMUI.Chip>
        <div style={{ marginLeft:"auto" }}><window.PMUI.SearchBox value={q} onChange={setQ} width={280} placeholder="이름 · 차량번호 · 접수번호 검색" /></div>
      </div>

      <Card padded={false}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 20px", borderBottom:"1px solid var(--border-subtle)" }}>
          <Icon name="secure" size={18} color="#B9791A" />
          <span style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>폐업·양도·이관·탈퇴자는 미수금 명단에서 제외됩니다. 과거 미납잔액이 남은 경우 <b style={{ color:"var(--red-500)" }}>추후 안내(추심) 대상</b>으로 관리합니다. 회원 데이터는 삭제하지 않습니다.</span>
        </div>
        <div style={{ maxHeight:"calc(100vh - 400px)", overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              <Th label="처리사유" /><Th label="지역" /><Th label="성명" /><Th label="차량번호" /><Th label="관리번호" /><Th label="처리일" /><Th label="공문/접수" /><Th label="미납잔액" align="right" /><Th label="추후안내" /><Th label="처리" align="right" />
            </tr></thead>
            <tbody>
              {rows.map((c)=>(
                <tr key={c.id} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                  <td style={{ padding:"12px 16px" }}><CTypeBadge type={c.type} /></td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{c.sigun}</td>
                  <td style={{ padding:"12px 16px", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{c.name}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{c.vehicleNo}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{c.mgmtNo}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{c.processDate}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{c.docNo}</td>
                  <td style={{ padding:"12px 16px", textAlign:"right", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums", font:"var(--fw-bold) 14px/1 var(--font-sans)", color: c.unpaidBalance>0?"var(--red-500)":"var(--text-tertiary)" }}>{won(c.unpaidBalance)}</td>
                  <td style={{ padding:"12px 16px" }}>
                    {c.unpaidBalance>0 ? (c.notifyLater
                      ? <span style={{ display:"inline-flex", alignItems:"center", gap:5, font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"#B9791A" }}><span style={{ width:6, height:6, borderRadius:"50%", background:"#B9791A" }} />대상</span>
                      : <span style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>—</span>) : <span style={{ font:"var(--body-sm)", color:"var(--green-500)" }}>정산완료</span>}
                  </td>
                  <td style={{ padding:"12px 16px", textAlign:"right", whiteSpace:"nowrap" }}>
                    <div style={{ display:"inline-flex", gap:6 }}>
                      <button type="button" onClick={()=>{ if(confirm(`${c.name} 회원을 정상 명단으로 복귀할까요?`)) onRestore(c); }} style={{ height:28, padding:"0 11px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", cursor:"pointer", background:"var(--white)", color:"var(--brand)", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>복귀</button>
                      <button type="button" onClick={()=>{ if(confirm(`${c.name} 폐업기록을 삭제할까요? (회원 데이터는 유지)`)) onDelete(c); }} style={{ height:28, padding:"0 11px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", cursor:"pointer", background:"var(--white)", color:"var(--text-tertiary)", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan={10} style={{ padding:"60px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-md)" }}>해당하는 폐업·이탈 회원이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

window.Closures = Closures;
