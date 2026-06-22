// 엑셀 업로드 미리보기 — 전체면허자현황 / 2026 미수금만 허용, 미리보기 후 반영
const { Card, Icon, Button, Badge } = window.PayroleDesignSystem_9db006;

const FILE_TYPES = ["전체면허자현황","2026 미수금"];

const TYPE_GUIDE = {
  "전체면허자현황": [
    "개인 시트와 택배 시트만 읽습니다.",
    "회원 기본정보, 차량번호, 지역, 자격증명 발급일을 확인합니다.",
    "신규/중복/누락/오류를 미리보기 후 반영합니다.",
  ],
  "2026 미수금": [
    "2026년회비내역 시트를 기준으로 읽습니다.",
    "회원 원장이 아니라 현재 미수 잔액 보조자료로 처리합니다.",
    "0원·선납·미납 회원을 모두 유지합니다.",
  ],
};

const PREVIEW_ROWS = {
  "전체면허자현황": [
    { kind:"신규",   name:"권상호", vno:"강원 80바 7741", region:"춘천시", item:"협회비", out:0, note:"개인 시트 신규 회원 후보" },
    { kind:"신규",   name:"맹순자", vno:"강원 86아 2210", region:"평창군", item:"협회비", out:0, note:"70세 감면 대상 후보" },
    { kind:"중복",   name:"김영수", vno:"강원 80바 1024", region:"춘천시", item:"협회비", out:0, note:"기존 회원 GW-001과 일치" },
    { kind:"중복",   name:"이정호", vno:"강원 82배 5532", region:"원주시", item:"관리비", out:0, note:"택배 시트 기존 회원 일치" },
    { kind:"오류",   name:"—",      vno:"강원 88아 0099", region:"철원군", item:"—", out:null, note:"성명 누락 — 반영 불가" },
    { kind:"누락",   name:"정해철", vno:"강원 87바 1141", region:"정선군", item:"관리비", out:0, note:"자격증명 발급일 누락" },
    { kind:"제외",   name:"홍판석", vno:"강원 83바 4412", region:"홍천군", item:"협회비", out:0, note:"폐업 처리자 — 기본 반영 제외" },
  ],
  "2026 미수금": [
    { kind:"정상",   name:"김영수", vno:"강원 80바 1024", region:"춘천시", item:"협회비", out:40000, note:"현재 미수 잔액 반영" },
    { kind:"정상",   name:"이정호", vno:"강원 82배 5532", region:"원주시", item:"관리비", out:15000, note:"현재 미수 잔액 반영" },
    { kind:"정상",   name:"맹순자", vno:"강원 86아 2210", region:"평창군", item:"70세", out:5000, note:"70세 감면 회비" },
    { kind:"중복",   name:"박상철", vno:"강원 81바 8821", region:"강릉시", item:"협회비", out:0, note:"0원 회원 유지" },
    { kind:"정상",   name:"안두식", vno:"강원 92배 9921", region:"고성군", item:"관리비", out:-20000, note:"선납/초과입금 유지" },
    { kind:"오류",   name:"정해철", vno:"(공백)", region:"정선군", item:"관리비", out:25000, note:"차량번호 누락 — 매칭 불가" },
    { kind:"제외",   name:"홍판석", vno:"강원 83바 4412", region:"홍천군", item:"협회비", out:30000, note:"폐업 처리자 — 추심 대상으로만 확인" },
  ],
};

const KIND_STYLE = {
  "정상":   { bg:"var(--green-50)", fg:"var(--green-500)", icon:"check" },
  "신규":   { bg:"var(--green-50)", fg:"var(--green-500)", icon:"add-user" },
  "중복":   { bg:"var(--blue-100)", fg:"var(--blue-600)", icon:"copy" },
  "누락":   { bg:"#FFF3DC",         fg:"#B9791A", icon:"warning" },
  "오류":   { bg:"var(--red-50)",   fg:"var(--red-500)", icon:"close" },
  "제외":   { bg:"var(--grey-50)",  fg:"var(--grey-400)", icon:"minus" },
};

