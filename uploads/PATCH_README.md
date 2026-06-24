# 미수금관리 긴급 패치 적용법

이 패치는 현재 터진 핵심 오류만 먼저 잡습니다.

## 고치는 내용

1. 회원 상세/미수금명단 미수개월 불일치
   - `backend/app/routers/members.py`
   - `len(open_items)=1`로만 계산하던 문제를 `현재잔액 / 월부과액` 기준과 함께 계산하도록 변경

2. 통장매칭 붙여넣기 오류
   - `frontend/static/app/BankMatching.jsx`
   - `거래 후 잔액`을 입금액으로 잘못 읽던 `Math.max(...)` 방식 제거
   - `입금금액` 컬럼만 입금액으로 사용
   - 입금자명은 `거래기록사항` 우선, 없으면 `거래내용`

3. 통장매칭 백엔드 방어
   - `backend/app/routers/deposits.py`
   - 입금금액/거래기록사항 우선 매핑

4. 초기 로딩 속도 개선
   - `frontend/static/app/App.jsx`
   - 최초 `/api/members?size=5000` → `/api/members?page=1&size=100`

## 적용 방법

압축을 풀고, `apply_misu_critical_patch.py`를 `genspark` 루트 폴더에 복사한 뒤 실행하세요.

```cmd
cd /d C:\Users\PC\Documents\GitHub\genspark
python apply_misu_critical_patch.py
```

그 다음:

```cmd
git status
git add frontend/static/app/BankMatching.jsx frontend/static/app/App.jsx backend/app/routers/members.py backend/app/routers/deposits.py
git commit -m "Fix arrears months and bank paste parsing"
git push origin claude/sweet-ptolemy-66ml2i
```

Railway가 자동 배포되면 확인:

- 회원상세와 미수금명단의 미수개월이 같아야 함
- 통장매칭 붙여넣기에서 입금액이 `입금금액` 기준으로 들어가야 함
- 20,260,529원 같은 거래 후 잔액이 입금액으로 들어가면 실패
- Railway 로그에 `/api/members?page=1&size=100`, `/api/deposits` 호출이 보여야 함

## 되돌리기

각 파일 옆에 `.bak_misu_critical` 백업이 생깁니다.
문제 있으면 백업 파일을 원래 파일명으로 되돌리세요.
