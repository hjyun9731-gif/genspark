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

const NAV = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'list', label: '미수금명단' },
  { key: 'bank', label: '통장매칭' },
  { key: 'closure', label: '폐업현황' },
  { key: 'payments', label: '수납내역' },
  { key: 'pending', label: '신규 · 예정자' },
  { key: 'import', label: '엑셀 업로드' },
]

export default function App() {
  const [view, setView] = useState('list')
  const [health, setHealth] = useState('확인 중…')
  const [preset, setPreset] = useState(null)
  const [data, setData] = useState(() => buildInitialData())

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
      setHealth(Array.isArray(members) && members.length ? '연결됨 · 실제 DB 데이터 표시 중' : '연결됨 · DB 데이터 없음, 엑셀 업로드 필요')
      return true
    }catch(e){
      setData(d => ({...d, members: [], closures: [], pending: [], deposits: [], payments: []}))
      setHealth('백엔드 미연결 · 데이터 표시 불가')
      return false
    }
  }

  useEffect(() => {
    api.health().then((d) => { setHealth(`연결됨 (${d.app})`); reloadFromDb() }).catch(() => setHealth('백엔드 미연결 · 데이터 표시 불가'))
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

  function navigate(nextView, nextPreset=null){ setView(nextView); setPreset(nextPreset) }

  async function saveMemo(memberId, memo){
    try{ await api.updateMember(memberId,{memo}); await reloadFromDb() }
    catch(e){ alert(e.message || '메모 저장 실패') }
  }

  async function updateMember(memberId, payload){
    try{ await api.updateMember(memberId, payload); await reloadFromDb() }
    catch(e){ alert(e.message || '회원정보 수정 실패') }
  }

  async function applyPayment(memberId, amount, method='직접수납', chargeItem=null){
    try{ await api.applyPayment(memberId,{amount:Number(amount)||0, method, charge_item:chargeItem || undefined}); await reloadFromDb() }
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
  async function updatePayment(paymentId, payload){
    try{ await api.updatePayment(paymentId, payload); await reloadFromDb() }
    catch(e){ alert(e.message || '수납 수정 실패') }
  }

  async function matchDeposit(depositId, memberId, chargeItem=null){
    try{ await api.matchDeposit(depositId,{member_id:memberId, charge_item:chargeItem || undefined}); await reloadFromDb() }
    catch(e){ alert(e.message || '통장매칭 실패') }
  }
  async function matchDepositIncome(depositId, chargeItem='기타'){
    try{ await api.matchDepositIncome(depositId,{charge_item:chargeItem}); await reloadFromDb() }
    catch(e){ alert(e.message || '잡수입/기타수입 반영 실패') }
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

  const screenProps = {data, summary, navigate, preset, setPreset, saveMemo, updateMember, applyPayment, registerClosure, updateClosure, restoreClosure, deleteClosure, updatePayment, cancelPayment, matchDeposit, matchDepositIncome, excludeDeposit, resetPendingDeposits, addPending, updatePending, deletePending, promotePending, reloadFromDb}
  const Screen = {dashboard:Dashboard,list:ReceivablesList,bank:BankMatching,closure:ClosureBoard,payments:PaymentsHistory,pending:PendingBoard,import:ExcelImport}[view] || Dashboard

  return <div className="app top-app">
    <header className="top-nav">
      <div className="top-brand">
        <b>미수금관리</b>
        <span>강원 개인소형화물협회</span>
      </div>
      <nav className="top-menu">{NAV.map(n=><button key={n.key} onClick={()=>navigate(n.key)} className={'top-nav-btn '+(view===n.key?'active':'')}>{n.label}</button>)}</nav>
      <div className="top-health"><i/> DB 연결됨</div>
    </header>
    <main className="main top-main"><Screen {...screenProps}/></main>
  </div>
}
