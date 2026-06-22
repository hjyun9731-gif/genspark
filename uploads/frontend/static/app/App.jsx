// 메인 앱 — 화면 라우팅 + 전역 상태(수납/통장매칭/폐업/업로드) + Tweaks
const D = window.PMData;
const { won } = D;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#3981F7",
  "density": "regular"
}/*EDITMODE-END*/;

const TITLES = {
  dashboard: ["대시보드", "강원도개인소형화물협회 회원 미수금 현황을 한눈에 확인합니다."],
  list:      ["미수금 명단", "회원별 미수금을 조회·검색하고 바로 수납 처리합니다. 0원·선납 회원도 함께 표시됩니다."],
  regional:  ["지역별 미수금 · 문자 대상 추출", "지역·부과항목별로 추출하거나 문자 발송 대상을 뽑아 엑셀로 내려받습니다."],
  bank:      ["통장매칭", "통장거래내역을 업로드/붙여넣기 후 회원 미수금과 대조해 수납으로 반영합니다."],
  closure:   ["폐업현황", "폐업·양도·이관·탈퇴 회원과 미납잔액 추심 대상을 기간별로 관리합니다."],
  history:   ["수납 내역", "전체 수납 기록을 조회하고 잘못된 수납은 삭제가 아니라 취소/복구합니다."],
  upload:    ["엑셀 업로드", "전체면허자현황과 2026 미수금만 미리보기 후 안전하게 반영합니다."],
  settings:  ["설정", "부과 기준·18개 시군·수납/발송 조건을 관리합니다."],
};

