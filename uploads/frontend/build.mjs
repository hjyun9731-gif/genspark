// 정적 복사 빌드
// ----------------------------------------------------------------------------
// 이 프론트는 번들링이 필요 없는 Claude 디자인 프로토타입(브라우저 내 Babel)이다.
// Vite 대신 static/ 폴더를 dist/ 로 그대로 복사한다.
//   static/index.html      ← 미수금 관리 시스템 (앱 진입점)
//   static/app/*           ← 화면/로직 (text/babel 로 런타임 로드)
//   static/_ds/*           ← Payrole 디자인 시스템 토큰 + 번들
//   static/assets/         ← FastAPI(main.py)가 /assets 를 마운트하므로 폴더 유지 필수
//
// Dockerfile 은 `npm run build -- --outDir dist --emptyOutDir` 로 호출하지만
// 추가 인자는 무시하고 항상 dist/ 로 출력한다(결과 동일).
import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs'

const SRC = 'static'
const OUT = 'dist'

if (!existsSync(SRC)) {
  console.error('[build] static/ 폴더가 없습니다. 빌드 중단.')
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
cpSync(SRC, OUT, { recursive: true })

console.log('[build] static/ → dist/ 복사 완료 (Claude 미수금 관리 시스템 최신본)')
