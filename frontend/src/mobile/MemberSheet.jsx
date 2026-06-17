import React, { useMemo, useState } from 'react'
import { formatWon, getOpenArrears } from '../data.js'

const METHODS = ['직접수납', '계좌이체', '통장매칭']

function extractInfo(member, key) {
  const found = String(member.memo || '').split(/\s*\/\s*/).map(v => v.trim()).find(v => v.startsWith(key + ':'))
  return found ? found.slice(key.length + 1).trim() : ''
}
function monthCount(member) {
  const amount = Number(member.totalArrears) || 0
  const monthly = Number(member.monthlyCharge) || 0
  if (amount <= 0) return 0
  if (monthly > 0) return Math.max(1, Math.ceil(amount / monthly))
  return Number(member.arrearsMonths) || 1
}

export default function MemberSheet({ member, onClose, applyPayment, onToast }) {
  const open = useMemo(() => getOpenArrears(member), [member])
  const total = Number(member.totalArrears) || 0
  const months = monthCount(member)

  const [method, setMethod] = useState('직접수납')
  const [amount, setAmount] = useState(String(Math.max(total, 0) || ''))
  const [busy, setBusy] = useState(false)

  const amtNum = Number(String(amount).replace(/[^0-9]/g, '')) || 0
  const addr = extractInfo(member, '주소') || member.regionRaw || ''

  async function pay() {
    if (amtNum <= 0) return onToast('수납액을 입력하세요.')
    if (amtNum > total && total > 0 && !confirm(`미납액(${formatWon(total)})보다 큰 금액입니다. 그대로 수납할까요?`)) return
    setBusy(true)
    try {
      await applyPayment(member.id, amtNum, method)
      onToast(`${member.name} · ${formatWon(amtNum)} 수납 완료`)
      onClose()
    } catch (e) { onToast(e.message || '수납 처리 실패') }
    finally { setBusy(false) }
  }

  return <div className="m-sheet-bg" onMouseDown={onClose}>
    <div className="m-sheet" onMouseDown={e => e.stopPropagation()}>
      <div className="m-grip" />
      <div className="m-sheet-head">
        <div className="m-sheet-name">{member.name}<span className="veh">{member.vehicleNo}</span></div>
        <div className="m-sheet-meta">{member.sigun || '-'} · {member.chargeItem} · {member.membership === '협회가입' ? '협회가입' : '미가입'} · {member.mgmtNo || '-'}</div>
      </div>

      <div className="m-sheet-body">
        <div className={'m-hero' + (total <= 0 ? ' clear' : '')}>
          <div className="lab">{total <= 0 ? '미납액 없음' : '현재 미납액'}</div>
          <div className="big">{formatWon(total)}</div>
          {total > 0 && <div className="note">미수 {months}개월 · 미납항목 {open.length}건</div>}
        </div>

        {open.length > 0 && <>
          <div className="m-sec-title">미수 상세 <span>월별</span></div>
          <div className="m-rows">
            {open.map((a, i) => <div className="m-row" key={i}>
              <div><div className="ym">{a.ym || a.label}</div><div className="it">{a.item || member.chargeItem}</div></div>
              <div className="rwon">{formatWon(a.amount)}</div>
            </div>)}
          </div>
        </>}

        <div className="m-sec-title">회원 정보</div>
        <div className="m-info-grid">
          <div className="m-info"><div className="k">핸드폰</div><div className="v">{member.phone ? <a className="m-call" href={`tel:${member.phone}`}>{member.phone}</a> : '-'}</div></div>
          <div className="m-info"><div className="k">계정</div><div className="v">{member.chargeItem}</div></div>
          <div className="m-info"><div className="k">미수개월수</div><div className="v">{months}개월</div></div>
          <div className="m-info"><div className="k">상태</div><div className="v">{member.status || '정상'}</div></div>
          {addr && <div className="m-info full"><div className="k">주소</div><div className="v">{addr}</div></div>}
        </div>

        {total > 0 && <div className="m-pay">
          <div className="m-pay-title">수납 처리</div>
          <div className="m-method">
            {METHODS.map(mtd => <button key={mtd} className={method === mtd ? 'active' : ''} onClick={() => setMethod(mtd)}>{mtd}</button>)}
          </div>
          <div className="m-amt-input">
            <input inputMode="numeric" value={amtNum ? amtNum.toLocaleString('ko-KR') : ''} onChange={e => setAmount(e.target.value)} placeholder="0" />
            <span className="suf">원</span>
          </div>
          <div className="m-quick">
            <button onClick={() => setAmount(String(total))}>전액</button>
            <button onClick={() => setAmount(String(Math.round(total / 2)))}>절반</button>
            {open[open.length - 1] && <button onClick={() => setAmount(String(open[open.length - 1].amount))}>1개월</button>}
            <button onClick={() => setAmount('')}>지움</button>
          </div>
          <div className="m-pay-actions">
            <button className="m-btn ghost" onClick={onClose}>닫기</button>
            <button className="m-btn primary" disabled={busy || amtNum <= 0} onClick={pay}>{busy ? '처리 중…' : `${formatWon(amtNum)} 수납`}</button>
          </div>
        </div>}

        {total <= 0 && <div className="m-pay-actions"><button className="m-btn ghost" style={{ width: '100%' }} onClick={onClose}>닫기</button></div>}
      </div>
    </div>
  </div>
}
