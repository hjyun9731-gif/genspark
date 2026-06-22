# 강원 화물협회 · 미수금 관리 시스템 (1차 MVP 프로토타입)

화물협회 회비/미수금 수납관리 업무를 위한 클릭형 프로토타입입니다.
React(UMD) + Babel standalone 기반의 단일 페이지 앱으로, **빌드 과정 없이** 정적 파일만으로 동작합니다.

## 구성

| 파일 | 설명 |
|------|------|
| `index.html` | 데스크톱 관리자 화면 (대시보드·미수금 명단·지역별 문자·통장매칭·폐업현황·신규/예정자·수납내역·업로드·설정) |
| `모바일.html` | 모바일 앱 버전 |
| `app/` | 화면별 컴포넌트 (JSX, Babel로 브라우저에서 트랜스파일) |
| `_ds/` | Payrole 디자인 시스템 번들 (토큰 CSS + 컴포넌트 JS) |

## 실행 방법

JSX를 `<script type="text/babel" src>`로 불러오므로 `file://`로 직접 열면 브라우저 보안정책(CORS)에 막힙니다.
**로컬 정적 서버**로 열어주세요.

```bash
# 저장소 루트에서
python3 -m http.server 8000
# 또는
npx serve .
```

이후 브라우저에서:
- 데스크톱: http://localhost:8000/index.html
- 모바일: http://localhost:8000/모바일.html

## GitHub Pages 배포

저장소 Settings → Pages → Branch `main` / `/ (root)` 선택 시
`https://<사용자>.github.io/<저장소>/` 에서 `index.html`이 바로 서비스됩니다.

## 참고

- React 18 / Babel / 디자인 시스템 번들은 첫 로딩 시 CDN(unpkg) 또는 로컬 파일에서 불러옵니다.
- 프로토타입 단계로 데이터는 `app/data.jsx`의 목업입니다. 실 데이터 연동은 미적용 상태입니다.
