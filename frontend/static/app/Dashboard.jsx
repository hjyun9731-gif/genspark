// 대시보드 — 전체 미수 현황 한눈에 (Genspark 집계 통일: 미수개월수별/계정별/처리대기/비율)
const { Card, Icon } = window.PayroleDesignSystem_9db006;

function Metric({ icon, tint, label, value, unit, sub, accent, onClick, isMobile }){
  const [hover,setHover]=React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)",
        padding: isMobile ? "12px 14px" : "18px 20px",
        cursor:onClick?"pointer":"default", boxShadow: hover&&onClick ? "var(--shadow-md)" : "var(--shadow-xs)",
        transform: hover&&onClick ? "translateY(-2px)":"none", transition:"all .15s ease",
        minWidth:0, boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ width: isMobile?28:34, height: isMobile?28:34, borderRadius:9, background:tint||"var(--brand-subtle)", display:"inline-flex", alignItems:"center", justifyContent:"center", flex:"none" }}>
          <Icon name={icon} size={isMobile?15:18} color={accent||"var(--brand)"} /></span>
        {onClick && !isMobile && <Icon name="chevron-right" size={14} style={{ color:"var(--text-tertiary)" }} />}
      </div>
      <div style={{ font:`var(--fw-medium) ${isMobile?"11":"13"}px/1.4 var(--font-sans)`, color:"var(--text-secondary)", marginTop: isMobile?8:14 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:3, marginTop:3, flexWrap:"wrap" }}>
        <span style={{ font:`var(--fw-bold) ${isMobile?"18":"26"}px/1.15 var(--font-sans)`, color:"var(--text-primary)", letterSpacing:"-0.02em", wordBreak:"keep-all" }}>{value}</span>
        {unit && <span style={{ font:`var(--fw-medium) ${isMobile?"12":"14"}px/1 var(--font-sans)`, color:"var(--text-tertiary)" }}>{unit}</span>}
      </div>
      {sub && !isMobile && <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:6 }}>{sub}</div>}
    </div>
  );
}

