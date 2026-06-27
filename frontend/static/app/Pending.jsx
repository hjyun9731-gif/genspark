// 신규 · 예정자 — 자격증명 발급 예정/신규 등록 대기 → 등록·수정·삭제·전체자명단 전환
const { Card, Icon, Button } = window.PayroleDesignSystem_9db006;

function Pending({ pending, onAdd, onUpdate, onDelete, onPromote, onToast }){
  const D = window.PMData; const { won, num } = D;
  const [kind, setKind] = React.useState("전체");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState(null); // {mode:'add'|'edit', row}

  const rows = React.useMemo(()=>{
    const nq = q.trim().toLowerCase();
    return pending.filter(p=>{
      if (kind!=="전체" && p.kind!==kind) return false;
      if (nq && ![p.name,p.vehicleNo,p.sigun,p.phone].join(" ").toLowerCase().includes(nq)) return false;
      return true;
    });
  }, [pending,kind,q]);

  const countBy = (k)=> pending.filter(p=>k==="전체"||p.kind===k).length;

  const Th = ({label,align="left"})=>(
    <th style={{ textAlign:align, padding:"11px 16px", whiteSpace:"nowrap", font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-default)", position:"sticky", top:0, zIndex:1 }}>{label}</th>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {[["등록 대기 전체",`${num(pending.length)}명`,"var(--text-primary)"],
          ["신규 등록",`${num(pending.filter(p=>p.kind==="신규").length)}명`,"var(--brand)"],
          ["부과 예정",`${num(pending.filter(p=>p.kind==="예정").length)}명`,"#B9791A"]].map(([l,v,c])=>(
          <div key={l} style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"14px 18px", boxShadow:"var(--shadow-xs)" }}>
            <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div>
            <div style={{ font:"var(--fw-bold) 20px/1.1 var(--font-sans)", color:c, marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        {["전체","신규","예정"].map(k=>(
          <window.PMUI.Chip key={k} active={kind===k} count={countBy(k)} onClick={()=>setKind(k)}>{k==="전체"?"전체":k+" 등록"}</window.PMUI.Chip>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
          <window.PMUI.SearchBox value={q} onChange={setQ} width={260} placeholder="이름 · 차량번호 · 지역 검색" />
          <Button variant="primary" size="medium" leadingIcon="add-user" onClick={()=>setEditing({ mode:"add", row:{ name:"", sigun:"춘천시", vehicleNo:"", phone:"", membership:"협회미가입", kind:"신규", billingStartYm:"2026-07", reason:"", address:"", public_address:"", resident_no:"", cert_issue_no:"", doc_no:"" } })}>예정자 등록</Button>
        </div>
      </div>

      <Card padded={false}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 20px", borderBottom:"1px solid var(--border-subtle)" }}>
          <Icon name="add-user" size={18} color="var(--brand)" />
          <span style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>자격증명 발급 다음 달부터 부과됩니다. 승인·확인이 끝나면 <b style={{ color:"var(--brand)" }}>전체자명단 전환</b>으로 정식 회원 명단에 추가합니다.</span>
        </div>
        <div style={{ maxHeight:"calc(100vh - 380px)", overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              <Th label="구분" /><Th label="성명" /><Th label="지역" /><Th label="차량번호" /><Th label="가입" /><Th label="자격증명 발급일" /><Th label="부과 시작" /><Th label="월부과금" align="right" /><Th label="확인사항" /><Th label="처리" align="right" />
            </tr></thead>
            <tbody>
              {rows.map(p=>(
                <tr key={p.id} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ display:"inline-flex", padding:"3px 10px", borderRadius:"var(--radius-pill)", font:"var(--fw-demibold) 12px/1 var(--font-sans)",
                      background: p.kind==="신규"?"var(--blue-100)":"#FFF3DC", color: p.kind==="신규"?"var(--blue-600)":"#B9791A" }}>{p.kind}</span>
                  </td>
                  <td style={{ padding:"12px 16px", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{p.name}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{p.sigun}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{p.vehicleNo}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{p.membership}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{p.certIssueDate||"—"}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{p.billingStartYm}</td>
                  <td style={{ padding:"12px 16px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{won(p.monthlyCharge)}</td>
                  <td style={{ padding:"12px 16px", font:"var(--body-sm)", color: p.phone?"var(--text-secondary)":"var(--red-500)", maxWidth:240 }}>{p.reason}</td>
                  <td style={{ padding:"12px 16px", textAlign:"right", whiteSpace:"nowrap" }}>
                    <div style={{ display:"inline-flex", gap:6 }}>
                      <button type="button" onClick={()=>onPromote(p)} style={{ height:28, padding:"0 11px", borderRadius:"var(--radius-pill)", border:"none", cursor:"pointer", background:"var(--brand)", color:"#fff", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>명단 전환</button>
                      <button type="button" onClick={()=>setEditing({ mode:"edit", row:p })} style={{ height:28, padding:"0 11px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", cursor:"pointer", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>수정</button>
                      <button type="button" onClick={()=>{ if(confirm(`${p.name} 예정자를 삭제할까요?`)) onDelete(p); }} style={{ height:28, padding:"0 11px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", cursor:"pointer", background:"var(--white)", color:"var(--text-tertiary)", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan={10} style={{ padding:"60px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-md)" }}>등록 대기 중인 예정자가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <PendingEditModal mode={editing.mode} row={editing.row} onClose={()=>setEditing(null)}
        onSave={(row)=>{ editing.mode==="add" ? onAdd(row) : onUpdate(row); setEditing(null); }} />}
    </div>
  );
}

function PendingEditModal({ mode, row, onClose, onSave }){
  const D = window.PMData;
  const [f, setF] = React.useState(row);
  const set = (k,v)=> setF(s=>({ ...s, [k]:v }));
  const monthly = f.membership==="협회가입" ? (f.reason && f.reason.includes("70세") ? 5000 : 10000) : 5000;
  const label = { font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", marginBottom:7, display:"block" };
  const inp = { width:"100%", height:42, padding:"0 14px", boxSizing:"border-box", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"var(--fw-medium) 14px/1 var(--font-sans)", color:"var(--text-primary)", outline:"none", background:"var(--white)" };
  const sel = { ...inp, appearance:"none", cursor:"pointer", paddingRight:34, backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 6 12' fill='%239096A2'><path d='M0 4l3 4 3-4'/></svg>\")", backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center" };
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:120, background:"rgba(10,17,47,0.38)", display:"flex", justifyContent:"center", alignItems:"center", backdropFilter:"blur(2px)", animation:"pmFade .15s ease" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:480, background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden", animation:"pmPop .18s ease" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--border-subtle)" }}>
          <div style={{ font:"var(--fw-bold) 18px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{mode==="add"?"예정자 등록":"예정자 수정"}</div>
          <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} /></button>
        </div>
        <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:14, maxHeight:"70vh", overflow:"auto" }}>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={label}>성명</label><input value={f.name} onChange={e=>set("name",e.target.value)} style={inp} placeholder="성명" /></div>
            <div style={{ flex:1 }}><label style={label}>구분</label>
              <div style={{ display:"flex", gap:6 }}>{["신규","예정"].map(k=><button key={k} type="button" onClick={()=>set("kind",k)} style={{ flex:1, height:42, borderRadius:"var(--radius-md)", cursor:"pointer", border: f.kind===k?"1.5px solid var(--brand)":"1px solid var(--border-default)", background: f.kind===k?"var(--brand-subtle)":"var(--white)", color: f.kind===k?"var(--brand-active)":"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)" }}>{k}</button>)}</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={label}>지역</label>
              <select value={f.sigun} onChange={e=>set("sigun",e.target.value)} style={sel}>{D.REGIONS.map(r=><option key={r}>{r}</option>)}</select></div>
            <div style={{ flex:1 }}><label style={label}>가입</label>
              <select value={f.membership} onChange={e=>set("membership",e.target.value)} style={sel}>{["협회가입","협회미가입"].map(r=><option key={r}>{r}</option>)}</select></div>
          </div>
          <div><label style={label}>차량번호</label><input value={f.vehicleNo} onChange={e=>set("vehicleNo",e.target.value)} style={inp} placeholder="강원 80바 1234" /></div>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={label}>전화번호</label><input value={f.phone} onChange={e=>set("phone",e.target.value)} style={inp} placeholder="010-0000-0000" /></div>
            <div style={{ flex:1 }}><label style={label}>부과 시작월</label><input value={f.billingStartYm} onChange={e=>set("billingStartYm",e.target.value)} style={inp} placeholder="2026-07" /></div>
          </div>
          <div><label style={label}>자격증명 발급일</label><input type="date" value={f.certIssueDate||""} onChange={e=>set("certIssueDate",e.target.value)} style={inp} /></div>
          <div><label style={label}>주소</label><input value={f.address||""} onChange={e=>set("address",e.target.value)} style={inp} placeholder="주소" /></div>
          <div><label style={label}>공문 주소</label><input value={f.public_address||""} onChange={e=>set("public_address",e.target.value)} style={inp} placeholder="공문 발송 주소" /></div>
          <div><label style={label}>주민등록번호</label><input value={f.resident_no||""} onChange={e=>set("resident_no",e.target.value)} style={inp} placeholder="000000-0000000" /></div>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={label}>자격증명 발급번호</label><input value={f.cert_issue_no||""} onChange={e=>set("cert_issue_no",e.target.value)} style={inp} placeholder="발급번호" /></div>
            <div style={{ flex:1 }}><label style={label}>공문/접수번호</label><input value={f.doc_no||""} onChange={e=>set("doc_no",e.target.value)} style={inp} placeholder="공문/접수번호" /></div>
          </div>
          <div><label style={label}>확인사항/비고</label><input value={f.reason||""} onChange={e=>set("reason",e.target.value)} style={inp} placeholder="예: 협회 가입 승인 대기" /></div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"var(--grey-25)", borderRadius:"var(--radius-md)" }}>
            <span style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>예상 월부과금</span>
            <b style={{ font:"var(--fw-bold) 16px/1 var(--font-sans)", color:"var(--text-primary)" }}>{window.PMData.won(monthly)}</b>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, padding:"16px 24px", borderTop:"1px solid var(--border-subtle)" }}>
          <Button variant="tertiary" size="medium" fullWidth onClick={onClose}>취소</Button>
          <Button variant="primary" size="medium" fullWidth disabled={!f.name||!f.vehicleNo} onClick={()=>onSave({ ...f, monthlyCharge:monthly })}>{mode==="add"?"등록":"저장"}</Button>
        </div>
      </div>
    </div>
  );
}

window.Pending = Pending;
