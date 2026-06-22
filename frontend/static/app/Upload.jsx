// 엑셀 업로드 미리보기 — 신규/중복/오류/제외 검토 후 반영
const { Card, Icon, Button, Badge } = window.PayroleDesignSystem_9db006;

const FILE_TYPES = [
  "전체면허자현황","2026 미수금","신규등록대장","양도양수대장",
  "폐지현황","주소지변경","변경등록","부과대수","통장 거래내역",
];

// 미리보기 목업 행 (반영 시 시뮬레이션)
const PREVIEW_ROWS = [
  { kind:"신규",   name:"권상호", vno:"강원 80바 7741", region:"춘천시", item:"협회비", out:30000, note:"자격증명 2025-11 발급" },
  { kind:"신규",   name:"맹순자", vno:"강원 86아 2210", region:"평창군", item:"70세",  out:5000,  note:"70세 감면 대상" },
  { kind:"중복",   name:"김영수", vno:"강원 80바 1024", region:"춘천시", item:"협회비", out:40000, note:"GW-001 기존 회원과 일치" },
  { kind:"중복",   name:"이정호", vno:"강원 82배 5532", region:"원주시", item:"관리비", out:15000, note:"이름+차량번호 뒤4자리 일치" },
  { kind:"불일치", name:"박상철", vno:"강원 81바 ****", region:"강릉시", item:"협회비", out:60000, note:"차량번호 뒤4자리 불일치 — 확인 필요" },
  { kind:"오류",   name:"—",      vno:"강원 88아 0099", region:"철원군", item:"—",     out:null,  note:"성명 누락 — 매칭 불가" },
  { kind:"오류",   name:"정해철", vno:"(공백)",          region:"정선군", item:"관리비", out:25000, note:"자격증명 발급일 누락" },
  { kind:"제외",   name:"홍판석", vno:"강원 83바 4412", region:"홍천군", item:"협회비", out:0,     note:"폐업 처리 — 반영 제외" },
  { kind:"제외",   name:"안두식", vno:"강원 92배 9921", region:"고성군", item:"관리비", out:0,     note:"양도 — 반영 제외" },
];

const KIND_STYLE = {
  "신규":   { bg:"var(--green-50)", fg:"var(--green-500)", icon:"add-user" },
  "중복":   { bg:"var(--blue-100)", fg:"var(--blue-600)", icon:"copy" },
  "불일치": { bg:"var(--amber-50)", fg:"#B9791A", icon:"warning" },
  "오류":   { bg:"var(--red-50)",   fg:"var(--red-500)", icon:"close" },
  "제외":   { bg:"var(--grey-50)",  fg:"var(--grey-400)", icon:"minus" },
};

