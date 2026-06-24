from __future__ import annotations
import re
import shutil
from pathlib import Path

ROOT = Path.cwd()
BACKUP_SUFFIX = ".bak_misu_critical"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def backup(path: Path) -> None:
    bak = path.with_name(path.name + BACKUP_SUFFIX)
    if not bak.exists():
        shutil.copy2(path, bak)


def patch_members() -> list[str]:
    path = ROOT / "backend" / "app" / "routers" / "members.py"
    if not path.exists():
        return [f"SKIP members.py 없음: {path}"]
    backup(path)
    text = read(path)
    changed = []

    if "# MISU_CRITICAL_PATCH_ARREARS_MONTHS" not in text:
        # import math 추가
        text = re.sub(r"(?m)^(from datetime import date\s*)$", r"\1\nimport math", text, count=1)
        # arrears_amount 직후 공통 미수개월 계산 삽입
        pattern = r"(?m)^(\s*)arrears_amount\s*=\s*sum\(x\.amount for x in balance_items\)\s*$"
        repl = (
            r"\1arrears_amount = sum(x.amount for x in balance_items)\n"
            r"\1# MISU_CRITICAL_PATCH_ARREARS_MONTHS: 미수월수는 화면별 계산 금지.\n"
            r"\1# 2026 미수금이 한 줄 현재잔액으로 들어온 경우 len(open_items)=1이 되므로,\n"
            r"\1# 금액/monthly_charge 기준도 함께 적용해 목록/상세/대시보드 값을 통일한다.\n"
            r"\1monthly_charge_for_months = int(member.monthly_charge or 0)\n"
            r"\1amount_based_months = math.ceil(max(int(arrears_amount or 0), 0) / monthly_charge_for_months) if monthly_charge_for_months > 0 else 0\n"
            r"\1arrears_months_common = max(len(open_items), amount_based_months)\n"
        )
        text, n = re.subn(pattern, repl, text, count=1)
        if n:
            changed.append("members.py: 공통 미수개월 계산 삽입")
        else:
            changed.append("WARN members.py: arrears_amount 위치 못 찾음")

    # len(open_items) 직접 반환 제거
    text2 = text.replace('"arrears_months": len(open_items),', '"arrears_months": arrears_months_common,')
    text2 = text2.replace('"arrearsMonths": len(open_items),', '"arrearsMonths": arrears_months_common,')
    if text2 != text:
        text = text2
        changed.append("members.py: arrears_months/arrearsMonths 공통값 적용")

    write(path, text)
    return changed or ["members.py: 변경 없음"]


def patch_app() -> list[str]:
    path = ROOT / "frontend" / "static" / "app" / "App.jsx"
    if not path.exists():
        return [f"SKIP App.jsx 없음: {path}"]
    backup(path)
    text = read(path)
    changed = []
    text2 = text.replace("fetch('/api/members?size=5000')", "fetch('/api/members?page=1&size=100')")
    if text2 != text:
        text = text2
        changed.append("App.jsx: 최초 로딩 members 5000건 → 100건으로 축소")
    text2 = text.replace("아래 14개 지역명", "아래 18개 지역명")
    if text2 != text:
        text = text2
        changed.append("App.jsx: 설정 문구 14개 → 18개")
    write(path, text)
    return changed or ["App.jsx: 변경 없음"]


NEW_PARSE = r'''function parsePasted(text){
  const rawLines = String(text||"").split(/\r?\n/).filter(v=>v.trim());
  const out=[];
  let header=null;
  const clean = (v)=>String(v ?? "").replace(/\u00a0/g," ").trim();
  const splitLine = (line)=> line.includes("\t") ? line.split("\t").map(clean) : line.split(/\s{2,}/).map(clean);
  const money = (v)=>{
    const s = clean(v);
    if(!s || s==="-" || s==="　") return 0;
    const n = Number(s.replace(/[^0-9\-]/g,""));
    return Number.isFinite(n) ? n : 0;
  };
  const normalizeDate = (v)=>{
    const s = clean(v);
    const m = s.match(/(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if(!m) return "";
    let y = m[1];
    if(y.length===2) y = "20" + y;
    return `${y}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[3])).padStart(2,"0")}`;
  };
  const idxOf = (names)=>{
    if(!header) return -1;
    return header.findIndex(h=>names.some(n=>clean(h).replace(/\s/g,"").includes(n.replace(/\s/g,""))));
  };
  const pick = (cols, names, fallbackIndex=-1)=>{
    const idx = idxOf(names);
    if(idx >= 0) return cols[idx] || "";
    return fallbackIndex >= 0 ? (cols[fallbackIndex] || "") : "";
  };
  for(const line of rawLines){
    const cols = splitLine(line);
    const joined = cols.join(" ");
    if(/거래일자/.test(joined) && /입금금액/.test(joined)){
      header = cols;
      continue;
    }
    if(/합계|잔액조회/.test(joined)) continue;

    // 표준 은행 컬럼: 구분, 거래일자, 출금금액, 입금금액, 거래 후 잔액, 거래내용, 거래기록사항, 거래점, 거래시간
    const hasSeq = /^\d+$/.test(clean(cols[0]||""));
    const date = normalizeDate(pick(cols,["거래일자"], hasSeq ? 1 : 0)) || normalizeDate(joined);
    const withdraw = money(pick(cols,["출금금액"], hasSeq ? 2 : -1));
    const depositAmount = money(pick(cols,["입금금액"], hasSeq ? 3 : -1));
    const balanceAfter = money(pick(cols,["거래후잔액","거래 후 잔액"], hasSeq ? 4 : -1));
    const desc = pick(cols,["거래내용"], hasSeq ? 5 : -1);
    const record = pick(cols,["거래기록사항"], hasSeq ? 6 : -1);
    const branch = pick(cols,["거래점"], hasSeq ? 7 : -1);
    const time = pick(cols,["거래시간"], hasSeq ? 8 : -1);

    // 핵심: 거래 후 잔액은 절대 입금액으로 쓰지 않는다.
    if(!date || depositAmount <= 0) continue;
    if(withdraw > 0 && depositAmount <= 0) continue;

    let depositorName = clean(record || desc).replace(/[0-9,원]/g,"").trim() || clean(record || desc) || "미확인";
    if(["농협","신한","국민","우리","하나","기업","IBK"].includes(depositorName)) depositorName = clean(record || desc) || "미확인";

    out.push({
      depositDate: date,
      amount: depositAmount,
      depositorName,
      memo: clean(record || desc),
      description: clean(desc),
      bankBranch: clean(branch),
      balanceAfter,
      transactionTime: clean(time),
      status: depositAmount > 1000000 ? "검토필요" : "미매칭",
    });
  }
  return out;
}
function PasteModal'''


