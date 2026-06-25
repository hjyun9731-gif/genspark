# -*- coding: utf-8 -*-
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
print(f"[MISU MEMBER DETAIL PATCH] repo: {ROOT}")

def read(p):
    return p.read_text(encoding="utf-8", errors="replace")

def write(p, s):
    p.write_text(s, encoding="utf-8", newline="\n")

def backup(p):
    b = p.with_name(p.name + ".bak_member_detail")
    if not b.exists():
        shutil.copy2(p, b)

def patch_members_py():
    p = ROOT / "backend" / "app" / "routers" / "members.py"
    backup(p)
    s = read(p)

    old = """    for label in labels:
        # 메모에 저장된 "주소:... / 공문 주소:..." 형태를 다시 화면 필드로 복원한다.
        m = re.search(rf"(?:^|\\s*/\\s*){re.escape(label)}\\s*[:：]\\s*([^/]+)", raw)
        if m:
            v = m.group(1).strip()
            if v:
                return v[:300]
    return None
"""
    new = """    for label in labels:
        # 메모에 저장된 "주소:... / 공문 주소:..." 형태를 다시 화면 필드로 복원한다.
        # 과거 업로드에서 "원장 비고:주소:..."처럼 앞에 다른 라벨이 붙은 경우도 같이 복원한다.
        patterns = [
            rf"(?:^|\\s*/\\s*){re.escape(label)}\\s*[:：]\\s*([^/]+)",
            rf"{re.escape(label)}\\s*[:：]\\s*([^/]+)",
        ]
        for pattern in patterns:
            m = re.search(pattern, raw)
            if m:
                v = m.group(1).strip()
                if v:
                    return v[:300]
    return None
"""
    if old in s:
        s = s.replace(old, new, 1)
    else:
        print("  ! _memo_field block not matched; skipped")

    write(p, s)
    print("- members.py: 주소/공문주소 메모 복원 보강")

def patch_imports_py():
    p = ROOT / "backend" / "app" / "routers" / "imports.py"
    backup(p)
    s = read(p)

    helper = """

def _merge_member_notes(existing: str | None, generated: str | None, max_len: int = 1800) -> str | None:
    \"\"\"주소/공문주소/주민번호 등 구조화 메모를 원장 비고로 감싸지 않고 그대로 보존한다.\"\"\"
    current = _clean(existing)
    note = _clean(generated)
    if not note:
        return current[:max_len] if current else None
    parts = [x.strip() for x in (current + " / " + note if current else note).split(" / ") if x.strip()]
    merged: list[str] = []
    seen: set[str] = set()
    for part in parts:
        if part in seen:
            continue
        seen.add(part)
        merged.append(part)
    return " / ".join(merged)[:max_len] if merged else None
"""

    if "def _merge_member_notes(" not in s:
        anchor = "def _is_contact_problem_note(value: Any) -> bool:"
        s = s.replace(anchor, helper + "\n" + anchor, 1)

    old = """                cleaned_memo = _strip_generated_member_memo(m.memo)
                if memo:
                    m.memo = _append_unique_note(cleaned_memo, "원장 비고", memo)
                else:
                    m.memo = cleaned_memo
"""
    new = """                cleaned_memo = _strip_generated_member_memo(m.memo)
                m.memo = _merge_member_notes(cleaned_memo, memo)
"""
    if old in s:
        s = s.replace(old, new, 1)
    else:
        print("  ! existing member memo update block not matched; skipped")

    write(p, s)
    print("- imports.py: 재업로드 시 주소/공문주소 유지 보강")

def patch_modals_jsx():
    p = ROOT / "frontend" / "static" / "app" / "Modals.jsx"
    backup(p)
    s = read(p)

    s = s.replace(
        '<InfoRow label="주소" value={member.address} />',
        '<InfoRow label="주소" value={member.address||member.addr||member.homeAddress||member.home_address} />'
    )
    s = s.replace(
        '<InfoRow label="공문주소" value={member.publicAddress||member.public_address} />',
        '<InfoRow label="공문주소" value={member.publicAddress||member.public_address||member.officialAddress||member.official_address} />'
    )

    s = s.replace(
        '<button onClick={()=>onClosure(member)} style={{ height:38, padding:"0 16px", borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 14px/1 var(--font-sans)", cursor:"pointer" }}>폐업·이탈</button>',
        '<button onClick={()=>onClosure(member)} style={{ height:38, minWidth:104, flex:"0 0 auto", padding:"0 16px", borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 14px/1 var(--font-sans)", cursor:"pointer", whiteSpace:"nowrap" }}>폐업·이탈</button>'
    )

    write(p, s)
    print("- Modals.jsx: 상세 주소 표시/폐업버튼 보강")

def main():
    patch_members_py()
    patch_imports_py()
    patch_modals_jsx()
    print("\n완료. git status 확인 후 임시파일 삭제, commit/push 하세요.")

if __name__ == "__main__":
    main()
