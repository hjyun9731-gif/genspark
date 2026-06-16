import React, { useMemo, useState } from 'react'
import { Card, PageHead, Badge, formatWon } from '../components.jsx'
import { api } from '../api.js'


const INCOME_ITEMS = [
  { value: '협회비', label: '협회비', accounting: '회비수입', tone: 'lavender' },
  { value: '관리비', label: '관리비', accounting: '회비수입', tone: 'sky' },
  { value: '협회가입비', label: '협회가입비', accounting: '가수금', tone: 'pink' },
  { value: '자격증명발급비', label: '자격증명발급비', accounting: '잡수입', tone: 'yellow' },
  { value: '기타', label: '기타', accounting: '기타수입', tone: 'green' },
]

function accountingType(item){
  return INCOME_ITEMS.find(x => x.value === item)?.accounting || '회비수입'
}

function inferChargeItem(member, deposit){
  const text = normalizeText([deposit?.depositorName, deposit?.memo, deposit?.description].join(' '))
  if(text.includes('가입비') || text.includes('협회가입') || text.includes('신규가입')) return '협회가입비'
  if(text.includes('자격증명') || text.includes('발급비') || text.includes('재발급')) return '자격증명발급비'
  return member?.chargeItem || member?.charge_item || '관리비'
}

function itemTone(item){
  return INCOME_ITEMS.find(x => x.value === item)?.tone || 'soft'
}

