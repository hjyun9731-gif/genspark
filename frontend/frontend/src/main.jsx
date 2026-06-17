import React from 'react'
import ReactDOM from 'react-dom/client'

function isMobileDevice() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const touch = navigator.maxTouchPoints && navigator.maxTouchPoints > 1
  const small = window.matchMedia && window.matchMedia('(max-width: 760px)').matches
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  const forceDesktop = new URLSearchParams(window.location.search).get('view') === 'desktop'
  const forceMobile = new URLSearchParams(window.location.search).get('view') === 'mobile' || window.location.hash === '#mobile'
  if (forceDesktop) return false
  if (forceMobile) return true
  return mobileUa || (touch && small)
}

async function boot() {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  if (isMobileDevice()) {
    // 모바일은 데스크톱 App/styles.css를 아예 import하지 않는다.
    // 데스크톱 CSS가 모바일 화면을 망가뜨리는 문제를 막기 위해 완전 분리한다.
    const mod = await import('./mobile/MobileStandalone.jsx')
    const MobileStandalone = mod.default
    root.render(<MobileStandalone />)
  } else {
    const mod = await import('./App.jsx')
    const App = mod.default
    root.render(<App />)
  }
}

boot()
