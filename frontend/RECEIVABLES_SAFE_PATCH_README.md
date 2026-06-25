# 미수금명단 전용 안전 패치

이번 패치는 미수금명단만 건드립니다.

## 고치는 것
- `Receivables.jsx`의 `pad is not defined` 가능 오류 수정
- 현재 페이지 합계 / 전체 조건 합계 분리 표시
- 탭의 잘못된 100명 기준 카운트 숨김
- 기본값을 미납 / 0원 제외 / 선납 제외로 유지
- 필터 변경 시 1페이지로 이동
- 서버에서 전체 조건 기준 정렬 후 50명씩 페이지네이션

## 적용
```cmd
cd /d C:\Users\PC\Documents\GitHub\genspark
python apply_receivables_safe_patch.py
git status --short
```

## 임시파일 삭제 및 커밋
```cmd
del apply_receivables_safe_patch.py
del frontend\static\app\*.bak_receivables_safe
del backend\app\routers\*.bak_receivables_safe

git add frontend/static/app/Receivables.jsx backend/app/routers/members.py
git commit -m "Fix receivables list safely"
git push origin claude/sweet-ptolemy-66ml2i
```
