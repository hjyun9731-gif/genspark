// 공용 UI 헬퍼 — 상태 칩, 부과항목 태그, 연/월 선택, 빠른 필터칩, 테이블 셀
const { Icon } = window.PayroleDesignSystem_9db006;

const STATUS_STYLE = {
  "미납":   { bg:"var(--red-50)",   fg:"var(--red-500)" },
  "일부납": { bg:"var(--amber-50)", fg:"#B9791A" },
  "완납":   { bg:"var(--green-50)", fg:"var(--green-500)" },
  "선납":   { bg:"#EFEEFD",         fg:"var(--violet-500)" },
  "0원":    { bg:"var(--grey-50)",  fg:"var(--grey-400)" },
};

function StatusPill({ status }){
  const s = STATUS_STYLE[status] || STATUS_STYLE["0원"];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px",
      borderRadius:"var(--radius-pill)", background:s.bg, color:s.fg,
      font:"var(--fw-demibold) 12px/1 var(--font-sans)", whiteSpace:"nowrap" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.fg }} />
      {status}
    </span>
  );
}

const CHARGE_STYLE = {
  "협회비":         { bg:"var(--blue-100)", fg:"var(--blue-600)" },
  "관리비":         { bg:"#FFF3DC",         fg:"#B9791A" },
  "70세":           { bg:"#EAF7F0",         fg:"var(--green-500)" },
  "협회가입비":     { bg:"#FCE9F1",         fg:"#C13D78" },
  "자격증명발급비": { bg:"#FBF3DA",         fg:"#9A7B12" },
  "기타":           { bg:"var(--green-50)",  fg:"var(--green-500)" },
  "선납/초과입금":  { bg:"#EFEEFD",         fg:"var(--violet-500)" },
};
function ChargeTag({ item }){
  const s = CHARGE_STYLE[item] || CHARGE_STYLE["협회비"];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 9px",
      borderRadius:"var(--radius-pill)", background:s.bg, color:s.fg,
      font:"var(--fw-demibold) 12px/1 var(--font-sans)", whiteSpace:"nowrap" }}>{item}</span>
  );
}

// 회계구분 작은 라벨
function AccountingTag({ accounting }){
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:"var(--radius-xs)",
      background:"var(--grey-50)", color:"var(--text-tertiary)", border:"1px solid var(--border-subtle)",
      font:"var(--fw-medium) 11px/1.3 var(--font-sans)", whiteSpace:"nowrap" }}>{accounting}</span>
  );
}

// 미수개월수 칩 (색 강도)
function MonthsChip({ months }){
  if (!months) return <span style={{ color:"var(--text-tertiary)" }}>—</span>;
  const tone = months>=12 ? { bg:"var(--red-50)", fg:"var(--red-500)" }
    : months>=7 ? { bg:"#FFF3DC", fg:"#B9791A" }
    : months>=4 ? { bg:"#EAF3FF", fg:"var(--blue-600)" }
    : { bg:"var(--grey-50)", fg:"var(--text-secondary)" };
  return (
    <span style={{ display:"inline-flex", alignItems:"baseline", gap:2, padding:"3px 9px", borderRadius:"var(--radius-pill)",
      background:tone.bg, color:tone.fg, font:"var(--fw-demibold) 12px/1 var(--font-sans)", whiteSpace:"nowrap" }}>
      {months}<span style={{ fontSize:10, fontWeight:500 }}>개월</span></span>
  );
}

const MEMBERTYPE_STYLE = {
  "회원":   { fg:"var(--text-primary)" },
  "준회원": { fg:"var(--grey-400)" },
  "미가입": { fg:"var(--grey-300)" },
};

// 회원상태 배지 (제외대상 표시)
function MemberStatusChip({ status }){
  if (status === "정상") return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 7px", borderRadius:"var(--radius-xs)",
      background:"var(--grey-50)", color:"var(--grey-400)", border:"1px solid var(--border-default)",
      font:"var(--fw-medium) 11px/1.3 var(--font-sans)", whiteSpace:"nowrap" }}>{status}</span>
  );
}