function Upload({ onApply }){
  const { won } = window.PMData;
  const [fileType, setFileType] = React.useState("2026 미수금");
  const [stage, setStage] = React.useState("select");
  const [tab, setTab] = React.useState("전체");
  const [fileName, setFileName] = React.useState("");
  const [history, setHistory] = React.useState([]);
  const rows = PREVIEW_ROWS[fileType] || [];
  const counts = React.useMemo(()=>{
    const c = { 전체: rows.length, 정상:0, 신규:0, 중복:0, 누락:0, 오류:0, 제외:0 };
    rows.forEach(r=> c[r.kind]=(c[r.kind]||0)+1);
    return c;
  }, [fileType]);
  const visible = tab==="전체" ? rows : rows.filter(r=>r.kind===tab);

  function startPreview(){
    if(!fileName){
      setFileName(fileType==="2026 미수금" ? "2026미수금.xlsx" : "전체면허자현황.xlsx");
    }
    setStage("preview");
  }
  function apply(){
    if(!confirm(`${fileType} 미리보기 ${rows.length}건을 반영할까요?\n기존 데이터는 삭제하지 않고 변경사항만 업데이트합니다.`)) return;
    const record = { type:fileType, file:fileName || "-", date:new Date().toISOString().slice(0,10), total:rows.length, ok:(counts.정상||0)+(counts.신규||0)+(counts.중복||0), skipped:(counts.오류||0)+(counts.제외||0)+(counts.누락||0) };
    setHistory(h=>[record, ...h].slice(0,5));
    setStage("done");
    onApply && onApply(record);
  }

  const cardStyle = { background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"14px 18px", boxShadow:"var(--shadow-xs)" };

  if(stage==="select"){
    return (
      <div style={{ maxWidth:860, margin:"0 auto", display:"flex", flexDirection:"column", gap:20 }}>
        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:6 }}>1. 업로드 파일 종류 선택</div>
          <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginBottom:16 }}>미수금 프로그램에서 직접 업로드하는 자료는 전체면허자현황과 2026 미수금 두 가지입니다. 통장 거래내역은 통장매칭 화면에서 처리합니다.</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
            {FILE_TYPES.map(t=>
              <button key={t} type="button" onClick={()=>setFileType(t)}
                style={{ textAlign:"left", padding:"15px 16px", borderRadius:"var(--radius-lg)", cursor:"pointer",
                  border:fileType===t?"1px solid var(--brand)":"1px solid var(--border-default)",
                  background:fileType===t?"var(--brand-subtle)":"var(--white)", boxShadow:fileType===t?"0 0 0 3px rgba(57,129,247,.08)":"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Icon name={t==="2026 미수금"?"wallet":"users"} size={18} style={{ color:fileType===t?"var(--brand)":"var(--text-tertiary)" }} />
                  <span style={{ font:"var(--fw-demibold) 14px/1.2 var(--font-sans)", color:"var(--text-primary)" }}>{t}</span>
                </div>
                <div style={{ marginTop:8, font:"var(--body-xs)", color:"var(--text-tertiary)", lineHeight:1.5 }}>{TYPE_GUIDE[t][0]}</div>
              </button>
            )}
          </div>
        </Card>

        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:12 }}>2. 파일 선택</div>
          <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:180, border:"1px dashed var(--border-default)", borderRadius:"var(--radius-lg)", background:"var(--grey-25)", cursor:"pointer", textAlign:"center", padding:24 }}>
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={e=>setFileName(e.target.files?.[0]?.name || "")} />
            <Icon name="upload" size={34} style={{ color:"var(--brand)", marginBottom:12 }} />
            <div style={{ font:"var(--fw-demibold) 15px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{fileName || "엑셀 파일을 선택하거나 클릭하세요"}</div>
            <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:6 }}>선택 후 미리보기에서 오류/중복/누락을 확인합니다.</div>
          </label>
          <div style={{ display:"flex", justifyContent:"space-between", gap:16, marginTop:16, alignItems:"center" }}>
            <div>
              {(TYPE_GUIDE[fileType]||[]).map(g=><div key={g} style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", lineHeight:1.7 }}>• {g}</div>)}
            </div>
            <Button size="md" onClick={startPreview}>미리보기 생성</Button>
          </div>
        </Card>

        {history.length>0 && <UploadHistory history={history} />}
      </div>
    );
  }

  if(stage==="done"){
    return (
      <div style={{ maxWidth:860, margin:"0 auto", display:"flex", flexDirection:"column", gap:20 }}>
        <Card>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"var(--green-50)", display:"grid", placeItems:"center" }}><Icon name="check" size={22} style={{ color:"var(--green-500)" }} /></div>
            <div>
              <div style={{ font:"var(--fw-bold) 18px/1.2 var(--font-sans)", color:"var(--text-primary)" }}>반영 완료</div>
              <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginTop:4 }}>기존 데이터 삭제 없이 변경사항만 업데이트했습니다.</div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:18 }}>
            {[["총 행", rows.length],["정상/신규/중복", (counts.정상||0)+(counts.신규||0)+(counts.중복||0)],["오류/누락", (counts.오류||0)+(counts.누락||0)],["제외", counts.제외||0]].map(([l,v])=><div key={l} style={cardStyle}><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div><div style={{ font:"var(--fw-bold) 18px/1.1 var(--font-sans)", color:"var(--text-primary)", marginTop:4 }}>{v}건</div></div>)}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:18 }}>
            <Button size="md" onClick={()=>{ setStage("select"); setFileName(""); }}>다른 파일 업로드</Button>
            <Button size="md" variant="secondary" onClick={()=>setStage("preview")}>미리보기 다시 보기</Button>
          </div>
        </Card>
        <UploadHistory history={history} />
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12 }}>
        {[["파일종류",fileType],["파일명",fileName||"-"],["총 행",`${counts.전체}건`],["정상",`${(counts.정상||0)+(counts.신규||0)}건`],["중복",`${counts.중복||0}건`],["오류/누락",`${(counts.오류||0)+(counts.누락||0)}건`]].map(([l,v])=>(
          <div key={l} style={cardStyle}><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div><div style={{ font:"var(--fw-bold) 17px/1.1 var(--font-sans)", color:l==="오류/누락"?"var(--red-500)":"var(--text-primary)", marginTop:4 }}>{v}</div></div>
        ))}
      </div>

      <Card>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, marginBottom:14 }}>
          <div>
            <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>업로드 미리보기</div>
            <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginTop:4 }}>반영 전 신규/중복/오류/누락/제외 대상을 확인하세요.</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
            {["전체","정상","신규","중복","누락","오류","제외"].map(t=>(counts[t]||t==="전체") ? <window.PMUI.Chip key={t} active={tab===t} count={counts[t]||0} onClick={()=>setTab(t)}>{t}</window.PMUI.Chip> : null)}
          </div>
        </div>
        <div style={{ border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["상태","지역","성명","차량번호","부과","현재금액","검토내용"].map((h,i)=><th key={h} style={{ textAlign:i===5?"right":"left", padding:"11px 14px", font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-default)" }}>{h}</th>)}</tr></thead>
            <tbody>
              {visible.map((r,i)=>{
                const st=KIND_STYLE[r.kind]||KIND_STYLE.정상;
                return <tr key={i} style={{ borderBottom:i<visible.length-1?"1px solid var(--border-subtle)":"none" }}>
                  <td style={{ padding:"12px 14px" }}><span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 9px", borderRadius:"var(--radius-pill)", background:st.bg, color:st.fg, font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}><Icon name={st.icon} size={12} />{r.kind}</span></td>
                  <td style={{ padding:"12px 14px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.region}</td>
                  <td style={{ padding:"12px 14px", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--text-primary)" }}>{r.name}</td>
                  <td style={{ padding:"12px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.vno}</td>
                  <td style={{ padding:"12px 14px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.item}</td>
                  <td style={{ padding:"12px 14px", textAlign:"right", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:(r.out||0)>0?"var(--red-500)":(r.out||0)<0?"var(--violet-500)":"var(--text-tertiary)" }}>{r.out==null?"—":won(r.out)}</td>
                  <td style={{ padding:"12px 14px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.note}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
          <Button size="md" variant="secondary" onClick={()=>setStage("select")}>취소</Button>
          <Button size="md" onClick={apply}>반영하기</Button>
        </div>
      </Card>
    </div>
  );
}

function UploadHistory({ history }){
  return (
    <Card>
      <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:12 }}>최근 업로드 기록</div>
      {history.length===0 ? <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>아직 반영 기록이 없습니다.</div> :
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {history.map((h,i)=><div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:i<history.length-1?"1px solid var(--border-subtle)":"none" }}>
            <div><div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{h.type} · {h.file}</div><div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:3 }}>{h.date} · 정상 {h.ok}건 · 제외/오류 {h.skipped}건</div></div>
            <Badge>{h.total}건</Badge>
          </div>)}
        </div>}
    </Card>
  );
}

window.Upload = Upload;
