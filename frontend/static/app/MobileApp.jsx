// 모바일 PWA — PIN 잠금 → 미수금 명단 → 회원 상세 → 수납 시트
// 데이터/계산 로직(window.PMData)은 데스크톱과 동일하게 재사용한다.
const { Icon } = window.PayroleDesignSystem_9db006;
const D = window.PMData;
const { won, num } = D;

const PIN_KEY = "pm_mobile_pin";
const DEFAULT_PIN = "1234";

// ===== PIN 잠금 =====
function PinLock({ onUnlock }){
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState(false);
  const saved = localStorage.getItem(PIN_KEY) || DEFAULT_PIN;

  const press = (d)=>{
    if (d==="del"){ setPin(p=>p.slice(0,-1)); setErr(false); return; }
    if (pin.length>=4) return;
    const np = pin+d; setPin(np);
    if (np.length===4){
      if (np===saved){ setTimeout(onUnlock, 120); }
      else { setErr(true); setTimeout(()=>{ setPin(""); }, 400); }
    }
  };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 32px", background:"var(--white)" }}>
      <div style={{ width:60, height:60, borderRadius:16, background:"var(--brand)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 8px 20px rgba(57,129,247,0.3)" }}>
        <Icon name="secure" size={30} color="#fff" />
      </div>
      <div style={{ font:"var(--fw-bold) 20px/1.3 var(--font-sans)", color:"var(--text-primary)", marginTop:20 }}>강원 화물협회</div>
      <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:4 }}>PIN 4자리를 입력하세요</div>

      <div style={{ display:"flex", gap:16, margin:"32px 0", animation: err?"pmShake .4s":"none" }}>
        {[0,1,2,3].map(i=>(
          <span key={i} style={{ width:16, height:16, borderRadius:"50%", transition:"all .15s",
            background: i<pin.length ? (err?"var(--red-500)":"var(--brand)") : "var(--grey-100)" }} />
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,72px)", gap:16 }}>
        {["1","2","3","4","5","6","7","8","9","","0","del"].map((d,i)=>(
          d==="" ? <span key={i} /> :
          <button key={i} type="button" onClick={()=>press(d)} style={{ width:72, height:72, borderRadius:"50%", border:"none", cursor:"pointer",
            background: d==="del"?"transparent":"var(--grey-25)", color:"var(--text-primary)",
            font:"var(--fw-medium) 26px/1 var(--font-sans)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {d==="del" ? <Icon name="close" size={22} style={{ color:"var(--text-tertiary)" }} /> : d}</button>
        ))}
      </div>
      <div style={{ font:"var(--body-xs)", color:"var(--text-muted)", marginTop:28 }}>기본 PIN 1234 · 설정에서 변경</div>
    </div>
  );
}

// ===== 상단바 =====
function MobileHeader({ title, sub, onBack, right }){
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderBottom:"1px solid var(--border-subtle)", background:"var(--white)", position:"sticky", top:0, zIndex:10 }}>
      {onBack && <button type="button" onClick={onBack} style={{ border:"none", background:"none", cursor:"pointer", padding:4, display:"flex" }}><Icon name="chevron-left" size={22} style={{ color:"var(--text-primary)" }} /></button>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ font:"var(--fw-bold) 17px/1.2 var(--font-sans)", color:"var(--text-primary)" }}>{title}</div>
        {sub && <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// ===== 명단 =====
function MobileList({ members, onSelect }){
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState("미수있음");

  const rows = React.useMemo(()=>{
    const nq = q.trim().toLowerCase(); const nv = D.normVehicle(q);
    return members.filter(m=>{
      if (m.status!=="정상") return false;
      const out = D.outstanding(m);
      if (tab==="미수있음" && !(out>0)) return false;
      if (tab==="완납" && out!==0) return false;
      if (tab==="선납" && !(out<0)) return false;
      if (nq){
        const text=[m.name,m.vehicleNo,m.mgmtNo,m.phone,m.sigun].join(" ").toLowerCase();
        if(!(text.includes(nq) || (nv && D.normVehicle(m.vehicleNo).includes(nv)))) return false;
      }
      return true;
    }).sort((a,b)=>D.outstanding(b)-D.outstanding(a));
  }, [members,q,tab]);

  const sumOut = rows.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <MobileHeader title="미수금 명단" sub={`${num(rows.length)}명 · 합계 ${won(sumOut)}`} />
      <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10, borderBottom:"1px solid var(--border-subtle)", background:"var(--white)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, height:42, padding:"0 14px", borderRadius:"var(--radius-pill)", background:"var(--grey-25)" }}>
          <Icon name="search" size={18} style={{ color:"var(--text-tertiary)" }} />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="이름·차량번호·관리번호 검색"
            style={{ flex:1, border:"none", outline:"none", background:"transparent", font:"var(--fw-regular) 15px/1.4 var(--font-sans)", color:"var(--text-primary)" }} />
          {q && <button type="button" onClick={()=>setQ("")} style={{ border:"none", background:"none", cursor:"pointer", display:"flex", padding:0 }}><Icon name="close" size={16} style={{ color:"var(--text-tertiary)" }} /></button>}
        </div>
        <div style={{ display:"flex", gap:8, overflowX:"auto" }}>
          {["미수있음","완납","선납"].map(t=>(
            <button key={t} type="button" onClick={()=>setTab(t)} style={{ flex:"none", height:34, padding:"0 16px", borderRadius:"var(--radius-pill)", cursor:"pointer", whiteSpace:"nowrap",
              border: tab===t?"1px solid var(--brand)":"1px solid var(--border-default)", background: tab===t?"var(--brand)":"var(--white)", color: tab===t?"#fff":"var(--text-secondary)", font:"var(--fw-medium) 14px/1 var(--font-sans)" }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflow:"auto", padding:"8px 0 24px" }}>
        {rows.map(m=>{
          const out = D.outstanding(m); const months = D.arrearsMonths(m);
          return (
            <button key={m.id} type="button" onClick={()=>onSelect(m)} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"14px 16px", border:"none", borderBottom:"1px solid var(--border-subtle)", background:"var(--white)", cursor:"pointer", textAlign:"left" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <b style={{ font:"var(--fw-demibold) 16px/1.2 var(--font-sans)", color:"var(--text-primary)" }}>{m.name}</b>
                  {m.isSenior && <span style={{ font:"10px/1 var(--font-sans)", color:"var(--green-500)", fontWeight:700, padding:"2px 5px", background:"#EAF7F0", borderRadius:4 }}>70세</span>}
                  <window.PMUI.ChargeTag item={m.chargeItem} />
                </div>
                <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:4 }}>{m.sigun} · {m.vehicleNo}{months>0 && ` · 미수 ${months}개월`}</div>
              </div>
              <div style={{ textAlign:"right", flex:"none" }}>
                <div style={{ font:"var(--fw-bold) 16px/1.1 var(--font-sans)", fontVariantNumeric:"tabular-nums",
                  color: out>0?"var(--red-500)": out<0?"var(--violet-500)":"var(--text-tertiary)" }}>{won(out)}</div>
                <Icon name="chevron-right" size={16} style={{ color:"var(--text-muted)", marginTop:2 }} />
              </div>
            </button>
          );
        })}
        {rows.length===0 && <div style={{ padding:"60px 20px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-md)" }}>조건에 맞는 회원이 없습니다.</div>}
      </div>
    </div>
  );
}

