// 통장매칭 — 엑셀/복사붙여넣기 입력 + 자동후보 + 안전 반영
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

function BankMatching({ deposits, members, onMatch, onExclude, onRestore, onImport, onToast }){
  window.__PM_CURRENT_MEMBERS__ = members;
  const D = window.PMData; const { won, num } = D;
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("전체");
  const [modal, setModal] = React.useState(null);
  const [paste, setPaste] = React.useState("");
  const [showInput, setShowInput] = React.useState(true);

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

  function addPaste(){
    const parsed = D.parseBankText(paste).map(d=>D.inferBankCandidates(d, members));
    if(!parsed.length){ onToast && onToast("붙여넣기에서 거래내역을 찾지 못했습니다."); return; }
    onImport && onImport(parsed);
    setPaste("");
    onToast && onToast(`통장거래내역 ${parsed.length}건 미리보기 추가`);
  }
  function handleFile(e){
    const file = e.target.files?.[0];
    if(!file) return;
    file.text().then(txt=>{
      const parsed = D.parseBankText(txt).map(d=>D.inferBankCandidates(d, members));
      if(!parsed.length){ onToast && onToast("파일에서 거래내역을 찾지 못했습니다. 엑셀은 CSV/TSV로 저장하거나 복사붙여넣기를 사용하세요."); return; }
      onImport && onImport(parsed);
      onToast && onToast(`${file.name} · 거래내역 ${parsed.length}건 미리보기 추가`);
    });
  }

  function autoAll(){
    const targets = rows.filter(d=>d.status==="자동매칭" && d.candidates[0]);
    if(!targets.length){ onToast && onToast("자동매칭 대상이 없습니다."); return; }
    const preview = targets.slice(0,8).map(d=>`- ${d.depositorName} ${won(d.amount)} → ${d.candidates[0].name}`).join("\n");
    if(!confirm(`자동매칭 ${targets.length}건을 수납 반영할까요?\n\n${preview}${targets.length>8 ? "\n..." : ""}\n\n후보확인/중복후보 건은 제외됩니다.`)) return;
    targets.forEach(d=>onMatch(d, d.candidates[0], D.isArrearsIncome(d.candidates[0].chargeItem)?undefined:d.candidates[0].chargeItem));
    onToast && onToast(`자동매칭 ${targets.length}건 수납 반영 완료`);
  }

  const Th = ({label,align="left"})=>(
    <th style={{ textAlign:align, padding:"11px 16px", whiteSpace:"nowrap", font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-default)", position:"sticky", top:0, zIndex:1 }}>{label}</th>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
        {[["입금내역",`${num(summary.total)}건`,"var(--text-primary)"],["자동매칭",`${num(summary.auto)}건`,"var(--green-500)"],["확인필요",`${num(summary.confirm)}건`,"#B9791A"],["미매칭",`${num(summary.unmatched)}건`,"var(--red-500)"],["처리완료/제외",`${num(summary.done)}건`,"var(--blue-600)"]].map(([l,v,c])=>(
          <div key={l} style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"14px 18px", boxShadow:"var(--shadow-xs)" }}>
            <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div><div style={{ font:"var(--fw-bold) 20px/1.1 var(--font-sans)", color:c, marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>

      <Card>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:12 }}>
          <div>
            <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>통장거래내역 입력</div>
            <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginTop:4 }}>통장 거래내역은 이 화면에서 엑셀/CSV 업로드하거나 은행 내역을 그대로 복사 붙여넣기합니다.</div>
          </div>
          <button type="button" onClick={()=>setShowInput(v=>!v)} style={{ height:34, padding:"0 12px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", background:"var(--white)", cursor:"pointer", font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-secondary)" }}>{showInput?"접기":"입력 열기"}</button>
        </div>
        {showInput && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div style={{ border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:14, background:"var(--grey-25)" }}>
              <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:8 }}>엑셀/CSV 업로드</div>
              <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, minHeight:86, border:"1px dashed var(--border-default)", borderRadius:"var(--radius-lg)", background:"var(--white)", cursor:"pointer" }}>
                <input type="file" accept=".csv,.txt,.tsv,.xls,.xlsx" style={{ display:"none" }} onChange={handleFile} />
                <Icon name="upload" size={18} style={{ color:"var(--brand)" }} />
                <span style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-secondary)" }}>파일 선택</span>
              </label>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:8, lineHeight:1.5 }}>권장 컬럼: 거래일자, 입금자명, 입금액, 거래내용, 거래기록사항, 거래시간, 거래점</div>
            </div>
            <div style={{ border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:14, background:"var(--grey-25)" }}>
              <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:8 }}>복사 붙여넣기</div>
              <textarea value={paste} onChange={e=>setPaste(e.target.value)} placeholder={"거래일자\t입금자명\t입금액\t거래내용\t거래기록사항\n2026-06-20\t김영수\t40000\t타행이체\t김영수1024"}
                style={{ width:"100%", height:86, resize:"vertical", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", padding:10, font:"var(--body-sm)", color:"var(--text-primary)", background:"var(--white)" }} />
              <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}><Button size="sm" onClick={addPaste}>붙여넣기 분석</Button></div>
            </div>
          </div>
        )}
      </Card>

      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        {["전체","처리대기","자동매칭","확인필요","미매칭","매칭완료","제외"].map(st=>(
          <window.PMUI.Chip key={st} active={status===st} onClick={()=>setStatus(st)}>{st}</window.PMUI.Chip>
        ))}
        <window.PMUI.SearchBox value={q} onChange={setQ} width={300} placeholder="입금자명 · 메모 · 후보회원 검색" />
        <Button size="sm" onClick={autoAll} style={{ marginLeft:"auto" }}>자동매칭 전체 반영</Button>
      </div>

      <Card padded={false}>
        <div style={{ maxHeight:"calc(100vh - 430px)", overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1120 }}>
            <thead><tr><Th label="상태" /><Th label="거래일자" /><Th label="입금자" /><Th label="입금액" align="right" /><Th label="후보회원" /><Th label="매칭근거" /><Th label="현재미수" align="right" /><Th label="차액" /><Th label="거래기록사항" /><Th label="" align="right" /></tr></thead>
            <tbody>
              {rows.map((d,i)=>{
                const best = d.candidates && d.candidates[0];
                const reasons = best?.reasons?.length ? best.reasons : (best?.reason||"").split("·").map(x=>x.trim()).filter(Boolean);
                return (
                  <tr key={d.id} style={{ borderBottom:i<rows.length-1?"1px solid var(--border-subtle)":"none" }}>
                    <td style={{ padding:"12px 16px" }}><BankStatusBadge status={d.status} /></td>
                    <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{d.depositDate}</td>
                    <td style={{ padding:"12px 16px", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>{d.depositorName}</td>
                    <td style={{ padding:"12px 16px", textAlign:"right", font:"var(--fw-bold) 14px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{won(d.amount)}</td>
                    <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{best ? `${best.name} · ${best.vehicleNo}` : "—"}</td>
                    <td style={{ padding:"12px 16px", minWidth:190 }}>
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                        {reasons.length ? reasons.map(r=><span key={r} style={{ padding:"3px 7px", borderRadius:"var(--radius-pill)", background:"var(--grey-25)", border:"1px solid var(--border-subtle)", font:"var(--fw-medium) 11px/1 var(--font-sans)", color:"var(--text-secondary)" }}>{r}</span>) : <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>수동확인 필요</span>}
                      </div>
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"right", font:"var(--body-sm)", color:"var(--red-500)", whiteSpace:"nowrap" }}>{best ? won(best.totalArrears) : "—"}</td>
                    <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:best?.diff===0?"var(--green-500)":"var(--text-secondary)", whiteSpace:"nowrap" }}>{best ? diffText(best.diff) : "—"}</td>
                    <td style={{ padding:"12px 16px", font:"var(--body-xs)", color:"var(--text-tertiary)", maxWidth:220, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.memo}</td>
                    <td style={{ padding:"12px 16px", textAlign:"right", whiteSpace:"nowrap" }}>
                      {d.status==="자동매칭" && best && <button type="button" onClick={()=>setModal({type:"apply", deposit:d, candidate:best})} style={linkBtn("var(--brand)")}>반영</button>}
                      {["후보확인","중복후보","미매칭"].includes(d.status) && <button type="button" onClick={()=>setModal({type:"candidates", deposit:d})} style={linkBtn("#B9791A")}>후보</button>}
                      {d.status==="제외" && <button type="button" onClick={()=>onRestore&&onRestore(d)} style={linkBtn("var(--brand)")}>되돌리기</button>}
                      {!["매칭완료","제외"].includes(d.status) && <button type="button" onClick={()=>onExclude(d)} style={{ ...linkBtn("var(--text-tertiary)"), marginLeft:8 }}>제외</button>}
                    </td>
                  </tr>
                );
              })}
              {rows.length===0 && <tr><td colSpan={10} style={{ padding:"60px", textAlign:"center", color:"var(--text-tertiary)" }}>조건에 맞는 거래내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {modal?.type==="apply" && <ApplyPreviewModal data={modal} onClose={()=>setModal(null)} onApply={(d,c)=>{ onMatch(d,c); setModal(null); }} />}
      {modal?.type==="candidates" && <CandidateModal deposit={modal.deposit} members={members} onClose={()=>setModal(null)} onApply={(d,c)=>{ if(d.status!=="자동매칭" && !confirm("후보확인 건입니다. 수동 확인 후 반영할까요?")) return; onMatch(d,c); setModal(null); }} />}
    </div>
  );
}

