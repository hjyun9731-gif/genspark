import React, { useEffect, useMemo, useState } from 'react'
import { Card, PageHead, Badge, formatWon } from '../components.jsx'
import { api } from '../api.js'

const INCOME_ACTIONS = [
  { value: null, label: '회비반영' },
  { value: '협회가입비', label: '가수금' },
  { value: '자격증명발급비', label: '잡수입' },
  { value: '기타', label: '기타' },
]


const INCOME_ONLY_ACTIONS = [
  { value: '협회가입비', label: '가수금' },
  { value: '자격증명발급비', label: '잡수입' },
  { value: '기타', label: '기타' },
]

function IncomeOnlyButtons({deposit, onIncome}){
  if(!deposit || ['매칭완료','반영완료','제외'].includes(getStatus(deposit))) return null
  return <div className="income-only-actions">
    {INCOME_ONLY_ACTIONS.map(a => <button key={a.value} className="btn mini income-soft" onClick={()=>onIncome(deposit.id, a.value)}>{a.label}</button>)}
  </div>
}

const STATUS_TONE = {
  '자동매칭': 'green',
  '후보확인': 'orange',
  '중복후보': 'purple',
  '미매칭': 'red',
  '매칭완료': 'blue',
  '제외': 'gray',
}

function StatusBadge({status}){
  return <Badge tone={STATUS_TONE[status] || 'gray'}>{status || '대기'}</Badge>
}

function diffText(diff){
  if(diff === null || diff === undefined) return '-'
  if(Number(diff) === 0) return '일치'
  return Number(diff) > 0 ? `초과 ${formatWon(diff)}` : `부족 ${formatWon(Math.abs(diff))}`
}

function getStatus(d){
  return d.status || d.matchStatus || '대기'
}

function getBestCandidate(d, members){
  return d.bestCandidate || (d.candidateId ? members.find(m => m.id === d.candidateId) : null)
}

function memberMemo(m){
  return m?.memo || m?.note || m?.remark || m?.remarks || ''
}

function getGroupCandidate(d){
  return d?.groupCandidate || (d?.groupCandidates && d.groupCandidates[0]) || null
}

function normalizeText(v){
  return String(v || '').replace(/\s+/g, '').toLowerCase()
}

function shortText(v, n = 42){
  const s = String(v || '-').trim()
  return s.length > n ? `${s.slice(0, n)}…` : s
}

function DepositDetail({deposit}){
  if(!deposit) return null
  return <tr className="match-detail-row">
    <td colSpan={10}>
      <div className="match-detail-grid">
        <div><b>거래 원문</b><span>{deposit.memo || '-'}</span></div>
        <div><b>거래내용</b><span>{deposit.description || deposit.transactionType || '-'}</span></div>
        <div><b>원본구분</b><span>{deposit.sourceType || deposit.source || '-'}</span></div>
        <div><b>입금자/기록</b><span>{deposit.depositorName || deposit.rawName || '-'}</span></div>
        <div><b>매칭메모</b><span>{deposit.hint || '-'}</span></div>
      </div>
    </td>
  </tr>
}