// 연/월 선택 (헤더용)
function YearMonth({ year, month, onYear, onMonth }){
  const cell = {
    appearance:"none", border:"1px solid var(--border-default)", background:"var(--white)",
    borderRadius:"var(--radius-md)", height:42, padding:"0 34px 0 14px",
    font:"var(--fw-medium) 14px/1 var(--font-sans)", color:"var(--text-primary)", cursor:"pointer",
    backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 6 12' fill='%239096A2'><path d='M0 4l3 4 3-4'/></svg>\")",
    backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center",
  };
  return (
    <div style={{ display:"flex", gap:8 }}>
      <select value={year} onChange={e=>onYear(+e.target.value)} style={cell}>
        {[2024,2025,2026].map(y=><option key={y} value={y}>{y}년</option>)}
      </select>
      <select value={month} onChange={e=>onMonth(+e.target.value)} style={cell}>
        {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}
      </select>
    </div>
  );
}

// 빠른 필터칩
function Chip({ active, onClick, children, count }){
  return (
    <button type="button" onClick={onClick} style={{
      display:"inline-flex", alignItems:"center", gap:7, height:36, padding:"0 14px",
      borderRadius:"var(--radius-pill)", cursor:"pointer", whiteSpace:"nowrap",
      border: active ? "1px solid var(--brand)" : "1px solid var(--border-default)",
      background: active ? "var(--brand)" : "var(--white)",
      color: active ? "#fff" : "var(--text-secondary)",
      font:"var(--fw-medium) 13px/1 var(--font-sans)", transition:"all .15s ease",
    }}>
      {children}
      {count!=null && <span style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)",
        color: active ? "rgba(255,255,255,0.85)" : "var(--text-tertiary)" }}>{count}</span>}
    </button>
  );
}

// 검색 입력 (헤더용)
function SearchBox({ value, onChange, placeholder, width=320 }){
  const [focus,setFocus]=React.useState(false);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, width, height:42, padding:"0 14px",
      borderRadius:"var(--radius-md)", background:"var(--white)",
      boxShadow:`inset 0 0 0 1px ${focus?"var(--brand)":"var(--border-default)"}`,
      outline: focus?"var(--ring-brand)":"none", transition:"box-shadow .15s ease" }}>
      <Icon name="search" size={18} style={{ color:"var(--text-tertiary)", flex:"none" }} />
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
        style={{ flex:1, border:"none", outline:"none", background:"transparent",
          font:"var(--fw-regular) 14px/1.5 var(--font-sans)", color:"var(--text-primary)", minWidth:0 }} />
      {value && <button type="button" onClick={()=>onChange("")} style={{ border:"none", background:"none",
        cursor:"pointer", padding:0, display:"flex", color:"var(--text-tertiary)" }}>
        <Icon name="close" size={16} /></button>}
    </div>
  );
}

// 다운로드 버튼 (엑셀)
function DownloadBtn({ onClick, label="엑셀 다운로드" }){
  const [hover,setHover]=React.useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ display:"inline-flex", alignItems:"center", gap:8, height:42, padding:"0 18px",
        borderRadius:"var(--radius-pill)", cursor:"pointer", border:"none",
        background: hover?"var(--brand-hover)":"var(--brand)", color:"#fff", whiteSpace:"nowrap",
        font:"var(--fw-medium) 14px/1 var(--font-sans)", boxShadow:"0 4px 12px rgba(57,129,247,0.24)",
        transition:"background .15s ease" }}>
      <Icon name="download" size={18} /> {label}
    </button>
  );
}

window.PMUI = { StatusPill, ChargeTag, AccountingTag, MonthsChip, MemberStatusChip, MEMBERTYPE_STYLE, YearMonth, Chip, SearchBox, DownloadBtn };
