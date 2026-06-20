import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import './mobile.css'

function won(n){ return (Number(n)||0).toLocaleString('ko-KR') + '원' }
function num(n){ return (Number(n)||0).toLocaleString('ko-KR') }
function text(v){ return String(v ?? '').trim() }
function clean(v){ return text(v).replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase() }
function digits(v){ return text(v).replace(/\D/g,'') }
function getName(m){ return text(m.name || m.memberName || '-') }
function getVehicle(m){ return text(m.vehicleNo || m.vehicle_no || '-') }
function getRegion(m){ return text(m.sigun || m.region || m.regionRaw || m.region_raw || '-') }
function getPhone(m){ return text(m.phone || m.mobile || '-') }
function getItem(m){ return text(m.chargeItem || m.charge_item || (m.membership === '협회가입' ? '협회비' : '관리비')) }
function monthly(m){ return Number(m.monthlyCharge ?? m.monthly_charge) || (getItem(m) === '협회비' ? 10000 : 5000) }
function safeAmount(m, value){
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  // 음수는 선납/초과금으로 그대로 보여준다.
  if (n < 0) return n
  if (n === 0) return 0
  const mo = monthly(m) || 5000
  const months = Math.ceil(n / mo)
  // 모바일에서는 120개월 초과 금액은 기존 자동계산 오류로 보고 제외한다.
  // 실제 장기미수는 데스크톱에서 확인하고, 모바일은 현장 확인용으로 안전하게 보여준다.
  if (months > 120) return 0
  return n
}
function balance(m){
  const keys = ['currentBalance','current_balance','currentAmount','current_amount','arrears_amount','balance','totalArrears','total_arrears']
  for (const k of keys) {
    if (m[k] !== undefined && m[k] !== null) {
      const n = safeAmount(m, m[k])
      if (n !== 0 || Number(m[k]) === 0) return n
    }
  }
  const arr = Array.isArray(m.arrears) ? m.arrears : []
  const open = arr.filter(a => !a.paid && !a.is_paid)
  if (open.length) return safeAmount(m, open.reduce((s,a)=>s+(Number(a.amount)||0),0))
  return 0
}
function months(m){
  const b = balance(m)
  if (b <= 0) return 0
  const byAmount = Math.ceil(b / (monthly(m) || 5000))
  const apiMonths = Number(m.arrearsMonths ?? m.arrears_months)
  if (Number.isFinite(apiMonths) && apiMonths > 0 && apiMonths <= 120) return apiMonths
  return byAmount <= 120 ? byAmount : 0
}
function address(m){
  const memo = text(m.memo)
  const found = memo.split(/\s*\/\s*/).find(x => x.startsWith('주소:'))
  return found ? found.slice(3).trim() : text(m.address || m.regionRaw || m.region_raw || '-')
}
function initial(v){ return getName(v).slice(0,1) || '회' }

