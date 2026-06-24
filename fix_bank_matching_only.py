from __future__ import annotations
import re
import shutil
from pathlib import Path

ROOT = Path.cwd()
path = ROOT / "frontend" / "static" / "app" / "BankMatching.jsx"
if not path.exists():
    raise SystemExit(f"BankMatching.jsx 파일을 찾을 수 없습니다: {path}")

backup = path.with_name(path.name + ".bak_bank_parse_fix")
if not backup.exists():
    shutil.copy2(path, backup)

text = path.read_text(encoding="utf-8")

new_parse = r"""// MISU_CRITICAL_PATCH_BANK_PARSE: 입금금액 컬럼만 입금액으로 사용하고, 거래 후 잔액은 참고값으로만 저장
function parsePasted(text){
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

    // 표준 은행 컬럼:
    // 구분, 거래일자, 출금금액, 입금금액, 거래 후 잔액, 거래내용, 거래기록사항, 거래점, 거래시간
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
    if(["농협","신한","국민","우리","하나","기업","IBK"].includes(depositorName)){
      depositorName = clean(record || desc) || "미확인";
    }

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
function PasteModal"""

if "MISU_CRITICAL_PATCH_BANK_PARSE" in text:
    print("BankMatching.jsx: 이미 패치 표시가 있습니다. 변경하지 않습니다.")
else:
    pattern = r"function parsePasted\(text\)\{.*?\n\}\s*function PasteModal"
    new_text, n = re.subn(pattern, lambda _m: new_parse, text, count=1, flags=re.S)
    if n == 0:
        raise SystemExit("parsePasted 함수를 찾지 못했습니다. BankMatching.jsx 구조가 예상과 다릅니다.")
    path.write_text(new_text, encoding="utf-8", newline="\n")
    print("BankMatching.jsx: 통장매칭 파서 패치 완료")
    print("백업:", backup)