const STATUS_TONE = {
  '자동매칭': 'green',
  '후보확인': 'orange',
  '중복후보': 'purple',
  '미매칭': 'red',
  '묶음수납': 'purple',
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

function normalizeText(v){
  return String(v || '').replace(/\s+/g, '').toLowerCase()
}

function memberSearchText(m){
  return normalizeText([
    m.name, m.vehicleNo, m.vehicle_no, m.mgmtNo, m.mgmt_no, m.phone, m.sigun,
    m.memo, m.note, m.remark, m.remarks
  ].join(' '))
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
      </div>
    </td>
  </tr>
}

function ManualMatchModal({deposit, members, onClose, onMatch, onIncomeOnly, onGroupMatch, onExclude}){
  const [q,setQ]=useState('')
  const [chargeItem,setChargeItem]=useState(()=>inferChargeItem(deposit?.bestCandidate, deposit))
  const candidates = deposit?.candidates || []
  const groupCandidates = deposit?.groupCandidates || (deposit?.groupCandidate ? [deposit.groupCandidate] : [])
  const hasQuery = q.trim().length > 0
  const isNonArrears = ['협회가입비','자격증명발급비','기타'].includes(chargeItem)
  const memberRows = useMemo(()=>{
    const base = (members || []).filter(m => m.status === '정상')
    if(!q.trim()) return []
    const s = normalizeText(q)
    return base.filter(m => memberSearchText(m).includes(s)).slice(0,60)
  },[members,q])
  if(!deposit) return null
  return <div className="modal-bg">
    <div className="modal wide match-modal clean-match-modal">
      <div className="modal-title-row">
        <div>
          <h2>후보 확인 / 수동매칭</h2>
          <p>자동 후보가 애매하면 회원을 검색해서 선택하세요. 관련 없는 회원 목록은 기본으로 펼치지 않습니다.</p>
        </div>
        <button className="btn" onClick={onClose}>닫기</button>
      </div>

      <div className="deposit-hero">
        <div><span>입금자명</span><b>{deposit.depositorName || '-'}</b></div>
        <div><span>입금액</span><b>{formatWon(deposit.amount)}</b></div>
        <div><span>거래일자</span><b>{deposit.depositDate || '-'}</b></div>
        <div><span>상태</span><StatusBadge status={getStatus(deposit)}/></div>
      </div>

      <div className="match-guide-box">
        <b>이 입금건 처리 방법</b>
        <div>
          <span>① 허장덕/조철만/주신평은 <b>묶음수납 반영</b></span>
          <span>② 추천 후보가 맞으면 <b>반영</b></span>
          <span>③ 없으면 아래에서 <b>회원 검색 후 선택</b></span>
          <span>④ 협회 입금이 아니면 <b>제외</b></span>
        </div>
      </div>

      <div className="income-select-panel clean-income">
        <div>
          <b>수납항목</b>
          <p>{isNonArrears ? '선택한 항목은 미수금 차감 없이 수납내역에만 기록됩니다. 회원과 무관한 입금이면 오른쪽 단독 반영을 누르세요.' : '협회비/관리비는 선택 회원의 미수금에서 차감됩니다.'}</p>
        </div>
        <select className="select" value={chargeItem} onChange={e=>setChargeItem(e.target.value)}>
          {INCOME_ITEMS.map(item => <option key={item.value} value={item.value}>{item.label} · {item.accounting}</option>)}
        </select>
        <Badge tone={itemTone(chargeItem)}>{accountingType(chargeItem)}</Badge>
        {isNonArrears && <button className="btn green income-only-btn" onClick={()=>{
          const label = `${chargeItem}(${accountingType(chargeItem)})`
          if(confirm(`회원 선택 없이 ${label} ${formatWon(deposit.amount)}을 반영할까요?`)){
            onIncomeOnly?.(deposit.id, chargeItem)
          }
        }}>회원 없이 {accountingType(chargeItem)} 반영</button>}
      </div>

      {groupCandidates.length ? <>
        <div className="section-title compact-title">묶음수납 후보 <span>허장덕 · 조철만 · 주신평 등 대납자 사전 일치</span></div>
        <div className="group-candidate-list">
          {groupCandidates.map(g => <div className="group-candidate-card" key={g.code || g.title}>
            <div className="group-candidate-head">
              <div>
                <b>{g.title || g.code}</b>
                <span>{g.resolvedCount || 0}/{g.targetCount || 0}명 확인 · 예상 {formatWon(g.expectedAmount || 0)} · 입금 {formatWon(g.depositAmount || deposit.amount || 0)} · {diffText(g.diff)}</span>
              </div>
              <button className="btn green" onClick={()=>{
                if(confirm(`${g.title || g.code} 묶음수납으로 ${formatWon(g.depositAmount || deposit.amount)}을 반영할까요?`)) onGroupMatch?.(deposit.id, g.code)
              }}>묶음수납 반영</button>
            </div>
            <div className="group-target-grid">
              {(g.targets || []).map((t,idx)=><div className={'group-target '+(t.resolved?'':'unresolved')} key={idx}>
                <b>{t.memberName || t.name}</b>
                <span>{t.vehicleNo || `뒤4자리 ${t.vehicleLast4 || '-'}`} · {t.mgmtNo || (t.resolved ? '-' : '회원확인필요')}</span>
                <em>{formatWon(t.amount || 0)}</em>
              </div>)}
            </div>
          </div>)}
        </div>
      </> : null}

      {candidates.length ? <>
        <div className="section-title compact-title">추천 후보 <span>근거가 있는 후보만 표시</span></div>
        <div className="candidate-card-list">
          {candidates.map(c=>{
            const arrears = Number(c.totalArrears || c.arrears_amount || 0)
            return <div className="candidate-card" key={c.id}>
              <div className="candidate-main">
                <b>{c.name}</b>
                <span>{c.vehicleNo || c.vehicle_no || '-'} · {c.mgmtNo || c.mgmt_no || '-'}</span>
                <em>{shortText(c.reason || c.reasons?.join(' · ') || '-', 72)}</em>
              </div>
              <div className="candidate-money">
                <span>현재미수</span>
                <b>{formatWon(arrears)}</b>
                <em>{diffText(c.diff)}</em>
              </div>
              <button className="btn green" onClick={()=>onMatch(deposit.id, c.id, chargeItem)}>이 후보로 반영</button>
            </div>
          })}
        </div>
      </> : <div className="no-candidate-box">추천 후보가 없습니다. 아래 검색창에 이름, 차량번호 뒤4자리, 관리번호, 전화번호를 입력하세요.</div>}

      <div className="manual-search-panel">
        <div className="section-title compact-title">회원 검색 <span>검색어 입력 전에는 아무 목록도 보여주지 않습니다</span></div>
        <input className="input full" value={q} onChange={e=>setQ(e.target.value)} autoFocus placeholder="이름 / 차량번호 뒤4자리 / 관리번호 / 전화번호 검색" />
        {!hasQuery ? <div className="search-empty-help">예: 김남진, 2107, 신25-81, 010 뒤4자리</div> :
          <div className="manual-result-list">
            {memberRows.map(m=>{
              const arrears = Number(m.totalArrears || 0)
              return <div className="manual-member-row" key={m.id}>
                <div>
                  <b>{m.name}</b>
                  <span>{m.sigun || '-'} · {m.vehicleNo || m.vehicle_no || '-'} · {m.mgmtNo || m.mgmt_no || '-'}</span>
                  <em>{m.membership || '-'} / {m.phone || '-'}</em>
                  {m.memo ? <em>비고: {shortText(m.memo, 42)}</em> : null}
                </div>
                <div className={arrears < 0 ? 'money advance' : 'money'}>{formatWon(arrears)}</div>
                <button className="btn green" onClick={()=>onMatch(deposit.id, m.id, chargeItem)}>선택 반영</button>
              </div>
            })}
            {!memberRows.length && <div className="empty-cell compact">검색 결과가 없습니다. 이름 일부나 차량번호 숫자만 다시 입력해보세요.</div>}
          </div>
        }
      </div>

      <div className="modal-bottom-actions">
        <button className="btn" onClick={onClose}>닫기</button>
        <button className="btn danger-soft" onClick={()=>{ if(confirm('이 입금건을 통장매칭 대상에서 제외할까요?')) { onExclude?.(deposit.id); onClose(); }}}>이 입금건 제외</button>
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

export default function BankMatching({data, matchDeposit, matchDepositIncome, matchDepositGroup, excludeDeposit, resetPendingDeposits, navigate, reloadFromDb}){
  const [q,setQ]=useState('')
  const [status,setStatus]=useState('전체')
  const [resetKey,setResetKey]=useState(0)
  const [modal,setModal]=useState(null)
  const [showPaste,setShowPaste]=useState(false)
  const [openId,setOpenId]=useState(null)
  const [page,setPage]=useState(1)
  const pageSize = 50

  const deposits = data.deposits || []
  const members = data.members || []

  const summary=useMemo(()=>{
    const count=(st)=>deposits.filter(d=>getStatus(d)===st).length
    return {
      total: deposits.length,
      auto: count('자동매칭'),
      confirm: count('후보확인') + count('중복후보') + count('묶음수납'),
      unmatched: count('미매칭'),
      done: count('매칭완료'),
      excluded: count('제외'),
    }
  },[deposits])

  const rows=useMemo(()=>{
    return deposits.filter(d=>{
      const best = getBestCandidate(d, members)
      const text=normalizeText([d.depositorName,d.memo,d.description,d.status,d.matchStatus,best?.name,best?.vehicleNo,best?.vehicle_no,best?.mgmtNo,best?.mgmt_no].join(' '))
      const okQ=!q.trim() || text.includes(normalizeText(q))
      const st=getStatus(d)
      const okS=status==='전체' || st===status || (status==='처리대기' && !['매칭완료','제외'].includes(st)) || (status==='확인필요' && ['후보확인','중복후보','묶음수납'].includes(st))
      return okQ && okS
    }).sort((a,b)=>{
      const rank = {'자동매칭':1,'묶음수납':2,'후보확인':3,'중복후보':4,'미매칭':5,'대기':6,'매칭완료':9,'제외':10}
      return (rank[getStatus(a)]||8) - (rank[getStatus(b)]||8)
    })
  },[deposits,members,q,status])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = rows.slice((page-1)*pageSize, page*pageSize)

  async function doMatch(depositId, memberId, chargeItem=null){
    await matchDeposit(depositId, memberId, chargeItem)
    setModal(null)
  }

  async function doIncomeOnly(depositId, chargeItem='기타'){
    await matchDepositIncome?.(depositId, chargeItem)
    setModal(null)
  }

  async function doGroupMatch(depositId, groupCode=null){
    await matchDepositGroup?.(depositId, groupCode)
    setModal(null)
  }

  const handleAutoAll = async () => {
    const targets = rows.filter(d => getStatus(d) === '자동매칭' && getBestCandidate(d, members))
    if(!targets.length) return alert('자동매칭 대상이 없습니다.')
    if(!confirm(`자동매칭 ${targets.length}건을 수납 반영할까요?\n반영 전 후보가 맞는지 확인하세요.`)) return
    for(const d of targets){
      const best = getBestCandidate(d, members)
      await matchDeposit(d.id, best.id, inferChargeItem(best, d))
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
      <button className="btn green" onClick={handleAutoAll}>자동매칭 전체 반영</button>
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
        <option>전체</option><option>처리대기</option><option>자동매칭</option><option>묶음수납</option><option>확인필요</option><option>후보확인</option><option>중복후보</option><option>미매칭</option><option>매칭완료</option><option>제외</option>
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
              const best=getBestCandidate(d, members)
              const group=d.groupCandidate || (d.groupCandidates && d.groupCandidates[0])
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
                  <td><b>{group ? group.title : best?.name || '-'}</b><div className="tiny muted">{group ? `묶음 ${group.resolvedCount}/${group.targetCount}명` : best ? (best.mgmtNo || best.mgmt_no || '') : '수동매칭 필요'}</div></td>
                  <td className="nowrap">{group ? '대납자 묶음' : best?.vehicleNo || best?.vehicle_no || '-'}</td>
                  <td className="right nowrap"><b>{best ? formatWon(arrears) : '-'}</b><div className="tiny muted">{best ? diffText(diff) : '-'}</div></td>
                  <td className="action-cell left">
                    {!done && group && <button className="btn mini green" onClick={()=>doGroupMatch(d.id, group.code)}>묶음반영</button>}
                    {!done && !group && <button className="btn mini green" disabled={!best} onClick={()=>doMatch(d.id, best.id, inferChargeItem(best, d))}>반영</button>}
                    {!done && <button className="btn mini soft" onClick={()=>setModal(d)}>{best?'후보':'수동'}</button>}
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
    <ManualMatchModal deposit={modal} members={members} onClose={()=>setModal(null)} onMatch={doMatch} onIncomeOnly={doIncomeOnly} onGroupMatch={doGroupMatch} onExclude={excludeDeposit}/>
    {showPaste && <PasteDepositModal onClose={()=>setShowPaste(false)} onSaved={reloadFromDb}/>}
  </div>
}
