import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import MobilePinLock from './MobilePinLock.jsx'
import MobileReceivables from './MobileReceivables.jsx'
import MobileMemberDetail from './MobileMemberDetail.jsx'
import './mobile.css'

/**
 * 모바일 전용 PWA 앱 (/mobile).
 * - 데스크톱과 같은 FastAPI 백엔드 / 같은 DB 사용 (별도 저장소 없음).
 * - 현장 조회 + 수납용. PIN 잠금 → 미수금명단 → 회원 상세/수납.
 */
export default function MobileApp() {
  const [locked, setLocked] = useState(true)
  const [members, setMembers] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('amount')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  function showToast(t) { setToast(t); setTimeout(() => setToast(''), 2200) }

  async function load() {
    setStatus(s => (s === 'ready' ? s : 'loading'))
    try {
      const list = await api.listMembers({ size: 10000 })
      setMembers(Array.isArray(list) ? list : [])
      setStatus('ready')
    } catch (e) {
      setStatus('error')
    }
  }

  useEffect(() => { if (!locked) load() }, [locked]) // eslint-disable-line

  async function refresh() {
    setRefreshing(true)
    try { await load(); showToast('최신 데이터로 새로고침했습니다.') }
    finally { setRefreshing(false) }
  }

  async function applyPayment(memberId, body) {
    // 같은 DB에 저장 → 데스크톱 수납내역에도 즉시 반영
    await api.applyPayment(memberId, body)
    await load()
  }
  async function saveMemo(memberId, memo) {
    await api.updateMember(memberId, { memo })
    setMembers(ms => ms.map(m => (m.id === memberId ? { ...m, memo } : m)))
  }

  if (locked) return <MobilePinLock onUnlock={() => setLocked(false)} />

  const selectedLive = selected ? (members.find(m => m.id === selected.id) || selected) : null

  return <div className="m-app">
    {status === 'loading' && <div className="m-state"><div className="m-spin" />데이터를 불러오는 중…</div>}
    {status === 'error' && <div className="m-state">
      서버에 연결하지 못했습니다.<br />네트워크 상태를 확인해 주세요.
      <button className="m-retry" onClick={load}>다시 시도</button>
    </div>}

    {status === 'ready' && <>
      <MobileReceivables
        members={members}
        q={q} setQ={setQ}
        sort={sort} setSort={setSort}
        onSelect={setSelected}
        onLock={() => setLocked(true)}
      />
      <div className="m-tabbar">
        <button className="m-tab active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><circle cx="3.5" cy="6" r="1.3" /><circle cx="3.5" cy="12" r="1.3" /><circle cx="3.5" cy="18" r="1.3" /></svg>
          미수금명단
        </button>
        <button className="m-tab" onClick={refresh}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>
          {refreshing ? '동기화…' : '새로고침'}
        </button>
      </div>
    </>}

    {selectedLive && <MobileMemberDetail
      base={selectedLive}
      onBack={() => setSelected(null)}
      onApplyPayment={applyPayment}
      onSaveMemo={saveMemo}
      onToast={showToast}
    />}

    {toast && <div className="m-toast">{toast}</div>}
  </div>
}