function safeLoad(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  }catch(e){ return fallback; }
}
function save(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState("dashboard");
  const [members, setMembers] = React.useState(()=>safeLoad("pm_members_v2", D.MEMBERS));
  const [deposits, setDeposits] = React.useState(()=>safeLoad("pm_deposits_v2", D.DEPOSITS));
  const [closures, setClosures] = React.useState(()=>safeLoad("pm_closures_v2", D.CLOSURES));
  const [drill, setDrill] = React.useState(null);
  const [payTarget, setPayTarget] = React.useState(null);
  const [detail, setDetail] = React.useState(null);
  const [closeTarget, setCloseTarget] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [year, setYear] = React.useState(2026);
  const [month, setMonth] = React.useState(6);

  React.useEffect(()=>{
    const r = document.documentElement;
    r.style.setProperty("--brand", t.accent);
    r.style.setProperty("--brand-hover", t.accent);
  }, [t.accent]);

  React.useEffect(()=>save("pm_members_v2", members), [members]);
  React.useEffect(()=>save("pm_deposits_v2", deposits), [deposits]);
  React.useEffect(()=>save("pm_closures_v2", closures), [closures]);

  const agg = React.useMemo(()=>D.aggregate(members), [members]);
  const showToast = (msg)=>{ setToast(msg); setTimeout(()=>setToast(null), 3200); };

  const goList = (filter)=>{ setDrill({ ...filter, _k: Date.now() }); setRoute("list"); };

  // 수납 반영 (오래된 달부터 차감)
  const confirmPay = (member, info)=>{
    let updatedMember = null;
    setMembers(ms=> ms.map(m=>{
      if (m.id!==member.id) return m;
      const { member: nm } = D.applyPayment(m, { amount:info.amount, method:info.method, chargeItem:info.chargeItem, paidDate:info.date, sourceDepositId:info.sourceDepositId||null });
      updatedMember = nm;
      return nm;
    }));
    setPayTarget(null);
    if (detail && detail.id===member.id && updatedMember) setDetail(updatedMember);
    showToast(`${member.name} 님 ${won(info.amount)} 수납 완료 · 잔액 ${won(info.after)}`);
  };

  // 통장매칭 → 수납 반영 + deposit 상태 변경
  const matchDeposit = (deposit, candidate, chargeItemOverride)=>{
    if (!candidate) return;
    let updatedMember = null;
    setMembers(ms=> ms.map(m=> {
      if(m.id!==candidate.id) return m;
      const result = D.applyPayment(m, { amount:deposit.amount, method:"통장매칭", chargeItem: chargeItemOverride||m.chargeItem, paidDate:deposit.depositDate, sourceDepositId:deposit.id });
      updatedMember = result.member;
      return result.member;
    }));
    setDeposits(ds=> ds.map(d=> d.id===deposit.id ? { ...d, status:"매칭완료", matchedMemberId:candidate.id, matchedAt:new Date().toISOString().slice(0,10) } : d));
    if(detail && detail.id===candidate.id && updatedMember) setDetail(updatedMember);
  };
  const excludeDeposit = (deposit)=>{ setDeposits(ds=> ds.map(d=> d.id===deposit.id ? { ...d, status:"제외", excludedAt:new Date().toISOString().slice(0,10) } : d)); showToast("입금 거래 제외 처리"); };
  const restoreDeposit = (deposit)=>{ setDeposits(ds=> ds.map(d=> d.id===deposit.id ? { ...d, status:(d.candidates?.length>1?"중복후보":d.candidates?.length===1?"후보확인":"미매칭"), excludedAt:null } : d)); showToast("제외 거래를 되돌렸습니다."); };
  const importDeposits = (newRows)=>{ setDeposits(ds=>[...newRows.map((r,i)=>({ ...r, id: Date.now()+i })), ...ds]); };

  // 수납 취소/복구 — 삭제 금지
  const cancelPayment = (memberId, paymentId, reason)=>{
    const why = reason || prompt("수납 취소/복구 사유를 입력하세요.", "잘못 매칭/오입력") || "사유 미입력";
    let sourceDepositId = null;
    setMembers(ms=> ms.map(m=>{
      if(m.id!==memberId) return m;
      const p=(m.payments||[]).find(x=>x.id===paymentId);
      sourceDepositId = p?.sourceDepositId || null;
      const nm = D.cancelPayment(m, paymentId, why);
      if(detail && detail.id===memberId) setDetail(nm);
      return nm;
    }));
    if(sourceDepositId){
      setDeposits(ds=>ds.map(d=>d.id===sourceDepositId ? { ...d, status:(d.candidates?.length>1?"중복후보":d.candidates?.length===1?"후보확인":"미매칭"), matchedMemberId:null, restoredAt:new Date().toISOString().slice(0,10) } : d));
    }
    showToast("수납내역 취소/복구 완료 · 원래 미수금으로 복구했습니다.");
  };
  const editPayment = (member, payment)=>{
    const why = prompt("수정 전 기존 수납을 취소/복구합니다. 사유를 입력하세요.", "수납 수정") || "수납 수정";
    cancelPayment(member.id, payment.id, why);
    setPayTarget(member);
  };

  // 폐업/이탈 등록 (상태 변경 + closures 추가, 데이터 삭제 X)
  const registerClosure = (member, payload)=>{
    const bal = D.outstanding(member);
    setMembers(ms=> ms.map(m=> m.id===member.id ? { ...m, status:payload.type } : m));
    setClosures(cs=> [{ id: Date.now(), memberId:member.id, name:member.name, sigun:member.sigun, vehicleNo:member.vehicleNo, mgmtNo:member.mgmtNo, phone:member.phone, address:member.address,
      type:payload.type, processDate:"2026-06-20", docNo:payload.docNo||"-", content:payload.content, unpaidBalance:bal, notifyLater:bal>0,
      chaseStatus: bal>0?"추심대상":"정산완료", lastNoticeDate:"", chaseMemo:payload.content||"" }, ...cs]);
    setCloseTarget(null); setDetail(null);
    showToast(`${member.name} 님 ${payload.type} 처리 · 폐업현황에 저장 (미납잔액 ${won(bal)})`);
  };
  const updateClosure = (id, patch)=>{
    setClosures(cs=>cs.map(c=>c.id===id ? { ...c, ...patch } : c));
    showToast("폐업현황이 업데이트되었습니다.");
  };
  const restoreClosedMember = (closure)=>{
    setMembers(ms=>ms.map(m=>m.id===closure.memberId ? { ...m, status:"정상" } : m));
    setClosures(cs=>cs.map(c=>c.id===closure.id ? { ...c, chaseStatus:"정상복구", content:(c.content||"")+" / 정상회원 복구" } : c));
    showToast(`${closure.name} 님 정상회원으로 복구했습니다.`);
  };

  const handleApply = (record)=> showToast(`${record?.type||"엑셀"} 반영 완료 · 기존 데이터 유지, 변경사항만 업데이트`);

  const [title, subtitle] = TITLES[route];

  const headerRight = (route==="dashboard" || route==="list") ? (
    <window.PMUI.YearMonth year={year} month={month} onYear={setYear} onMonth={setMonth} />
  ) : null;

  return (
    <window.AppShell active={route} onNavigate={(id)=>{ setRoute(id); setDrill(null); }}
      title={title} subtitle={subtitle} headerRight={headerRight} density={t.density}>

      {route==="dashboard" && <window.Dashboard agg={agg} members={members} deposits={deposits} closures={closures} onDrill={goList} onNav={setRoute} year={year} month={month} />}
      {route==="list" && <window.Receivables members={members} drill={drill} density={t.density} onPay={setPayTarget} onSelect={setDetail} onToast={showToast} />}
      {route==="regional" && <window.Regional members={members} onToast={showToast} />}
      {route==="bank" && <window.BankMatching deposits={deposits} members={members} onMatch={matchDeposit} onExclude={excludeDeposit} onRestore={restoreDeposit} onImport={importDeposits} onToast={showToast} />}
      {route==="closure" && <window.Closures closures={closures} onToast={showToast} onUpdate={updateClosure} onRestore={restoreClosedMember} onPay={(c)=>{ const m=members.find(x=>x.id===c.memberId); if(m) setPayTarget(m); }} />}
      {route==="upload" && <window.Upload onApply={handleApply} />}
      {route==="history" && <HistoryView members={members} onSelect={(m)=>setDetail(m)} onCancel={cancelPayment} onEdit={editPayment} />}
      {route==="settings" && <SettingsView />}

      {payTarget && <window.PayModal member={payTarget} onClose={()=>setPayTarget(null)} onConfirm={confirmPay} />}
      {detail && <window.MemberDetail member={detail} onClose={()=>setDetail(null)} onPay={(m)=>setPayTarget(m)} onClosure={(m)=>setCloseTarget(m)} />}
      {closeTarget && <window.ClosureModal member={closeTarget} onClose={()=>setCloseTarget(null)} onConfirm={registerClosure} />}

      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:200, display:"flex", alignItems:"center", gap:10, padding:"13px 20px", background:"var(--ink-950)", color:"#fff", borderRadius:"var(--radius-pill)", boxShadow:"var(--shadow-lg)", font:"var(--fw-medium) 14px/1 var(--font-sans)", animation:"pmPop .2s ease" }}>
          <window.PayroleDesignSystem_9db006.Icon name="check" size={17} color="var(--green-500)" /> {toast}
        </div>
      )}

      <TweaksPanel>
        <TweakSection label="포인트 컬러" />
        <TweakColor label="액센트" value={t.accent} options={["#3981F7","#7065F0","#0AAF60","#F5A623"]} onChange={(v)=>setTweak("accent", v)} />
        <TweakSection label="테이블" />
        <TweakRadio label="밀도" value={t.density} options={["compact","regular","comfy"]} onChange={(v)=>setTweak("density", v)} />
      </TweaksPanel>
    </window.AppShell>
  );
}

