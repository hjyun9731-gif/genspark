import React, { useState, useEffect, useRef } from 'react'

const PIN_KEY = 'misu_mobile_pin_v1'

function Dot({ on, err }) { return <div className={'m-dot' + (on ? ' on' : '') + (err ? ' err' : '')} /> }

/**
 * 간단 PIN 잠금 (분실 시 단순 가림용 — 강력 보안 아님).
 * 최초 실행 시 4자리 PIN을 설정하고, 이후에는 입력해야 진입합니다.
 */
export default function PinLock({ onUnlock }) {
  const hasPin = !!localStorage.getItem(PIN_KEY)
  const [phase, setPhase] = useState(hasPin ? 'enter' : 'set')
  const [first, setFirst] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)
  const [msg, setMsg] = useState('')
  const lockRef = useRef(null)

  const titles = { set: 'PIN 번호 설정', confirm: 'PIN 다시 입력', enter: '미수금관리' }
  const descs = {
    set: '사용할 4자리 PIN을 입력하세요.',
    confirm: '확인을 위해 한 번 더 입력하세요.',
    enter: 'PIN 4자리를 입력하세요.',
  }

  function shake() {
    setErr(true)
    lockRef.current?.classList.add('m-shake')
    setTimeout(() => { lockRef.current?.classList.remove('m-shake'); setErr(false); setCode('') }, 450)
  }

  useEffect(() => {
    if (code.length < 4) return
    const t = setTimeout(() => {
      if (phase === 'set') { setFirst(code); setCode(''); setPhase('confirm'); setMsg('') }
      else if (phase === 'confirm') {
        if (code === first) { localStorage.setItem(PIN_KEY, code); onUnlock() }
        else { setMsg('PIN이 일치하지 않습니다. 다시 설정하세요.'); setFirst(''); setPhase('set'); shake() }
      } else {
        if (code === localStorage.getItem(PIN_KEY)) onUnlock()
        else { setMsg('PIN이 올바르지 않습니다.'); shake() }
      }
    }, 120)
    return () => clearTimeout(t)
  }, [code]) // eslint-disable-line

  function press(n) { if (code.length < 4) { setCode(code + n); setMsg('') } }
  function back() { setCode(code.slice(0, -1)) }
  function resetPin() {
    if (confirm('PIN을 잊으셨나요? 초기화하면 새 PIN을 다시 설정합니다.')) {
      localStorage.removeItem(PIN_KEY); setFirst(''); setCode(''); setMsg(''); setPhase('set')
    }
  }

  return <div className="m-lock" ref={lockRef}>
    <div className="m-lock-logo">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
    <h2>{titles[phase]}</h2>
    <p>{msg || descs[phase]}</p>
    <div className="m-dots">{[0, 1, 2, 3].map(i => <Dot key={i} on={i < code.length} err={err} />)}</div>
    <div className="m-pad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} className="m-key" onClick={() => press(n)}>{n}</button>)}
      <button className="m-key blank" />
      <button className="m-key" onClick={() => press(0)}>0</button>
      <button className="m-key fn" onClick={back} aria-label="지우기">⌫</button>
    </div>
    {phase === 'enter' && <button className="m-lock-foot" onClick={resetPin}>PIN을 잊으셨나요?</button>}
  </div>
}