function linkBtn(color){
  return { border:"none", background:"transparent", cursor:"pointer", color, font:"var(--fw-demibold) 12px/1 var(--font-sans)", padding:"6px 4px" };
}

function ApplyPreviewModal({ data, onClose, onApply }){
  const D=window.PMData, { won }=D;
  const { deposit, candidate }=data;
  const m = window.__PM_CURRENT_MEMBERS__?.find(x=>x.id===candidate.id) || null;
  const preview = m ? D.openItems(m).slice(0,6) : [];
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:120, background:"rgba(10,17,47,.38)", display:"grid", placeItems:"center", backdropFilter:"blur(2px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:460, background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
        <div style={{ padding:"18px 22px", borderBottom:"1px solid var(--border-subtle)", font:"var(--fw-bold) 17px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>통장매칭 반영 확인</div>
        <div style={{ padding:22 }}>
          <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", lineHeight:1.7 }}>{deposit.depositorName} 입금액 <b>{won(deposit.amount)}</b>을 {candidate.name} 회원 수납으로 반영합니다.</div>
          <div style={{ marginTop:14, border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
            {preview.length ? preview.map((it,i)=><div key={it.ym+i} style={{ display:"flex", justifyContent:"space-between", padding:"9px 12px", borderBottom:i<preview.length-1?"1px solid var(--border-subtle)":"none", font:"var(--body-sm)", color:"var(--text-secondary)" }}><span>{it.ym}부터 차감</span><b>{won(Math.min(deposit.amount, it.amount))}</b></div>) : <div style={{ padding:12, font:"var(--body-sm)", color:"var(--text-tertiary)" }}>차감할 미수월이 없으면 선납으로 처리됩니다.</div>}
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:18 }}>
            <Button size="sm" variant="secondary" onClick={onClose}>취소</Button>
            <Button size="sm" onClick={()=>onApply(deposit,candidate)}>반영하기</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateModal({ deposit, members, onClose, onApply }){
  const D=window.PMData, { won }=D;
  const [q,setQ]=React.useState("");
  const candidates = React.useMemo(()=>{
    if(q.trim()){
      const nq=q.trim().toLowerCase(), nv=D.normVehicle(q);
      return members.filter(m=>m.status==="정상" && ([m.name,m.vehicleNo,m.sigun,m.phone].join(" ").toLowerCase().includes(nq) || (nv && D.normVehicle(m.vehicleNo).includes(nv)))).slice(0,12)
        .map(m=>({ id:m.id, name:m.name, vehicleNo:m.vehicleNo, mgmtNo:m.mgmtNo, sigun:m.sigun, totalArrears:D.outstanding(m), diff:deposit.amount-D.outstanding(m), reason:"수동검색", reasons:["수동검색"], chargeItem:m.chargeItem }));
    }
    return deposit.candidates||[];
  }, [q,deposit,members]);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:120, background:"rgba(10,17,47,.38)", display:"grid", placeItems:"center", backdropFilter:"blur(2px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:620, background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
        <div style={{ padding:"18px 22px", borderBottom:"1px solid var(--border-subtle)", display:"flex", justifyContent:"space-between" }}>
          <div><div style={{ font:"var(--fw-bold) 17px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>후보 확인 / 수동매칭</div><div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginTop:4 }}>{deposit.depositorName} · {won(deposit.amount)}</div></div>
          <button onClick={onClose} style={{ border:"none", background:"transparent", cursor:"pointer" }}><Icon name="close" size={18} /></button>
        </div>
        <div style={{ padding:22 }}>
          <window.PMUI.SearchBox value={q} onChange={setQ} width={300} placeholder="회원명 · 차량번호 검색" />
          <div style={{ marginTop:14, border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", overflow:"hidden", maxHeight:360, overflowY:"auto" }}>
            {candidates.map((c,i)=><button key={c.id+i} type="button" onClick={()=>onApply(deposit,c)} style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr .8fr .8fr", width:"100%", gap:10, alignItems:"center", textAlign:"left", padding:"12px 14px", border:"none", borderBottom:i<candidates.length-1?"1px solid var(--border-subtle)":"none", background:"var(--white)", cursor:"pointer" }}>
              <span style={{ font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>{c.name}</span>
              <span style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>{c.vehicleNo}</span>
              <span style={{ font:"var(--body-sm)", color:"var(--red-500)", textAlign:"right" }}>{won(c.totalArrears)}</span>
              <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", textAlign:"right" }}>{c.reason}</span>
            </button>)}
            {candidates.length===0 && <div style={{ padding:32, textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>후보가 없습니다.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

window.BankMatching = BankMatching;
