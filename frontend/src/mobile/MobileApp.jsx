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

const VALUE_KEYS = {
  id: ['id', 'memberId', 'member_id'],
  name: ['name', 'memberName', 'member_name'],
  vehicleNo: ['vehicleNo', 'vehicle_no', 'carNo', 'car_no', 'vehicleNumber', 'vehicle_number'],
  phone: ['phone', 'mobile', 'mobilePhone', 'mobile_phone', 'tel', 'telephone'],
  mgmtNo: ['mgmtNo', 'mgmt_no', 'managementNo', 'management_no', 'managementNumber', 'management_number'],
  sigun: ['sigun', 'region', 'city', 'area'],
  chargeItem: ['chargeItem', 'charge_item', 'account', 'billingItem', 'billing_item'],
  monthlyCharge: ['monthlyCharge', 'monthly_charge', 'chargeAmount', 'charge_amount'],
  arrearsMonths: ['arrearsMonths', 'arrears_months', 'months', 'overdueMonths', 'overdue_months'],
}
const MONEY_KEYS = [
  'totalArrears', 'total_arrears', 'arrears', 'arrearsAmount', 'arrears_amount',
  'unpaidAmount', 'unpaid_amount', 'receivableAmount', 'receivable_amount',
  'currentBalance', 'current_balance', 'balance', 'amountDue', 'amount_due',
]

function raw(member, keys, fallback = '') {
  for (const key of keys) {
    const value = member?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}
function numberValue(value) {
  if (typeof value === 'number') return value
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
function moneyOf(member) { return numberValue(raw(member, MONEY_KEYS, 0)) }
function monthlyOf(member) { return numberValue(raw(member, VALUE_KEYS.monthlyCharge, 0)) }
function monthsOf(member) { return numberValue(raw(member, VALUE_KEYS.arrearsMonths, 0)) }
function textOf(member, key, fallback = '') { return String(raw(member, VALUE_KEYS[key] || [key], fallback) || '') }
function idOf(member) { return String(raw(member, VALUE_KEYS.id, '')) }
function statusOf(member) { return String(member?.status ?? member?.memberStatus ?? member?.member_status ?? member?.state ?? '').trim() }
function isActive(member) {
  const status = statusOf(member)
  if (!status) return true
  if (['정상', '활동', '운영', '영업중', 'active', 'ACTIVE'].includes(status)) return true
  return !/(폐업|폐지|양도|이관|탈퇴|취소|말소|inactive|closed)/i.test(status)
}
function chargeItemOf(member) {
  const item = textOf(member, 'chargeItem')
  if (item) return item
  const membership = String(member?.membership || member?.member_type || '')
  return membership.includes('가입') ? '협회비' : '관리비'
}
function monthCount(member) {
  const amount = moneyOf(member)
  const monthly = monthlyOf(member)
  if (amount <= 0) return 0
  if (monthly > 0) return Math.max(1, Math.ceil(amount / monthly))
  return monthsOf(member) || 1
}
function normalizedForSheet(member) {
  return {
    ...member,
    id: member?.id ?? member?.memberId ?? member?.member_id,
    name: textOf(member, 'name'),
    vehicleNo: textOf(member, 'vehicleNo'),
    phone: textOf(member, 'phone'),
    mgmtNo: textOf(member, 'mgmtNo'),
    sigun: textOf(member, 'sigun'),
    chargeItem: chargeItemOf(member),
    totalArrears: moneyOf(member),
    monthlyCharge: monthlyOf(member) || member?.monthlyCharge,
    arrearsMonths: monthsOf(member) || member?.arrearsMonths,
    status: statusOf(member) || '정상',
  }
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


function formatCacheLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function MobileApp({ data, summary, applyPayment, reloadFromDb, loading = false, health = '', mobileCacheSavedAt = '', onExitMobile }) {
  const [locked, setLocked] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('amount')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  function showToast(t) { setToast(t); setTimeout(() => setToast(''), 2200) }

  const members = data.members || []
  const arrears = useMemo(() => {
    let rows = members.filter(m => isActive(m) && moneyOf(m) > 0).map(normalizedForSheet)
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
      amount: (a, b) => moneyOf(b) - moneyOf(a),
      months: (a, b) => monthCount(b) - monthCount(a),
      name: (a, b) => (a.name || '').localeCompare(b.name || '', 'ko'),
    }[sort]
    return [...rows].sort(cmp)
  }, [members, q, sort])

  const totalArrears = useMemo(() => arrears.reduce((s, m) => s + moneyOf(m), 0), [arrears])

  async function unlock() { setLocked(false) }
  async function refresh() {
    setRefreshing(true)
    try { await reloadFromDb?.({mobileOnly: true}); showToast('최신 데이터로 새로고침했습니다.') }
    finally { setRefreshing(false) }
  }

  const selectedId = selected ? idOf(selected) : ''
  const selectedLive = selected
    ? normalizedForSheet(members.find(m => idOf(m) === selectedId) || selected)
    : null

  const cacheLabel = formatCacheLabel(mobileCacheSavedAt)
  const syncLabel = loading && members.length
    ? '저장된 자료 먼저 표시 · 최신자료 확인 중'
    : cacheLabel
      ? `마지막 동기화 ${cacheLabel}`
      : health

  if (locked) return <PinLock onUnlock={unlock} />

  const emptyText = loading || refreshing
    ? '자료를 불러오는 중입니다.'
    : members.length === 0
      ? `회원 자료를 못 불러왔습니다.\n${health || '백엔드 연결이나 배포 상태를 확인하세요.'}`
      : q
        ? '검색 결과가 없습니다.'
        : `미수 회원이 없습니다.\n불러온 회원 ${formatNum(members.length)}명 중 미납액이 0원으로 들어왔습니다.`

  return <div className="m-root">
    <div className="m-header">
      <div className="m-header-top">
        <div className="m-title">미수금명단<small>강원 개인소형화물협회</small></div>
        <button className="m-headbtn" onClick={() => setLocked(true)} aria-label="잠금"><Icon name="lock" /></button>
      </div>
      <div className="m-sync-line">{syncLabel}</div>
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
        const amount = moneyOf(m)
        const hot = amount >= 300000 || months >= 12
        const chargeItem = chargeItemOf(m)
        return <button className="m-card" key={idOf(m) || `${m.name}-${m.vehicleNo}`} onClick={() => setSelected(m)}>
          <div className={'av' + (chargeItem === '관리비' ? ' teal' : '')}>{(m.name || '?').slice(0, 1)}</div>
          <div className="mid">
            <div className="nm">{m.name}<span className="veh">{m.vehicleNo}</span></div>
            <div className="sub">
              <span className={'m-tag ' + (chargeItem === '협회비' ? 'blue' : 'teal')}>{chargeItem}</span>
              <span>{m.sigun || '-'}</span>
            </div>
          </div>
          <div className="amt">
            <div className={'won' + (hot ? ' hot' : '')}>{formatWon(amount)}</div>
            <div className="mo">{months}개월</div>
          </div>
        </button>
      })}
      {!arrears.length && <div className="m-empty">{emptyText}</div>}
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
