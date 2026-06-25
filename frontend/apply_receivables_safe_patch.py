# -*- coding: utf-8 -*-
"""
미수금명단 전용 안전 패치
- Receivables.jsx만 우선 안전하게 보정
- members.py는 정렬/메타 헤더만 안전 보강
실행 위치: C:\Users\PC\Documents\GitHub\genspark
"""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
print(f"[MISU RECEIVABLES SAFE PATCH] repo: {ROOT}")

def read(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")

def write(p: Path, s: str) -> None:
    p.write_text(s, encoding="utf-8", newline="\n")

def backup(p: Path) -> None:
    b = p.with_name(p.name + ".bak_receivables_safe")
    if not b.exists():
        shutil.copy2(p, b)

def patch_receivables():
    p = ROOT / "frontend" / "static" / "app" / "Receivables.jsx"
    backup(p)
    s = read(p)

    # 흰백지 원인 가능성: pad 변수가 없음. cellPad로 고정.
    s = s.replace("style={{ padding:pad }}", "style={{ padding:cellPad }}")

    # 서버 정렬 파라미터 전달
    if 'params.set("sort", sort.key);' not in s:
        s = s.replace('params.set("size", PAGE_SIZE);\n', 'params.set("size", PAGE_SIZE);\n    params.set("sort", sort.key);\n    params.set("dir", sort.dir);\n', 1)

    # 정렬 변경 시 서버 재조회
    old_dep = "[query, region, membership, account, amount, status, special, inclZero, inclPrepaid, minAmt, maxAmt, page]"
    new_dep = "[query, region, membership, account, amount, status, special, sort, inclZero, inclPrepaid, minAmt, maxAmt, page]"
    s = s.replace(old_dep, new_dep)

    # 페이지 합계와 전체 조건 합계 분리
    if "const pageSumOut =" not in s:
        s = s.replace(
            "  const sumOut = serverMeta?.totalBalance ?? rows.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);\n",
            "  const pageSumOut = rows.reduce((s,m)=>s+Math.max(D.outstanding(m),0),0);\n  const sumOut = serverMeta?.totalBalance ?? pageSumOut;\n",
            1
        )

    # 요약 카드 4개 → 5개, 현재 페이지 합계 표시
    s = s.replace(
        '      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>\n        {[["현재 표시",`${num(rows.length)}명 / 전체 ${num(serverTotal || rows.length)}명`,"var(--text-primary)"],\n          ["전체 조건 합계",won(sumOut),"var(--red-500)"],\n          ["30만원 이상",`${num(over300)}명`,"var(--text-primary)"],\n          ["12개월 이상",`${num(longCnt)}명`,"#B9791A"]].map(([l,v,c])=>(',
        '      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,minmax(0,1fr))", gap:12 }}>\n        {[["현재 표시",`${num(rows.length)}명 / 전체 ${num(serverTotal || rows.length)}명`,"var(--text-primary)"],\n          ["현재 페이지 합계",won(pageSumOut),"var(--text-primary)"],\n          ["전체 조건 합계",won(sumOut),"var(--red-500)"],\n          ["30만원 이상",`${num(over300)}명`,"var(--text-primary)"],\n          ["12개월 이상",`${num(longCnt)}명`,"#B9791A"]].map(([l,v,c])=>('
    )

    # 탭 카운트가 프론트 100명 fallback으로 오해를 만들면 숨김. 위 요약카드가 공식 숫자.
    s = s.replace(
        '<Chip key={key} active={amount===key} count={countByAmount(key)} onClick={()=>setAmount(key)}>{label}</Chip>',
        '<Chip key={key} active={amount===key} onClick={()=>{ setAmount(key); setPage(1); }}>{label}</Chip>'
    )

    # 필터 변경 시 페이지 1로 리셋되게 주요 컨트롤 보강
    s = s.replace('onChange={setRegion}', 'onChange={(v)=>{setRegion(v);setPage(1);}}')
    s = s.replace('onChange={setMembership}', 'onChange={(v)=>{setMembership(v);setPage(1);}}')
    s = s.replace('onChange={setAccount}', 'onChange={(v)=>{setAccount(v);setPage(1);}}')
    s = s.replace('onChange={setStatus}', 'onChange={(v)=>{setStatus(v);setPage(1);}}')
    s = s.replace('onChange={e=>setMinAmt(e.target.value)}', 'onChange={e=>{setMinAmt(e.target.value);setPage(1);}}')
    s = s.replace('onChange={e=>setMaxAmt(e.target.value)}', 'onChange={e=>{setMaxAmt(e.target.value);setPage(1);}}')
    s = s.replace('onClick={()=>setSpecial(special==="장기"?"":"장기")}', 'onClick={()=>{setSpecial(special==="장기"?"":"장기");setPage(1);}}')
    s = s.replace('onClick={()=>setInclZero(!inclZero)}', 'onClick={()=>{setInclZero(!inclZero);setPage(1);}}')
    s = s.replace('onClick={()=>setInclPrepaid(!inclPrepaid)}', 'onClick={()=>{setInclPrepaid(!inclPrepaid);setPage(1);}}')

    # 초기화는 실무 기본값인 미납/0원제외/선납제외로 복귀
    s = s.replace('setAmount("전체"); setStatus("정상");', 'setAmount("미수있음"); setStatus("정상");')

    # 하단 문구도 실무 기준으로 변경
    s = s.replace("이름 클릭 시 상세 · 0원·선납 회원도 함께 표시", "이름 클릭 시 상세 · 기본값은 미납/0원 제외/선납 제외")

    # 다음 버튼은 전체 건수 기준으로만 노출/비활성화
    s = s.replace(
        '{serverRows !== null && rows.length === PAGE_SIZE && (',
        '{serverRows !== null && serverTotal > PAGE_SIZE && ('
    )
    s = s.replace(
        '<button onClick={()=>setPage(p=>p+1)}\n                  style={{ height:28, padding:"0 10px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-pill)", background:"var(--white)", cursor:"pointer", color:"var(--text-secondary)", fontSize:12 }}>다음</button>',
        '<button onClick={()=>setPage(p=>p+1)} disabled={page*PAGE_SIZE >= serverTotal}\n                  style={{ height:28, padding:"0 10px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-pill)", background:"var(--white)", cursor:page*PAGE_SIZE>=serverTotal?"default":"pointer", color:"var(--text-secondary)", fontSize:12, opacity:page*PAGE_SIZE>=serverTotal?0.4:1 }}>다음</button>'
    )

    write(p, s)
    print("- Receivables.jsx: 미수금명단 안전 보정 완료")

def patch_members():
    p = ROOT / "backend" / "app" / "routers" / "members.py"
    backup(p)
    s = read(p)

    # API가 sort/dir을 받아 전체 조건 기준으로 정렬한 뒤 페이지네이션하도록 보강
    if "sort: str | None = Query" not in s:
        s = s.replace(
            '    max_months: int | None = Query(None, description="미수개월 최댓값"),\n    page: int = 1,\n',
            '    max_months: int | None = Query(None, description="미수개월 최댓값"),\n    sort: str | None = Query("outstanding", description="정렬키"),\n    dir: str = Query("desc", description="asc/desc"),\n    page: int = 1,\n',
            1
        )

    sort_block = """    # 전체 조건 기준 정렬 후 페이지네이션한다. 프론트의 50명 현재페이지 기준 정렬 오류 방지.
    reverse = (dir or "desc") != "asc"
    def _sort_value(x: dict):
        key = sort or "outstanding"
        if key == "months":
            return int(x.get("arrears_months") or 0)
        if key == "ledger":
            return int(x.get("arrears_amount") or 0)
        if key == "region":
            return x.get("sigun") or ""
        if key == "name":
            return x.get("name") or ""
        if key == "vehicle":
            return x.get("vehicle_no") or ""
        return int(x.get("arrears_amount") or 0)
    filtered.sort(key=_sort_value, reverse=reverse)

"""
    if "# 전체 조건 기준 정렬 후 페이지네이션한다." not in s:
        s = s.replace("    total = len(filtered)\n", sort_block + "    total = len(filtered)\n", 1)

    write(p, s)
    print("- members.py: 미수금명단 정렬/메타 보강 완료")

def main():
    patch_receivables()
    patch_members()
    print("\\n완료. git status 확인 후 commit/push 하세요. 백업 파일은 *.bak_receivables_safe 입니다.")

if __name__ == "__main__":
    main()