function Upload({ onApply }){
  const { won } = window.PMData;
  const [fileType, setFileType] = React.useState("2026 미수금");
  const [stage, setStage] = React.useState("select"); // select | preview | done
  const [tab, setTab] = React.useState("전체");
  const [applied, setApplied] = React.useState(null);

  const counts = React.useMemo(()=>{
    const c = { 전체: PREVIEW_ROWS.length };
    PREVIEW_ROWS.forEach(r=> c[r.kind]=(c[r.kind]||0)+1);
    return c;
  }, []);
  const visible = tab==="전체" ? PREVIEW_ROWS : PREVIEW_ROWS.filter(r=>r.kind===tab);

  const apply = ()=>{
    const newCnt = counts["신규"]||0, dupCnt=counts["중복"]||0;
    setApplied({ newCnt, updated: dupCnt, skipped: (counts["오류"]||0)+(counts["제외"]||0) });
    setStage("done");
    onApply && onApply();
  };

  if (stage==="select"){
    return (
      <div style={{ maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:20 }}>
        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:6 }}>1. 업로드 파일 종류 선택</div>
          <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginBottom:16 }}>업로드할 협회 엑셀 자료의 종류를 먼저 선택하세요. 시트와 컬럼은 자동으로 분석됩니다.</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {FILE_TYPES.map(t=>(
              <button key={t} type="button" onClick={()=>setFileType(t)} style={{
                padding:"14px 14px", textAlign:"left", borderRadius:"var(--radius-md)", cursor:"pointer",
                border: fileType===t?"1.5px solid var(--brand)":"1px solid var(--border-default)",
                background: fileType===t?"var(--brand-subtle)":"var(--white)",
                font:"var(--fw-medium) 13.5px/1.3 var(--font-sans)",
                color: fileType===t?"var(--brand-active)":"var(--text-primary)", transition:"all .12s" }}>
                {t}</button>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:14 }}>2. 파일 업로드</div>
          <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12,
            padding:"44px 20px", border:"2px dashed var(--border-default)", borderRadius:"var(--radius-lg)",
            cursor:"pointer", background:"var(--grey-25)", transition:"all .15s" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--brand)"; e.currentTarget.style.background="var(--brand-subtle)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border-default)"; e.currentTarget.style.background="var(--grey-25)"; }}
            onClick={(e)=>{ e.preventDefault(); setStage("preview"); }}>
            <span style={{ width:52, height:52, borderRadius:"50%", background:"var(--brand-subtle)",
              display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="cloud" size={26} color="var(--brand)" /></span>
            <div style={{ textAlign:"center" }}>
              <div style={{ font:"var(--fw-demibold) 15px/1.4 var(--font-sans)", color:"var(--text-primary)" }}>
                <span style={{ color:"var(--brand)" }}>{fileType}</span> 파일을 여기에 끌어다 놓기</div>
              <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:4 }}>또는 클릭하여 .xlsx · .xls · .csv 선택 (최대 20MB)</div>
            </div>
          </label>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:16, padding:"12px 14px",
            background:"var(--amber-50)", borderRadius:"var(--radius-md)" }}>
            <Icon name="secure" size={18} color="#B9791A" style={{ flex:"none" }} />
            <span style={{ font:"var(--body-sm)", color:"#946012" }}>업로드 즉시 기존 데이터가 삭제되지 않습니다. 미리보기에서 직접 <b>반영하기</b>를 눌러야 적용됩니다.</span>
          </div>
        </Card>
      </div>
    );
  }

  if (stage==="done"){
    return (
      <div style={{ maxWidth:560, margin:"40px auto 0" }}>
        <Card>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"20px 10px 8px", textAlign:"center" }}>
            <span style={{ width:60, height:60, borderRadius:"50%", background:"var(--green-50)",
              display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="check" size={30} color="var(--green-500)" /></span>
            <div>
              <div style={{ font:"var(--fw-bold) 20px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>반영이 완료되었습니다</div>
              <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginTop:6 }}>{fileType} · 기존 데이터는 유지되고 변경사항만 업데이트되었습니다.</div>
            </div>
            <div style={{ display:"flex", gap:10, width:"100%", marginTop:6 }}>
              {[["신규 추가",applied.newCnt,"var(--green-500)"],["정보 갱신",applied.updated,"var(--brand)"],["반영 제외",applied.skipped,"var(--text-tertiary)"]].map(([l,v,c])=>(
                <div key={l} style={{ flex:1, padding:"14px", borderRadius:"var(--radius-md)", background:"var(--grey-25)", textAlign:"center" }}>
                  <div style={{ font:`var(--fw-bold) 24px/1 var(--font-sans)`, color:c }}>{v}</div>
                  <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:4 }}>{l}건</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:10 }}>
              <Button variant="tertiary" size="medium" leadingIcon="copy" onClick={()=>{ setStage("select"); setApplied(null); }}>되돌리기</Button>
              <Button variant="primary" size="medium" onClick={()=>{ setStage("select"); setApplied(null); }}>새 파일 업로드</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // preview
  const TABS = ["전체","신규","중복","불일치","오류","제외"];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ width:40, height:40, borderRadius:10, background:"var(--green-50)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
            <Icon name="document" size={20} color="var(--green-500)" /></span>
          <div>
            <div style={{ font:"var(--fw-demibold) 15px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{fileType}_2026.xlsx</div>
            <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>시트 1개 · 컬럼 11개 자동 매칭 완료 · {PREVIEW_ROWS.length}행 분석</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <Button variant="tertiary" size="medium" onClick={()=>setStage("select")}>취소</Button>
          <Button variant="primary" size="medium" leadingIcon="check" onClick={apply}>반영하기</Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
        {["신규","중복","불일치","오류","제외"].map(k=>{
          const s=KIND_STYLE[k];
          return (
            <div key={k} style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-md)", padding:"14px 16px", boxShadow:"var(--shadow-xs)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:26, height:26, borderRadius:7, background:s.bg, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name={s.icon==="minus"?"close":s.icon} size={14} color={s.fg} /></span>
                <span style={{ font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-secondary)" }}>{k}</span>
              </div>
              <div style={{ font:"var(--fw-bold) 24px/1.1 var(--font-sans)", color:"var(--text-primary)", marginTop:10 }}>{counts[k]||0}<span style={{ fontSize:13, color:"var(--text-tertiary)", fontWeight:500 }}>건</span></div>
            </div>
          );
        })}
      </div>

      <Card padded={false}>
        <div style={{ display:"flex", gap:6, padding:"12px 16px", borderBottom:"1px solid var(--border-subtle)", flexWrap:"wrap" }}>
          {TABS.map(t=>(
            <window.PMUI.Chip key={t} active={tab===t} count={counts[t]||0} onClick={()=>setTab(t)}>{t}</window.PMUI.Chip>
          ))}
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            {["구분","성명","차량번호","지역","부과항목","미수금","검토 내용"].map((h,i)=>(
              <th key={h} style={{ textAlign:i===5?"right":"left", padding:"10px 18px", whiteSpace:"nowrap",
                font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)",
                background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>))}
          </tr></thead>
          <tbody>
            {visible.map((r,i)=>{
              const s=KIND_STYLE[r.kind];
              return (
                <tr key={i} style={{ borderBottom: i<visible.length-1?"1px solid var(--border-subtle)":"none" }}>
                  <td style={{ padding:"12px 18px" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:"var(--radius-pill)",
                      background:s.bg, color:s.fg, font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>{r.kind}</span>
                  </td>
                  <td style={{ padding:"12px 18px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:r.name==="—"?"var(--text-muted)":"var(--text-primary)", whiteSpace:"nowrap" }}>{r.name}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.vno}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.region}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.item}</td>
                  <td style={{ padding:"12px 18px", textAlign:"right", font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{r.out==null?"—":won(r.out)}</td>
                  <td style={{ padding:"12px 18px", font:"var(--body-sm)", color: r.kind==="오류"?"var(--red-500)":"var(--text-secondary)" }}>{r.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

window.Upload = Upload;
