# MISU Runtime Hotfix

Railway 로그 오류 수정:
- `/api/closures` 500: `NameError: address is not defined`
- `/api/members/exclusion-rules` 404

적용:
```cmd
cd /d C:\Users\PC\Documents\GitHub\genspark
python apply_misu_runtime_hotfix.py
git status --short
```

커밋:
```cmd
del apply_misu_runtime_hotfix.py
del backend\app\routers\*.bak_hotfix
git add backend/app/routers/closures.py backend/app/routers/members.py
git commit -m "Fix closure and exclusion rule runtime errors"
git push origin claude/sweet-ptolemy-66ml2i
```