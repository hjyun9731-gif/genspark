# RUNBOOK

## 패치 적용

```cmd
cd /d C:\Users\PC\Documents\GitHub\genspark
python apply_misu_critical_patch.py
git status
git add .
git commit -m "Fix critical misu data calculation and bank parsing"
git push origin claude/sweet-ptolemy-66ml2i
```

## Railway 확인

Deploy Logs에서 다음이 보이는지 확인:

```text
GET /api/members?page=1&size=100
GET /api/deposits
GET /api/dashboard/summary
```

통장매칭 붙여넣기 후:

```text
POST /api/deposits/bulk
```

## 실패 시

- `*.bak_misu_critical` 백업으로 되돌림
- GitHub Desktop에서 변경 파일 Diff 확인
- Railway 배포 로그 확인