// ===== 회원 상세 + 수납 시트 =====
function MobileDetail({ member, onBack, onPay }){
  const open = D.balanceItems(member);
  const cur = D.outstanding(member);
  const [sheet, setSheet] = React.useState(false);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--surface-canvas)" }}>
      <MobileHeader title={member.name} sub={`${member.mgmtNo} · ${member.sigun}`} onBack={onBack} />
      <div style={{ flex:1, overflow:"auto", padding:"16px" }}>
        {/* 잔액 카드 */}
        <div style={{ background:"var(--white)", borderRadius:"var(--radius-lg)", padding:"20px", boxShadow:"var(--shadow-xs)", border:"1px solid var(--border-subtle)" }}>
          <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>현재잔액</div>
          <div style={{ font:"var(--fw-bold) 32px/1.1 var(--font-sans)", letterSpacing:"-0.02em", marginTop:4,
            color: cur>0?"var(--red-500)": cur<0?"var(--violet-500)":"var(--green-500)" }}>{won(cur)}</div>
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            {[["원장미수",D.ledgerArrears(member)],["수납합계",D.paidTotal(member)],["미수개월",D.arrearsMonths(member)+"개월"]].map(([l,v])=>(
              <div key={l} style={{ flex:1, padding:"10px", borderRadius:"var(--radius-md)", background:"var(--grey-25)", textAlign:"center" }}>
                <div style={{ font:"10px/1.3 var(--font-sans)", color:"var(--text-tertiary)" }}>{l}</div>
                <div style={{ font:"var(--fw-demibold) 13px/1.2 var(--font-sans)", color:"var(--text-primary)", marginTop:3, fontVariantNumeric:"tabular-nums" }}>{typeof v==="number"?won(v):v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 기본정보 */}
        <div style={{ background:"var(--white)", borderRadius:"var(--radius-lg)", padding:"6px 16px", marginTop:14, boxShadow:"var(--shadow-xs)", border:"1px solid var(--border-subtle)" }}>
          {[["차량번호",member.vehicleNo],["연락처",member.phone||"—"],["가입/계정",`${member.membership} · ${member.chargeItem}`],["월부과금",won(member.monthlyCharge)],["주소",member.address]].map(([l,v],i,arr)=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", gap:16, padding:"12px 0", borderBottom: i<arr.length-1?"1px solid var(--border-subtle)":"none" }}>
              <span style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", flex:"none" }}>{l}</span>
              <span style={{ font:"var(--fw-medium) 14px/1.4 var(--font-sans)", color:"var(--text-primary)", textAlign:"right" }}>{v}</span>
            </div>
          ))}
        </div>

        {/* 월별 미수 */}
        <div style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-tertiary)", margin:"20px 4px 10px" }}>월별 미수 ({open.length}건)</div>
        <div style={{ background:"var(--white)", borderRadius:"var(--radius-lg)", overflow:"hidden", boxShadow:"var(--shadow-xs)", border:"1px solid var(--border-subtle)" }}>
          {open.length ? open.map((it,i)=>(
            <div key={it.ym} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderBottom: i<open.length-1?"1px solid var(--border-subtle)":"none" }}>
              <span style={{ font:"var(--body-sm)", color:"var(--text-primary)", fontVariantNumeric:"tabular-nums" }}>{it.ym} · {it.item}</span>
              <b style={{ font:"var(--fw-demibold) 14px/1 var(--font-sans)", color: it.amount<0?"var(--violet-500)":"var(--red-500)", fontVariantNumeric:"tabular-nums" }}>{won(it.amount)}</b>
            </div>
          )) : <div style={{ padding:"24px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>현재 미수금이 없습니다.</div>}
        </div>

        {/* 수납내역 */}
        {(member.payments||[]).length>0 && (
          <>
            <div style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-tertiary)", margin:"20px 4px 10px" }}>수납내역 ({member.payments.length}건)</div>
            <div style={{ background:"var(--white)", borderRadius:"var(--radius-lg)", overflow:"hidden", boxShadow:"var(--shadow-xs)", border:"1px solid var(--border-subtle)" }}>
              {member.payments.slice(0,8).map((p,i,arr)=>(
                <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom: i<arr.length-1?"1px solid var(--border-subtle)":"none" }}>
                  <div><div style={{ font:"var(--fw-medium) 13px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{p.chargeItem} · {p.method}</div><div style={{ font:"10px/1.4 var(--font-sans)", color:"var(--text-tertiary)" }}>{p.paidDate} · {p.accounting}</div></div>
                  <b style={{ font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--green-500)" }}>+{won(p.amount)}</b>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 하단 고정 수납 버튼 */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border-subtle)", background:"var(--white)" }}>
        <button type="button" onClick={()=>setSheet(true)} disabled={cur<=0} style={{ width:"100%", height:52, borderRadius:"var(--radius-pill)", border:"none", cursor:cur<=0?"default":"pointer",
          background: cur>0?"var(--brand)":"var(--grey-100)", color: cur>0?"#fff":"var(--text-muted)", font:"var(--fw-demibold) 16px/1 var(--font-sans)", boxShadow: cur>0?"0 4px 12px rgba(57,129,247,0.28)":"none" }}>
          수납 반영</button>
      </div>

      {sheet && <PaySheet member={member} onClose={()=>setSheet(false)} onConfirm={(info)=>{ onPay(member, info); setSheet(false); }} />}
    </div>
  );
}

// ===== 수납 바텀시트 =====
function PaySheet({ member, onClose, onConfirm }){
  const cur = D.outstanding(member);
  const [amount, setAmount] = React.useState(Math.max(cur,0));
  const [item, setItem] = React.useState(member.chargeItem);
  const [method, setMethod] = React.useState("직접수납");
  const deduct = D.isArrearsIncome(item);
  const amt = parseInt(amount)||0;
  const after = deduct ? cur-amt : cur;
  const nextStatus = after<0?"선납":after===0?"완납":"미납";

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(10,17,47,0.4)", display:"flex", alignItems:"flex-end", animation:"pmFade .15s ease" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%", background:"var(--white)", borderTopLeftRadius:24, borderTopRightRadius:24, padding:"8px 20px 24px", animation:"pmSheet .25s ease", maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ width:40, height:5, borderRadius:3, background:"var(--grey-100)", margin:"8px auto 16px" }} />
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18 }}>
          <div style={{ font:"var(--fw-bold) 19px/1.2 var(--font-sans)", color:"var(--text-primary)" }}>수납 반영</div>
          <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{member.name} · 잔액 {won(cur)}</div>
        </div>

        <label style={{ font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", display:"block", marginBottom:8 }}>수납액</label>
        <div style={{ position:"relative", marginBottom:10 }}>
          <input type="number" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} style={{ width:"100%", height:56, padding:"0 44px 0 16px", boxSizing:"border-box", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"var(--fw-bold) 22px/1 var(--font-sans)", textAlign:"right", color:"var(--text-primary)", outline:"none" }} />
          <span style={{ position:"absolute", right:16, top:0, height:56, display:"flex", alignItems:"center", color:"var(--text-tertiary)", font:"var(--fw-medium) 16px/1 var(--font-sans)" }}>원</span>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:18 }}>
          {[["전액",Math.max(cur,0)],["월부과금",member.monthlyCharge],["3개월",member.monthlyCharge*3]].map(([l,v])=>(
            <button key={l} type="button" onClick={()=>setAmount(v)} style={{ flex:1, height:40, borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)", background:"var(--white)", cursor:"pointer", font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-secondary)" }}>{l}</button>
          ))}
        </div>

        <label style={{ font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", display:"block", marginBottom:8 }}>수납항목</label>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:18 }}>
          {D.INCOME_ITEMS.map(it=>(
            <button key={it.value} type="button" onClick={()=>setItem(it.value)} style={{ height:38, padding:"0 13px", borderRadius:"var(--radius-pill)", cursor:"pointer",
              border: item===it.value?"1.5px solid var(--brand)":"1px solid var(--border-default)", background: item===it.value?"var(--brand-subtle)":"var(--white)", color: item===it.value?"var(--brand-active)":"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)" }}>{it.value}</button>
          ))}
        </div>

        <label style={{ font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", display:"block", marginBottom:8 }}>납부방식</label>
        <div style={{ display:"flex", gap:6, marginBottom:18 }}>
          {["직접수납","통장매칭","현금","CMS"].map(m=>(
            <button key={m} type="button" onClick={()=>setMethod(m)} style={{ flex:1, height:40, borderRadius:"var(--radius-md)", cursor:"pointer",
              border: method===m?"1.5px solid var(--brand)":"1px solid var(--border-default)", background: method===m?"var(--brand-subtle)":"var(--white)", color: method===m?"var(--brand-active)":"var(--text-secondary)", font:"var(--fw-medium) 12px/1 var(--font-sans)" }}>{m}</button>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", background: after<=0?"var(--green-50)":"var(--grey-25)", borderRadius:"var(--radius-md)", marginBottom:16 }}>
          <span style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>처리 후 잔액</span>
          <span style={{ font:"var(--fw-bold) 18px/1 var(--font-sans)", color: after<0?"var(--violet-500)":after===0?"var(--green-500)":"var(--text-primary)" }}>{won(after)} · {nextStatus}</span>
        </div>
        <button type="button" onClick={()=>onConfirm({ amount:amt, method, chargeItem:item, date:"2026-06-20", after, nextStatus })} style={{ width:"100%", height:52, borderRadius:"var(--radius-pill)", border:"none", cursor:"pointer", background:"var(--brand)", color:"#fff", font:"var(--fw-demibold) 16px/1 var(--font-sans)" }}>반영하기</button>
      </div>
    </div>
  );
}

function MobileApp(){
  const [locked, setLocked] = React.useState(true);
  const [members, setMembers] = React.useState(D.MEMBERS);
  const [sel, setSel] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  React.useEffect(()=>{ document.documentElement.style.setProperty("--brand", "#3981F7"); }, []);

  const pay = (member, info)=>{
    setMembers(ms=> ms.map(m=> m.id===member.id ? D.applyPayment(m, { amount:info.amount, method:info.method, chargeItem:info.chargeItem, paidDate:info.date }).member : m));
    const nm = D.applyPayment(member, { amount:info.amount, method:info.method, chargeItem:info.chargeItem, paidDate:info.date }).member;
    setSel(nm);
    setToast(`${member.name} 수납 완료 · 잔액 ${won(info.after)}`);
    setTimeout(()=>setToast(null), 2600);
  };

  if (locked) return <PinLock onUnlock={()=>setLocked(false)} />;
  const cur = sel && members.find(m=>m.id===sel.id);
  return (
    <>
      {cur ? <MobileDetail member={cur} onBack={()=>setSel(null)} onPay={pay} />
           : <MobileList members={members} onSelect={setSel} />}
      {toast && <div style={{ position:"fixed", bottom:84, left:"50%", transform:"translateX(-50%)", zIndex:80, padding:"12px 20px", background:"var(--ink-950)", color:"#fff", borderRadius:"var(--radius-pill)", font:"var(--fw-medium) 14px/1 var(--font-sans)", boxShadow:"var(--shadow-lg)", whiteSpace:"nowrap" }}>{toast}</div>}
    </>
  );
}

window.MobileApp = MobileApp;
