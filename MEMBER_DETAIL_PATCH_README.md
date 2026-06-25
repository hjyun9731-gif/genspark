# 회원상세 주소/공문주소 + 폐업버튼 패치

적용:
```cmd
cd /d C:\Users\PC\Documents\GitHub\genspark
python apply_member_detail_patch.py
git status --short
```

임시파일 삭제 + 커밋:
```cmd
del apply_member_detail_patch.py
del frontend\static\app\*.bak_member_detail
del backend\app\routers\*.bak_member_detail

git add backend/app/routers/members.py backend/app/routers/imports.py frontend/static/app/Modals.jsx
git commit -m "Fix member detail address display"
git push origin claude/sweet-ptolemy-66ml2i
```
