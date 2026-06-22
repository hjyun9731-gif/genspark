# MVP 디자인 패치 · Apply MVP design to production app

실제 운영 프로젝트(**Vite + React, `frontend/`**)에 **그대로 덮어쓰는** 디자인 전용 패치입니다.
DB / API / 수납 / 통장매칭 / 엑셀업로드 등 **모든 기능 로직은 일절 건드리지 않습니다.**

## 무엇을 바꾸나
운영 화면(Dashboard·ReceivablesList·BankMatching·ClosureBoard·PaymentsHistory·ExcelImport·PendingBoard·Roster·모바일)은
전부 **공통 클래스**(`card` · `btn` · `badge` · `admin-table` · `kpi-card` · `chip` · `modal` …)를 사용합니다.
따라서 그 클래스의 **외형만** MVP(Payrole 블루 `#3981F7`) 디자인으로 재정의하면 **전 화면이 한 번에** 재스킨됩니다.

- **클래스명 변경 없음 · JSX 변경 없음 · import 변경 없음** → 화면(.jsx) 파일을 손대지 않습니다.
- 디자인 토큰(색/라운드/그림자) + 컴포넌트 외형(버튼 pill, 16px 카드, 블루 KPI/배지/테이블)만 교체.

## 포함 파일 (실제 경로 그대로)
```
frontend/index.html                  # Pretendard 웹폰트 <link> 1줄 추가 (렌더링 일관성)
frontend/src/styles.css              # 데스크톱 디자인 시스템 재스킨 (하단 OVERRIDE 블록 교체)
frontend/src/mobile/mobile.css       # 모바일 인디고 → 블루 색상 치환
```

## 적용 방법
패치의 `frontend/` 를 운영 저장소 루트의 `frontend/` 위에 덮어쓰기 → 3개 파일만 교체됩니다.

```bash
# 운영 저장소 루트에서
cp -r patch-mvp-design/frontend/. frontend/
cd frontend
npm install   # 최초 1회
npm run build # vite build → ../backend/app/static 로 산출
```

## 빌드 안전성
이 패치는 **CSS 2개 + index.html `<link>` 1줄**만 변경합니다 — JS/JSX/TS/import 그래프를 전혀 건드리지 않으므로
Vite 빌드 결과에 영향이 없습니다. (이 환경에서는 `npm run build`를 직접 실행할 수 없어, 위 명령으로 최종 확인 부탁드립니다.)

## 커밋 메시지
```
Apply MVP design to production app
```