export default function MobileStandalone(){
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('amount')
  const [selected, setSelected] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)

  async function load(){
    setLoading(true); setError('')
    try{
      const rows = await api.listMembers({size: 10000})
      setMembers(Array.isArray(rows) ? rows : [])
    }catch(e){
      setError(e.message || '데이터를 불러오지 못했습니다')
      setMembers([])
    }finally{ setLoading(false) }
  }
  useEffect(()=>{ load() }, [])

  const rows = useMemo(()=>{
    const query = clean(q)
    let list = members.filter(m => text(m.status || '정상') === '정상')
    if (query) {
      list = list.filter(m => [getName(m), getVehicle(m), getPhone(m), getRegion(m), address(m), m.mgmtNo, m.mgmt_no].some(v => clean(v).includes(query) || digits(v).includes(query)))
    } else {
      // 모바일 기본 화면은 실제 미수 있는 사람만. 단 과대계산값은 balance()에서 0 처리한다.
      list = list.filter(m => balance(m) > 0)
    }
    list = list.map(m => ({...m, _balance: balance(m), _months: months(m)}))
    if (!query) list = list.filter(m => m._balance > 0)
    list.sort((a,b)=>{
      if (sort === 'name') return getName(a).localeCompare(getName(b),'ko')
      if (sort === 'months') return (b._months||0) - (a._months||0)
      return (b._balance||0) - (a._balance||0)
    })
    return list
  }, [members, q, sort])

  const total = rows.reduce((s,m)=>s+(m._balance>0?m._balance:0),0)

  async function pay(){
    if (!selected) return
    const amount = Number(String(payAmount).replace(/[^0-9-]/g,''))
    if (!amount) return alert('금액을 입력하세요')
    try{
      setPaying(true)
      await api.applyPayment(selected.id, { amount, method:'모바일수납', charge_item:getItem(selected) })
      await load()
      setSelected(null); setPayAmount('')
    }catch(e){ alert(e.message || '수납 반영 실패') }
    finally{ setPaying(false) }
  }

  return <div className="mapp">
    <header className="mhead">
      <div><h1>미수금명단</h1><p>강원 개인소형화물협회</p></div>
      <button className="micon" onClick={load} title="새로고침">↻</button>
    </header>

    <main className="mbody">
      <div className="msearch"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="이름 · 차량번호 · 연락처 · 지역 검색" /></div>
      <div className="mstats">
        <div><span>{q ? '검색 결과' : '미수 인원'}</span><strong>{num(rows.length)}명</strong></div>
        <div><span>총 미납액</span><strong className="danger">{won(total)}</strong></div>
      </div>
      <div className="msorts">
        <button className={sort==='amount'?'on':''} onClick={()=>setSort('amount')}>미납액순</button>
        <button className={sort==='months'?'on':''} onClick={()=>setSort('months')}>미수개월순</button>
        <button className={sort==='name'?'on':''} onClick={()=>setSort('name')}>이름순</button>
      </div>
      {loading && <p className="mempty">불러오는 중...</p>}
      {error && <p className="mempty">{error}</p>}
      {!loading && !error && <>
        <p className="mcount">총 {num(rows.length)}명</p>
        <div className="mlist">
          {rows.slice(0,300).map(m => <button className="mcard" key={m.id || `${getName(m)}-${getVehicle(m)}`} onClick={()=>{setSelected(m); setPayAmount(String(Math.max(0,m._balance || 0)))}}>
            <div className="avatar">{initial(m)}</div>
            <div className="minfo">
              <div className="line1"><b>{getName(m)}</b><span>{getVehicle(m)}</span></div>
              <div className="line2"><em>{getItem(m)}</em><span>{getRegion(m)}</span></div>
            </div>
            <div className="mamount"><strong>{won(m._balance)}</strong><span>{num(m._months)}개월</span></div>
          </button>)}
          {!rows.length && <p className="mempty">표시할 회원이 없습니다.</p>}
        </div>
      </>}
    </main>

    <footer className="mbottom">
      <button className="on"><b>☷</b><span>미수금명단</span></button>
      <button onClick={load}><b>↻</b><span>새로고침</span></button>
    </footer>

    {selected && <div className="msheet-bg" onClick={()=>setSelected(null)}>
      <section className="msheet" onClick={e=>e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head"><div><h2>{getName(selected)}</h2><p>{getRegion(selected)} · {getVehicle(selected)}</p></div><button onClick={()=>setSelected(null)}>닫기</button></div>
        <div className="sheet-grid">
          <div><span>현재잔액</span><b className="danger">{won(balance(selected))}</b></div>
          <div><span>미수개월</span><b>{num(months(selected))}개월</b></div>
          <div><span>계정</span><b>{getItem(selected)}</b></div>
          <div><span>연락처</span><b>{getPhone(selected)}</b></div>
          <div className="wide"><span>주소</span><b>{address(selected)}</b></div>
        </div>
        <div className="paybox">
          <label>수납 금액</label>
          <input value={payAmount} onChange={e=>setPayAmount(e.target.value)} inputMode="numeric" />
          <button onClick={pay} disabled={paying}>{paying ? '처리 중...' : '수납 반영'}</button>
        </div>
      </section>
    </div>}
  </div>
}
