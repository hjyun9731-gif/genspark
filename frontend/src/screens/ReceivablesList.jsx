import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Card, PageHead, formatWon, formatNum } from '../components.jsx'
import { SIGUN, getOpenArrears } from '../data.js'

const PER_PAGE = 50

const INCOME_ITEMS = [
  { value: '협회비', label: '협회비', accounting: '회비수입', tone: 'lavender' },
  { value: '관리비', label: '관리비', accounting: '회비수입', tone: 'sky' },
  { value: '협회가입비', label: '협회가입비', accounting: '가수금', tone: 'pink' },
  { value: '자격증명발급비', label: '자격증명발급비', accounting: '잡수입', tone: 'yellow' },
  { value: '기타', label: '기타', accounting: '기타수입', tone: 'green' },
]
function incomeMeta(item){ return INCOME_ITEMS.find(x => x.value === item) || { value:item || '-', label:item || '-', accounting:'회비수입', tone:'soft' } }


function memoParts(member){
  return String(member.memo || '').split(/\s*\/\s*/).map(v => v.trim()).filter(Boolean)
}
function extractInfo(member, key){
  const found = memoParts(member).find(v => v.startsWith(key + ':'))
  return found ? found.slice(key.length + 1).trim() : ''
}
function addressOf(member){ return extractInfo(member, '주소') || member.regionRaw || '-' }
function bizNoOf(member){ return extractInfo(member, '사업자등록번호') || '-' }
function officialAddressOf(member){ return extractInfo(member, '공문주소') || '-' }
function noteOf(member){
  return memoParts(member)
    .filter(v => !['주소:','사업자등록번호:','공문주소:','비고:','전화메모:','부과시작일:'].some(prefix => v.startsWith(prefix)))
    .join(' / ')
}
function normalizeDisplayDate(value){
  const s = String(value || '').trim()
  if (!s || s === '-') return '-'
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return s
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const currentYear = new Date().getFullYear()
  const yy = year % 100
  // 엑셀 21.08.27 같은 값이 2027-08-21처럼 뒤집혀 들어온 경우 보정
  if (year > currentYear && yy >= 1 && yy <= 31 && day >= 1 && day <= 31) {
    const fixedYear = 2000 + day
    const fixedDay = yy
    if (fixedYear <= currentYear) {
      return `${fixedYear}-${String(month).padStart(2, '0')}-${String(fixedDay).padStart(2, '0')}`
    }
  }
  return s
}
function startDateOf(member){ return normalizeDisplayDate(extractInfo(member, '부과시작일') || member.billingStartYm || '-') }
function billingBasisDate(member){
  const raw = (member.chargeItem === '협회비' || member.membership === '협회가입') ? member.assocJoinDate : member.certIssueDate
  return normalizeDisplayDate(raw || '-')
}
function currentArrear(member){
  const open = getOpenArrears(member)
  return open.length ? open[open.length - 1] : null
}
function basisYm(member){
  const ar = currentArrear(member)
  return ar?.ym || member.billingStartYm || '-'
}
function arrearsMonthCount(member){
  const amount = Number(member.totalArrears) || 0
  const monthly = Number(member.monthlyCharge) || 0
  if (amount <= 0) return 0
  if (monthly > 0) return Math.max(1, Math.ceil(amount / monthly))
  return Number(member.arrearsMonths) || 1
}
function normText(value){
  return String(value || '').replace(/[^0-9a-zA-Z가-힣]/g, '').toLowerCase()
}
function last4(value){
  const m = normText(value).match(/(\d{4})(?!.*\d)/)
  return m ? m[1] : ''
}
function paymentMatchesMember(payment, member){
  const memberId = String(member.id ?? '')
  const paymentMemberId = String(payment.memberId ?? payment.member_id ?? '')
  if (memberId && paymentMemberId && memberId === paymentMemberId) return true

  const memberVehicle = normText(member.vehicleNo || member.vehicle_no)
  const paymentVehicle = normText(payment.vehicleNo || payment.vehicle_no)
  if (memberVehicle && paymentVehicle && memberVehicle === paymentVehicle) return true

  const memberMgmt = normText(member.mgmtNo || member.mgmt_no)
  const paymentMgmt = normText(payment.mgmtNo || payment.mgmt_no || payment.managementNo || payment.management_no)
  if (memberMgmt && paymentMgmt && memberMgmt === paymentMgmt) return true

  const memberName = normText(member.name)
  const paymentName = normText(payment.name)
  const paymentMemo = normText(payment.memo || payment.depositorName || payment.depositor_name || '')
  const memberTail = last4(member.vehicleNo || member.vehicle_no)
  const paymentText = [paymentVehicle, paymentMemo, normText(payment.name)].join(' ')

  // 통장매칭 수납은 member_id가 저장되는 게 정상이지만, 예전 반영분/마이그레이션분은
  // id가 비어 있을 수 있어 이름+차량뒤4자리까지 보조로 연결한다.
  if (memberName && paymentName && memberName === paymentName) {
    if (!memberTail) return true
    if (paymentText.includes(memberTail)) return true
    if (paymentVehicle && last4(paymentVehicle) === memberTail) return true
  }
  return false
}
function memberPayments(data, member){
  return [...(data.payments || [])]
    .filter(payment => paymentMatchesMember(payment, member))
    .sort((a, b) => String(b.paidDate || b.paid_date || b.createdAt || '').localeCompare(String(a.paidDate || a.paid_date || a.createdAt || '')))
}
function paymentSearchText(payment){
  return [payment.name, payment.vehicleNo, payment.vehicle_no, payment.mgmtNo, payment.mgmt_no, payment.method, payment.paidForYm, payment.paid_for_ym, payment.chargeItem, payment.charge_item, payment.memo].join(' ').toLowerCase()
}
function recentPaymentText(payments){
  if (!payments.length) return '-'
  const p = payments[0]
  return `${p.paidDate || (p.createdAt || '').slice(0,10) || '-'} · ${formatWon(p.amount)} · ${p.method || '-'}`
}
function makeMemoFromFields(fields){
  const parts = []
  if(fields.address) parts.push(`주소:${fields.address}`)
  if(fields.bizNo) parts.push(`사업자등록번호:${fields.bizNo}`)
  if(fields.officialAddress) parts.push(`공문주소:${fields.officialAddress}`)
  if(fields.note) parts.push(fields.note)
  return parts.join(' / ')
}

