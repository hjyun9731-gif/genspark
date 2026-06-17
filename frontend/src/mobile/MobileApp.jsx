import React, { useMemo, useState } from 'react'
import { formatWon, formatNum } from '../data.js'
import PinLock from './PinLock.jsx'
import MemberSheet from './MemberSheet.jsx'
import '../mobile.css'

const SORTS = [
  { key: 'amount', label: '미납액순' },
  { key: 'months', label: '미수개월순' },
  { key: 'name', label: '이름순' },
]

function monthCount(member) {
  const amount = Number(member.totalArrears) || 0
  const monthly = Number(member.monthlyCharge) || 0
  if (amount <= 0) return 0
  if (monthly > 0) return Math.max(1, Math.ceil(amount / monthly))
  return Number(member.arrearsMonths) || 1
}

function Icon({ name }) {
  const p = {
    list: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><circle cx="3.5" cy="6" r="1.3" /><circle cx="3.5" cy="12" r="1.3" /><circle cx="3.5" cy="18" r="1.3" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  }[name]
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
}

export default function MobileApp({ data, summary, applyPayment, reloadFromDb, onExitMobile }) {
  const [locked, setLocked] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('amount')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  function showToast(t) { setToast(t); setTimeout(() => setToast(''), 2200) }

  const arrears = useMemo(() => {
    let rows = (data.members || []).filter(m => m.status === '정상' && (Number(m.totalArrears) || 0) > 0)
    if (q.trim()) {
      const k = q.trim().toLowerCase()
      rows = rows.filter(m =>
        (m.name || '').toLowerCase().includes(k) ||
        (m.vehicleNo || '').toLowerCase().includes(k) ||
        (m.phone || '').includes(k) ||
        (m.mgmtNo || '').toLowerCase().includes(k) ||
        (m.sigun || '').toLowerCase().includes(k)
      )
    }
    const cmp = {
      amount: (a, b) => (b.totalArrears || 0) - (a.totalArrears || 0),
      months: (a, b) => monthCount(b) - monthCount(a),
      name: (a, b) => (a.name || '').localeCompare(b.name || '', 'ko'),
    }[sort]
    return [...rows].sort(cmp)
  }, [data.members, q, sort])

  const totalArrears = useMemo(() => arrears.reduce((s, m) => s + (Number(m.totalArrears) || 0), 0), [arrears])

  async function unlock() { setLocked(false); reloadFromDb?.() }
  async function refresh() {
    setRefreshing(true)
    try { await reloadFromDb?.(); showToast('최신 데이터로 새로고침했습니다.') }
    finally { setRefreshing(false) }
  }

  const selectedLive = selected ? (data.members || []).find(m => m.id === selected.id) || selected : null

  if (locked) return <PinLock onUnlock={unlock} />

  return <div className="m-root">
    <div className="m-header">
      <div className="m-header-top">
        <div className="m-title">미수금명단<small>강원 개인소형화물협회</small></div>
        <button className="m-headbtn" onClick={() => setLocked(true)} aria-label="잠금"><Icon name="lock" /></button>
      </div>
      <div className="m-search">
        <span className="ico"><Icon name="search" /></span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름 · 차량번호 · 연락처 · 지역 검색" />
      </div>
      <div className="m-summary">
        <div className="m-sumcard accent"><div className="lab">미수 인원</div><div className="val">{formatNum(arrears.length)}명</div></div>
        <div className="m-sumcard warn"><div className="lab">총 미납액</div><div className="val">{formatWon(totalArrears)}</div></div>
      </div>
    </div>

    <div className="m-chips">
      {SORTS.map(s => <button key={s.key} className={'m-chip' + (sort === s.key ? ' active' : '')} onClick={() => setSort(s.key)}>{s.label}</button>)}
    </div>

    <div className="m-list">
      <div className="m-count">{q ? `검색결과 ${arrears.length}명` : `총 ${arrears.length}명`}</div>
      {arrears.map(m => {
        const months = monthCount(m)
        const hot = (Number(m.totalArrears) || 0) >= 300000 || months >= 12
        return <button className="m-card" key={m.id} onClick={() => setSelected(m)}>
          <div className={'av' + (m.chargeItem === '관리비' ? ' teal' : '')}>{(m.name || '?').slice(0, 1)}</div>
          <div className="mid">
            <div className="nm">{m.name}<span className="veh">{m.vehicleNo}</span></div>
            <div className="sub">
              <span className={'m-tag ' + (m.chargeItem === '협회비' ? 'blue' : 'teal')}>{m.chargeItem}</span>
              <span>{m.sigun || '-'}</span>
            </div>
          </div>
          <div className="amt">
            <div className={'won' + (hot ? ' hot' : '')}>{formatWon(m.totalArrears)}</div>
            <div className="mo">{months}개월</div>
          </div>
        </button>
      })}
      {!arrears.length && <div className="m-empty">{q ? '검색 결과가 없습니다.' : '미수 회원이 없습니다.\n엑셀 업로드 후 표시됩니다.'}</div>}
      {onExitMobile && <div className="m-pcswitch">데스크톱에서 보시려면 <button onClick={onExitMobile}>PC 화면으로 보기</button></div>}
    </div>

    <div className="m-tabbar">
      <button className="m-tab active"><Icon name="list" />미수금명단</button>
      <button className="m-tab" onClick={refresh}><Icon name="refresh" />{refreshing ? '동기화…' : '새로고침'}</button>
    </div>

    {selectedLive && <MemberSheet member={selectedLive} onClose={() => setSelected(null)} applyPayment={applyPayment} onToast={showToast} />}
    {toast && <div className="m-toast">{toast}</div>}
  </div>
}
