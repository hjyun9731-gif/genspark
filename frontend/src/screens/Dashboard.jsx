import React, { useMemo } from 'react'
import { Card, PageHead, formatWon, formatNum } from '../components.jsx'

function accountBuckets(members){
  return members.reduce((acc, m) => {
    const key = m.chargeItem || '기타'
    acc[key] = (acc[key] || 0) + (Number(m.totalArrears) || 0)
    return acc
  }, {})
}
function monthBuckets(members){
  const buckets = [
    { key:'1-3개월', min:1, max:3, tone:'blue' },
    { key:'4-6개월', min:4, max:6, tone:'mint' },
    { key:'7-12개월', min:7, max:12, tone:'orange' },
    { key:'12개월 이상', min:13, max:9999, tone:'red' },
  ]
  return buckets.map(bucket => {
    const rows = members.filter(m => {
      const months = Number(m.arrearsMonths) || (Number(m.totalArrears) > 0 ? 1 : 0)
      return months >= bucket.min && months <= bucket.max
    })
    return { ...bucket, count: rows.length, amount: rows.reduce((sum,m)=>sum+(Number(m.totalArrears)||0),0) }
  })
}
function memberTypeRatio(members){
  const total = Math.max(1, members.length)
  const personal = members.filter(m=>m.memberType==='개인').length
  const delivery = members.filter(m=>m.memberType==='택배').length
  return { personal, delivery, personalPct: Math.round(personal/total*100), deliveryPct: Math.round(delivery/total*100) }
}
function membershipRatio(members){
  const total = Math.max(1, members.length)
  const joined = members.filter(m=>m.membership==='협회가입').length
  const notJoined = members.filter(m=>m.membership!=='협회가입').length
  return { joined, notJoined, joinedPct: Math.round(joined/total*100), notJoinedPct: Math.round(notJoined/total*100) }
}