export default function ReceivablesList({ data, preset, setPreset, saveMemo, updateMember, applyPayment, registerClosure }){
  const [searchInput, setSearchInput] = useState(preset?.q || '')
  const [q, setQ] = useState(preset?.q || '')
  const [sigun, setSigun] = useState(preset?.sigun || '전체')
  const [membership, setMembership] = useState('전체')
  const [account, setAccount] = useState('전체')
  const [amount, setAmount] = useState(preset?.amount || '전체')
  const [status, setStatus] = useState('정상')
  const [special, setSpecial] = useState(preset?.special || '')
  const [sortKey, setSortKey] = useState('amount')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [quickPay, setQuickPay] = useState(null)
  const [quickClose, setQuickClose] = useState(null)
  const [editMember, setEditMember] = useState(null)
  const [paymentMember, setPaymentMember] = useState(null)
  const [highlightMemberId, setHighlightMemberId] = useState(preset?.memberId || null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(searchInput)
      setPage(1)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  React.useEffect(() => {
    if (!preset) return
    setSearchInput(preset.q || '')
    setQ(preset.q || '')
    setSigun(preset.sigun || '전체')
    setAmount(preset.amount || '전체')
    setStatus(preset.status || '정상')
    setSpecial(preset.special || '')
    setHighlightMemberId(preset.memberId || null)
    setPage(1)
    if (preset.memberId && preset.openPayments) {
      const target = data.members.find(member => String(member.id) === String(preset.memberId))
      if (target) setPaymentMember(target)
    }
    setPreset?.(null)
  }, [preset, setPreset])

  const regionCounts = useMemo(() => {
    const counts = { 전체: 0 }
    data.members.forEach(member => {
      if (member.status !== '정상') return
      counts.전체 += 1
      counts[member.sigun || '미분류'] = (counts[member.sigun || '미분류'] || 0) + 1
    })
    return counts
  }, [data.members])

  const rows = useMemo(() => {
    let arr = [...data.members]
    const hasSearch = q.trim().length > 0
    if (status !== '전체') arr = arr.filter(member => member.status === status)
    // 미수금명단은 이름과 달리 '미수자만'이 아니라 협회 관리 대상 전체 명단이다.
    // 0원 완납자, 선입금/초과입금(-금액) 회원도 빠지면 안 된다.
    if (amount === '미수있음') arr = arr.filter(member => Number(member.totalArrears) > 0)
    if (amount === '완납') arr = arr.filter(member => Number(member.totalArrears) === 0)
    if (amount === '선납') arr = arr.filter(member => Number(member.totalArrears) < 0)
    if (amount === '30만원이상') arr = arr.filter(member => Number(member.totalArrears) >= 300000)
    if (sigun !== '전체') arr = arr.filter(member => member.sigun === sigun)
    if (membership !== '전체') arr = arr.filter(member => member.membership === membership)
    if (account !== '전체') arr = arr.filter(member => member.chargeItem === account)
    if (special === '장기') arr = arr.filter(member => arrearsMonthCount(member) >= 12)
    if (special === '결번') arr = arr.filter(member => member.disconnected)
    if (special === '자격') arr = arr.filter(member => member.certMissing)
    if (q.trim()) {
      const keyword = q.trim().toLowerCase()
      arr = arr.filter(member => {
        const memberHit = [
          member.name, member.vehicleNo, member.mgmtNo, member.phone, member.sigun, member.regionRaw,
          member.memo, addressOf(member), bizNoOf(member), officialAddressOf(member), member.chargeItem,
        ].join(' ').toLowerCase().includes(keyword)
        const paymentHit = memberPayments(data, member).some(payment => paymentSearchText(payment).includes(keyword))
        return memberHit || paymentHit
      })
    }
    if (highlightMemberId) {
      arr = arr.sort((a, b) => String(a.id) === String(highlightMemberId) ? -1 : String(b.id) === String(highlightMemberId) ? 1 : 0)
    }
    const regionOrder = Object.fromEntries(SIGUN.map((name, idx) => [name, idx]))
    const valueOf = (member) => {
      if (sortKey === 'amount') return Number(member.totalArrears) || 0
      if (sortKey === 'months') return arrearsMonthCount(member)
      if (sortKey === 'region') return regionOrder[member.sigun] ?? 999
      if (sortKey === 'vehicle') return member.vehicleNo || ''
      if (sortKey === 'name') return member.name || ''
      if (sortKey === 'ym') return basisYm(member) || ''
      if (sortKey === 'basis') return billingBasisDate(member) || ''
      return Number(member.totalArrears) || 0
    }
    return arr.sort((a, b) => {
      const av = valueOf(a)
      const bv = valueOf(b)
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv), 'ko', { numeric: true })
      if (cmp === 0 && sortKey === 'region') {
        const moneyCmp = (Number(b.totalArrears) || 0) - (Number(a.totalArrears) || 0)
        if (moneyCmp !== 0) return moneyCmp
        return String(a.vehicleNo || '').localeCompare(String(b.vehicleNo || ''), 'ko', { numeric: true })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data.members, data.payments, q, sigun, membership, account, amount, status, special, sortKey, sortDir, highlightMemberId])

  const totalArrears = rows.reduce((sum, member) => sum + (Number(member.totalArrears) || 0), 0)
  const over300k = rows.filter(member => Number(member.totalArrears) >= 300000).length
  const longOverdue = rows.filter(member => arrearsMonthCount(member) >= 12).length
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function paymentsFor(member){ return memberPayments(data, member) }

  function resetFilters(){
    setSearchInput('')
    setQ('')
    setSigun('전체')
    setMembership('전체')
    setAccount('전체')
    setAmount('전체')
    setStatus('정상')
    setSpecial('')
    setSortKey('amount')
    setSortDir('desc')
    setSelected(null)
    setQuickPay(null)
    setQuickClose(null)
    setEditMember(null)
    setPaymentMember(null)
    setHighlightMemberId(null)
    setPage(1)
  }

  function exportCSV(){
    const head = ['지역','차량번호','이름','계정','부과기준일','기준월','미수개월수','현재잔액','핸드폰번호','주소','처리상태']
    const lines = [head.join(',')].concat(rows.map(member => [
      member.sigun || '-', member.vehicleNo, member.name, member.chargeItem, billingBasisDate(member), basisYm(member), arrearsMonthCount(member),
      member.totalArrears || 0, member.phone || '-', addressOf(member), member.status || '-',
    ].map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')))
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    link.download = '미수금명단.csv'
    link.click()
  }

  return <div className="screen-shell admin-screen receivables-screen">
    <PageHead title="미수금명단" desc="지역별 미수자를 한 화면에서 확인하고 바로 처리합니다.">
      <button type="button" className="btn mini reset-btn" onClick={resetFilters}>초기화</button>
      <button type="button" className="btn soft mini" onClick={exportCSV}>엑셀 다운로드</button>
    </PageHead>

    <div className="summary-strip four">
      <div className="summary-box"><span>검색 결과</span><strong>{formatNum(rows.length)}명</strong></div>
      <div className="summary-box"><span>현재잔액 합계</span><strong className="money-main">{formatWon(totalArrears)}</strong></div>
      <div className="summary-box"><span>30만원 이상</span><strong className="money-sub">{formatNum(over300k)}명</strong></div>
      <div className="summary-box"><span>12개월 이상</span><strong className="money-accent">{formatNum(longOverdue)}명</strong></div>
    </div>

    <Card className="admin-control-card">
      <div className="admin-filter-row">
        <input className="input admin-search" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="이름, 차량번호, 관리번호, 핸드폰번호, 주소 검색" />
        <select className="select" value={sigun} onChange={e => { setSigun(e.target.value); setPage(1) }}>
          <option value="전체">전체 지역</option>
          {SIGUN.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="select" value={membership} onChange={e => { setMembership(e.target.value); setPage(1) }}>
          <option value="전체">가입/미가입</option><option value="협회가입">협회가입</option><option value="협회미가입">협회미가입</option>
        </select>
        <select className="select" value={account} onChange={e => { setAccount(e.target.value); setPage(1) }}>
          <option value="전체">계정 전체</option><option value="협회비">협회비</option><option value="관리비">관리비</option>
        </select>
        <select className="select" value={amount} onChange={e => { setAmount(e.target.value); setPage(1) }}>
          <option value="전체">전체</option><option value="미수있음">미수있음</option><option value="완납">완납/0원</option><option value="선납">선납/초과</option><option value="30만원이상">30만원 이상</option>
        </select>
        <select className="select" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="정상">정상</option><option value="전체">상태 전체</option><option value="폐업">폐업</option><option value="양도">양도</option><option value="이관">이관</option><option value="탈퇴">탈퇴</option>
        </select>
        <select className="select" value={sortKey} onChange={e => { setSortKey(e.target.value); setPage(1) }}>
          <option value="amount">미납금액순</option><option value="months">미수개월수순</option><option value="region">지역순 보기</option><option value="vehicle">차량번호순</option><option value="name">이름순</option><option value="ym">기준월순</option><option value="basis">부과기준일순</option>
        </select>
        <select className="select" value={sortDir} onChange={e => { setSortDir(e.target.value); setPage(1) }}>
          <option value="desc">내림차순</option><option value="asc">오름차순</option>
        </select>
        <button type="button" className="btn soft" onClick={() => setPage(1)}>조회</button>
        <button type="button" className="btn region-sort-btn" onClick={() => { setSigun('전체'); setSortKey('region'); setSortDir('asc'); setPage(1) }}>지역순 보기</button>
        <button type="button" className="btn reset-btn" onClick={resetFilters}>초기화</button>
      </div>
      <div className="selected-region-line">
        <b>지역별 보기</b>
        <span>{sigun === '전체' ? `전체 ${formatNum(regionCounts.전체 || 0)}명` : `${sigun} ${formatNum(regionCounts[sigun] || 0)}명`}</span>
        <em>{q.trim() ? '전체/검색에서는 완납·선납 회원도 같이 표시합니다.' : (sortKey === 'region' ? '전체 명단을 지역별로 묶어 보는 상태입니다.' : '지역 선택은 필터, 지역순 보기는 전체를 지역별로 정렬합니다.')}</em>
      </div>
      <div className="mini-chip-row">
        <button type="button" className={'chip ' + (special === '장기' ? 'active' : '')} onClick={() => { setSpecial(special === '장기' ? '' : '장기'); setPage(1) }}>12개월 이상</button>
        <button type="button" className={'chip ' + (special === '결번' ? 'active' : '')} onClick={() => { setSpecial(special === '결번' ? '' : '결번'); setPage(1) }}>결번/반송</button>
        <button type="button" className={'chip ' + (special === '자격' ? 'active' : '')} onClick={() => { setSpecial(special === '자격' ? '' : '자격'); setPage(1) }}>자격증명 미발급</button>
      </div>
    </Card>

    <Card className="admin-list-card">
      <div className="admin-list-head">
        <b>{sigun === '전체' ? '전체 지역 미수금명단' : `${sigun} 미수금명단`}</b>
        <span>{formatNum(rows.length)}명 · 이름 클릭 시 상세정보</span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table roster-like-table receivables-table">
          <thead>
            <tr>
              <th>지역</th><th>차량번호</th><th>이름</th><th>계정</th><th>부과기준일</th><th>기준월</th><th>미수개월수</th><th className="right">현재잔액</th><th>핸드폰번호</th><th>주소</th><th>처리상태</th><th>최근수납</th><th className="right sticky-action-col">수정/처리</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(member => <tr key={member.id} className={String(member.id) === String(highlightMemberId) ? 'highlight-row' : ''}>
              <td>{member.sigun || '-'}</td>
              <td className="mono nowrap">{member.vehicleNo || '-'}</td>
              <td><button type="button" className="name-link admin-name" onClick={() => setSelected(member)}>{member.name}</button></td>
              <td><Badge tone={member.chargeItem === '협회비' ? 'blue' : 'mint'}>{member.chargeItem}</Badge></td>
              <td className="mono nowrap">{billingBasisDate(member)}</td>
              <td className="mono nowrap">{basisYm(member)}</td>
              <td className="mono nowrap"><b>{arrearsMonthCount(member)}</b>개월</td>
              <td className="right money money-main">{formatWon(member.totalArrears)}</td>
              <td className="mono nowrap" style={{ color: member.disconnected ? 'var(--rose)' : undefined }}>{member.phone || '-'}</td>
              <td className="clip-cell" title={addressOf(member)}>{addressOf(member)}</td>
              <td>{Number(member.totalArrears) < 0 ? <Badge tone="purple">선납</Badge> : Number(member.totalArrears) === 0 ? <Badge tone="mint">완납/0원</Badge> : <Badge tone={member.status === '정상' ? 'soft' : 'rose'}>{member.status || '-'}</Badge>}</td>
              <td className="mono nowrap">{paymentsFor(member).length ? <button type="button" className="name-link payment-mini-link has-payment" onClick={() => setPaymentMember(member)}>{recentPaymentText(paymentsFor(member))}</button> : <span className="muted">-</span>}</td>
              <td className="right action-cell sticky-action-cell">
                <button type="button" className="btn mini action-edit" onClick={() => setEditMember(member)}>수정</button>
                <button type="button" className="btn mini action-pay" onClick={() => setQuickPay(member)}>수납</button>
                <button type="button" className="btn mini soft" onClick={() => setPaymentMember(member)}>수납내역</button>
                <button type="button" className="btn mini action-close" onClick={() => setQuickClose(member)}>폐업</button>
              </td>
            </tr>)}
            {!pageRows.length && <tr><td colSpan="13" className="empty-cell compact">조건에 맞는 회원이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pager-row">
        <span>{formatNum(rows.length)}명 중 {rows.length ? formatNum((page - 1) * PER_PAGE + 1) : 0}–{formatNum(Math.min(page * PER_PAGE, rows.length))}</span>
        <div><button type="button" className="btn mini" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button><b style={{ margin: '0 8px' }}>{page}/{pageCount}</b><button type="button" className="btn mini" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>다음</button></div>
      </div>
    </Card>

    {selected && <MemberDetailModal member={data.members.find(member => member.id === selected.id) || selected} payments={paymentsFor(data.members.find(member => member.id === selected.id) || selected)} onClose={() => setSelected(null)} saveMemo={saveMemo} applyPayment={applyPayment} registerClosure={registerClosure} />}
    {quickPay && <PaymentModal member={quickPay} onClose={() => setQuickPay(null)} onSave={(amountValue, method, chargeItem) => { applyPayment(quickPay.id, amountValue, method, chargeItem); setQuickPay(null) }} />}
    {quickClose && <ClosureModal member={quickClose} onClose={() => setQuickClose(null)} onSave={(payload) => { registerClosure(quickClose.id, payload); setQuickClose(null) }} />}
    {editMember && <MemberEditModal member={editMember} onClose={() => setEditMember(null)} onSave={(payload) => { updateMember(editMember.id, payload); setEditMember(null) }} />}
    {paymentMember && <MemberPaymentHistoryModal member={paymentMember} payments={paymentsFor(paymentMember)} onClose={() => setPaymentMember(null)} />}
  </div>
}

function MemberDetailModal({ member, payments=[], onClose, saveMemo, applyPayment, registerClosure }){
  const [memo, setMemo] = useState(noteOf(member))
  const [showPay, setShowPay] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const open = getOpenArrears(member)
  return <div className="modal-bg"><div className="modal modern-detail-modal">
    <div className="modal-title-row"><div><h3>{member.name}</h3><p>{member.sigun} · {member.vehicleNo} · {member.mgmtNo}</p></div><button type="button" className="btn mini" onClick={onClose}>닫기</button></div>
    <div className="detail-section"><h4 className="compact-title">회원 기본정보</h4><div className="info-grid compact-info three-col">
      <Info k="지역" v={member.sigun}/><Info k="차량번호" v={member.vehicleNo}/><Info k="이름" v={member.name}/><Info k="계정" v={`${member.chargeItem} / ${formatWon(member.monthlyCharge)}`}/><Info k="부과기준일" v={billingBasisDate(member)}/><Info k="기준월" v={basisYm(member)}/><Info k="미수개월수" v={`${arrearsMonthCount(member)}개월`}/><Info k="현재잔액" v={formatWon(member.totalArrears)}/><Info k="핸드폰번호" v={member.phone || '-'}/><Info k="주소" v={addressOf(member)}/><Info k="관리번호" v={member.mgmtNo}/><Info k="자격증명 발급일" v={member.certIssueDate || '-'}/><Info k="사업자등록번호" v={bizNoOf(member)}/>
    </div></div>
    <div className="detail-section"><h4 className="compact-title">현재 미수 상세</h4><div className="mini-box"><table className="admin-table dense"><thead><tr><th>기준월</th><th>항목</th><th className="right">금액</th><th>상태</th></tr></thead><tbody>{open.map(item => <tr key={item.ym}><td>{item.ym}</td><td>{item.item}</td><td className="right money">{formatWon(item.amount)}</td><td><Badge tone="rose">미납</Badge></td></tr>)}{!open.length && <tr><td colSpan="4" className="empty-cell compact">현재 미수금이 없습니다.</td></tr>}</tbody></table></div></div>
    <PaymentHistorySection payments={payments} />
    <div className="detail-section"><h4 className="compact-title">내부 메모</h4><textarea className="textarea" value={memo} onChange={e => setMemo(e.target.value)} placeholder="상담 메모 / 특이사항"/><div className="action-row"><button type="button" className="btn primary" onClick={() => saveMemo(member.id, memo)}>메모 저장</button><button type="button" className="btn action-pay" onClick={() => setShowPay(true)}>수납 반영</button><button type="button" className="btn action-close" onClick={() => setShowClose(true)}>폐업/이탈</button></div></div>
    {showPay && <PaymentModal member={member} onClose={() => setShowPay(false)} onSave={(amountValue, method, chargeItem) => { applyPayment(member.id, amountValue, method, chargeItem); setShowPay(false) }} />}
    {showClose && <ClosureModal member={member} onClose={() => setShowClose(false)} onSave={(payload) => { registerClosure(member.id, payload); setShowClose(false); onClose() }} />}
  </div></div>
}
function PaymentHistorySection({ payments }){
  const total = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  return <div className="detail-section payment-history-section"><h4 className="compact-title">수납내역 <span>{payments.length ? `${payments.length}건 · ${formatWon(total)}` : '0건'}</span></h4><div className="mini-box"><table className="admin-table dense"><thead><tr><th>수납일</th><th>대상월</th><th>항목</th><th>회계구분</th><th>방식</th><th className="right">금액</th><th>메모</th></tr></thead><tbody>{payments.map(payment => { const meta = incomeMeta(payment.chargeItem || payment.charge_item); return <tr key={payment.id}><td>{payment.paidDate || '-'}</td><td>{payment.paidForYm || '-'}</td><td><Badge tone={meta.tone}>{payment.chargeItem || '-'}</Badge></td><td>{payment.accountingType || payment.accounting_type || meta.accounting}</td><td><Badge tone={payment.method === '통장매칭' ? 'blue' : 'soft'}>{payment.method || '-'}</Badge></td><td className="right money">{formatWon(payment.amount)}</td><td className="clip-cell" title={payment.memo || ''}>{payment.memo || '-'}</td></tr>})}{!payments.length && <tr><td colSpan="7" className="empty-cell compact">수납내역이 없습니다.</td></tr>}</tbody></table></div></div>
}

function MemberPaymentHistoryModal({ member, payments, onClose }){
  const total = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  return <div className="modal-bg"><div className="modal payment-history-modal"><div className="modal-title-row"><div><h3>{member.name} 수납내역</h3><p>{member.sigun} · {member.vehicleNo} · 총 {payments.length}건 · {formatWon(total)}</p></div><button type="button" className="btn mini" onClick={onClose}>닫기</button></div><PaymentHistorySection payments={payments}/></div></div>
}

function Info({ k, v }){ return <div className="info"><b>{k}</b><span>{v || '-'}</span></div> }
function PaymentModal({ member, onClose, onSave }){
  const [amount, setAmount] = useState(Math.max(Number(member.totalArrears) || Number(member.monthlyCharge) || 0, 0))
  const [method, setMethod] = useState('직접수납')
  const [chargeItem, setChargeItem] = useState(member.chargeItem || '관리비')
  const meta = incomeMeta(chargeItem)
  const nonArrears = ['협회가입비','자격증명발급비','기타'].includes(chargeItem)
  return <div className="modal-bg"><div className="modal"><h3>수납 반영</h3>
    <div className="form-row"><b>회원</b><span>{member.name} / {member.vehicleNo}</span></div>
    <div className="form-row"><b>현재 미수</b><span>{formatWon(member.totalArrears)}</span></div>
    <div className="form-row"><b>수납항목</b><select className="select" value={chargeItem} onChange={e => setChargeItem(e.target.value)}>{INCOME_ITEMS.map(item => <option key={item.value} value={item.value}>{item.label} · {item.accounting}</option>)}</select></div>
    <div className="form-row"><b>회계구분</b><span><Badge tone={meta.tone}>{meta.accounting}</Badge> {nonArrears && <em className="small">미수금 차감 없음</em>}</span></div>
    <div className="form-row"><b>수납액</b><input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
    <div className="form-row"><b>방법</b><select className="select" value={method} onChange={e => setMethod(e.target.value)}><option>직접수납</option><option>통장매칭</option><option>현금</option><option>CMS</option></select></div>
    <div className="notice compact-notice">협회가입비(가수금)와 자격증명발급비(잡수입)는 수납내역에만 남고 현재잔액은 차감하지 않습니다.</div>
    <div className="action-row right"><button type="button" className="btn" onClick={onClose}>취소</button><button type="button" className="btn action-pay" onClick={() => onSave(amount, method, chargeItem)}>반영</button></div>
  </div></div>
}
function ClosureModal({ member, onClose, onSave }){ const [type, setType] = useState('폐업'); const [docNo, setDocNo] = useState(''); const [content, setContent] = useState('시청 접수 후 처리'); return <div className="modal-bg"><div className="modal"><h3>폐업/이탈 등록</h3><div className="form-row"><b>처리사유</b><select className="select" value={type} onChange={e => setType(e.target.value)}><option>폐업</option><option>탈퇴</option><option>양도</option><option>이관</option></select></div><div className="form-row"><b>관리번호</b><input className="input" value={docNo} onChange={e => setDocNo(e.target.value)} placeholder="관리번호 또는 접수번호" /></div><div className="form-row"><b>내용</b><textarea className="textarea" value={content} onChange={e => setContent(e.target.value)} /></div><div className="notice">현재 미수잔액 {formatWon(member.totalArrears)} 기준으로 폐업현황에 저장됩니다.</div><div className="action-row right"><button type="button" className="btn" onClick={onClose}>취소</button><button type="button" className="btn action-close" onClick={() => onSave({ type, docNo, content })}>처리 저장</button></div></div></div> }

function MemberEditModal({ member, onClose, onSave }){
  const [form, setForm] = useState({
    mgmt_no: member.mgmtNo || '',
    sigun: member.sigun || '춘천시',
    vehicle_no: member.vehicleNo || '',
    name: member.name || '',
    phone: member.phone || '',
    region_raw: member.regionRaw || '',
    membership: member.membership || '협회미가입',
    assoc_join_date: member.assocJoinDate || '',
    cert_issue_date: member.certIssueDate || '',
    billing_start_ym: member.billingStartYm || '',
    charge_item: member.chargeItem || '관리비',
    monthly_charge: member.monthlyCharge || 5000,
    member_type: member.memberType || '개인',
    last_payment_ym: member.lastPaymentYm || '',
    status: member.status || '정상',
    address: addressOf(member) === '-' ? '' : addressOf(member),
    bizNo: bizNoOf(member) === '-' ? '' : bizNoOf(member),
    officialAddress: officialAddressOf(member) === '-' ? '' : officialAddressOf(member),
    note: noteOf(member),
  })
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const submit = () => {
    onSave({
      mgmt_no: form.mgmt_no,
      sigun: form.sigun,
      vehicle_no: form.vehicle_no,
      name: form.name,
      phone: form.phone,
      region_raw: form.region_raw,
      membership: form.membership,
      assoc_join_date: form.assoc_join_date || null,
      cert_issue_date: form.cert_issue_date || null,
      billing_start_ym: form.billing_start_ym || null,
      charge_item: form.charge_item,
      monthly_charge: Number(form.monthly_charge) || 0,
      member_type: form.member_type,
      last_payment_ym: form.last_payment_ym || null,
      status: form.status,
      memo: makeMemoFromFields(form),
    })
  }
  return <div className="modal-bg"><div className="modal member-edit-modal">
    <div className="modal-title-row"><h3>회원 수정</h3><button type="button" className="btn mini" onClick={onClose}>닫기</button></div>
    <div className="edit-grid">
      <Field label="관리번호" value={form.mgmt_no} onChange={v => update('mgmt_no', v)} />
      <label><b>지역</b><select className="select" value={form.sigun} onChange={e => update('sigun', e.target.value)}>{SIGUN.map(s => <option key={s}>{s}</option>)}</select></label>
      <Field label="차량번호" required value={form.vehicle_no} onChange={v => update('vehicle_no', v)} />
      <Field label="성명" required value={form.name} onChange={v => update('name', v)} />
      <Field label="전화번호" value={form.phone} onChange={v => update('phone', v)} />
      <Field label="주소" value={form.address} onChange={v => update('address', v)} wide />
      <label><b>가입여부</b><select className="select" value={form.membership} onChange={e => update('membership', e.target.value)}><option>협회가입</option><option>협회미가입</option></select></label>
      <Field label="가입일자" value={form.assoc_join_date} onChange={v => update('assoc_join_date', v)} />
      <Field label="인가일자" value={form.cert_issue_date} onChange={v => update('cert_issue_date', v)} />
      <Field label="부과시작일/월" value={form.billing_start_ym} onChange={v => update('billing_start_ym', v)} />
      <label><b>계정</b><select className="select" value={form.charge_item} onChange={e => update('charge_item', e.target.value)}><option>협회비</option><option>관리비</option></select></label>
      <Field label="월부과액" type="number" value={form.monthly_charge} onChange={v => update('monthly_charge', v)} />
      <label><b>구분</b><select className="select" value={form.member_type} onChange={e => update('member_type', e.target.value)}><option>개인</option><option>택배</option></select></label>
      <Field label="마지막납부월" value={form.last_payment_ym} onChange={v => update('last_payment_ym', v)} />
      <label><b>상태</b><select className="select" value={form.status} onChange={e => update('status', e.target.value)}><option>정상</option><option>폐업</option><option>양도</option><option>이관</option><option>탈퇴</option></select></label>
      <Field label="사업자번호" value={form.bizNo} onChange={v => update('bizNo', v)} />
      <Field label="공문주소" value={form.officialAddress} onChange={v => update('officialAddress', v)} wide />
    </div>
    <label className="block-label"><b>비고/내부메모</b><textarea className="textarea" value={form.note} onChange={e => update('note', e.target.value)} /></label>
    <div className="action-row right"><button type="button" className="btn" onClick={onClose}>취소</button><button type="button" className="btn primary" onClick={submit}>저장</button></div>
  </div></div>
}
function Field({ label, value, onChange, type='text', wide=false, required=false }){ return <label className={wide ? 'wide-field' : ''}><b>{label}{required ? '*' : ''}</b><input className="input" type={type} value={value || ''} onChange={e => onChange(e.target.value)} /></label> }
