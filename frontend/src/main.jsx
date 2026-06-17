import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MobileStandalone from './mobile/MobileStandalone.jsx'

function isMobileDevice() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const byUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  const byWidth = window.matchMedia && window.matchMedia('(max-width: 760px)').matches
  return byUa || byWidth
}

ReactDOM.createRoot(document.getElementById('root')).render(
  isMobileDevice() ? <MobileStandalone /> : <App />
)
