import React from 'react'
import ReactDOM from 'react-dom/client'

// 라우트 분리: '/mobile' 경로는 모바일 전용 PWA, 그 외는 데스크톱 업무관리 시스템.
// (백엔드 SPA 폴백이 모든 경로에 index.html을 돌려주므로 별도 라우터 불필요)
const isMobile = window.location.pathname.replace(/\/+$/, '').toLowerCase().endsWith('/mobile')
  || window.location.pathname.toLowerCase().startsWith('/mobile')

const root = ReactDOM.createRoot(document.getElementById('root'))

if (isMobile) {
  import('./mobile/MobileApp.jsx').then(({ default: MobileApp }) => {
    root.render(<MobileApp />)
  })
} else {
  import('./App.jsx').then(({ default: App }) => {
    root.render(<App />)
  })
}