function Dashboard({ agg, members, deposits, closures, onDrill, onNav, year, month }){
  const D = window.PMData; const { won, wonShort, num } = D;
  const isMobile = window.useMobile ? window.useMobile() : false;
  const maxRegion = Math.max(...agg.regionTop.map(r=>r.amt), 1);
  const collectRate = agg.thisMonthCharge ? Math.round(agg.thisMonthCollected/agg.thisMonthCharge*100) : 0;

  // 최근 수납
  const recent = [];
  members.forEach(m=> (m.payments||[]).forEach(p=> { if(String(p.paidDate||"").startsWith("2026")) recent.push({ ...p, name:m.name, sigun:m.sigun }); }));
  recent.sort((a,b)=>(b.paidDate||"").localeCompare(a.paidDate||"")); const recent5 = recent.slice(0,5);

  // 처리대기
  const bankNeeds = deposits.filter(d=>!["매칭완료","제외"].includes(d.status)).length;
  const bankUnmatched = deposits.filter(d=>d.status==="미매칭").length;
  const closureDebt = closures.filter(c=>c.unpaidBalance>0).length;

  const accountTotal = Math.max(1, Object.values(agg.byAccount).reduce((s,v)=>s+v,0));
  const activeTotal = Math.max(1, agg.activeMembers);
  const pct = (n)=>Math.round(n/activeTotal*100);

  if (isMobile) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14, width:"100%", boxSizing:"border-box" }}>
        {/* 모바일 KPI — 2열 grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:10 }}>
          <Metric icon="user" label="전체 회원" value={num(agg.totalMembers)} unit="명" onClick={()=>onDrill({ amount:"전체", status:"전체" })} isMobile />
          <Metric icon="warning" tint="var(--red-50)" accent="var(--red-500)" label="미수 인원" value={num(agg.overdueCount)} unit="명" onClick={()=>onDrill({ amount:"미수있음" })} isMobile />
          <Metric icon="coin" tint="#EFEEFD" accent="var(--violet-500)" label="선납자" value={agg.prepaid} unit="명" onClick={()=>onDrill({ amount:"선납" })} isMobile />
          <Metric icon="statistics" label="수납률" value={collectRate} unit="%" isMobile />
          <Metric icon="target" tint="var(--red-50)" accent="var(--red-500)" label="30만원↑ 고액" value={agg.highValue} unit="명" onClick={()=>onDrill({ amount:"30만원이상" })} isMobile />
          <Metric icon="calendar" tint="#FFF3DC" accent="#B9791A" label="12개월↑ 장기" value={agg.longOverdue} unit="명" onClick={()=>onDrill({ amount:"미수있음", special:"장기" })} isMobile />
        </div>
        {/* 총 미수금 — 전폭 카드 */}
        <div style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"14px 16px", boxSizing:"border-box", boxShadow:"var(--shadow-xs)" }}>
          <div style={{ font:"var(--fw-medium) 11px/1.4 var(--font-sans)", color:"var(--text-secondary)" }}>총 미수금 ({year}년 {month}월 기준)</div>
          <div style={{ font:"var(--fw-bold) 22px/1.15 var(--font-sans)", color:"var(--red-500)", letterSpacing:"-0.02em", marginTop:4, wordBreak:"keep-all" }}>{won(agg.totalOutstanding)}</div>
        </div>

        {/* 지역별 TOP — 모바일 컴팩트 */}
        <Card>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>지역별 미수금 TOP</div>
            <button type="button" onClick={()=>onDrill({ amount:"미수있음" })} style={{ border:"none", background:"none", cursor:"pointer", color:"var(--brand)", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>전체보기 →</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {agg.regionTop.slice(0,5).map((r,i)=>(
              <div key={r.region} onClick={()=>onDrill({ region:r.region, amount:"미수있음" })} style={{ cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-primary)", display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ width:16, color:"var(--text-tertiary)", fontWeight:600, fontSize:11 }}>{i+1}</span>
                    <span>{r.region}</span>
                    <span style={{ color:"var(--text-tertiary)", fontWeight:400, fontSize:10 }}>{r.count}명</span>
                  </span>
                  <span style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-primary)", wordBreak:"keep-all" }}>{won(r.amt)}</span>
                </div>
                <div style={{ height:5, background:"var(--grey-50)", borderRadius:"var(--radius-pill)", overflow:"hidden" }}>
                  <div style={{ width:`${Math.max(r.amt/maxRegion*100,4)}%`, height:"100%", background:"var(--brand)" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 미수개월수별 */}
        <Card>
          <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:12 }}>미수개월수별</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:8 }}>
            {agg.buckets.map(b=>{
              const tone = b.key==="12개월 이상" ? {bg:"var(--red-50)",fg:"var(--red-500)"} : b.key==="7-12개월" ? {bg:"#FFF3DC",fg:"#B9791A"} : b.key==="4-6개월" ? {bg:"#EAF3FF",fg:"var(--blue-600)"} : {bg:"var(--grey-25)",fg:"var(--text-secondary)"};
              return (
                <button key={b.key} type="button" onClick={()=>onDrill({ amount:"미수있음", special: b.key==="12개월 이상"?"장기":"" })}
                  style={{ textAlign:"left", padding:"10px 12px", borderRadius:"var(--radius-md)", border:"none", cursor:"pointer", background:tone.bg, minWidth:0, boxSizing:"border-box" }}>
                  <div style={{ font:"var(--fw-medium) 11px/1 var(--font-sans)", color:tone.fg }}>{b.key}</div>
                  <div style={{ font:"var(--fw-bold) 18px/1.1 var(--font-sans)", color:"var(--text-primary)", marginTop:5 }}>{b.count}<span style={{ fontSize:11, fontWeight:500, color:"var(--text-tertiary)" }}>명</span></div>
                  <div style={{ font:"10px/1.4 var(--font-sans)", color:"var(--text-tertiary)", marginTop:2, wordBreak:"keep-all" }}>{won(b.amount)}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 처리 대기 */}
        <Card>
          <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:10 }}>처리 대기</div>
          {[["통장매칭 확인",bankNeeds,"건",()=>onNav("bank")],
            ["미매칭 입금",bankUnmatched,"건",()=>onNav("bank")],
            ["폐업 미납잔액",closureDebt,"건",()=>onNav("closure")]].map(([l,v,u,fn])=>(
            <button key={l} type="button" onClick={fn} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"11px 0", border:"none", borderBottom:"1px solid var(--border-subtle)", background:"none", cursor:"pointer", textAlign:"left", boxSizing:"border-box" }}>
              <div style={{ flex:1, font:"var(--fw-medium) 13px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{l}</div>
              <span style={{ font:"var(--fw-bold) 16px/1 var(--font-sans)", color: v>0?"var(--brand)":"var(--text-tertiary)" }}>{v}<span style={{ fontSize:11, fontWeight:500, color:"var(--text-tertiary)" }}>{u}</span></span>
              <Icon name="chevron-right" size={13} style={{ color:"var(--text-tertiary)", flex:"none" }} />
            </button>
          ))}
        </Card>

        {/* 최근 수납 */}
        <Card>
          <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:8 }}>최근 수납</div>
          {recent5.map((t,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom: i<recent5.length-1?"1px solid var(--border-subtle)":"none" }}>
              <span style={{ width:30, height:30, borderRadius:8, flex:"none", background:"var(--green-50)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}><Icon name="income" size={13} color="var(--green-500)" /></span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ font:"var(--fw-demibold) 13px/1.3 var(--font-sans)", color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</div>
                <div style={{ font:"10px/1.4 var(--font-sans)", color:"var(--text-tertiary)" }}>{t.sigun} · {t.paidDate}</div>
              </div>
              <div style={{ font:"var(--fw-demibold) 12px/1.3 var(--font-sans)", color:"var(--green-500)", flex:"none", wordBreak:"keep-all" }}>+{won(t.amount)}</div>
            </div>
          ))}
          {recent5.length===0 && <div style={{ padding:"16px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>수납 내역 없음</div>}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16 }}>
        <Metric icon="user" label="전체 회원" value={num(agg.totalMembers)} unit="명" sub={`정상 회원 ${agg.activeMembers}명`} onClick={()=>onDrill({ amount:"전체", status:"전체" })} />
        <Metric icon="warning" tint="var(--red-50)" accent="var(--red-500)" label="현재 미수 인원" value={num(agg.overdueCount)} unit="명" sub="미수금 명단 바로가기" onClick={()=>onDrill({ amount:"미수있음" })} />
        <Metric icon="dollar" tint="var(--red-50)" accent="var(--red-500)" label="총 미수금" value={won(agg.totalOutstanding)} sub={`${year}년 ${month}월 기준`} onClick={()=>onDrill({ amount:"미수있음" })} />
        <Metric icon="statistics" label="이번 달 수납률" value={collectRate} unit="%" sub={`수납 ${wonShort(agg.thisMonthCollected)}원 / 부과 ${wonShort(agg.thisMonthCharge)}원`} />

        <Metric icon="coin" tint="#EFEEFD" accent="var(--violet-500)" label="선납자" value={agg.prepaid} unit="명" onClick={()=>onDrill({ amount:"선납" })} />
        <Metric icon="target" tint="var(--red-50)" accent="var(--red-500)" label="30만원 이상 고액" value={agg.highValue} unit="명" onClick={()=>onDrill({ amount:"30만원이상" })} />
        <Metric icon="calendar" tint="#FFF3DC" accent="#B9791A" label="12개월 이상 장기" value={agg.longOverdue} unit="명" onClick={()=>onDrill({ amount:"미수있음", special:"장기" })} />
        <Metric icon="profile" tint="var(--green-50)" accent="var(--green-500)" label="70세 이상 대상" value={agg.seniors} unit="명" onClick={()=>onDrill({ amount:"전체", special:"70세" })} />
      </div>

      {/* 지역별 / 계정별 / 미수개월수별 */}
      <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1fr 1fr", gap:20, alignItems:"start" }}>
        <Card>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>지역별 미수금 TOP</div>
            <button type="button" onClick={()=>onDrill({ amount:"미수있음" })} style={{ border:"none", background:"none", cursor:"pointer", color:"var(--brand)", font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>전체보기 →</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {agg.regionTop.map((r,i)=>(
              <div key={r.region} onClick={()=>onDrill({ region:r.region, amount:"미수있음" })} style={{ cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
                  <span style={{ font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>
                    <span style={{ display:"inline-block", width:16, color:"var(--text-tertiary)", fontWeight:600 }}>{i+1}</span>{r.region} <span style={{ color:"var(--text-tertiary)", fontWeight:400, fontSize:11 }}>· {r.count}명</span></span>
                  <span style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{won(r.amt)}</span>
                </div>
                <div style={{ height:7, background:"var(--grey-50)", borderRadius:"var(--radius-pill)", overflow:"hidden" }}>
                  <div style={{ width:`${Math.max(r.amt/maxRegion*100,4)}%`, height:"100%", background:"var(--brand)", borderRadius:"var(--radius-pill)" }} /></div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:16 }}>계정별 미수금</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {Object.entries(agg.byAccount).map(([name,amt])=>(
              <div key={name} onClick={()=>onDrill({ amount:"미수있음" })} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background: name==="협회비"?"var(--brand)":"#F5A623" }} />
                <b style={{ flex:1, font:"var(--fw-medium) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>{name}</b>
                <span style={{ font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>{won(amt)}</span>
                <em style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", fontStyle:"normal", width:34, textAlign:"right" }}>{Math.round(amt/accountTotal*100)}%</em>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", height:10, borderRadius:"var(--radius-pill)", overflow:"hidden", marginTop:18, background:"var(--grey-50)" }}>
            <div style={{ width:`${(agg.byAccount["협회비"]||0)/accountTotal*100}%`, background:"var(--brand)" }} />
            <div style={{ width:`${(agg.byAccount["관리비"]||0)/accountTotal*100}%`, background:"#F5A623" }} />
          </div>
        </Card>

        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:16 }}>미수개월수별 현황</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {agg.buckets.map(b=>{
              const tone = b.key==="12개월 이상" ? {bg:"var(--red-50)",fg:"var(--red-500)"} : b.key==="7-12개월" ? {bg:"#FFF3DC",fg:"#B9791A"} : b.key==="4-6개월" ? {bg:"#EAF3FF",fg:"var(--blue-600)"} : {bg:"var(--grey-25)",fg:"var(--text-secondary)"};
              return (
                <button key={b.key} type="button" onClick={()=>onDrill({ amount:"미수있음", special: b.key==="12개월 이상"?"장기":"" })}
                  style={{ textAlign:"left", padding:"12px 14px", borderRadius:"var(--radius-md)", border:"none", cursor:"pointer", background:tone.bg }}>
                  <div style={{ font:"var(--fw-medium) 12px/1 var(--font-sans)", color:tone.fg }}>{b.key}</div>
                  <div style={{ font:"var(--fw-bold) 20px/1.1 var(--font-sans)", color:"var(--text-primary)", marginTop:6 }}>{b.count}<span style={{ fontSize:12, fontWeight:500, color:"var(--text-tertiary)" }}>명</span></div>
                  <div style={{ font:"10px/1.4 var(--font-sans)", color:"var(--text-tertiary)", marginTop:2 }}>{won(b.amount)}</div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 처리대기 / 최근수납 / 비율 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:20, alignItems:"start" }}>
        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:6 }}>처리 대기 현황</div>
          <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginBottom:12 }}>바로 처리할 업무</div>
          {[["통장매칭 확인 필요",bankNeeds,"건","입금건 매칭/수납",()=>onNav("bank")],
            ["미매칭 입금",bankUnmatched,"건","수동 검색 필요",()=>onNav("bank")],
            ["폐업 후 미납 잔액",closureDebt,"건","추후 안내 대상",()=>onNav("closure")]].map(([l,v,u,s,fn])=>(
            <button key={l} type="button" onClick={fn} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 0", border:"none", borderBottom:"1px solid var(--border-subtle)", background:"none", cursor:"pointer", textAlign:"left" }}>
              <div style={{ flex:1 }}>
                <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{l}</div>
                <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:2 }}>{s}</div>
              </div>
              <span style={{ font:"var(--fw-bold) 18px/1 var(--font-sans)", color: v>0?"var(--brand)":"var(--text-tertiary)" }}>{v}<span style={{ fontSize:12, fontWeight:500, color:"var(--text-tertiary)" }}>{u}</span></span>
              <Icon name="chevron-right" size={14} style={{ color:"var(--text-tertiary)" }} />
            </button>
          ))}
        </Card>

        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:8 }}>최근 수납 내역</div>
          <div style={{ display:"flex", flexDirection:"column" }}>
            {recent5.map((t,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderBottom: i<recent5.length-1?"1px solid var(--border-subtle)":"none" }}>
                <span style={{ width:34, height:34, borderRadius:9, flex:"none", background:"var(--green-50)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}><Icon name="income" size={15} color="var(--green-500)" /></span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ font:"var(--fw-demibold) 13px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{t.name}</div>
                  <div style={{ font:"10px/1.4 var(--font-sans)", color:"var(--text-tertiary)" }}>{t.sigun} · {t.method} · {t.paidDate}</div>
                </div>
                <div style={{ font:"var(--fw-demibold) 13px/1.3 var(--font-sans)", color:"var(--green-500)" }}>+{won(t.amount)}</div>
              </div>
            ))}
            {recent5.length===0 && <div style={{ padding:"20px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>최근 수납 내역이 없습니다.</div>}
          </div>
        </Card>

        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:16 }}>회원 구성 비율</div>
          {[["개인",agg.personal,"var(--brand)"],["택배",agg.delivery,"#F5A623"]].map(([l,v,c])=>(
            <div key={l} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}><span style={{ font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{l} <span style={{ color:"var(--text-tertiary)", fontWeight:400 }}>{v}명</span></span><span style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:c }}>{pct(v)}%</span></div>
              <div style={{ height:7, background:"var(--grey-50)", borderRadius:"var(--radius-pill)", overflow:"hidden" }}><div style={{ width:`${pct(v)}%`, height:"100%", background:c }} /></div>
            </div>
          ))}
          <div style={{ height:1, background:"var(--border-subtle)", margin:"4px 0 14px" }} />
          {[["협회가입",agg.joined,"var(--green-500)"],["협회미가입",agg.notJoined,"var(--grey-300)"]].map(([l,v,c])=>(
            <div key={l} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}><span style={{ font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{l} <span style={{ color:"var(--text-tertiary)", fontWeight:400 }}>{v}명</span></span><span style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:c }}>{pct(v)}%</span></div>
              <div style={{ height:7, background:"var(--grey-50)", borderRadius:"var(--radius-pill)", overflow:"hidden" }}><div style={{ width:`${pct(v)}%`, height:"100%", background:c }} /></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