function ManualMatchModal({deposit, members, onClose, onMatch, onGroupMatch, onIncome}){
  const [q,setQ]=useState('')
  const [serverRows,setServerRows]=useState([])
  const [loading,setLoading]=useState(false)
  const candidates = deposit?.candidates || []
  const groupCandidates = deposit?.groupCandidates || (deposit?.groupCandidate ? [deposit.groupCandidate] : [])

  useEffect(()=>{
    let alive = true
    async function run(){
      const keyword = q.trim()
      if(!keyword){ setServerRows([]); return }
      setLoading(true)
      try{
        const rows = await api.listMembers({q:keyword, status:'정상', size:1000})
        if(alive) setServerRows(Array.isArray(rows) ? rows : [])
      }catch(e){ if(alive) setServerRows([]) }
      finally{ if(alive) setLoading(false) }
    }
    const t = setTimeout(run, 200)
    return ()=>{ alive=false; clearTimeout(t) }
  },[q])

  const memberRows = useMemo(()=>{
    const keyword = q.trim()
    const s = normalizeText(keyword)
    const source = keyword ? serverRows : (members || [])
    const base = (source || []).filter(m => m.status === '정상')
    const filtered = keyword ? base.filter(m => normalizeText([m.name, m.vehicleNo, m.vehicle_no, m.mgmtNo, m.mgmt_no, m.phone, memberMemo(m)].join(' ')).includes(s)) : base
    return filtered.sort((a,b)=>{
      const an=normalizeText(a.name), bn=normalizeText(b.name)
      const av=normalizeText([a.vehicleNo,a.vehicle_no].join(' ')), bv=normalizeText([b.vehicleNo,b.vehicle_no].join(' '))
      const score=(m,n,v)=> n===s?0:n.startsWith(s)?1:v.includes(s)?2:normalizeText(memberMemo(m)).includes(s)?3:4
      return score(a,an,av)-score(b,bn,bv) || (Number(b.totalArrears)||0)-(Number(a.totalArrears)||0)
    }).slice(0,100)
  },[members,serverRows,q])
  if(!deposit) return null
  return <div className="modal-bg">
    <div className="modal wide match-modal">
      <div className="modal-title-row">
        <div>
          <h2>후보 확인 / 수동매칭</h2>
          <p>추천 후보가 맞으면 바로 수납반영하고, 아니면 회원을 검색해서 선택하세요.</p>
        </div>
        <button className="btn" onClick={onClose}>닫기</button>
      </div>

      <div className="compact-summary four">
        <div><b>입금자명</b><strong>{deposit.depositorName || '-'}</strong></div>
        <div><b>입금액</b><strong>{formatWon(deposit.amount)}</strong></div>
        <div><b>거래일자</b><strong>{deposit.depositDate || '-'}</strong></div>
        <div><b>상태</b><strong><StatusBadge status={getStatus(deposit)}/></strong></div>
      </div>

      <div className="income-only-panel">
        <div>
          <b>회원 없이 처리</b>
          <span>자격증명발급비·가입비·기타 입금은 미수금 차감 없이 통장내역만 완료처리합니다.</span>
        </div>
        <IncomeOnlyButtons deposit={deposit} onIncome={onIncome} />
      </div>

      {groupCandidates.length ? <>
        <div className="section-title compact-title">묶음수납 후보 <span>허장덕 · 조철만 · 주신평 · 합동/화물유지계약</span></div>
        <div className="admin-table-wrap modal-table-scroll">
          <table className="admin-table dense"><thead><tr><th>묶음</th><th>대상</th><th className="right">예상금액</th><th className="right">차액</th><th>처리</th></tr></thead><tbody>
            {groupCandidates.map(g=><tr key={g.code || g.title}>
              <td><b>{g.title}</b><br/><span className="tiny muted">{g.reason}</span></td>
              <td>{g.resolvedCount}/{g.targetCount}명 확인</td>
              <td className="right money">{formatWon(g.expectedAmount)}</td>
              <td className="right">{diffText(g.diff)}</td>
              <td><button className="btn mini green" onClick={()=>onGroupMatch(deposit.id, g.code)}>묶음반영</button></td>
            </tr>)}
          </tbody></table>
        </div>
      </> : null}

      {candidates.length ? <>
        <div className="section-title compact-title">추천 후보</div>
        <div className="admin-table-wrap modal-table-scroll">
          <table className="admin-table dense"><thead><tr><th>회원</th><th>차량번호</th><th>관리번호</th><th>비고/메모</th><th>매칭근거</th><th className="right">현재미수</th><th className="right">차액</th><th>처리</th></tr></thead><tbody>
            {candidates.map(c=><tr key={c.id}>
              <td><b>{c.name}</b></td>
              <td>{c.vehicleNo || c.vehicle_no || '-'}</td>
              <td>{c.mgmtNo || c.mgmt_no || '-'}</td>
              <td className="muted-cell memo-cell">{shortText(memberMemo(c) || '-', 40)}</td>
              <td className="muted-cell">{shortText(c.reason || c.reasons?.join(' · ') || '-', 52)}</td>
              <td className="right money">{formatWon(c.totalArrears || c.arrears_amount)}</td>
              <td className="right">{diffText(c.diff)}</td>
              <td className="action-cell">{INCOME_ACTIONS.map(a => <button key={a.label} className={a.value ? 'btn mini soft' : 'btn mini green'} onClick={()=>onMatch(deposit.id, c.id, a.value)}>{a.label}</button>)}</td>
            </tr>)}
          </tbody></table>
        </div>
      </> : null}

      <div className="section-title compact-title">회원 검색</div>
      <input className="input full" value={q} onChange={e=>setQ(e.target.value)} placeholder="이름 / 차량번호 / 관리번호 / 전화번호 검색" />
      <div className="admin-table-wrap modal-table-scroll mt8">
        <table className="admin-table dense"><thead><tr><th>이름</th><th>지역</th><th>차량번호</th><th>관리번호</th><th>구분</th><th>비고/메모</th><th className="right">현재미수</th><th>처리</th></tr></thead><tbody>
          {memberRows.map(m=><tr key={m.id}>
            <td><b>{m.name}</b></td>
            <td>{m.sigun || '-'}</td>
            <td>{m.vehicleNo || m.vehicle_no || '-'}</td>
            <td>{m.mgmtNo || m.mgmt_no || '-'}</td>
            <td>{m.membership || '-'}</td>
            <td className="muted-cell memo-cell">{shortText(memberMemo(m) || '-', 34)}</td>
            <td className="right money">{formatWon(m.totalArrears)}</td>
            <td className="action-cell">{INCOME_ACTIONS.map(a => <button key={a.label} className={a.value ? 'btn mini soft' : 'btn mini green'} onClick={()=>onMatch(deposit.id, m.id, a.value)}>{a.label}</button>)}</td>
          </tr>)}
          {loading && <tr><td colSpan={8} className="empty-cell compact">검색 중...</td></tr>}
          {!loading && !memberRows.length && <tr><td colSpan={8} className="empty-cell compact">검색 결과가 없습니다.</td></tr>}
        </tbody></table>
      </div>
    </div>
  </div>
}


