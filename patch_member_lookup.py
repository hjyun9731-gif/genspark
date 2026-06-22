"""
misugeum 회원용 미수금 조회 사이트 패치 스크립트

사용법:
1) 이 파일이 들어있는 patch 폴더 전체를 실제 misugeum 프로젝트 루트에 복사
2) 프로젝트 루트에서 실행:
   python patch_member_lookup.py
3) main.py 문법검사:
   python -m py_compile main.py routers/public_lookup.py
4) 로컬 실행 후 확인:
   /member-arrears
   /admin/public-arrears
"""
from pathlib import Path
import shutil
import re
import sys

ROOT = Path.cwd()
PATCH_DIR = Path(__file__).resolve().parent

MAIN = ROOT / "main.py"
if not MAIN.exists():
    raise SystemExit("ERROR: main.py가 있는 실제 misugeum 프로젝트 루트에서 실행해야 합니다.")

# 1) 파일 복사
for folder in ["routers", "templates"]:
    (ROOT / folder).mkdir(exist_ok=True)

files = [
    (PATCH_DIR / "routers" / "public_lookup.py", ROOT / "routers" / "public_lookup.py"),
    (PATCH_DIR / "templates" / "member_arrears_lookup.html", ROOT / "templates" / "member_arrears_lookup.html"),
    (PATCH_DIR / "templates" / "admin_public_arrears.html", ROOT / "templates" / "admin_public_arrears.html"),
]
for src, dst in files:
    if not src.exists():
        raise SystemExit(f"ERROR: 패치 파일이 없습니다: {src}")
    shutil.copy2(src, dst)

init = ROOT / "routers" / "__init__.py"
if not init.exists():
    init.write_text("", encoding="utf-8")

# 2) main.py 백업
backup = ROOT / "main.py.before_member_lookup_patch"
if not backup.exists():
    shutil.copy2(MAIN, backup)

s = MAIN.read_text(encoding="utf-8")

# 3) import 추가
import_line = "from routers.public_lookup import router as public_lookup_router"
if import_line not in s:
    # 마지막 import 블록 뒤에 넣기
    lines = s.splitlines()
    insert_at = 0
    for i, line in enumerate(lines[:120]):
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("from "):
            insert_at = i + 1
    lines.insert(insert_at, import_line)
    s = "\n".join(lines) + "\n"

# 4) app.include_router 추가
include_line = "app.include_router(public_lookup_router)"
if include_line not in s:
    # app = FastAPI(...) 뒤에 넣기. 멀티라인 FastAPI도 고려해서 첫 app 선언 이후 적당한 위치 탐색
    lines = s.splitlines()
    app_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bapp\s*=\s*FastAPI\s*\(", line):
            app_idx = i
            break
    if app_idx is None:
        raise SystemExit("ERROR: main.py에서 app = FastAPI(...) 선언을 찾지 못했습니다. 수동으로 app.include_router(public_lookup_router)를 추가해 주세요.")

    # FastAPI 선언이 닫히는 줄 찾기
    insert_at = app_idx + 1
    depth = 0
    started = False
    for i in range(app_idx, min(len(lines), app_idx + 40)):
        depth += lines[i].count("(")
        depth -= lines[i].count(")")
        if "FastAPI" in lines[i]:
            started = True
        if started and depth <= 0:
            insert_at = i + 1
            break

    # 기존 app.add_middleware/app.mount 앞보다 include_router가 먼저 와도 문제 없지만, 깔끔하게 app 선언 직후 넣음
    lines.insert(insert_at, include_line)
    s = "\n".join(lines) + "\n"

MAIN.write_text(s, encoding="utf-8")

print("OK 회원용 미수금 조회 사이트 패치 완료")
print("수정/추가 파일:")
print("- main.py")
print("- routers/public_lookup.py")
print("- templates/member_arrears_lookup.html")
print("- templates/admin_public_arrears.html")
print("\n다음 확인 명령:")
print("python -m py_compile main.py routers/public_lookup.py")
print("\nRailway 환경변수 권장:")
print("PUBLIC_ARREARS_ADMIN_KEY=관리자전용비밀번호")
print("PUBLIC_ARREARS_BANK_ACCOUNT=농협 XXXX-XX-XXXXXX 강원도개인소형화물협회")
