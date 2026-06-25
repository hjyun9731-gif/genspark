# -*- coding: utf-8 -*-
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent
print(f'[MISU RUNTIME HOTFIX] repo: {ROOT}')

def read(p):
    return p.read_text(encoding='utf-8', errors='replace')

def write(p, s):
    p.write_text(s, encoding='utf-8', newline='\n')

def backup(p):
    b = p.with_name(p.name + '.bak_hotfix')
    if not b.exists():
        shutil.copy2(p, b)

def ensure_import(s, line):
    if re.search(rf'(?m)^{re.escape(line)}$', s):
        return s
    m = re.search(r'(?m)^(from\s+\S+\s+import\s+.*|import\s+\S+.*)$', s)
    if m:
        return s[:m.start()] + line + '\n' + s[m.start():]
    return line + '\n' + s

def patch_closures():
    p = ROOT / 'backend' / 'app' / 'routers' / 'closures.py'
    backup(p)
    s = read(p)
    s = ensure_import(s, 'import re')
    s = ensure_import(s, 'import math')
    marker = '# MISU_HOTFIX_CLOSURE_ADDRESS'
    if marker not in s:
        block = (
            'def _closure_dict(c: Closure) -> dict:\n'
            '    m = c.member\n'
            '    ' + marker + '\n'
            '    memo_raw = (getattr(m, "memo", "") or "") if m else ""\n'
            '    def _pick(labels):\n'
            '        for label in labels:\n'
            '            mm = re.search(rf"(?:^|\\s*/\\s*){re.escape(label)}\\s*[:：]\\s*([^/]+)", memo_raw)\n'
            '            if mm:\n'
            '                return (mm.group(1) or "").strip()\n'
            '        return ""\n'
            '    address = (getattr(m, "address", None) or _pick(["주소", "주 소", "일반주소"]) or "") if m else ""\n'
            '    open_items = []\n'
            '    if m is not None:\n'
            '        try:\n'
            '            open_items = [x for x in (getattr(m, "receivable_items", []) or []) if (not getattr(x, "is_paid", False)) and int(getattr(x, "amount", 0) or 0) > 0]\n'
            '        except Exception:\n'
            '            open_items = []\n'
            '    unpaid_items = []\n'
            '    for x in open_items:\n'
            '        item = getattr(x, "charge_item", None) or (getattr(m, "charge_item", "") if m else "")\n'
            '        if item and item not in unpaid_items:\n'
            '            unpaid_items.append(item)\n'
            '    unpaid_item = "/".join(unpaid_items) or (getattr(m, "charge_item", "") if m else "")\n'
            '    unpaid_balance_for_months = int(getattr(c, "unpaid_balance", 0) or 0)\n'
            '    monthly_charge = int(getattr(m, "monthly_charge", 0) or 0) if m else 0\n'
            '    unpaid_period = len(open_items)\n'
            '    if monthly_charge > 0 and unpaid_balance_for_months > 0:\n'
            '        unpaid_period = max(unpaid_period, math.ceil(unpaid_balance_for_months / monthly_charge))\n'
            '    collect_status = getattr(c, "collect_status", None) or getattr(c, "status", None) or ""\n'
            '    last_notice = getattr(c, "last_notice_date", None) or getattr(c, "updated_at", None)\n'
            '    last_notice_date = last_notice.isoformat() if hasattr(last_notice, "isoformat") else (last_notice or "")\n'
        )
        s = s.replace('def _closure_dict(c: Closure) -> dict:\n    m = c.member\n', block, 1)
    if '"address": address,' not in s:
        s = s.replace('        "memo": m.memo if m else "",\n', '        "memo": m.memo if m else "",\n        "address": address,\n', 1)
    add = ''
    if '"unpaidItem":' not in s:
        add += '        "unpaidItem": unpaid_item,\n        "unpaid_item": unpaid_item,\n'
    if '"unpaidPeriod":' not in s:
        add += '        "unpaidPeriod": unpaid_period,\n        "unpaid_period": unpaid_period,\n'
    if '"collectStatus":' not in s:
        add += '        "collectStatus": collect_status,\n        "collect_status": collect_status,\n'
    if '"lastNoticeDate":' not in s:
        add += '        "lastNoticeDate": last_notice_date,\n        "last_notice_date": last_notice_date,\n'
    if add and '        "memberStatus": m.status if m else "",\n' in s:
        s = s.replace('        "memberStatus": m.status if m else "",\n', add + '        "memberStatus": m.status if m else "",\n', 1)
    write(p, s)
    print('- closures.py hotfixed')