function moneyNumber(v){
  const n = String(v || '').replace(/[^0-9-]/g, '')
  return Number(n || 0)
}

function parsePastedDeposits(text){
  const lines = String(text || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean)
  let header = null
  const rows = []
  for(const line of lines){
    const cols = line.includes('\t') ? line.split('\t').map(v => v.trim()) : line.split(/\s{2,}/).map(v => v.trim())
    const joined = cols.join(' ')
    if(/거래일자/.test(joined) && /입금/.test(joined)) { header = cols; continue }
    if(!cols.length || /합계|잔액조회|구분\s*거래일자/.test(joined)) continue

    const idx = (names) => header ? header.findIndex(h => names.some(n => String(h).replace(/\s/g,'').includes(n))) : -1
    let dateIdx = idx(['거래일자','일자'])
    let amountIdx = idx(['입금금액','입금액'])
    let memoIdx = idx(['거래기록사항','기록사항','입금자명','입금자'])
    let descIdx = idx(['거래내용','내용'])

    if(dateIdx < 0) dateIdx = cols.findIndex(c => /\d{2,4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(c))
    if(amountIdx < 0 && cols.length >= 4) amountIdx = 3
    if(memoIdx < 0 && cols.length >= 7) memoIdx = 6
    if(descIdx < 0 && cols.length >= 6) descIdx = 5

    const deposit_date = cols[dateIdx] || ''
    const amount = moneyNumber(cols[amountIdx])
    const memo = cols[memoIdx] || cols[descIdx] || ''
    const depositor_name = (memo || cols[2] || '').replace(/[0-9,원]/g,'').trim() || '미확인'
    if(!deposit_date || amount <= 0) continue
    rows.push({deposit_date, amount, memo, depositor_name, description: cols[descIdx] || ''})
  }
  return rows
}

function PasteDepositModal({onClose, onSaved}){
  const [text,setText]=useState('')
  const [saving,setSaving]=useState(false)
  const parsed = useMemo(()=>parsePastedDeposits(text),[text])
  async function save(){
    if(!parsed.length) return alert('인식된 입금 거래가 없습니다. 엑셀에서 거래일자/입금액/거래기록사항을 포함해 복사하세요.')
    if(!confirm(`붙여넣은 거래 ${parsed.length}건을 통장매칭에 저장할까요?`)) return
    setSaving(true)
    try{
      const res = await api.createDeposits(parsed)
      await onSaved?.()
      alert(`저장 완료: ${res.inserted || 0}건`)
      onClose()
    }catch(e){ alert(e.message || '붙여넣기 저장 실패') }
    finally{ setSaving(false) }
  }
  return <div className="modal-bg">
    <div className="modal wide paste-modal">
      <div className="modal-title-row">
        <div><h2>통장거래 붙여넣기</h2><p>엑셀/은행 거래내역을 복사해서 붙여넣으면 통장매칭 대기 거래로 저장합니다.</p></div>
        <button className="btn" onClick={onClose}>닫기</button>
      </div>
      <textarea className="textarea paste-textarea" value={text} onChange={e=>setText(e.target.value)} placeholder={'구분\t거래일자\t출금금액\t입금금액\t거래 후 잔액\t거래내용\t거래기록사항\n1\t2026-03-30\t\t30,000\t...\t폰신한은행\t김태형1824'} />
      <div className="paste-preview-head"><b>인식 결과 {parsed.length.toLocaleString()}건</b><span>입금액이 있는 행만 저장됩니다.</span></div>
      <div className="admin-table-wrap modal-table-scroll mt8">
        <table className="admin-table dense"><thead><tr><th>거래일자</th><th>입금자/기록</th><th className="right">입금액</th><th>내용</th></tr></thead><tbody>
          {parsed.slice(0,20).map((r,i)=><tr key={i}><td>{r.deposit_date}</td><td><b>{r.depositor_name}</b><br/><span className="muted-cell">{r.memo}</span></td><td className="right money">{formatWon(r.amount)}</td><td>{r.description || '-'}</td></tr>)}
          {!parsed.length && <tr><td colSpan={4} className="empty-cell compact">붙여넣은 거래내역이 아직 없습니다.</td></tr>}
        </tbody></table>
      </div>
      <div className="action-row right"><button className="btn" onClick={onClose}>취소</button><button className="btn primary" disabled={saving || !parsed.length} onClick={save}>통장매칭에 저장</button></div>
    </div>
  </div>
}

export default function BankMatching({data, matchDeposit, matchDepositGroup, excludeDeposit, resetPendingDeposits, navigate, reloadFromDb}){
  const [q,setQ]=useState('')
  const [status,setStatus]=useState('전체')
  const [resetKey,setResetKey]=useState(0)
  const [modal,setModal]=useState(null)
  const [showPaste,setShowPaste]=useState(false)
  const [openId,setOpenId]=useState(null)
  const [page,setPage]=useState(1)
  const pageSize = 50
  const [autoApplying,setAutoApplying]=useState(false)

  const deposits = data.deposits || []
  const members = data.members || []

  const summary=useMemo(()=>{
    const count=(st)=>deposits.filter(d=>getStatus(d)===st).length
    return {
      total: deposits.length,
      auto: count('자동매칭'),
      confirm: count('후보확인') + count('중복후보'),
      unmatched: count('미매칭'),
      done: count('매칭완료'),
      excluded: count('제외'),
    }
  },[deposits])

  const rows=useMemo(()=>{
    return deposits.filter(d=>{
      const best = getBestCandidate(d, members)
      const text=normalizeText([d.depositorName,d.memo,d.description,d.status,d.matchStatus,best?.name,best?.vehicleNo,best?.vehicle_no,best?.mgmtNo,best?.mgmt_no,memberMemo(best),d.hint].join(' '))
      const okQ=!q.trim() || text.includes(normalizeText(q))
      const st=getStatus(d)
      const okS=status==='전체' || st===status || (status==='처리대기' && !['매칭완료','제외'].includes(st)) || (status==='확인필요' && ['후보확인','중복후보'].includes(st))
      return okQ && okS
    }).sort((a,b)=>{
      const rank = {'자동매칭':1,'후보확인':2,'중복후보':3,'미매칭':4,'대기':5,'매칭완료':9,'제외':10}
      return (rank[getStatus(a)]||8) - (rank[getStatus(b)]||8)
    })
  },[deposits,members,q,status])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = rows.slice((page-1)*pageSize, page*pageSize)

  async function doMatch(depositId, memberId, chargeItem=null){
    await matchDeposit(depositId, memberId, chargeItem)
    setModal(null)
  }

  async function doGroupMatch(depositId, groupCode=null){
    await matchDepositGroup?.(depositId, groupCode)
    setModal(null)
  }

  async function doIncomeOnly(depositId, chargeItem){
    const label = chargeItem === '협회가입비' ? '가수금' : chargeItem === '자격증명발급비' ? '잡수입' : '기타수입'
    if(!confirm(`이 입금건을 ${label}으로 처리할까요?
회원 미수금은 차감하지 않고 통장내역만 완료 처리합니다.`)) return
    await api.matchDepositIncome(depositId, {charge_item: chargeItem})
    setModal(null)
    await reloadFromDb?.()
  }

  const handleAutoAll = async () => {
    const targets = rows.filter(d => getStatus(d) === '자동매칭' && getBestCandidate(d, members))
    if(!targets.length) return alert('자동매칭 대상이 없습니다.')
    if(!confirm(`자동매칭 ${targets.length}건을 수납 반영할까요?\n반영 전 후보가 맞는지 확인하세요.`)) return
    setAutoApplying(true)
    try{
      // 여러 건을 브라우저에서 1건씩 연속 호출하면 화면이 멈추거나 빈 화면처럼 보일 수 있어
      // 서버 일괄 반영 API를 우선 사용하고, 없으면 기존 개별 반영으로 fallback 한다.
      if(api.autoMatchAllDeposits){
        const res = await api.autoMatchAllDeposits()
        await reloadFromDb?.()
        alert(`자동매칭 반영 완료: ${res.matched || 0}건${res.skipped ? ` / 제외 ${res.skipped}건` : ''}`)
      }else{
        let ok = 0
        for(const d of targets){
          const best = getBestCandidate(d, members)
          if(!best) continue
          await matchDeposit(d.id, best.id)
          ok += 1
        }
        await reloadFromDb?.()
        alert(`자동매칭 반영 완료: ${ok}건`)
      }
    }catch(e){
      alert(e.message || '자동매칭 전체 반영 중 오류가 발생했습니다.')
    }finally{
      setAutoApplying(false)
    }
  }

  const resetFilters = () => {
    setQ('')
    setStatus('전체')
    setPage(1)
    setOpenId(null)
    setModal(null)
    setResetKey(v => v + 1)
  }

  async function resetResults(){
    if(!confirm('현재 통장매칭 결과를 초기화합니다. 수납 반영되지 않은 거래가 사라질 수 있습니다. 계속하시겠습니까?')) return
    setQ('')
    setStatus('전체')
    setPage(1)
    setOpenId(null)
    setModal(null)
    setResetKey(v => v + 1)
    await resetPendingDeposits?.()
  }

  return <div className="admin-page compact-page">
    <PageHead title="통장매칭" desc="입금자명·입금액·거래기록을 회원 미수금과 대조해 수납으로 반영합니다.">
      <button className="btn soft" onClick={()=>navigate?.('import')}>거래내역 업로드</button>
      <button className="btn soft paste-btn" onClick={()=>setShowPaste(true)}>붙여넣기 입력</button>
      <button className="btn green" disabled={autoApplying} onClick={handleAutoAll}>{autoApplying ? '반영 중...' : '자동매칭 전체 반영'}</button>
      <button className="btn danger-soft" onClick={resetResults}>매칭결과 초기화</button>
    </PageHead>

    <div className="compact-summary match-summary">
      <div><b>전체 거래</b><strong>{summary.total.toLocaleString()}건</strong><span>업로드된 원본</span></div>
      <div><b>자동매칭</b><strong className="green-text">{summary.auto.toLocaleString()}건</strong><span>바로 반영 후보</span></div>
      <div><b>확인 필요</b><strong className="orange-text">{summary.confirm.toLocaleString()}건</strong><span>후보확인/중복</span></div>
      <div><b>미매칭</b><strong className="red-text">{summary.unmatched.toLocaleString()}건</strong><span>수동검색 필요</span></div>
      <div><b>완료/제외</b><strong>{(summary.done+summary.excluded).toLocaleString()}건</strong><span>처리 끝</span></div>
    </div>

    <Card className="filter-card compact-filter" key={`bank-filter-${resetKey}`}>
      <input key={`bank-q-${resetKey}`} className="input search-wide" value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="입금자명 / 거래기록 / 회원명 / 차량번호 검색" />
      <select key={`bank-status-${resetKey}`} className="select" value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}>
        <option>전체</option><option>처리대기</option><option>자동매칭</option><option>확인필요</option><option>후보확인</option><option>중복후보</option><option>미매칭</option><option>매칭완료</option><option>제외</option>
      </select>
      <button className="btn primary" onClick={()=>setPage(1)}>조회</button>
      <button className="btn reset-btn" type="button" onClick={(e)=>{e.preventDefault(); e.stopPropagation(); resetFilters()}}>필터 초기화</button>
    </Card>

    <Card className="table-card compact-table-card">
      <div className="table-title-row">
        <b>매칭 결과</b>
        <span>총 {rows.length.toLocaleString()}건 · {page} / {totalPages}</span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table match-table">
          <thead>
            <tr>
              <th>거래일자</th>
              <th>입금자명</th>
              <th>거래기록사항</th>
              <th className="right">입금액</th>
              <th>상태</th>
              <th>추천회원</th>
              <th>차량번호</th>
              <th className="right">현재미수/차액</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(d=>{
              const group=getGroupCandidate(d)
              const best=getBestCandidate(d, members)
              const st=getStatus(d)
              const done=['매칭완료','제외'].includes(st)
              const amount = Number(d.amount)||0
              const arrears = Number(group?.expectedAmount || best?.totalArrears || best?.arrears_amount || d.currentArrears || 0)
              const diff = group ? group.diff : best ? (best.diff ?? d.difference ?? amount - arrears) : null
              const isOpen = openId === d.id
              return <React.Fragment key={d.id}>
                <tr className={done ? 'muted-row' : ''}>
                  <td className="mono nowrap">{d.depositDate || '-'}</td>
                  <td><b>{d.depositorName || '-'}</b></td>
                  <td className="clip-cell" title={d.memo || d.description || ''}>{shortText(d.memo || d.description || '-', 46)}</td>
                  <td className="right money nowrap">{formatWon(amount)}</td>
                  <td><StatusBadge status={st}/>{d.candidateCount>1 && <div className="tiny muted">후보 {d.candidateCount}명</div>}</td>
                  <td><b>{group ? group.title : best?.name || '-'}</b><div className="tiny muted">{group ? `묶음 ${group.resolvedCount}/${group.targetCount}명` : best ? (best.mgmtNo || best.mgmt_no || '') : '수동매칭 필요'}</div>{!group && best && memberMemo(best) && <div className="tiny memo-line">{shortText(memberMemo(best), 38)}</div>}{d.hint && <div className="tiny muted">{shortText(d.hint, 38)}</div>}</td>
                  <td className="nowrap">{group ? '대납자 묶음' : best?.vehicleNo || best?.vehicle_no || '-'}</td>
                  <td className="right nowrap"><b>{(group || best) ? formatWon(arrears) : '-'}</b><div className="tiny muted">{(group || best) ? diffText(diff) : '-'}</div></td>
                  <td className="action-cell left">
                    {!done && group && <button className="btn mini green" onClick={()=>doGroupMatch(d.id, group.code)}>묶음반영</button>}
                    {!done && !group && <button className="btn mini green" disabled={!best} onClick={()=>doMatch(d.id, best.id)}>반영</button>}
                    {!done && <button className="btn mini soft" onClick={()=>setModal(d)}>{best?'후보':'수동'}</button>}
                    {!done && !best && !group && <IncomeOnlyButtons deposit={d} onIncome={doIncomeOnly} />}
                    {!done && <button className="btn mini" onClick={()=>excludeDeposit(d.id)}>제외</button>}
                    <button className="btn mini" onClick={()=>setOpenId(isOpen?null:d.id)}>{isOpen?'닫기':'원문'}</button>
                    {done && <span className="tiny muted">완료</span>}
                  </td>
                </tr>
                {isOpen && <DepositDetail deposit={d}/>} 
              </React.Fragment>
            })}
            {!pageRows.length && <tr><td colSpan={9} className="empty-cell compact">매칭할 거래내역이 없습니다. 거래내역을 업로드하거나 붙여넣기 해주세요.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pager-row">
        <span>{rows.length ? `${((page-1)*pageSize)+1}-${Math.min(page*pageSize, rows.length)} / ${rows.length.toLocaleString()}건` : '0건'}</span>
        <div>
          <button className="btn mini" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>이전</button>
          <button className="btn mini" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>다음</button>
        </div>
      </div>
    </Card>
    <ManualMatchModal deposit={modal} members={members} onClose={()=>setModal(null)} onMatch={doMatch} onGroupMatch={doGroupMatch} onIncome={doIncomeOnly}/>
    {showPaste && <PasteDepositModal onClose={()=>setShowPaste(false)} onSaved={reloadFromDb}/>}
  </div>
}
