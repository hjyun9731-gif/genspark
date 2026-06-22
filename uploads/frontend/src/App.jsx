import React, { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { buildInitialData, getOpenArrears } from './data.js'
import './styles.css'
import Dashboard from './screens/Dashboard.jsx'
import ReceivablesList from './screens/ReceivablesList.jsx'
import BankMatching from './screens/BankMatching.jsx'
import ClosureBoard from './screens/ClosureBoard.jsx'
import PaymentsHistory from './screens/PaymentsHistory.jsx'
import PendingBoard from './screens/PendingBoard.jsx'
import ExcelImport from './screens/ExcelImport.jsx'


// 좌측 사이드바 메뉴. label 옆 group 으로 섹션을 나눠 표시한다.
const NAV = [
  { key: 'dashboard', label: '대시보드', icon: 'grid', group: '현황' },
  { key: 'list', label: '미수금명단', icon: 'list', group: '현황' },
  { key: 'bank', label: '통장매칭', icon: 'bank', group: '수납' },
  { key: 'payments', label: '수납내역', icon: 'receipt', group: '수납' },
  { key: 'closure', label: '폐업현황', icon: 'warn', group: '관리' },
  { key: 'pending', label: '신규 · 예정자', icon: 'user', group: '관리' },
  { key: 'import', label: '엑셀 업로드', icon: 'upload', group: '관리' },
]

const HASH_TO_VIEW = {
  dashboard: 'dashboard',
  receivables: 'list',
  list: 'list',
  bank: 'bank',
  closure: 'closure',
  payments: 'payments',
  pending: 'pending',
  import: 'import',
}
const VIEW_TO_HASH = {
  dashboard: 'dashboard',
  list: 'receivables',
  bank: 'bank',
  closure: 'closure',
  payments: 'payments',
  pending: 'pending',
  import: 'import',
}
function viewFromHash(){
  const raw = String(window.location.hash || '').replace(/^#/, '')
  return HASH_TO_VIEW[raw] || 'dashboard'
}

// 사이드바 아이콘 (단색 SVG, currentColor)
function NavIcon({ name }){
  const p = {
    grid: 'M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z',
    list: 'M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z',
    bank: 'M12 3l9 4v2H3V7l9-4zM5 10h2v7H5v-7zm6 0h2v7h-2v-7zm6 0h2v7h-2v-7zM3 19h18v2H3v-2z',
    receipt: 'M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2V2zm3 5h8v2H8V7zm0 4h8v2H8v-2z',
    warn: 'M12 2l10 18H2L12 2zm-1 7v5h2V9h-2zm0 6v2h2v-2h-2z',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z',
    upload: 'M12 3l5 5h-3v6h-4V8H7l5-5zM5 18h14v2H5v-2z',
  }[name] || 'M4 4h16v16H4z'
  return <svg className="nav-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={p} fill="currentColor"/></svg>
}

export default function App() {
  const [view, setView] = useState(() => viewFromHash())
  const [health, setHealth] = useState('확인 중…')
  const [preset, setPreset] = useState(null)
  const [data, setData] = useState(() => buildInitialData())
  const [connected, setConnected] = useState(false)


  async function reloadFromDb(){
    try{
      const [members, closures, pending, deposits, payments, dashboardSummary, bySigun] = await Promise.all([
        api.listMembers({size: 10000}),
        api.listClosures().catch(()=>[]),
        api.listPending().catch(()=>[]),
        api.listDeposits({size: 5000}).catch(()=>[]),
        api.listPayments({size: 5000}).catch(()=>[]),
        api.dashboardSummary().catch(()=>null),
        api.dashboardBySigun().catch(()=>[]),
      ])
      setData(d => ({
        ...d,
        members: Array.isArray(members)?members:[],
        closures: closures||[],
        pending: pending||[],
        deposits: deposits||[],
        payments: payments||[],
        dashboardSummary: dashboardSummary||null,
        bySigun: Array.isArray(bySigun)?bySigun:[],
      }))
      setConnected(true)
      setHealth(Array.isArray(members) && members.length ? '연결됨 · 실제 DB 데이터 표시 중' : '연결됨 · DB 데이터 없음, 엑셀 업로드 필요')
      return true
    }catch(e){
      setData(d => ({...d, members: [], closures: [], pending: [], deposits: [], payments: []}))
      setConnected(false)
      setHealth('백엔드 미연결 · 데이터 표시 불가')
      return false
    }
  }

  useEffect(() => {
    api.health().then((d) => { setConnected(true); setHealth(`연결됨 (${d.app})`); reloadFromDb() }).catch(() => { setConnected(false); setHealth('백엔드 미연결 · 데이터 표시 불가') })
  }, [])

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const summary = useMemo(() => {
    const active = data.members.filter(m => m.status === '정상')
    const arrearsMembers = active.filter(m => m.totalArrears > 0)
    const thisMonthPayments = data.payments.filter(p => p.paidDate?.startsWith('2026-06')).reduce((s,p)=>s+p.amount,0)
    const local = {
      totalMembers: data.members.length,
      activeMembers: active.length,
      arrearsCount: arrearsMembers.length,
      totalArrears: arrearsMembers.reduce((s,m)=>s+(Number(m.totalArrears)||0),0),
      thisMonthPayments,
      highAmount: arrearsMembers.filter(m=>(Number(m.totalArrears)||0)>=300000).length,
      longOverdue: arrearsMembers.filter(m=>(Number(m.arrearsMonths)||0)>=12).length,
      disconnected: active.filter(m=>m.disconnected).length,
      certMissing: active.filter(m=>m.certMissing).length,
      pending: data.pending.length,
      closures: data.closures.length,
      bankPending: data.deposits.filter(d=>d.status!=='매칭완료' && d.status!=='제외').length,
    }
    return data.dashboardSummary ? {...local, ...data.dashboardSummary} : local
  }, [data])

  function navigate(nextView, nextPreset=null){
    setView(nextView)
    setPreset(nextPreset)
    const nextHash = VIEW_TO_HASH[nextView] || 'dashboard'
    if (window.location.hash !== `#${nextHash}`) window.location.hash = nextHash
  }

  async function saveMemo(memberId, memo){
    try{ await api.updateMember(memberId,{memo}); await reloadFromDb() }
    catch(e){ alert(e.message || '메모 저장 실패') }
  }

  async function updateMember(memberId, payload){
    try{ await api.updateMember(memberId, payload); await reloadFromDb() }
    catch(e){ alert(e.message || '회원정보 수정 실패') }
  }

  async function applyPayment(memberId, amount, method='직접수납'){
    try{ await api.applyPayment(memberId,{amount:Number(amount)||0, method}); await reloadFromDb() }
    catch(e){ alert(e.message || '수납 반영 실패') }
  }

  async function registerClosure(memberId, payload){
    try{ await api.registerClosure(memberId,{type:payload.type, doc_no:payload.docNo || payload.doc_no || '', content:payload.content || '', notify_later:payload.notify_later || false, process_date:payload.processDate || new Date().toISOString().slice(0,10)}); await reloadFromDb() }
    catch(e){ alert(e.message || '폐업 등록 실패') }
  }

  async function updateClosure(closureId, payload){
    try{ await api.updateClosure(closureId, payload); await reloadFromDb() }
    catch(e){ alert(e.message || '폐업현황 수정 실패') }
  }
  async function restoreClosure(closureId){
    try{ await api.restoreClosure(closureId); await reloadFromDb() }
    catch(e){ alert(e.message || '복귀 처리 실패') }
  }
  async function deleteClosure(closureId, restoreMember=false){
    try{ await api.deleteClosure(closureId, restoreMember); await reloadFromDb() }
    catch(e){ alert(e.message || '폐업현황 삭제 실패') }
  }

  async function cancelPayment(paymentId){
    try{ await api.cancelPayment(paymentId); await reloadFromDb() }
    catch(e){ alert(e.message || '수납 취소 실패') }
  }
  async function resetAllPayments(){
    try{ await api.resetAllPayments(); await reloadFromDb() }
    catch(e){ alert(e.message || '수납내역 전체 초기화 실패') }
  }
  async function updatePayment(paymentId, payload){
    try{ await api.updatePayment(paymentId, payload); await reloadFromDb() }
    catch(e){ alert(e.message || '수납 수정 실패') }
  }

  async function matchDeposit(depositId, memberId, chargeItem=null){
    try{ await api.matchDeposit(depositId,{member_id:memberId, charge_item:chargeItem || undefined}); await reloadFromDb() }
    catch(e){ alert(e.message || '통장매칭 실패') }
  }
  async function matchDepositGroup(depositId, groupCode=null){
    try{ await api.matchDepositGroup(depositId,{group_code:groupCode || undefined}); await reloadFromDb() }
    catch(e){ alert(e.message || '묶음수납 반영 실패') }
  }
  async function excludeDeposit(depositId){
    try{ await api.excludeDeposit(depositId); await reloadFromDb() }
    catch(e){ alert(e.message || '입금 제외 실패') }
  }

  async function resetPendingDeposits(){
    try{ await api.resetPendingDeposits(); await reloadFromDb() }
    catch(e){ alert(e.message || '통장매칭 결과 초기화 실패') }
  }
  async function addPending(payload){
    try{ await api.createPending(payload); await reloadFromDb() }
    catch(e){ alert(e.message || '예정자 등록 실패') }
  }
  async function updatePending(id, payload){
    try{ await api.updatePending(id, payload); await reloadFromDb() }
    catch(e){ alert(e.message || '예정자 수정 실패') }
  }
  async function deletePending(id){
    try{ await api.deletePending(id); await reloadFromDb() }
    catch(e){ alert(e.message || '예정자 삭제 실패') }
  }
  async function promotePending(id, payload){
    try{ await api.promotePending(id, payload); await reloadFromDb() }
    catch(e){ alert(e.message || '전체자명단 전환 실패') }
  }

  const screenProps = {data, summary, navigate, preset, setPreset, saveMemo, updateMember, applyPayment, registerClosure, updateClosure, restoreClosure, deleteClosure, updatePayment, cancelPayment, resetAllPayments, matchDeposit, excludeDeposit, resetPendingDeposits, matchDepositGroup, addPending, updatePending, deletePending, promotePending, reloadFromDb}
  const Screen = {dashboard:Dashboard,list:ReceivablesList,bank:BankMatching,closure:ClosureBoard,payments:PaymentsHistory,pending:PendingBoard,import:ExcelImport}[view] || Dashboard
  const activeLabel = (NAV.find(n => n.key === view) || NAV[0]).label

  // group 단위로 메뉴를 묶는다.
  const groups = NAV.reduce((acc, item) => {
    const last = acc[acc.length - 1]
    if (last && last.group === item.group) last.items.push(item)
    else acc.push({ group: item.group, items: [item] })
    return acc
  }, [])

  return <div className="app sidebar-app">
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">미</span>
        <div className="sidebar-brand-text">
          <b>미수금관리</b>
          <span>강원 개인소형화물협회</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {groups.map(section => <div className="sidebar-group" key={section.group}>
          <div className="sidebar-group-label">{section.group}</div>
          {section.items.map(n => <button
            key={n.key}
            type="button"
            onClick={() => navigate(n.key)}
            className={'sidebar-nav-btn ' + (view === n.key ? 'active' : '')}
          >
            <NavIcon name={n.icon} />
            <span>{n.label}</span>
          </button>)}
        </div>)}
      </nav>
      <div className="sidebar-foot">
        <div className={'conn-dot ' + (connected ? 'ok' : 'off')}><i/>{connected ? 'DB 연결됨' : '미연결'}</div>
        <div className="sidebar-foot-sub">{health}</div>
      </div>
    </aside>
    <div className="content">
      <header className="content-bar">
        <div className="content-bar-title">{activeLabel}</div>
        <div className="content-bar-right">
          <span className={'conn-pill ' + (connected ? 'ok' : 'off')}><i/>{connected ? '실시간 연결' : '오프라인'}</span>
        </div>
      </header>
      <main className="content-main"><Screen {...screenProps}/></main>
    </div>
  </div>
}