def patch_bank_matching() -> list[str]:
    path = ROOT / "frontend" / "static" / "app" / "BankMatching.jsx"
    if not path.exists():
        return [f"SKIP BankMatching.jsx 없음: {path}"]
    backup(path)
    text = read(path)
    changed = []
    if "MISU_CRITICAL_PATCH_BANK_PARSE" not in text:
        repl = NEW_PARSE.replace("function parsePasted(text){", "// MISU_CRITICAL_PATCH_BANK_PARSE: 입금금액 컬럼만 입금액으로 사용\nfunction parsePasted(text){")
        new_text, n = re.subn(r"function parsePasted\(text\)\{.*?\n\}\s*function PasteModal", repl, text, count=1, flags=re.S)
        if n:
            text = new_text
            changed.append("BankMatching.jsx: 거래 후 잔액을 입금액으로 읽던 파서 교체")
        else:
            changed.append("WARN BankMatching.jsx: parsePasted 함수 못 찾음")
    write(path, text)
    return changed or ["BankMatching.jsx: 변경 없음"]


def patch_deposits_backend() -> list[str]:
    path = ROOT / "backend" / "app" / "routers" / "deposits.py"
    if not path.exists():
        return [f"SKIP deposits.py 없음: {path}"]
    backup(path)
    text = read(path)
    changed = []
    # 백엔드도 입금금액 우선으로 방어. 프론트가 amount를 제대로 보내도 안전하게 유지.
    old = 'amount = row.get("amount") or row.get("입금액") or 0'
    new = 'amount = row.get("deposit_amount") or row.get("depositAmount") or row.get("입금금액") or row.get("입금액") or row.get("amount") or 0  # MISU_CRITICAL_PATCH: 거래 후 잔액 금지, 입금금액 우선'
    if old in text and "MISU_CRITICAL_PATCH: 거래 후 잔액 금지" not in text:
        text = text.replace(old, new, 1)
        changed.append("deposits.py: 입금금액 우선 매핑")
    old2 = 'depositor_name=_short(row.get("depositor_name") or row.get("depositorName") or row.get("입금자명") or row.get("memo") or row.get("거래기록사항"), 40) or "미확인",'
    new2 = 'depositor_name=_short(row.get("거래기록사항") or row.get("거래내용") or row.get("depositor_name") or row.get("depositorName") or row.get("입금자명") or row.get("memo"), 40) or "미확인",  # MISU_CRITICAL_PATCH: 거래점/은행명보다 기록사항 우선'
    if old2 in text and "거래점/은행명보다 기록사항 우선" not in text:
        text = text.replace(old2, new2, 1)
        changed.append("deposits.py: 입금자명 거래기록사항 우선")
    write(path, text)
    return changed or ["deposits.py: 변경 없음"]


def main() -> None:
    print("[MISU CRITICAL PATCH] repo:", ROOT)
    results = []
    for fn in [patch_members, patch_app, patch_bank_matching, patch_deposits_backend]:
        try:
            results += fn()
        except Exception as e:
            results.append(f"ERROR {fn.__name__}: {e}")
    print("\n".join("- " + r for r in results))
    print("\n완료. GitHub Desktop에서 변경 파일 확인 후 commit/push 하세요.")
    print("백업 파일은 *.bak_misu_critical 로 생성했습니다.")

if __name__ == "__main__":
    main()
