// 메인 앱 — 화면 라우팅 + 전역 상태 (모든 데이터는 /api/* REST API 기준)
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
  const [route, setRoute] = React.useState(()=>localStorage.getItem("misu.route") || "dashboard");
  const [members, setMembers] = React.useState([]);
  const [closures, setClosures] = React.useState([]);
  const [pending, setPending] = React.useState([]);
  const [deposits, setDeposits] = React.useState([]);
  const [dashboardData, setDashboardData] = React.useState(null);
  const [regionData, setRegionData] = React.useState([]);
  const [dataLoading, setDataLoading] = React.useState(true);
  const [drill, setDrill] = React.useState(null);
  const [payTarget, setPayTarget] = React.useState(null);
  const [detail, setDetail] = React.useState(null);
  const [closeTarget, setCloseTarget] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [month, setMonth] = React.useState(new Date().getMonth() + 1);

  React.useEffect(()=>{
    const r = document.documentElement;
    r.style.setProperty("--brand", t.accent);
    r.style.setProperty("--brand-hover", t.accent);
  }, [t.accent]);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 3200); };
  React.useEffect(()=>{ localStorage.setItem("misu.route", route); }, [route]);

  // ── 전체 데이터 새로고침 ──
  const refetchAll = React.useCallback(async (msg) => {
    setDataLoading(true);
    try {
      const [mRes, cRes, dRes, rRes, depRes] = await Promise.all([
        fetch('/api/members?page=1&size=100'),
        fetch('/api/closures'),
        fetch('/api/dashboard/summary'),
        fetch('/api/dashboard/by-sigun'),
        fetch('/api/deposits'),
      ]);
      if (mRes.ok) setMembers(await mRes.json());
      if (cRes.ok) setClosures(await cRes.json());
      if (dRes.ok) setDashboardData(await dRes.json());
      if (rRes.ok) setRegionData(await rRes.json());
      if (depRes.ok) setDeposits(await depRes.json());
      const pendingRes = await fetch('/api/pending');
      if (pendingRes.ok) setPending(await pendingRes.json());
      if (msg) showToast(msg);
    } catch(e) {
      showToast('데이터 로드 실패: 서버 연결을 확인하세요.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  const refetchClosures = React.useCallback(async () => {
    const res = await fetch('/api/closures');
    if (res.ok) setClosures(await res.json());
  }, []);

  const refetchDashboard = React.useCallback(async () => {
    const [dRes, rRes] = await Promise.all([
      fetch('/api/dashboard/summary'),
      fetch('/api/dashboard/by-sigun'),
    ]);
    if (dRes.ok) setDashboardData(await dRes.json());
    if (rRes.ok) setRegionData(await rRes.json());
  }, []);

  React.useEffect(() => { refetchAll(); }, []);

  const goList = (filter) => { setDrill({ ...filter, _k: Date.now() }); setRoute("list"); };

  // ── 수납 반영 (API 호출) ──
  const confirmPay = async (member, info) => {
    try {
      const res = await fetch(`/api/members/${member.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: info.amount,
          method: info.method,
          charge_item: info.chargeItem,
          paid_date: info.date,
          deduct: D.isArrearsIncome(info.chargeItem),
        }),
      });
      if (!res.ok) { const e = await res.json().catch(()=>{}); showToast(`수납 실패: ${e?.detail||res.status}`); return; }
      const json = await res.json();
      const nm = json.member;
      setMembers(ms => ms.map(m => m.id === member.id ? nm : m));
      if (detail && detail.id === member.id) setDetail(nm);
      setPayTarget(null);
      await refetchDashboard();
      showToast(`${member.name} 님 ${won(info.amount)} 수납 완료 · 잔액 ${won(D.outstanding(nm))}`);
    } catch(e) {
      showToast('수납 처리 중 오류가 발생했습니다.');
    }
  };

  // ── 폐업 등록 (API 호출) ──
  const registerClosure = async (member, payload) => {
    try {
      const res = await fetch(`/api/members/${member.id}/closure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: payload.type,
          process_date: payload.processDate || new Date().toISOString().slice(0,10),
          doc_no: payload.docNo || '-',
          content: payload.content || '',
          notify_later: payload.notifyLater || false,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(()=>{}); showToast(`폐업 등록 실패: ${e?.detail||res.status}`); return; }
      setCloseTarget(null); setDetail(null);
      await Promise.all([refetchAll()]);
      showToast(`${member.name} 님 ${payload.type} 처리 완료`);
    } catch(e) {
      showToast('폐업 처리 중 오류가 발생했습니다.');
    }
  };

  // ── 폐업 복귀 ──
  const restoreClosure = async (c) => {
    try {
      const res = await fetch(`/api/closures/${c.id}/restore`, { method: 'POST' });
      if (!res.ok) { showToast(`복귀 실패: ${res.status}`); return; }
      await refetchAll();
      showToast(`${c.name} 회원 정상 명단으로 복귀`);
    } catch(e) {
      showToast('복귀 처리 중 오류가 발생했습니다.');
    }
  };

  // ── 폐업 상태 변경 ──
  const handleClosureStatusChange = async (closureId, patch) => {
    try {
      const res = await fetch(`/api/closures/${closureId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) { showToast(`상태 변경 실패: ${res.status}`); return; }
      await refetchClosures();
      showToast('상태가 변경되었습니다.');
    } catch(e) {
      showToast('상태 변경 중 오류가 발생했습니다.');
    }
  };

  // ── 통장 입금내역 저장 (붙여넣기 → 서버 저장 → 로컬 반영) ──
  const pasteDeposits = async (rows) => {
    try {
      const res = await fetch('/api/deposits/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (res.ok) {
        const refetchedRes = await fetch('/api/deposits');
        if (refetchedRes.ok) setDeposits(await refetchedRes.json());
        showToast(`${rows.length}건 거래내역 저장 완료`);
      } else {
        // 저장 실패 시 로컬 상태로만
        setDeposits(ds => {
          let id = Math.max(0, ...ds.map(d => d.id), 0) + 1;
          return [...rows.map(r => ({ id: id++, depositDate:r.depositDate, depositorName:r.depositorName, amount:r.amount, memo:r.memo, status:"미매칭", candidates:[] })), ...ds];
        });
      }
    } catch {
      setDeposits(ds => {
        let id = Math.max(0, ...ds.map(d => d.id), 0) + 1;
        return [...rows.map(r => ({ id: id++, depositDate:r.depositDate, depositorName:r.depositorName, amount:r.amount, memo:r.memo, status:"미매칭", candidates:[] })), ...ds];
      });
    }
  };

  const refetchDeposits = async () => {
    const res = await fetch('/api/deposits');
    if (res.ok) setDeposits(await res.json());
  };

  const matchDeposit = async (deposit, candidate, chargeItemOverride) => {
    if (!candidate) return;
    try {
      const res = await fetch(`/api/deposits/${deposit.id}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: candidate.id,
          charge_item: chargeItemOverride || candidate.chargeItem || candidate.charge_item,
          paid_date: deposit.depositDate || deposit.deposit_date,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(()=>{}); showToast(`통장매칭 수납 실패: ${e?.detail||res.status}`); return; }
      const json = await res.json();
      if (json.member) setMembers(ms => ms.map(m => m.id === candidate.id ? json.member : m));
      await Promise.all([refetchDeposits(), refetchDashboard()]);
    } catch(e) {
      showToast('통장매칭 처리 중 오류가 발생했습니다.');
    }
  };

  const matchDepositGroup = async (deposit, group) => {
    try {
      const res = await fetch(`/api/deposits/${deposit.id}/group-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_code: group.code }),
      });
      if (res.ok) { await Promise.all([refetchDeposits(), refetchDashboard()]); }
      else { showToast(`묶음수납 실패: ${res.status}`); }
    } catch { showToast('묶음수납 처리 중 오류가 발생했습니다.'); }
  };

  const excludeDeposit = async (deposit) => {
    try {
      const res = await fetch(`/api/deposits/${deposit.id}/exclude`, { method: 'POST' });
      if (res.ok) await refetchDeposits();
      else setDeposits(ds => ds.map(d => d.id === deposit.id ? { ...d, status:'제외' } : d));
    } catch {
      setDeposits(ds => ds.map(d => d.id === deposit.id ? { ...d, status:'제외' } : d));
    }
    showToast('입금 거래 제외 처리');
  };

  const resetBank = async () => {
    await refetchDeposits();
    showToast('통장매칭 결과 새로고침');
  };

  // ── 신규·예정자 ──
  const addPending = async (row) => {
    try {
      const res = await fetch('/api/pending', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(row) });
      if (res.ok) { const data = await res.json(); setPending(ps=>[data,...ps]); showToast(`${row.name} 예정자 등록`); }
      else setPending(ps=>[{ ...row, id:Date.now() },...ps]);
    } catch { setPending(ps=>[{ ...row, id:Date.now() },...ps]); showToast(`${row.name} 예정자 등록`); }
  };
  const updatePending = async (row) => {
    setPending(ps=>ps.map(p=>p.id===row.id?row:p));
    showToast(`${row.name} 예정자 수정`);
  };
  const deletePending = async (row) => {
    try {
      await fetch(`/api/pending/${row.id}`, { method:'DELETE' });
    } catch {}
    setPending(ps=>ps.filter(p=>p.id!==row.id));
    showToast(`${row.name} 예정자 삭제`);
  };
  const promotePending = async (row) => {
    setPending(ps=>ps.filter(p=>p.id!==row.id));
    showToast(`${row.name} 전체자명단 전환 완료`);
    await refetchAll();
  };

  // ── 엑셀 업로드 반영 ──
  const handleApply = (json) => {
    const msg = json
      ? `반영 완료: 회원 ${json.inserted||0}건 신규, ${json.updated||0}건 수정, 미수 ${json.arrears_inserted||0}건 저장`
      : '엑셀 반영 완료';
    refetchAll(msg);
  };

  // ── 대시보드 집계 (API 데이터 기반 또는 in-memory fallback) ──
  const agg = React.useMemo(() => {
    if (dashboardData) {
      return {
        totalMembers: dashboardData.totalMembers || dashboardData.total_members || 0,
        activeMembers: dashboardData.activeMembers || dashboardData.active_members || 0,
        overdueCount: dashboardData.arrearsCount || dashboardData.arrears_members || 0,
        totalOutstanding: dashboardData.totalArrears || dashboardData.total_arrears_amount || 0,
        thisMonthCharge: dashboardData.thisMonthCharge || dashboardData.this_month_charge || 0,
        thisMonthCollected: dashboardData.thisMonthPayments || dashboardData.month_payment || 0,
        prepaid: dashboardData.prepaidCount || dashboardData.prepaid || 0,
        highValue: dashboardData.highAmount || dashboardData.high_amount || 0,
        longOverdue: dashboardData.longOverdue || dashboardData.long_overdue || 0,
        seniors: dashboardData.seniorCount || dashboardData.seniors || 0,
        disconnected: dashboardData.disconnected || 0,
        certMissing: dashboardData.certMissing || dashboardData.cert_missing || 0,
        regionTop: regionData.map(r => ({ region: r.sigun||r.region, amt: r.total||r.amount||0, count: r.memberCount||r.member_count||0 })),
        byAccount: dashboardData.byAccount || dashboardData.by_account || {},
        buckets: dashboardData.monthBuckets || dashboardData.buckets || [],
        personal: 0, delivery: 0, joined: 0, notJoined: 0,
        longOverdueList: [],
      };
    }
    return D.aggregate(members);
  }, [dashboardData, regionData, members]);

  // 수납 내역: members에서 추출
  const cancelPayment = async (member, pay) => {
    try {
      const res = await fetch(`/api/payments/${pay.id}/cancel`, { method:'POST' });
      if (!res.ok) { showToast(`수납 취소 실패: ${res.status}`); return; }
      const mRes = await fetch(`/api/members/${member.id}`);
      if (mRes.ok) { const nm = await mRes.json(); setMembers(ms=>ms.map(m=>m.id===member.id?nm:m)); }
      await refetchDashboard();
      showToast(`수납 취소 · ${won(pay.amount)} 되돌림`);
    } catch {
      showToast('수납 취소 중 오류가 발생했습니다.');
    }
  };

  const [title, subtitle] = TITLES[route] || ["", ""];

  const headerRight = (route==="dashboard" || route==="list") ? (
    <window.PMUI.YearMonth year={year} month={month} onYear={setYear} onMonth={setMonth} />
  ) : null;

  return (
    <window.AppShell active={route} onNavigate={(id)=>{ setRoute(id); setDrill(null); localStorage.setItem("misu.route", id); }}
      title={title} subtitle={subtitle} headerRight={headerRight} density={t.density}>

      {dataLoading && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"80px 0", color:"var(--text-tertiary)", font:"var(--body-md)" }}>데이터를 불러오는 중...</div>}
      {!dataLoading && route==="dashboard" && <window.Dashboard agg={agg} members={members} deposits={deposits} closures={closures} onDrill={goList} onNav={setRoute} year={year} month={month} />}
      {!dataLoading && route==="list" && <window.Receivables members={members} drill={drill} density={t.density} onPay={setPayTarget} onSelect={setDetail} onToast={showToast} onRefresh={refetchAll} />}
      {route==="regional" && <window.Regional members={members} onToast={showToast} />}
      {route==="bank" && <window.BankMatching deposits={deposits} members={members} onMatch={matchDeposit} onGroupMatch={matchDepositGroup} onExclude={excludeDeposit} onReset={resetBank} onPaste={pasteDeposits} onToast={showToast} />}
      {route==="closure" && <window.Closures closures={closures} onRestore={restoreClosure} onStatusChange={handleClosureStatusChange} onToast={showToast} onRefresh={refetchClosures} />}
      {route==="pending" && <window.Pending pending={pending} onAdd={addPending} onUpdate={updatePending} onDelete={deletePending} onPromote={promotePending} onToast={showToast} />}
      {route==="certprint" && <window.CertPrint onToast={showToast} />}
      {route==="upload" && <window.Upload onApply={handleApply} />}
      {route==="history" && <HistoryView members={members} onCancel={cancelPayment} />}
      {route==="settings" && <SettingsView />}

      {payTarget && <window.PayModal member={payTarget} onClose={()=>setPayTarget(null)} onConfirm={confirmPay} />}
      {detail && <window.MemberDetail member={detail} onClose={()=>setDetail(null)} onPay={(m)=>setPayTarget(m)} onClosure={(m)=>setCloseTarget(m)} onUpdate={async (updated)=>{ setMembers(ms=>ms.map(m=>m.id===updated.id?{...m,...updated}:m)); setDetail(updated); }} onToast={showToast} />}
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
  members.forEach(m=> (m.payments||[]).forEach(p=> rows.push({ ...p, mid:m.id, name:m.name, sigun:m.sigun, vno:m.vehicleNo||m.vehicle_no })));
  rows.sort((a,b)=>(b.paidDate||b.paid_date||"").localeCompare(a.paidDate||a.paid_date||""));
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
              {["수납일","성명","지역","차량번호","대상월","수납항목","납부방식","금액",""].map((h,i)=>(
                <th key={h} style={{ textAlign:i===7?"right":"left", padding:"12px 18px", whiteSpace:"nowrap", font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)", position:"sticky", top:0 }}>{h}</th>))}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={`${r.id}-${i}`} style={{ borderBottom: i<rows.length-1?"1px solid var(--border-subtle)":"none" }}>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.paidDate||r.paid_date}</td>
                  <td style={{ padding:"12px 18px", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{r.name}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.sigun}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.vno}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{r.paidForYm||r.paid_for_ym}</td>
                  <td style={{ padding:"12px 18px" }}><window.PMUI.ChargeTag item={r.chargeItem||r.charge_item} /></td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.method}</td>
                  <td style={{ padding:"12px 18px", textAlign:"right", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--green-500)", whiteSpace:"nowrap" }}>+{won(r.amount)}</td>
                  <td style={{ padding:"12px 18px", textAlign:"right" }}>
                    <button type="button" onClick={()=>{ if(confirm(`${r.name} · ${won(r.amount)} 수납을 취소할까요?`)) onCancel(members.find(m=>m.id===r.mid)||{id:r.mid,name:r.name}, r); }} style={{ height:26, padding:"0 10px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)", cursor:"pointer", background:"var(--white)", color:"var(--text-tertiary)", font:"var(--fw-demibold) 11px/1 var(--font-sans)" }}>취소</button>
                  </td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan={9} style={{ padding:"60px", textAlign:"center", color:"var(--text-tertiary)" }}>수납 기록이 없습니다.</td></tr>}
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
        <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:14, lineHeight:1.6 }}>관리비는 자격증명 발급 다음 달부터 부과됩니다. 폐업·양도·이관·탈퇴자는 기본 부과·문자 대상에서 제외되며, 과거 미수금이 남으면 폐업현황에서 추심 대상으로 조회됩니다.</div>
      </Card>
      <Card>
        <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:6 }}>지역명 정규화</div>
        <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginBottom:14 }}>업로드 시 아래 18개 지역명으로 자동 정규화됩니다.</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {REGIONS.map(r=><span key={r} style={{ padding:"7px 13px", borderRadius:"var(--radius-pill)", background:"var(--grey-25)", border:"1px solid var(--border-subtle)", font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-secondary)" }}>{r}</span>)}
        </div>
      </Card>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
