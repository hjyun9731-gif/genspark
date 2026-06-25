# MISU Real-use Patch

실사용 중 발견된 기준 불일치와 화면 불편사항을 한 번에 보정하는 패치입니다.

## 주요 수정
- 대시보드 집계: 전체 DB 기준으로 12개월 이상, 30만원 이상, 선납자, 계정별 미수금, 미수개월수별 현황, 이번달 수납률 계산 보정
- 미수금명단: 기본값 미납/0원제외/선납제외, 현재 페이지와 전체 조건 합계 분리, 100명 기준 카운트 완화
- 회원상세: 오른쪽 drawer 대신 중앙 팝업, 주소/공문주소/주민번호/자격증명번호 표시 보강
- 지역/문자/폐업/예정자: backend 응답에 폐업 미납항목/미납기간/주소 보강, 예정자 주소/공문주소 메모 보존
- 통장매칭: 테이블 글씨와 간격 압축

## 적용 명령
```cmd
cd /d C:\Users\PC\Documents\GitHub\genspark
python apply_misu_realuse_patch.py
git status --short
```

임시파일 삭제 후 커밋/푸시:
```cmd
del apply_misu_realuse_patch.py
del backend\app\routers\*.bak_realuse
del frontend\static\app\*.bak_realuse
git add backend/app/routers/dashboard.py backend/app/routers/members.py backend/app/routers/closures.py backend/app/routers/pending.py frontend/static/app/App.jsx frontend/static/app/Receivables.jsx frontend/static/app/Modals.jsx frontend/static/app/BankMatching.jsx
git commit -m "Stabilize dashboard receivables and workflow UI"
git push origin claude/sweet-ptolemy-66ml2i
```

## 주의
패치 후 Railway 배포 완료 뒤 Ctrl+F5로 새로고침하세요.
주소/공문주소가 비어 있는 기존 회원은 전체면허자현황을 다시 업로드해야 완전히 채워집니다.
