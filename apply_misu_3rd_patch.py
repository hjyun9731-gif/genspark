# -*- coding: utf-8 -*-
"""
MISU 3차 패치
- 제외자/지로희망자 관리를 DB 저장 방식으로 보강 (/api/members/exclusion-rules)
- 지역별/알토란 제외 필터가 DB 저장 제외자를 읽도록 동기화
- 새로고침 시 현재 메뉴 유지 (localStorage + URL hash)
- 2차 패치가 만든 제외자 관리 UI의 저장/수정/해제를 서버 API로 전환

주의:
- 이 패치는 2차 패치 적용 후 실행하는 것을 권장합니다.
- 2차 패치가 아직 적용되지 않았어도 backend API와 새로고침 유지 패치는 적용됩니다.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path.cwd()


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def write(p: Path, s: str) -> None:
    bak = p.with_suffix(p.suffix + ".bak_3rd")
    if not bak.exists() and p.exists():
        bak.write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
    p.write_text(s, encoding="utf-8", newline="")


def ensure_import(s: str, import_line: str, after_prefix: str = "import ") -> str:
    if re.search(rf"(?m)^{re.escape(import_line)}$", s):
        return s
    # put after last top-level import/from block near the top
    lines = s.splitlines()
    idx = 0
    for i, line in enumerate(lines[:40]):
        if line.startswith("import ") or line.startswith("from "):
            idx = i + 1
    lines.insert(idx, import_line)
    return "\n".join(lines) + ("\n" if s.endswith("\n") else "")


def patch_members_backend():
    p = ROOT / "backend/app/routers/members.py"
    if not p.exists():
        print("- SKIP members.py 없음")
        return
    s = read(p)

    # imports
    if "from uuid import uuid4" not in s:
        s = ensure_import(s, "from uuid import uuid4")
    if "from sqlalchemy import select, text" not in s:
        s = s.replace("from sqlalchemy import select", "from sqlalchemy import select, text")
    if "Body" not in s.split("\n", 20)[0:20].__str__():
        s = s.replace("from fastapi import APIRouter, Depends, HTTPException, Query", "from fastapi import APIRouter, Body, Depends, HTTPException, Query")

    marker = "# MISU_3RD_EXCLUSION_API_BEGIN"
    if marker not in s:
        api_block = r'''

# MISU_3RD_EXCLUSION_API_BEGIN
# DB 저장형 제외자/지로희망자 관리. 별도 migration 없이 최초 호출 시 테이블을 생성한다.
def _ensure_exclusion_rules_table(db: Session) -> None:
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS exclusion_rules (
            id VARCHAR(64) PRIMARY KEY,
            member_id VARCHAR(64),
            sigun VARCHAR(100),
            name VARCHAR(100),
            vehicle_no VARCHAR(100),
            mgmt_no VARCHAR(100),
            phone VARCHAR(50),
            exclude_type VARCHAR(50) NOT NULL DEFAULT '문자제외',
            reason TEXT,
            start_date VARCHAR(20),
            memo TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    db.commit()


def _rule_dict(row) -> dict:
    r = dict(row._mapping if hasattr(row, "_mapping") else row)
    return {
        "id": r.get("id"),
        "member_id": r.get("member_id"),
        "memberId": r.get("member_id"),
        "region": r.get("sigun") or "",
        "sigun": r.get("sigun") or "",
        "name": r.get("name") or "",
        "vehicle_no": r.get("vehicle_no") or "",
        "vehicleNo": r.get("vehicle_no") or "",
        "mgmt_no": r.get("mgmt_no") or "",
        "mgmtNo": r.get("mgmt_no") or "",
        "phone": r.get("phone") or "",
        "exclude_type": r.get("exclude_type") or "문자제외",
        "excludeType": r.get("exclude_type") or "문자제외",
        "reason": r.get("reason") or "",
        "start_date": r.get("start_date") or "",
        "startDate": r.get("start_date") or "",
        "memo": r.get("memo") or "",
        "is_active": bool(r.get("is_active")),
        "isActive": bool(r.get("is_active")),
        "created_at": str(r.get("created_at") or ""),
        "updated_at": str(r.get("updated_at") or ""),
    }


@router.get("/exclusion-rules")
def list_exclusion_rules(active_only: bool = True, db: Session = Depends(get_db)):
    _ensure_exclusion_rules_table(db)
    where = "WHERE is_active = TRUE" if active_only else ""
    rows = db.execute(text(f"SELECT * FROM exclusion_rules {where} ORDER BY sigun, name, vehicle_no, created_at DESC")).all()
    return [_rule_dict(r) for r in rows]


@router.post("/exclusion-rules")
def create_exclusion_rule(payload: dict = Body(default={}), db: Session = Depends(get_db)):
    _ensure_exclusion_rules_table(db)
    rid = str(payload.get("id") or uuid4())
    params = {
        "id": rid,
        "member_id": payload.get("member_id") or payload.get("memberId") or payload.get("memberKey"),
        "sigun": payload.get("sigun") or payload.get("region"),
        "name": payload.get("name"),
        "vehicle_no": payload.get("vehicle_no") or payload.get("vehicleNo"),
        "mgmt_no": payload.get("mgmt_no") or payload.get("mgmtNo"),
        "phone": payload.get("phone"),
        "exclude_type": payload.get("exclude_type") or payload.get("excludeType") or "문자제외",
        "reason": payload.get("reason"),
        "start_date": payload.get("start_date") or payload.get("startDate"),
        "memo": payload.get("memo"),
    }
    db.execute(text("""
        INSERT INTO exclusion_rules
        (id, member_id, sigun, name, vehicle_no, mgmt_no, phone, exclude_type, reason, start_date, memo, is_active, updated_at)
        VALUES
        (:id, :member_id, :sigun, :name, :vehicle_no, :mgmt_no, :phone, :exclude_type, :reason, :start_date, :memo, TRUE, CURRENT_TIMESTAMP)
    """), params)
    db.commit()
    row = db.execute(text("SELECT * FROM exclusion_rules WHERE id=:id"), {"id": rid}).first()
    return _rule_dict(row)


@router.patch("/exclusion-rules/{rule_id}")
def update_exclusion_rule(rule_id: str, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    _ensure_exclusion_rules_table(db)
    exists = db.execute(text("SELECT id FROM exclusion_rules WHERE id=:id"), {"id": rule_id}).first()
    if not exists:
        payload = dict(payload or {})
        payload["id"] = rule_id
        return create_exclusion_rule(payload, db)
    params = {
        "id": rule_id,
        "member_id": payload.get("member_id") or payload.get("memberId") or payload.get("memberKey"),
        "sigun": payload.get("sigun") or payload.get("region"),
        "name": payload.get("name"),
        "vehicle_no": payload.get("vehicle_no") or payload.get("vehicleNo"),
        "mgmt_no": payload.get("mgmt_no") or payload.get("mgmtNo"),
        "phone": payload.get("phone"),
        "exclude_type": payload.get("exclude_type") or payload.get("excludeType") or "문자제외",
        "reason": payload.get("reason"),
        "start_date": payload.get("start_date") or payload.get("startDate"),
        "memo": payload.get("memo"),
        "is_active": bool(payload.get("is_active", payload.get("isActive", True))),
    }
    db.execute(text("""
        UPDATE exclusion_rules SET
          member_id=:member_id,
          sigun=:sigun,
          name=:name,
          vehicle_no=:vehicle_no,
          mgmt_no=:mgmt_no,
          phone=:phone,
          exclude_type=:exclude_type,
          reason=:reason,
          start_date=:start_date,
          memo=:memo,
          is_active=:is_active,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=:id
    """), params)
    db.commit()
    row = db.execute(text("SELECT * FROM exclusion_rules WHERE id=:id"), {"id": rule_id}).first()
    return _rule_dict(row)


@router.delete("/exclusion-rules/{rule_id}")
def delete_exclusion_rule(rule_id: str, hard: bool = False, db: Session = Depends(get_db)):
    _ensure_exclusion_rules_table(db)
    if hard:
        db.execute(text("DELETE FROM exclusion_rules WHERE id=:id"), {"id": rule_id})
    else:
        db.execute(text("UPDATE exclusion_rules SET is_active=FALSE, updated_at=CURRENT_TIMESTAMP WHERE id=:id"), {"id": rule_id})
    db.commit()
    return {"ok": True, "id": rule_id, "deleted": True}
# MISU_3RD_EXCLUSION_API_END
'''
        # Important: insert before dynamic /{member_id} route so /exclusion-rules is not swallowed.
        dyn = s.find('@router.get("/{member_id}")')
        if dyn == -1:
            s += api_block
            print("- WARN members.py: 동적 member route 위치 못 찾아 파일 끝에 추가")
        else:
            s = s[:dyn] + api_block + "\n" + s[dyn:]
        write(p, s)
        print("- members.py: DB 제외자/지로희망자 API 추가")
    else:
        print("- members.py: DB 제외자 API 이미 있음")


def patch_app_route_persist():
    p = ROOT / "frontend/static/app/App.jsx"
    if not p.exists():
        print("- SKIP App.jsx 없음")
        return
    s = read(p)
    if "MISU_3RD_ROUTE_PERSIST" in s:
        print("- App.jsx: 화면 유지 패치 이미 있음")
        return
    old = '  const [route, setRoute] = React.useState("dashboard");'
    new = '''  // MISU_3RD_ROUTE_PERSIST: 새로고침해도 현재 메뉴 유지
  const initialRoute = () => {
    const hash = String(window.location.hash || "").replace("#", "");
    const saved = localStorage.getItem("misu_current_route");
    return TITLES[hash] ? hash : (TITLES[saved] ? saved : "dashboard");
  };
  const [route, setRoute] = React.useState(initialRoute);'''
    if old not in s:
        print("- WARN App.jsx: route useState 위치를 찾지 못했습니다")
    else:
        s = s.replace(old, new, 1)
        anchor = '''  React.useEffect(()=>{
    const r = document.documentElement;
    r.style.setProperty("--brand", t.accent);
    r.style.setProperty("--brand-hover", t.accent);
  }, [t.accent]);'''
        extra = anchor + '''

  React.useEffect(() => {
    localStorage.setItem("misu_current_route", route);
    if (window.location.hash !== `#${route}`) {
      history.replaceState(null, "", `#${route}`);
    }
  }, [route]);

  React.useEffect(() => {
    const onHash = () => {
      const h = String(window.location.hash || "").replace("#", "");
      if (TITLES[h]) setRoute(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);'''
        if anchor in s:
            s = s.replace(anchor, extra, 1)
        else:
            print("- WARN App.jsx: route persist effect 삽입 위치를 찾지 못했습니다")
        write(p, s)
        print("- App.jsx: 새로고침 메뉴 유지 패치 완료")


def patch_regional_db_exclusions():
    p = ROOT / "frontend/static/app/Regional.jsx"
    if not p.exists():
        print("- SKIP Regional.jsx 없음")
        return
    s = read(p)
    changed = False

    # Ensure global cache-aware load/save helpers if the 2nd patch helpers exist.
    if "EXCLUSION_STORE_KEY" in s:
        s2 = re.sub(
            r"function loadExclusionRules\(\)\{[\s\S]*?\n\}",
            '''function loadExclusionRules(){
  if (Array.isArray(window.__MISU_EXCLUSION_RULES__)) return window.__MISU_EXCLUSION_RULES__;
  try { return JSON.parse(localStorage.getItem(EXCLUSION_STORE_KEY) || "[]"); } catch(e) { return []; }
}''',
            s,
            count=1,
        )
        if s2 != s:
            s = s2; changed = True
        s2 = re.sub(
            r"function saveExclusionRules\(rows\)\{[\s\S]*?\n\}",
            '''function saveExclusionRules(rows){
  const clean = rows || [];
  window.__MISU_EXCLUSION_RULES__ = clean;
  localStorage.setItem(EXCLUSION_STORE_KEY, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent("misu-exclusion-rules-changed"));
}''',
            s,
            count=1,
        )
        if s2 != s:
            s = s2; changed = True
    else:
        # Add minimal helpers so Altoran can read DB rules if 2nd patch is not present yet.
        helper = '''
// MISU_3RD_EXCLUSION_HELPER: DB/브라우저 공통 제외자 캐시
const EXCLUSION_STORE_KEY = "misu_exclusion_rules_v2";
function loadExclusionRules(){
  if (Array.isArray(window.__MISU_EXCLUSION_RULES__)) return window.__MISU_EXCLUSION_RULES__;
  try { return JSON.parse(localStorage.getItem(EXCLUSION_STORE_KEY) || "[]"); } catch(e) { return []; }
}
function saveExclusionRules(rows){
  const clean = rows || [];
  window.__MISU_EXCLUSION_RULES__ = clean;
  localStorage.setItem(EXCLUSION_STORE_KEY, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent("misu-exclusion-rules-changed"));
}
function memberKeyForExclusion(m){ return [m?.id, m?.mgmtNo||m?.mgmt_no, m?.vehicleNo||m?.vehicle_no, m?.name].filter(Boolean).join("|"); }
function isExcludedByRule(m, type){
  const rules = loadExclusionRules();
  const name = String(m?.name || "").trim();
  const vehicle = String(m?.vehicleNo || m?.vehicle_no || "").replace(/\s/g,"");
  const mgmt = String(m?.mgmtNo || m?.mgmt_no || "").trim();
  const phone = String(m?.phone || "").replace(/\D/g,"");
  return rules.some(r => {
    const rt = r.excludeType || r.exclude_type;
    if (type && rt && rt !== type && !(type === "문자제외" && rt === "지로희망")) return false;
    if ((r.memberKey || r.member_id || r.memberId) && String(r.memberKey || r.member_id || r.memberId) === memberKeyForExclusion(m)) return true;
    if ((r.mgmtNo || r.mgmt_no) && mgmt && (r.mgmtNo || r.mgmt_no) === mgmt) return true;
    if ((r.vehicleNo || r.vehicle_no) && vehicle && String(r.vehicleNo || r.vehicle_no).replace(/\s/g,"") === vehicle) return true;
    if (r.phone && phone && String(r.phone).replace(/\D/g,"") === phone) return true;
    if (r.name && name && r.name === name) return true;
    return false;
  });
}
'''
        if "function RChip" in s:
            s = s.replace("function RChip", helper + "\nfunction RChip", 1)
            changed = True

    # Add sync effect to Regional main component.
    if "MISU_3RD_EXCLUSION_SYNC" not in s and "function Regional({ members, onToast })" in s:
        s = s.replace(
            'function Regional({ members, onToast }) {\n  const [activeTab, setActiveTab] = React.useState(0);',
            '''function Regional({ members, onToast }) {
  const [activeTab, setActiveTab] = React.useState(0);
  // MISU_3RD_EXCLUSION_SYNC: 제외자/지로희망자 DB 저장값 불러오기
  React.useEffect(() => {
    let alive = true;
    fetch('/api/members/exclusion-rules')
      .then(r => r.ok ? r.json() : [])
      .then(rows => { if (alive && Array.isArray(rows)) saveExclusionRules(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);''',
            1,
        )
        changed = True

    # Convert 2nd patch TabExcluded save/remove functions to DB API.
    if "function saveRule(row){" in s and "MISU_3RD_RULE_SAVE" not in s:
        s = re.sub(
            r"function saveRule\(row\)\{[\s\S]*?\n  \}",
            '''async function saveRule(row){
    // MISU_3RD_RULE_SAVE: DB 저장형 제외자/지로희망자 저장
    const payload = {
      member_id: row.member_id || row.memberId || row.memberKey || null,
      region: row.region || row.sigun || "",
      name: row.name || "",
      vehicleNo: row.vehicleNo || row.vehicle_no || "",
      mgmtNo: row.mgmtNo || row.mgmt_no || "",
      phone: row.phone || "",
      excludeType: row.excludeType || row.exclude_type || "문자제외",
      reason: row.reason || "",
      startDate: row.startDate || row.start_date || new Date().toISOString().slice(0,10),
      memo: row.memo || "",
    };
    try {
      const isExisting = row.id && !String(row.id).startsWith("auto-");
      const res = await fetch(isExisting ? `/api/members/exclusion-rules/${row.id}` : '/api/members/exclusion-rules', {
        method: isExisting ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      const saved = await res.json();
      const normalized = { ...saved, source:"수동등록" };
      const next = isExisting ? rules.map(r=>r.id===row.id ? normalized : r) : [normalized, ...rules];
      saveExclusionRules(next); setRules(next); setModal(null); onToast(isExisting ? "제외자 정보 수정" : "제외자 추가 완료");
    } catch(e) {
      const next = row.id ? rules.map(r=>r.id===row.id ? row : r) : [{...row, id:String(Date.now())}, ...rules];
      saveExclusionRules(next); setRules(next); setModal(null); onToast("서버 저장 실패 · 이 브라우저에 임시 저장됨");
    }
  }''',
            s,
            count=1,
        )
        changed = True
    if "function removeRule(row){" in s and "MISU_3RD_RULE_REMOVE" not in s:
        s = re.sub(
            r"function removeRule\(row\)\{[\s\S]*?\n  \}",
            '''async function removeRule(row){
    // MISU_3RD_RULE_REMOVE: DB 저장형 제외자/지로희망자 해제
    if(!confirm(`${row.name || row.vehicleNo || "제외자"} 항목을 해제할까요?`)) return;
    try {
      if (row.id && !String(row.id).startsWith("auto-")) {
        await fetch(`/api/members/exclusion-rules/${row.id}`, { method:'DELETE' });
      }
    } catch(e) {}
    const next = rules.filter(r=>r.id!==row.id);
    saveExclusionRules(next); setRules(next); onToast("제외자 해제 완료");
  }''',
            s,
            count=1,
        )
        changed = True

    if changed:
        write(p, s)
        print("- Regional.jsx: DB 제외자 동기화/저장 패치 완료")
    else:
        print("- Regional.jsx: 변경 없음 또는 2차 UI 패턴 미확인")


def main():
    print(f"[MISU 3RD PATCH] repo: {ROOT}")
    patch_members_backend()
    patch_app_route_persist()
    patch_regional_db_exclusions()
    print("\n완료. git status 확인 후 commit/push 하세요. 백업은 *.bak_3rd 로 생성됩니다.")


if __name__ == "__main__":
    main()