def patch_members():
    p = ROOT / 'backend' / 'app' / 'routers' / 'members.py'
    backup(p)
    s = read(p)
    if 'from pydantic import BaseModel' not in s:
        s = s.replace('from fastapi import APIRouter, Depends, HTTPException, Query\n', 'from fastapi import APIRouter, Depends, HTTPException, Query\nfrom pydantic import BaseModel\n')
    if 'from sqlalchemy import select, text' not in s:
        s = s.replace('from sqlalchemy import select\n', 'from sqlalchemy import select, text\n')
    if 'MISU_HOTFIX_EXCLUSION_RULES' not in s:
        block = '''

# MISU_HOTFIX_EXCLUSION_RULES
class ExclusionRulePayload(BaseModel):
    region: str | None = None
    sigun: str | None = None
    name: str | None = None
    vehicle_no: str | None = None
    vehicleNo: str | None = None
    mgmt_no: str | None = None
    mgmtNo: str | None = None
    phone: str | None = None
    rule_type: str | None = None
    ruleType: str | None = None
    reason: str | None = None
    memo: str | None = None
    start_date: str | None = None
    startDate: str | None = None
    is_active: bool | None = True

def _ensure_exclusion_rules_table(db: Session) -> None:
    db.execute(text("CREATE TABLE IF NOT EXISTS exclusion_rules (id SERIAL PRIMARY KEY, region TEXT, name TEXT, vehicle_no TEXT, mgmt_no TEXT, phone TEXT, rule_type TEXT DEFAULT '문자제외', reason TEXT, memo TEXT, start_date TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"))
    db.commit()

def _exclusion_dict(payload: ExclusionRulePayload) -> dict:
    return {
        'region': payload.region or payload.sigun or '',
        'name': payload.name or '',
        'vehicle_no': payload.vehicle_no or payload.vehicleNo or '',
        'mgmt_no': payload.mgmt_no or payload.mgmtNo or '',
        'phone': payload.phone or '',
        'rule_type': payload.rule_type or payload.ruleType or '문자제외',
        'reason': payload.reason or '',
        'memo': payload.memo or '',
        'start_date': payload.start_date or payload.startDate or '',
        'is_active': True if payload.is_active is None else bool(payload.is_active),
    }

def _rule_row(row) -> dict:
    d = dict(row)
    return {
        'id': d.get('id'),
        'region': d.get('region') or '',
        'sigun': d.get('region') or '',
        'name': d.get('name') or '',
        'vehicle_no': d.get('vehicle_no') or '',
        'vehicleNo': d.get('vehicle_no') or '',
        'mgmt_no': d.get('mgmt_no') or '',
        'mgmtNo': d.get('mgmt_no') or '',
        'phone': d.get('phone') or '',
        'rule_type': d.get('rule_type') or '',
        'ruleType': d.get('rule_type') or '',
        'reason': d.get('reason') or '',
        'memo': d.get('memo') or '',
        'start_date': d.get('start_date') or '',
        'startDate': d.get('start_date') or '',
        'is_active': bool(d.get('is_active')),
        'isActive': bool(d.get('is_active')),
    }

@router.get('/exclusion-rules')
def list_exclusion_rules(db: Session = Depends(get_db)):
    _ensure_exclusion_rules_table(db)
    rows = db.execute(text("SELECT id, region, name, vehicle_no, mgmt_no, phone, rule_type, reason, memo, start_date, is_active FROM exclusion_rules WHERE COALESCE(is_active, TRUE)=TRUE ORDER BY id DESC")).mappings().all()
    return [_rule_row(r) for r in rows]

@router.post('/exclusion-rules')
def create_exclusion_rule(payload: ExclusionRulePayload, db: Session = Depends(get_db)):
    _ensure_exclusion_rules_table(db)
    d = _exclusion_dict(payload)
    row = db.execute(text("INSERT INTO exclusion_rules (region, name, vehicle_no, mgmt_no, phone, rule_type, reason, memo, start_date, is_active, updated_at) VALUES (:region, :name, :vehicle_no, :mgmt_no, :phone, :rule_type, :reason, :memo, :start_date, :is_active, CURRENT_TIMESTAMP) RETURNING id, region, name, vehicle_no, mgmt_no, phone, rule_type, reason, memo, start_date, is_active"), d).mappings().first()
    db.commit()
    return _rule_row(row) if row else {'ok': True}

@router.patch('/exclusion-rules/{rule_id}')
def update_exclusion_rule(rule_id: int, payload: ExclusionRulePayload, db: Session = Depends(get_db)):
    _ensure_exclusion_rules_table(db)
    d = _exclusion_dict(payload)
    d['id'] = rule_id
    db.execute(text("UPDATE exclusion_rules SET region=:region, name=:name, vehicle_no=:vehicle_no, mgmt_no=:mgmt_no, phone=:phone, rule_type=:rule_type, reason=:reason, memo=:memo, start_date=:start_date, is_active=:is_active, updated_at=CURRENT_TIMESTAMP WHERE id=:id"), d)
    db.commit()
    return {'ok': True, 'id': rule_id}

@router.delete('/exclusion-rules/{rule_id}')
def delete_exclusion_rule(rule_id: int, db: Session = Depends(get_db)):
    _ensure_exclusion_rules_table(db)
    db.execute(text("UPDATE exclusion_rules SET is_active=FALSE, updated_at=CURRENT_TIMESTAMP WHERE id=:id"), {'id': rule_id})
    db.commit()
    return {'ok': True, 'id': rule_id}

'''
        marker = '@router.get("/{member_id}")'
        if marker in s:
            s = s.replace(marker, block + '\n' + marker, 1)
        else:
            s += block
    write(p, s)
    print('- members.py hotfixed')

patch_closures()
patch_members()
print('완료. git status 확인 후 commit/push 하세요.')