import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { fmtWon, monthCount, balanceTone, telHref, smsHref, addressOf } from './mobileUtils.js'

// 수납 항목: 차감 여부가 다르다.
// 협회비/관리비 = 미수금 차감 / 가수금·잡수입·기타 = 차감 없이 수납내역만 기록
const PAY_ITEMS = [
  { key: '협회비', label: '협회비', deduct: true, note: '미수금 차감' },
  { key: '관리비', label: '관리비', deduct: true, note: '미수금 차감' },
  { key: '협회가입비', label: '협회가입비', sub: '가수금', deduct: false, note: '미차감' },
  { key: '자격증명발급비', label: '자격증명발급비', sub: '잡수입', deduct: false, note: '미차감' },
  { key: '기타', label: '기타', deduct: false, note: '미차감' },
]
const METHODS = ['직접수납', '계좌이체', '통장매칭']

function Ico({ name }) {
  const p = {
    back: <path d="M15 18l-6-6 6-6" />,
    call: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z" />,
    sms: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20l1-3.1A8.4 8.4 0 1 1 21 11.5z" />,
  }[name]
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
}

export default function MobileMemberDetail({ base, onBack, onApplyPayment, onSaveMemo, onToast }) {
  const [member, setMember] = useState(base)
  const [loading, setLoading] = useState(true)
  const [memo, setMemo] = useState('')
  const [memoDirty, setMemoDirty] = useState(false)
  const [paySheet, setPaySheet] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const full = await api.getMember(base.id)
      setMember(full)
      setMemo(full.memo || '')
      setMemoDirty(false)
    } catch (e) { onToast(e.message || '상세 정보를 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [base.id]) // eslint-disable-line

  const total = Number(member.totalArrears) || 0
  const months = monthCount(member)
  const tone = balanceTone(total)
  const open = useMemo(() => (member.arrears || member.receivable_items || []).filter(a => !(a.paid ?? a.is_paid) && Number(a.amount) > 0), [member])
  const payments = useMemo(() => (member.payments || []).slice().sort((a, b) => String(b.paidDate || b.paid_date || '').localeCompare(String(a.paidDate || a.paid_date || ''))), [member])
  const payTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const addr = addressOf(member)
  const tel = telHref(member.phone), sms = smsHref(member.phone)

  async function doPay(body) {
    await onApplyPayment(member.id, body)
    setPaySheet(false)
    await load()
  }
  async function saveMemo() {
    await onSaveMemo(member.id, memo)
    setMemoDirty(false)
    onToast('메모를 저장했습니다.')
  }

  return <div className="m-detail">
    <div className="m-dhead">
      <button className="m-back" onClick={onBack} aria-label="뒤로"><Ico name="back" /></button>
      <div className="m-dhead-info">
        <div className="m-dhead-name">{member.name}<span className="veh">{member.vehicleNo}</span></div>
        <div className="m-dhead-meta">{member.sigun || '-'} · {member.chargeItem} · {member.membership === '협회가입' ? '협회가입' : '미가입'} · {member.mgmtNo || '-'}</div>
      </div>
    </div>

    <div className="m-dbody">
      <div className="m-contact">
        <a className={'call' + (tel ? '' : ' off')} href={tel || undefined}><Ico name="call" />전화걸기</a>
        <a className={'sms' + (sms ? '' : ' off')} href={sms || undefined}><Ico name="sms" />문자보내기</a>
      </div>

      <div className={'m-hero ' + tone}>
        <div className="lab">{total > 0 ? '현재 미납액' : total < 0 ? '초과입금(선납)' : '미납액 없음'}</div>
        <div className="big">{fmtWon(Math.abs(total))}</div>
        {total > 0 && <div className="note">미수 {months}개월 · 미납항목 {open.length}건</div>}
      </div>

      {open.length > 0 && <>
        <div className="m-sec">현재 미수 상세 <span>월별</span></div>
        <div className="m-rows">
          {open.map((a, i) => <div className="m-row" key={i}>
            <div><div className="ym">{a.ym || a.label}</div><div className="it">{a.item || a.charge_item || member.chargeItem}</div></div>
            <div className="rwon">{fmtWon(a.amount)}</div>
          </div>)}
        </div>
      </>}

      <div className="m-sec">수납내역 <span>{payments.length ? `${payments.length}건 · ${fmtWon(payTotal)}` : '없음'}</span></div>
      {payments.length ? <div className="m-rows">
        {payments.slice(0, 12).map((p, i) => <div className="m-row pay" key={p.id || i}>
          <div><div className="ym">{p.paidDate || p.paid_date}</div><div className="it">{(p.chargeItem || p.charge_item || '-')} · {p.method || '-'}</div></div>
          <div className="rwon">+{fmtWon(p.amount)}</div>
        </div>)}
      </div> : <div className="m-rows"><div className="m-row"><div className="it">수납내역이 없습니다.</div></div></div>}

      <div className="m-sec">회원 정보</div>
      <div className="m-info-grid">
        <div className="m-info"><div className="k">핸드폰</div><div className="v">{member.phone || '-'}</div></div>
        <div className="m-info"><div className="k">계정 / 월부과</div><div className="v">{member.chargeItem} / {fmtWon(member.monthlyCharge)}</div></div>
        <div className="m-info"><div className="k">미수개월수</div><div className="v">{months}개월</div></div>
        <div className="m-info"><div className="k">최근수납월</div><div className="v">{member.lastPaymentYm || '-'}</div></div>
        {addr && <div className="m-info full"><div className="k">주소</div><div className="v">{addr}</div></div>}
      </div>

      <div className="m-sec">메모</div>
      <textarea className="m-memo" value={memo} onChange={e => { setMemo(e.target.value); setMemoDirty(true) }} placeholder="상담 메모 / 특이사항을 입력하세요." />
      <button className="m-memo-save" disabled={!memoDirty} onClick={saveMemo}>{memoDirty ? '메모 저장' : '저장됨'}</button>
    </div>

    <div className="m-footbar">
      <button className="m-paybtn" onClick={() => setPaySheet(true)}>수납 처리</button>
    </div>

    {loading && <div className="m-toast">불러오는 중…</div>}
    {paySheet && <PaymentSheet member={member} open={open} onClose={() => setPaySheet(false)} onPay={doPay} onToast={onToast} />}
  </div>
}

function PaymentSheet({ member, open, onClose, onPay, onToast }) {
  const defItem = member.chargeItem === '관리비' ? '관리비' : '협회비'
  const [item, setItem] = useState(defItem)
  const total = open.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const [amount, setAmount] = useState(String(total || ''))
  const [method, setMethod] = useState('직접수납')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)

  const itemDef = PAY_ITEMS.find(p => p.key === item) || PAY_ITEMS[0]
  const amtNum = Number(String(amount).replace(/[^0-9]/g, '')) || 0

  async function go() {
    if (amtNum <= 0) return onToast('수납액을 입력하세요.')
    if (itemDef.deduct && amtNum > total && total > 0 && !confirm(`미납액(${fmtWon(total)})보다 큰 금액입니다. 그대로 수납할까요?`)) return
    setBusy(true)
    try {
      await onPay({ amount: amtNum, method, charge_item: item, deduct: itemDef.deduct, memo })
      onToast(`${member.name} · ${fmtWon(amtNum)} 수납 완료`)
    } catch (e) { onToast(e.message || '수납 처리 실패'); setBusy(false) }
  }

  return <div className="m-sheet-bg" onMouseDown={onClose}>
    <div className="m-sheet" onMouseDown={e => e.stopPropagation()}>
      <div className="m-grip" />
      <div className="m-sheet-head"><h3>수납 처리</h3><p>{member.name} · {member.vehicleNo} · 현재잔액 {fmtWon(member.totalArrears)}</p></div>
      <div className="m-sheet-body">
        <div className="m-field-lab">수납 항목</div>
        <div className="m-item-grid">
          {PAY_ITEMS.map(p => <button key={p.key} className={'m-item' + (item === p.key ? ' active' : '')} onClick={() => setItem(p.key)}>
            {p.label}{p.sub ? <small>{p.sub}</small> : null}
          </button>)}
        </div>
        <div className="m-item-note">{itemDef.deduct ? '협회비·관리비는 미수금에서 차감됩니다.' : '가수금·잡수입·기타는 미수금 차감 없이 수납내역에만 기록됩니다.'}</div>

        <div className="m-field-lab">수납 금액</div>
        <div className="m-amt">
          <input inputMode="numeric" value={amtNum ? amtNum.toLocaleString('ko-KR') : ''} onChange={e => setAmount(e.target.value)} placeholder="0" />
          <span className="suf">원</span>
        </div>
        <div className="m-quick">
          {itemDef.deduct && total > 0 && <button onClick={() => setAmount(String(total))}>전액</button>}
          {itemDef.deduct && total > 0 && <button onClick={() => setAmount(String(Math.round(total / 2)))}>절반</button>}
          {itemDef.deduct && open[0] && <button onClick={() => setAmount(String(open[0].amount))}>1개월</button>}
          {member.monthlyCharge ? <button onClick={() => setAmount(String(member.monthlyCharge))}>{fmtWon(member.monthlyCharge)}</button> : null}
          <button onClick={() => setAmount('')}>지움</button>
        </div>

        <div className="m-field-lab">수납 방식</div>
        <div className="m-method">
          {METHODS.map(mtd => <button key={mtd} className={method === mtd ? 'active' : ''} onClick={() => setMethod(mtd)}>{mtd}</button>)}
        </div>

        <textarea className="m-sheet-memo" value={memo} onChange={e => setMemo(e.target.value)} placeholder="수납 메모 (선택)" />

        <div className="m-sheet-actions">
          <button className="m-btn cancel" onClick={onClose}>닫기</button>
          <button className="m-btn go" disabled={busy || amtNum <= 0} onClick={go}>{busy ? '처리 중…' : `${fmtWon(amtNum)} 수납`}</button>
        </div>
      </div>
    </div>
  </div>
}
