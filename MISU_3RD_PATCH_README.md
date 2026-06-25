# MISU 3차 패치

## 목적

2차 패치에서 브라우저 저장으로 만든 제외자/지로희망자 관리를 서버 DB 저장 방식으로 보강하고, 새로고침 시 현재 메뉴가 유지되도록 합니다.

## 포함 내용

1. `backend/app/routers/members.py`
   - `/api/members/exclusion-rules` GET/POST 추가
   - `/api/members/exclusion-rules/{id}` PATCH/DELETE 추가
   - 최초 호출 시 `exclusion_rules` 테이블 자동 생성
   - 별도 Alembic migration 없이 Railway PostgreSQL에서 바로 사용 가능하게 구성

2. `frontend/static/app/Regional.jsx`
   - 제외자/지로희망자 목록을 서버에서 불러와 캐시
   - 2차 패치의 제외자 추가/수정/해제를 서버 API로 저장
   - 서버 저장 실패 시 브라우저 임시 저장 fallback
   - 알토란/문자제외 필터가 DB 제외자 규칙을 읽을 수 있게 보강

3. `frontend/static/app/App.jsx`
   - 새로고침 시 현재 메뉴 유지
   - URL hash와 localStorage에 현재 메뉴 저장

## 적용 순서

```cmd
cd /d C:\Users\PC\Documents\GitHub\genspark
python apply_misu_3rd_patch.py
git status --short
```

정상 변경 파일:

```text
M backend/app/routers/members.py
M frontend/static/app/App.jsx
M frontend/static/app/Regional.jsx
```

임시파일 삭제:

```cmd
del apply_misu_3rd_patch.py
del backend\app\routers\*.bak_3rd
del frontend\static\app\*.bak_3rd
```

커밋/푸시:

```cmd
git add backend/app/routers/members.py frontend/static/app/App.jsx frontend/static/app/Regional.jsx
git commit -m "Persist exclusions and keep current route"
git push origin claude/sweet-ptolemy-66ml2i
```

## 주의

- 2차 패치를 먼저 적용한 상태에서 실행하는 것을 권장합니다.
- 2차 패치가 없어도 backend API와 새로고침 유지 기능은 적용됩니다.
- 제외자/지로희망자 기존 브라우저 저장 데이터는 서버에 자동 일괄 업로드하지 않습니다. 기존에 입력한 항목은 한 번 수정/저장하면 서버에 저장됩니다.
