import React, { useMemo } from 'react'
import { fmtWon, fmtNum, monthCount } from './mobileUtils.js'

const SORTS = [
  { key: 'amount', label: '미수금 높은순' },
  { key: 'months', label: '미수개월순' },
  { key: 'name', label: '이름순' },
  { key: 'vehicle', label: '차량번호순' },
]

function Ico({ name }) {
  const p = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  }[name]
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
}

export default function MobileReceivables({ members, q, setQ, sort, setSort, onSelect, onLock }) {
  const rows = useMemo(() => {
    let list = (members || []).filter(m => m.status === '정상')
    // 미수금명단: 현재잔액 0이 아닌(미수 또는 선납) 회원 위주, 검색 시 전체에서 탐색
    const k = q.trim().toLowerCase()
    if (k) {
      list = list.filter(m =>
        (m.name || '').toLowerCase().includes(k) ||
        (m.vehicleNo || '').toLowerCase().includes(k) ||
        String(m.phone || '').includes(k) ||
        (m.mgmtNo || '').toLowerCase().includes(k) ||
        (m.sigun || '').toLowerCase().includes(k))
    } else {
      list = list.filter(m => (Number(m.totalArrears) || 0) !== 0)
    }
    const cmp = {
      amount: (a, b) => (Number(b.totalArrears) || 0) - (Number(a.totalArrears) || 0),
      months: (a, b) => monthCount(b) - monthCount(a),
      name: (a, b) => (a.name || '').localeCompare(b.name || '', 'ko'),
      vehicle: (a, b) => String(a.vehicleNo || '').localeCompare(String(b.vehicleNo || ''), 'ko', { numeric: true }),
    }[sort]
    return [...list].sort(cmp)
  }, [members, q, sort])

  const arrearsRows = rows.filter(m => (Number(m.totalArrears) || 0) > 0)
  const totalArrears = arrearsRows.reduce((s, m) => s + (Number(m.totalArrears) || 0), 0)
  const over300 = arrearsRows.filter(m => (Number(m.totalArrears) || 0) >= 300000).length

  return <>
    <div className="m-header">
      <div className="m-header-top">
        <div className="m-title">미수금 모바일<small>강원 개인소형화물협회</small></div>
        <button className="m-headbtn" onClick={onLock} aria-label="잠금"><Ico name="lock" /></button>
      </div>
      <div className="m-search">
        <span className="ico"><Ico name="search" /></span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름 · 차량번호 · 전화번호 검색" inputMode="search" />
      </div>
      <div className="m-summary">
        <div className="m-sumcard v1"><div className="lab">미수 인원</div><div className="val">{fmtNum(arrearsRows.length)}명</div></div>
        <div className="m-sumcard v2"><div className="lab">총 현재잔액</div><div className="val">{fmtWon(totalArrears)}</div></div>
        <div className="m-sumcard v3"><div className="lab">30만원↑</div><div className="val">{fmtNum(over300)}명</div></div>
      </div>
    </div>

    <div className="m-chips">
      {SORTS.map(s => <button key={s.key} className={'m-chip' + (sort === s.key ? ' active' : '')} onClick={() => setSort(s.key)}>{s.label}</button>)}
    </div>

    <div className="m-list">
      <div className="m-count">{q ? `검색결과 ${rows.length}명` : `미수 ${arrearsRows.length}명`}</div>
      {rows.map(m => {
        const total = Number(m.totalArrears) || 0
        const months = monthCount(m)
        const hot = total >= 300000 || months >= 12
        const wonClass = total > 0 ? (hot ? 'won hot' : 'won') : total < 0 ? 'won pre' : 'won zero'
        return <button className="m-card" key={m.id} onClick={() => onSelect(m)}>
          <div className={'av' + (m.chargeItem === '관리비' ? ' teal' : '')}>{(m.name || '?').slice(0, 1)}</div>
          <div className="mid">
            <div className="nm">{m.name}<span className="veh">{m.vehicleNo}</span></div>
            <div className="sub">
              <span className={'m-tag ' + (m.chargeItem === '협회비' ? 'violet' : 'green')}>{m.chargeItem}</span>
              <span>{m.sigun || '-'}</span>
            </div>
          </div>
          <div className="amt">
            <div className={wonClass}>{total < 0 ? '선납 ' + fmtWon(-total) : fmtWon(total)}</div>
            <div className="mo">{total > 0 ? `미수 ${months}개월` : total < 0 ? '초과입금' : '완납'}</div>
            {m.phone ? <div className="phone">{m.phone}</div> : null}
          </div>
        </button>
      })}
      {!rows.length && <div className="m-empty">{q ? '검색 결과가 없습니다.' : '표시할 회원이 없습니다.\n데스크톱에서 엑셀 업로드 후 표시됩니다.'}</div>}
    </div>
  </>
}
