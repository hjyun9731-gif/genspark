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
  bank:      ["통장매칭", "입금자명·입금액을 회원 미수금과 대조해 수납으로 반영합니다."],
  closure:   ["폐업현황", "폐업·양도·이관·탈퇴 회원과 미납잔액 추심 대상을 관리합니다."],
  pending:   ["신규 · 예정자", "자격증명 발급 예정·신규 등록 대기자를 관리하고 정식 명단으로 전환합니다."],
  certprint: ["자격증명 인쇄", "화물운송종사자격증명을 웹에서 바로 입력·미리보기하고 인쇄합니다."],
  history:   ["수납 내역", "전체 수납 기록과 회계구분을 확인합니다."],
  upload:    ["엑셀 업로드", "협회 엑셀 자료를 업로드해 미리보기 후 안전하게 반영합니다."],
  settings:  ["설정", "부과 기준·지역명 정규화를 관리합니다."],
};

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState("dashboard");
  const [members, setMembers] = React.useState([]);
  const [deposits, setDeposits] = React.useState([]);
  const [closures, setClosures] = React.useState([]);
  const [pending, setPending] = React.useState([]);
  const [dataLoading, setDataLoading] = React.useState(true);
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

  const agg = React.useMemo(()=>D.aggregate(members), [members]);
  const showToast = (msg)=>{ setToast(msg); setTimeout(()=>setToast(null), 3200); };

  const refetchAll = React.useCallback(async (msg) => {
    setDataLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        fetch('/api/members?size=5000'),
        fetch('/api/closures'),
      ]);
      if (mRes.ok) setMembers(await mRes.json());
      if (cRes.ok) setClosures(await cRes.json());
      if (msg) { setToast(msg); setTimeout(()=>setToast(null), 3200); }
    } catch(e) {
      setToast('데이터 로드 실패: 서버 연결을 확인하세요.'); setTimeout(()=>setToast(null), 3200);
    } finally {
      setDataLoading(false);
    }
  }, []);

  React.useEffect(() => { refetchAll(); }, []);

  const goList = (filter)=>{ setDrill({ ...filter, _k: Date.now() }); setRoute("list"); };

  // 수납 반영 (오래된 달부터 차감)
  const confirmPay = (member, info)=>{
    setMembers(ms=> ms.map(m=>{
      if (m.id!==member.id) return m;
      const { member: nm } = D.applyPayment(m, { amount:info.amount, method:info.method, chargeItem:info.chargeItem, paidDate:info.date });
      return nm;
    }));
    setPayTarget(null);
    if (detail && detail.id===member.id){
      const nm = D.applyPayment(member, { amount:info.amount, method:info.method, chargeItem:info.chargeItem, paidDate:info.date }).member;
      setDetail(nm);
    }
    showToast(`${member.name} 님 ${won(info.amount)} 수납 완료 · 잔액 ${won(info.after)}`);
  };

  // 통장매칭 → 수납 반영 + deposit 상태 변경
  const matchDeposit = (deposit, candidate, chargeItemOverride)=>{
    if (!candidate) return;
    setMembers(ms=> ms.map(m=> m.id===candidate.id
      ? D.applyPayment(m, { amount:deposit.amount, method:"통장매칭", chargeItem: chargeItemOverride||m.chargeItem, paidDate:deposit.depositDate }).member
      : m));
    setDeposits(ds=> ds.map(d=> d.id===deposit.id ? { ...d, status:"매칭완료", matchedMemberId:candidate.id } : d));
  };
  const excludeDeposit = (deposit)=>{ setDeposits(ds=> ds.map(d=> d.id===deposit.id ? { ...d, status:"제외" } : d)); showToast("입금 거래 제외 처리"); };

  // 묶음수납 — 한 입금으로 그룹 내 여러 회원 대납
  const matchDepositGroup = (deposit, group)=>{
    const ids = (group.members||[]).map(m=>m.id);
    setMembers(ms=> ms.map(m=> ids.includes(m.id)
      ? D.applyPayment(m, { amount: D.outstanding(m), method:"묶음수납", chargeItem:m.chargeItem, paidDate:deposit.depositDate }).member
      : m));
    setDeposits(ds=> ds.map(d=> d.id===deposit.id ? { ...d, status:"매칭완료" } : d));
  };
  // 통장거래 붙여넣기 — 대기 거래 추가
  const pasteDeposits = (rows)=>{
    setDeposits(ds=>{ let id = Math.max(0,...ds.map(d=>d.id))+1; return [...rows.map(r=>({ id:id++, depositDate:r.depositDate, depositorName:r.depositorName, amount:r.amount, memo:r.memo, description:r.description, status:"미매칭", candidates:[] })), ...ds]; });
  };
  // 통장매칭 결과 초기화 — 수납 반영 안 된 건을 대기로
  const resetBank = ()=>{ setDeposits(ds=> ds.map(d=> ["매칭완료","제외"].includes(d.status)? d : ({ ...d, status: d.groupCandidates?.length?"후보확인": d.candidates?.length?"자동매칭":"미매칭" }))); showToast("통장매칭 결과 초기화"); };

  // 폐업 복귀 / 삭제
  const restoreClosure = (c)=>{ setMembers(ms=> ms.map(m=> m.id===c.memberId ? { ...m, status:"정상" } : m)); setClosures(cs=> cs.filter(x=>x.id!==c.id)); showToast(`${c.name} 회원 정상 명단으로 복귀`); };
  const deleteClosure = (c)=>{ setClosures(cs=> cs.filter(x=>x.id!==c.id)); showToast(`${c.name} 폐업기록 삭제 (회원 데이터 유지)`); };

  // 수납 취소 / 전체 초기화
  const cancelPayment = (member, pay)=>{
    setMembers(ms=> ms.map(m=>{
      if (m.id!==member.id) return m;
      const arrears=(m.arrears||[]).map(a=>({...a}));
      if (D.isArrearsIncome(pay.chargeItem)){ const it=arrears.find(a=>a.ym===pay.paidForYm); if(it){ it.paid=false; it.amount=(it.amount||0); } else arrears.push({ ym:pay.paidForYm, label:"복원", item:pay.chargeItem, amount: m.monthlyCharge, paid:false }); }
      return { ...m, arrears, payments:(m.payments||[]).filter(p=>p.id!==pay.id) };
    }));
    showToast(`수납 취소 · ${won(pay.amount)} 되돌림`);
  };

  // 신규·예정자
  const addPending = (row)=>{ setPending(ps=> [{ ...row, id: Math.max(0,...ps.map(p=>p.id))+1 }, ...ps]); showToast(`${row.name} 예정자 등록`); };
  const updatePending = (row)=>{ setPending(ps=> ps.map(p=> p.id===row.id? row : p)); showToast(`${row.name} 예정자 수정`); };
  const deletePending = (row)=>{ setPending(ps=> ps.filter(p=>p.id!==row.id)); showToast(`${row.name} 예정자 삭제`); };
  const promotePending = (row)=>{
    setPending(ps=> ps.filter(p=>p.id!==row.id));
    setMembers(ms=>{
      const n = ms.length+1;
      const isSenior = (row.reason||"").includes("70세");
      const chargeItem = row.membership==="협회가입" ? (isSenior?"70세":"협회비") : "관리비";
      const mem = { id:`GW-${String(n).padStart(3,"0")}`, mgmtNo:`NEW-${row.id}`, name:row.name, vehicleNo:row.vehicleNo, phone:row.phone||"", sigun:row.sigun, regionRaw:row.sigun, memberType:"개인", membership:row.membership, age:isSenior?72:50, isSenior, certIssueDate:row.certIssueDate||"", assocJoinDate: row.membership==="협회가입"?row.billingStartYm+"-01":"", billingStartYm:row.billingStartYm, chargeItem, monthlyCharge:row.monthlyCharge, lastPaymentYm:null, status:"정상", disconnected:false, certMissing:!row.certIssueDate, address:`강원특별자치도 ${row.sigun}`, pubAddress:`강원특별자치도 ${row.sigun}`, bizNo:"", note:"신규전환", arrears:[], payments:[] };
      return [...ms, mem];
    });
    showToast(`${row.name} 전체자명단 전환 완료`);
  };

  // 폐업/이탈 등록 (상태 변경 + closures 추가, 데이터 삭제 X)
  const registerClosure = (member, payload)=>{
    const bal = D.outstanding(member);
    setMembers(ms=> ms.map(m=> m.id===member.id ? { ...m, status:payload.type } : m));
    setClosures(cs=> [{ id: (cs[0]?.id||0)+1+cs.length, memberId:member.id, name:member.name, sigun:member.sigun, vehicleNo:member.vehicleNo, mgmtNo:member.mgmtNo, type:payload.type, processDate:"2026-06-20", docNo:payload.docNo||"-", content:payload.content, unpaidBalance:bal, notifyLater:payload.notifyLater }, ...cs]);
    setCloseTarget(null); setDetail(null);
    showToast(`${member.name} 님 ${payload.type} 처리 · 폐업현황에 저장 (미납잔액 ${won(bal)})`);
  };

  const handleApply = (json)=>{
    const msg = json
      ? `반영 완료: 회원 ${json.inserted||0}건 신규, ${json.updated||0}건 수정, 미수 ${json.arrears_inserted||json.inserted||0}건 저장`
      : '엑셀 반영 완료';
    refetchAll(msg);
  };

  const [title, subtitle] = TITLES[route];

  const headerRight = (route==="dashboard" || route==="list") ? (
    <window.PMUI.YearMonth year={year} month={month} onYear={setYear} onMonth={setMonth} />
  ) : null;

  return (
    <window.AppShell active={route} onNavigate={(id)=>{ setRoute(id); setDrill(null); }}
      title={title} subtitle={subtitle} headerRight={headerRight} density={t.density}>

      {dataLoading && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"80px 0", color:"var(--text-tertiary)", font:"var(--body-md)" }}>데이터를 불러오는 중...</div>}
      {!dataLoading && route==="dashboard" && <window.Dashboard agg={agg} members={members} deposits={deposits} closures={closures} onDrill={goList} onNav={setRoute} year={year} month={month} />}
      {!dataLoading && route==="list" && <window.Receivables members={members} drill={drill} density={t.density} onPay={setPayTarget} onSelect={setDetail} onToast={showToast} />}
      {route==="regional" && <window.Regional members={members} onToast={showToast} />}
      {route==="bank" && <window.BankMatching deposits={deposits} members={members} onMatch={matchDeposit} onGroupMatch={matchDepositGroup} onExclude={excludeDeposit} onReset={resetBank} onPaste={pasteDeposits} onToast={showToast} />}
      {route==="closure" && <window.Closures closures={closures} onRestore={restoreClosure} onStatusChange={(id,patch)=>setClosures(cs=>cs.map(c=>c.id===id?{...c,...patch}:c))} onToast={showToast} />}
      {route==="pending" && <window.Pending pending={pending} onAdd={addPending} onUpdate={updatePending} onDelete={deletePending} onPromote={promotePending} onToast={showToast} />}
      {route==="certprint" && <window.CertPrint onToast={showToast} />}
      {route==="upload" && <window.Upload onApply={handleApply} />}
      {route==="history" && <HistoryView members={members} onCancel={cancelPayment} />}
      {route==="settings" && <SettingsView />}

      {payTarget && <window.PayModal member={payTarget} onClose={()=>setPayTarget(null)} onConfirm={confirmPay} />}
      {detail && <window.MemberDetail member={detail} onClose={()=>setDetail(null)} onPay={(m)=>setPayTarget(m)} onClosure={(m)=>setCloseTarget(m)} onUpdate={(updated)=>{ setMembers(ms=>ms.map(m=>m.id===updated.id?{...m,...updated}:m)); setDetail(updated); }} onToast={showToast} />}
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