export default function Dashboard({data, summary, navigate}){
  const activeMembers = useMemo(()=>data.members.filter(m=>m.status==='정상'), [data.members])
  const arrearsMembers = useMemo(()=>activeMembers.filter(m=>(Number(m.totalArrears)||0)>0), [activeMembers])
  const localBySigun = useMemo(() => Object.entries(
    arrearsMembers.reduce((acc,m)=>{acc[m.sigun || '미분류']=(acc[m.sigun || '미분류']||0)+(Number(m.totalArrears)||0);return acc},{})
  ).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([sigun,total])=>({sigun,total})), [arrearsMembers])
  const bySigun = (data.bySigun && data.bySigun.length ? data.bySigun : localBySigun).slice(0,8)
  const maxRegion = Math.max(1, ...bySigun.map(r=>Number(r.total ?? r.amount ?? 0)))
  const accounts = accountBuckets(arrearsMembers)
  const accountTotal = Math.max(1, Object.values(accounts).reduce((s,v)=>s+v,0))
  const monthStats = monthBuckets(arrearsMembers)
  const typeRatio = memberTypeRatio(activeMembers)
  const joinRatio = membershipRatio(activeMembers)
  const bankNeeds = data.deposits.filter(d=>!['매칭완료','제외'].includes(d.status)).length
  const unmatchedDeposits = data.deposits.filter(d=>['미매칭','후보확인','중복후보'].includes(d.status)).length
  const closureDebt = data.closures.filter(c=>(Number(c.arrearsAmount ?? c.amount ?? c.unpaidAmount)||0)>0).length
  const pendingNeed = data.pending.filter(p=>p.status!=='전환완료').length

  const kpis = [
    { label:'총 회원수', value:formatNum(summary.totalMembers), note:`정상 ${formatNum(summary.activeMembers)}명`, tone:'indigo', icon:'회원', onClick:()=>navigate('list', { amount:'전체' }) },
    { label:'미수 인원', value:formatNum(summary.arrearsCount), note:'미수금명단 바로가기', tone:'violet', icon:'미수', onClick:()=>navigate('list', { amount:'미수있음' }) },
    { label:'총 미수금액', value:formatWon(summary.totalArrears), note:'정상 회원 기준', tone:'red', icon:'금액', onClick:()=>navigate('list', { amount:'미수있음' }) },
    { label:'이번달 수납액', value:formatWon(summary.thisMonthPayments), note:'수납내역 기준', tone:'mint', icon:'수납', onClick:()=>navigate('payments') },
  ]

  return <div className="dashboard-modern">
    <PageHead title="대시보드" desc="실제 DB 기준으로 미수 현황과 오늘 처리할 업무를 한눈에 확인합니다." />

    <div className="kpi-grid">
      {kpis.map(card => <button key={card.label} className={`kpi-card ${card.tone}`} onClick={card.onClick}>
        <div className="kpi-icon">{card.icon}</div>
        <div className="kpi-label">{card.label}</div>
        <div className="kpi-value">{card.value}</div>
        <div className="kpi-note">{card.note}</div>
      </button>)}
    </div>

    <div className="dashboard-grid-main">
      <Card className="dash-card region-card">
        <div className="dash-card-head"><h3>지역별 미수금 TOP</h3><button className="mini-link" onClick={()=>navigate('list', { amount:'미수있음' })}>전체보기</button></div>
        <div className="region-list">
          {bySigun.length ? bySigun.map((row, idx) => {
            const sigun = row.sigun || row.region || '미분류'
            const amount = Number(row.total ?? row.amount ?? 0)
            return <button key={sigun} className="region-row" onClick={()=>navigate('list', { amount:'미수있음', sigun })}>
              <span className="rank">{idx+1}</span><b>{sigun}</b>
              <div className="bar"><i style={{width:`${Math.max(7, amount / maxRegion * 100)}%`}}/></div>
              <strong>{formatWon(amount)}</strong>
            </button>
          }) : <div className="dash-empty">미수금 데이터가 없습니다.</div>}
        </div>
      </Card>

      <Card className="dash-card account-card">
        <div className="dash-card-head"><h3>계정별 미수금</h3><span>{formatWon(accountTotal === 1 ? 0 : accountTotal)}</span></div>
        <div className="account-list">
          {Object.entries(accounts).map(([name, amount]) => <button key={name} className="account-row" onClick={()=>navigate('list', { amount:'미수있음' })}>
            <span className={name==='협회비'?'dot indigo':'dot mint'} />
            <b>{name}</b>
            <strong>{formatWon(amount)}</strong>
            <em>{Math.round(amount / accountTotal * 100)}%</em>
          </button>)}
          {!Object.keys(accounts).length && <div className="dash-empty">계정별 미수금이 없습니다.</div>}
        </div>
        <div className="stack-bar">
          <i className="indigo" style={{width:`${Math.round((accounts['협회비']||0)/accountTotal*100)}%`}} />
          <i className="mint" style={{width:`${Math.round((accounts['관리비']||0)/accountTotal*100)}%`}} />
        </div>
      </Card>

      <Card className="dash-card month-card">
        <div className="dash-card-head"><h3>미수개월수별 현황</h3></div>
        <div className="month-grid">
          {monthStats.map(row => <button key={row.key} className={`month-box ${row.tone}`} onClick={()=>navigate('list', { amount:'미수있음', special: row.key==='12개월 이상' ? '장기' : '' })}>
            <span>{row.key}</span>
            <strong>{formatNum(row.count)}</strong>
            <em>{formatWon(row.amount)}</em>
          </button>)}
        </div>
      </Card>
    </div>

    <div className="dashboard-grid-sub">
      <Card className="dash-card work-card">
        <div className="dash-card-head"><h3>처리 대기 현황</h3><span>바로 처리할 업무</span></div>
        <div className="work-list">
          <button onClick={()=>navigate('bank')}><b>통장매칭 확인 필요</b><strong>{formatNum(bankNeeds)}건</strong><span>입금건 매칭/수납 처리</span></button>
          <button onClick={()=>navigate('bank')}><b>미매칭 입금</b><strong>{formatNum(unmatchedDeposits)}건</strong><span>수동 검색 필요</span></button>
          <button onClick={()=>navigate('closure')}><b>폐업 후 미납 잔액</b><strong>{formatNum(closureDebt)}건</strong><span>추후 안내 대상</span></button>
          <button onClick={()=>navigate('pending')}><b>예정자 전환 필요</b><strong>{formatNum(pendingNeed)}건</strong><span>전체자명단 전환 대기</span></button>
        </div>
      </Card>

      <Card className="dash-card quick-card">
        <div className="dash-card-head"><h3>빠른 이동</h3><span>자주 쓰는 업무</span></div>
        <div className="quick-grid">
          <button onClick={()=>navigate('list', { amount:'미수있음' })}>미수금명단</button>
          <button onClick={()=>navigate('bank')}>통장매칭</button>
          <button onClick={()=>navigate('closure')}>폐업현황</button>
          <button onClick={()=>navigate('pending')}>예정자 전환</button>
          <button onClick={()=>navigate('payments')}>수납내역</button>
          <button onClick={()=>navigate('import')}>엑셀 업로드</button>
        </div>
      </Card>
    </div>

    <div className="dashboard-grid-sub bottom-info">
      <Card className="dash-card ratio-card">
        <div className="dash-card-head"><h3>개인/택배 비율</h3></div>
        <div className="ratio-line"><b>개인</b><span>{formatNum(typeRatio.personal)}명</span><div><i style={{width:`${typeRatio.personalPct}%`}} /></div><em>{typeRatio.personalPct}%</em></div>
        <div className="ratio-line"><b>택배</b><span>{formatNum(typeRatio.delivery)}명</span><div><i className="mint" style={{width:`${typeRatio.deliveryPct}%`}} /></div><em>{typeRatio.deliveryPct}%</em></div>
      </Card>
      <Card className="dash-card ratio-card">
        <div className="dash-card-head"><h3>가입/미가입 비율</h3></div>
        <div className="ratio-line"><b>협회가입</b><span>{formatNum(joinRatio.joined)}명</span><div><i style={{width:`${joinRatio.joinedPct}%`}} /></div><em>{joinRatio.joinedPct}%</em></div>
        <div className="ratio-line"><b>협회미가입</b><span>{formatNum(joinRatio.notJoined)}명</span><div><i className="orange" style={{width:`${joinRatio.notJoinedPct}%`}} /></div><em>{joinRatio.notJoinedPct}%</em></div>
      </Card>
    </div>
  </div>
}
