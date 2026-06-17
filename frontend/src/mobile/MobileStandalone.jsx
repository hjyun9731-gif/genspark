import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import '../styles.css'
import './mobile.css'

function won(n){ return (Number(n)||0).toLocaleString('ko-KR') + '원' }
function num(n){ return (Number(n)||0).toLocaleString('ko-KR') }
function text(v){ return String(v ?? '').trim() }
function norm(v){ return text(v).replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase() }
function getBalance(m){
  const direct = [m.currentBalance, m.current_balance, m.totalArrears, m.arrears_amount, m.balance]
    .map(v => Number(v)).find(v => Number.isFinite(v))
  if (Number.isFinite(direct)) return direct
  const arr = Array.isArray(m.arrears) ? m.arrears : []
  return arr.filter(a => !a.paid && !a.is_paid).reduce((s,a)=>s+(Number(a.amount)||0),0)
}
function getMonthly(m){ return Number(m.monthlyCharge ?? m.monthly_charge) || (m.chargeItem === '협회비' || m.charge_item === '협회비' ? 10000 : 5000) }
function getMonths(m){
  const balance = getBalance(m)
  if (balance <= 0) return 0
  const apiMonths = Number(m.arrearsMonths ?? m.arrears_months)
  const monthly = getMonthly(m)
  const byAmount = monthly > 0 ? Math.ceil(balance / monthly) : 0
  if (Number.isFinite(apiMonths) && apiMonths > 0 && apiMonths <= 120) return apiMonths
  return byAmount
}
function sigun(m){ return text(m.sigun || m.region || m.regionRaw || m.region_raw || '-') }
function vehicle(m){ return text(m.vehicleNo || m.vehicle_no || '-') }
function phone(m){ return text(m.phone || '-') }
function item(m){ return text(m.chargeItem || m.charge_item || (m.membership === '협회가입' ? '협회비' : '관리비')) }
function basis(m){
  const val = item(m) === '협회비' ? (m.assocJoinDate || m.assoc_join_date) : (m.certIssueDate || m.cert_issue_date)
  return text(val || m.billingStartYm || m.billing_start_ym || '-')
}
function address(m){
  const memo = text(m.memo)
  const found = memo.split(/\s*\/\s*/).find(x => x.startsWith('주소:'))
  return found ? found.slice(3).trim() : text(m.regionRaw || m.region_raw || '-')
}

export default function MobileStandalone(){
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('amount')
  const [selected, setSelected] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  async function load(){
    setLoading(true); setError('')
    try{
      const rows = await api.listMembers({ size: 10000 })
      setMembers(Array.isArray(rows) ? rows : [])
    }catch(e){
      setError(e.message || '데이터를 불러오지 못했습니다')
      setMembers([])
    }finally{ setLoading(false) }
  }
  useEffect(()=>{ load() },[])

  const active = useMemo(()=>members.filter(m => (m.status || '정상') === '정상'),[members])
  const arrears = useMemo(()=>active.filter(m => getBalance(m) > 0),[active])
  const shown = useMemo(()=>{
    const nq = norm(q)
    let base = nq ? active.filter(m => [m.name, vehicle(m), phone(m), sigun(m), m.mgmtNo, m.mgmt_no, address(m)].some(v => norm(v).includes(nq))) : arrears
    base = [...base]
    if (sort === 'amount') base.sort((a,b)=>getBalance(b)-getBalance(a))
    if (sort === 'months') base.sort((a,b)=>getMonths(b)-getMonths(a))
    if (sort === 'name') base.sort((a,b)=>text(a.name).localeCompare(text(b.name),'ko'))
    return base
  },[q, active, arrears, sort])
  const total = arrears.reduce((s,m)=>s+getBalance(m),0)

  async function submitPayment(){
    if (!selected) return
    const amount = Number(String(payAmount).replace(/[^0-9-]/g,''))
    if (!amount){ alert('수납금액을 입력해 주세요.'); return }
    setPaying(true)
    try{
      await api.applyPayment(selected.id, { amount, method:'모바일수납', charge_item:item(selected) })
      setPayAmount('')
      setSelected(null)
      await load()
    }catch(e){ alert(e.message || '수납 반영 실패') }
    finally{ setPaying(false) }
  }

  return <div className="mapp">
    <header className="mhead">
      <div>
        <h1>미수금명단</h1>
        <p>강원 개인소형화물협회</p>
      </div>
      <button className="micon" onClick={load} aria-label="새로고침">↻</button>
    </header>

    <main className="mbody">
      <div className="msearch">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="이름 · 차량번호 · 연락처 · 지역 검색" />
      </div>

      <section className="mstats">
        <div><span>미수 인원</span><strong>{num(arrears.length)}명</strong></div>
        <div><span>총 미납액</span><strong className="danger">{won(total)}</strong></div>
      </section>

      <div className="msorts">
        <button className={sort==='amount'?'on':''} onClick={()=>setSort('amount')}>미납액순</button>
        <button className={sort==='months'?'on':''} onClick={()=>setSort('months')}>미수개월순</button>
        <button className={sort==='name'?'on':''} onClick={()=>setSort('name')}>이름순</button>
      </div>

      <p className="mcount">{loading ? '불러오는 중…' : error ? error : `총 ${num(shown.length)}명`}</p>

      <section className="mlist">
        {shown.slice(0, 300).map(m => <button className="mcard" key={m.id || vehicle(m)+m.name} onClick={()=>{setSelected(m); setPayAmount(getBalance(m)>0 ? String(getBalance(m)) : '')}}>
          <div className="avatar">{text(m.name).slice(0,1) || '?'}</div>
          <div className="minfo">
            <div className="line1"><b>{m.name}</b><span>{vehicle(m)}</span></div>
            <div className="line2"><em>{item(m)}</em><span>{sigun(m)}</span></div>
          </div>
          <div className="mamount"><strong>{won(getBalance(m))}</strong><span>{getMonths(m)}개월</span></div>
        </button>)}
        {!loading && !shown.length && <div className="mempty">검색 결과가 없습니다.</div>}
      </section>
    </main>

    <nav className="mbottom">
      <button className="on">☷<span>미수금명단</span></button>
      <button onClick={load}>↻<span>새로고침</span></button>
    </nav>

    {selected && <div className="msheet-bg" onClick={()=>setSelected(null)}>
      <div className="msheet" onClick={e=>e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <div><h2>{selected.name}</h2><p>{sigun(selected)} · {vehicle(selected)}</p></div>
          <button onClick={()=>setSelected(null)}>닫기</button>
        </div>
        <div className="sheet-grid">
          <div><span>계정</span><b>{item(selected)} / {won(getMonthly(selected))}</b></div>
          <div><span>현재잔액</span><b className={getBalance(selected)>0?'danger':''}>{won(getBalance(selected))}</b></div>
          <div><span>미수개월</span><b>{getMonths(selected)}개월</b></div>
          <div><span>부과기준</span><b>{basis(selected)}</b></div>
          <div><span>연락처</span><b>{phone(selected)}</b></div>
          <div><span>주소</span><b>{address(selected)}</b></div>
        </div>
        <div className="paybox">
          <label>수납금액</label>
          <input value={payAmount} onChange={e=>setPayAmount(e.target.value)} inputMode="numeric" placeholder="금액 입력" />
          <button disabled={paying} onClick={submitPayment}>{paying ? '처리 중…' : '수납 반영'}</button>
        </div>
      </div>
    </div>}
  </div>
}