// 수납 내역 (전체)
function HistoryView({ members, onCancel }){
  const { Card } = window.PayroleDesignSystem_9db006;
  const rows = [];
  members.forEach(m=> (m.payments||[]).forEach(p=> rows.push({ ...p, mid:m.id, name:m.name, sigun:m.sigun, vno:m.vehicleNo })));
  rows.sort((a,b)=>(b.paidDate||"").localeCompare(a.paidDate||""));
  const total = rows.reduce((s,p)=>s+p.amount,0);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:24, background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"16px 20px", boxShadow:"var(--shadow-xs)" }}>
        <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>총 수납 건수</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--text-primary)" }}>{D.num(rows.length)}건</div></div>
        <div style={{ width:1, background:"var(--border-default)" }} />
        <div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>총 수납 금액</div><div style={{ font:"var(--fw-bold) 22px/1.1 var(--font-sans)", color:"var(--green-500)" }}>{won(total)}</div></div>
      </div>
      <Card padded={false}>
        <div style={{ maxHeight:"calc(100vh - 320px)", overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              {["수납일","성명","지역","차량번호","대상월","수납항목","회계구분","납부방식","금액",""].map((h,i)=>(
                <th key={h} style={{ textAlign:i===8?"right":"left", padding:"12px 18px", whiteSpace:"nowrap", font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)", position:"sticky", top:0 }}>{h}</th>))}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id} style={{ borderBottom: i<rows.length-1?"1px solid var(--border-subtle)":"none" }}>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{r.paidDate}</td>
                  <td style={{ padding:"12px 18px", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{r.name}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.sigun}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.vno}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{r.paidForYm}</td>
                  <td style={{ padding:"12px 18px" }}><window.PMUI.ChargeTag item={r.chargeItem} /></td>
                  <td style={{ padding:"12px 18px" }}><window.PMUI.AccountingTag accounting={r.accounting} /></td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.method}</td>
                  <td style={{ padding:"12px 18px", textAlign:"right", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--green-500)", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>+{won(r.amount)}</td>
                  <td style={{ padding:"12px 18px", textAlign:"right" }}>
                    <button type="button" onClick={()=>{ if(confirm(`${r.name} · ${won(r.amount)} 수납을 취소할까요?`)) onCancel(members.find(m=>m.id===r.mid)||{id:r.mid,name:r.name,monthlyCharge:0,arrears:[],payments:[]}, r); }} style={{ height:26, padding:"0 10px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", cursor:"pointer", background:"var(--white)", color:"var(--text-tertiary)", font:"var(--fw-demibold) 11px/1 var(--font-sans)" }}>취소</button>
                  </td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan={10} style={{ padding:"60px", textAlign:"center", color:"var(--text-tertiary)" }}>수납 기록이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SettingsView(){
  const { Card } = window.PayroleDesignSystem_9db006;
  const { FEE_ASSOC, FEE_MGMT, FEE_SENIOR, REGIONS } = D;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, maxWidth:980 }}>
      <Card>
        <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:16 }}>부과 기준</div>
        {[["협회가입 · 협회비",won(FEE_ASSOC)+" / 월"],["협회미가입 · 관리비",won(FEE_MGMT)+" / 월"],["70세 이상 · 협회비 50% 감면",won(FEE_SENIOR)+" / 월"]].map(([l,v])=>(
          <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", borderBottom:"1px solid var(--border-subtle)" }}>
            <span style={{ font:"var(--body-md)", color:"var(--text-secondary)" }}>{l}</span>
            <span style={{ font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>{v}</span>
          </div>
        ))}
        <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:14, lineHeight:1.6 }}>관리비는 자격증명 발급 다음 달부터 부과됩니다. 폐업·양도·이관·탈퇴자는 기본 부과·문자 대상에서 제외되며, 과거 미수금이 남으면 폐업현황에서 추심 대상으로 조회됩니다. 수납은 항상 오래된 달부터 차감하며, 협회가입비·자격증명발급비는 가수금·잡수입으로 기록만 남고 미수금은 차감하지 않습니다.</div>
      </Card>
      <Card>
        <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:6 }}>지역명 정규화</div>
        <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginBottom:14 }}>업로드 시 아래 14개 지역명으로 자동 정규화됩니다.</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {REGIONS.map(r=><span key={r} style={{ padding:"7px 13px", borderRadius:"var(--radius-pill)", background:"var(--grey-25)", border:"1px solid var(--border-subtle)", font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-secondary)" }}>{r}</span>)}
        </div>
      </Card>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