// 수납 내역 (전체) — 검색/기간/필터/엑셀/취소복구
function HistoryView({ members, onSelect, onCancel, onEdit }){
  const { Card } = window.PayroleDesignSystem_9db006;
  const [q,setQ]=React.useState("");
  const [region,setRegion]=React.useState("");
  const [item,setItem]=React.useState("");
  const [method,setMethod]=React.useState("");
  const [acc,setAcc]=React.useState("");
  const [from,setFrom]=React.useState("");
  const [to,setTo]=React.useState("");

  const allRows = [];
  members.forEach(m=> (m.payments||[]).forEach(p=> allRows.push({ ...p, memberId:m.id, member:m, name:m.name, sigun:m.sigun, vno:m.vehicleNo })));
  const rows = allRows.filter(r=>{
    const text=[r.name,r.vno,r.sigun,r.chargeItem,r.method,r.accounting,r.memo].join(" ").toLowerCase();
    if(q && !text.includes(q.toLowerCase())) return false;
    if(region && r.sigun!==region) return false;
    if(item && r.chargeItem!==item) return false;
    if(method && r.method!==method) return false;
    if(acc && r.accounting!==acc) return false;
    if(from && String(r.paidDate||"")<from) return false;
    if(to && String(r.paidDate||"")>to) return false;
    return true;
  }).sort((a,b)=>(b.paidDate||"").localeCompare(a.paidDate||""));

  const activeRows=rows.filter(r=>!r.canceled);
  const total = activeRows.reduce((s,p)=>s+p.amount,0);
  const canceledTotal = rows.filter(r=>r.canceled).reduce((s,p)=>s+p.amount,0);
  const sumBy=(name)=>activeRows.filter(r=>r.accounting===name).reduce((s,p)=>s+p.amount,0);
  const methods=[...new Set(allRows.map(r=>r.method).filter(Boolean))];

  function exportCSV(){
    const head=["상태","수납일","성명","지역","차량번호","대상월","수납항목","회계구분","납부방식","금액","취소일","취소사유","메모"];
    const lines=[head.join(",")].concat(rows.map(r=>[
      r.canceled?"취소":"정상", r.paidDate, r.name, r.sigun, r.vno, r.paidForYm, r.chargeItem, r.accounting, r.method, r.amount, r.canceledAt||"", r.cancelReason||"", r.memo||""
    ].map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")));
    const link=document.createElement("a"); link.href=URL.createObjectURL(new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"})); link.download="수납내역.csv"; link.click();
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:12 }}>
        {[["총 수납",won(total),"var(--green-500)"],["협회비",won(activeRows.filter(r=>r.chargeItem==="협회비").reduce((s,p)=>s+p.amount,0)),"var(--text-primary)"],["관리비",won(activeRows.filter(r=>r.chargeItem==="관리비").reduce((s,p)=>s+p.amount,0)),"var(--text-primary)"],["가수금",won(sumBy("가수금")),"var(--violet-500)"],["잡수입",won(sumBy("잡수입")),"var(--blue-600)"],["기타수입",won(sumBy("기타수입")),"var(--text-primary)"],["선납",won(sumBy("선납")),"var(--violet-500)"],["취소금액",won(canceledTotal),"var(--red-500)"]].map(([l,v,c])=>(
          <div key={l} style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"14px 14px", boxShadow:"var(--shadow-xs)" }}>
            <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div><div style={{ font:"var(--fw-bold) 17px/1.1 var(--font-sans)", color:c, marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <window.PMUI.SearchBox value={q} onChange={setQ} width={280} placeholder="이름 · 차량번호 · 수납항목 검색" />
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={filterInput()} />
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={filterInput()} />
        <window.FilterDropdown label="지역" value={region} onChange={setRegion} options={["",...D.REGIONS]} render={v=>v||"전체 지역"} />
        <window.FilterDropdown label="항목" value={item} onChange={setItem} options={["","협회비","관리비","협회가입비","자격증명발급비","기타","선납/초과입금"]} render={v=>v||"항목 전체"} />
        <window.FilterDropdown label="방식" value={method} onChange={setMethod} options={["",...methods]} render={v=>v||"방식 전체"} />
        <window.FilterDropdown label="회계" value={acc} onChange={setAcc} options={["","회비수입","가수금","잡수입","기타수입","선납"]} render={v=>v||"회계 전체"} />
        <window.PMUI.DownloadBtn onClick={exportCSV} />
      </div>

      <Card padded={false}>
        <div style={{ maxHeight:"calc(100vh - 390px)", overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1160 }}>
            <thead><tr>
              {["상태","수납일","성명","지역","차량번호","대상월","수납항목","회계구분","납부방식","금액","처리"].map((h,i)=>(
                <th key={h} style={{ textAlign:i===9?"right":i===10?"right":"left", padding:"12px 18px", whiteSpace:"nowrap", font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)", position:"sticky", top:0 }}>{h}</th>))}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id+i} style={{ borderBottom: i<rows.length-1?"1px solid var(--border-subtle)":"none", opacity:r.canceled ? .75 : 1 }}>
                  <td style={{ padding:"12px 18px" }}>{r.canceled ? <window.PMUI.StatusPill status="취소" /> : <window.PMUI.StatusPill status="완납" />}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{r.paidDate}</td>
                  <td onClick={()=>onSelect&&onSelect(r.member)} style={{ padding:"12px 18px", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap", cursor:"pointer" }}>{r.name}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.sigun}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.vno}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{r.paidForYm}</td>
                  <td style={{ padding:"12px 18px" }}><window.PMUI.ChargeTag item={r.chargeItem} /></td>
                  <td style={{ padding:"12px 18px" }}><window.PMUI.AccountingTag accounting={r.accounting} /></td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.method}</td>
                  <td style={{ padding:"12px 18px", textAlign:"right", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:r.canceled?"var(--text-tertiary)":"var(--green-500)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{r.canceled?"취소 ":"+"}{won(r.amount)}</td>
                  <td style={{ padding:"12px 18px", textAlign:"right", whiteSpace:"nowrap" }}>
                    <button type="button" onClick={()=>onSelect&&onSelect(r.member)} style={historyBtn("var(--brand)")}>상세</button>
                    {!r.canceled && <button type="button" onClick={()=>onEdit&&onEdit(r.member,r)} style={{...historyBtn("#B9791A"), marginLeft:8}}>수정</button>}
                    {!r.canceled && <button type="button" onClick={()=>onCancel&&onCancel(r.memberId,r.id)} style={{...historyBtn("var(--red-500)"), marginLeft:8}}>취소/복구</button>}
                    {r.canceled && <span style={{ marginLeft:8, font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{r.cancelReason||"취소됨"}</span>}
                  </td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan={11} style={{ padding:"60px", textAlign:"center", color:"var(--text-tertiary)" }}>수납 기록이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
function filterInput(){ return { height:36, padding:"0 10px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-pill)", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)" }; }
function historyBtn(color){ return { border:"none", background:"transparent", cursor:"pointer", color, font:"var(--fw-demibold) 12px/1 var(--font-sans)", padding:"6px 2px" }; }

function SettingsView(){
  const { Card } = window.PayroleDesignSystem_9db006;
  const { FEE_ASSOC, FEE_MGMT, FEE_SENIOR, REGIONS } = D;
  const Section = ({title, children})=><Card><div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:14 }}>{title}</div>{children}</Card>;
  const pill = (v)=><span key={v} style={{ padding:"7px 13px", borderRadius:"var(--radius-pill)", background:"var(--grey-25)", border:"1px solid var(--border-subtle)", font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-secondary)" }}>{v}</span>;
  const row = (l,v)=><div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--border-subtle)" }}><span style={{ font:"var(--body-md)", color:"var(--text-secondary)" }}>{l}</span><span style={{ font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>{v}</span></div>;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, maxWidth:1120 }}>
      <Section title="부과 기준">
        {[["협회가입 · 협회비",won(FEE_ASSOC)+" / 월"],["협회미가입 · 관리비",won(FEE_MGMT)+" / 월"],["70세 이상 · 협회비 50% 감면",won(FEE_SENIOR)+" / 월"],["고액 미납 기준","20만원 / 30만원"],["장기 미납 기준","12개월 이상"]].map(([l,v])=>row(l,v))}
        <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:14, lineHeight:1.6 }}>관리비는 자격증명 발급 다음 달부터 부과됩니다. 수납은 삭제하지 않고 취소/복구로 이력을 보존합니다.</div>
      </Section>
      <Section title={`강원도 18개 시군`}>
        <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginBottom:14 }}>업로드·지역별 추출·문자 대상은 아래 18개 시군 기준으로 정규화됩니다.</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{REGIONS.map(pill)}</div>
      </Section>
      <Section title="회원/상태값">
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>{["회원","준회원","미가입","협회가입","협회미가입"].map(pill)}</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{["정상","폐업","양도","이관","탈퇴"].map(pill)}</div>
      </Section>
      <Section title="수납/발송 조건">
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>{["협회비","관리비","협회가입비","자격증명발급비","기타","선납/초과입금"].map(pill)}</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{["계좌","현금","CMS","통장매칭","기타","결번 제외","자동이체 제외","지로 대상"].map(pill)}</div>
      </Section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
