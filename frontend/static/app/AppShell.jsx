// 앱 셸 — 좌측 사이드바 + 상단 헤더. 디자인 시스템 프리미티브로 구성.
const { SidebarNav, IconButton, Avatar } = window.PayroleDesignSystem_9db006;

const NAV = [
  { id: "dashboard", icon: "home",        label: "대시보드" },
  { id: "list",      icon: "list",        label: "미수금 명단" },
  { id: "regional",  icon: "earth",       label: "지역별 · 문자" },
  { id: "bank",      icon: "card",        label: "통장매칭" },
  { id: "closure",   icon: "warning",     label: "폐업현황" },
  { id: "history",   icon: "transactions",label: "수납 내역" },
  { id: "upload",    icon: "cloud",       label: "엑셀 업로드" },
];

function BrandMark(){
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 6px" }}>
      <span style={{ width:34, height:34, borderRadius:10, background:"var(--brand)",
        display:"inline-flex", alignItems:"center", justifyContent:"center", flex:"none",
        boxShadow:"0 4px 10px rgba(57,129,247,0.32)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h8A1.5 1.5 0 0 1 14 7.5V16H3V7.5Z" fill="#fff"/>
          <path d="M14 9.5h3.7c.5 0 .96.25 1.24.66L21 13v3h-7V9.5Z" fill="#fff" opacity="0.85"/>
          <circle cx="7" cy="17.5" r="2.1" fill="#fff" stroke="var(--brand)" strokeWidth="1.4"/>
          <circle cx="17" cy="17.5" r="2.1" fill="#fff" stroke="var(--brand)" strokeWidth="1.4"/>
        </svg>
      </span>
      <div style={{ lineHeight:1.1 }}>
        <div style={{ font:"var(--fw-bold) 15px/1.15 var(--font-sans)", color:"var(--text-primary)", letterSpacing:"-0.02em" }}>강원 화물협회</div>
        <div style={{ font:"var(--fw-medium) 11px/1.2 var(--font-sans)", color:"var(--text-tertiary)", marginTop:2 }}>미수금 관리 시스템</div>
      </div>
    </div>
  );
}

function AppShell({ active, onNavigate, title, subtitle, headerRight, children, density }){
  return (
    <div style={{ display:"flex", height:"100%", background:"var(--surface-canvas)", fontFamily:"var(--font-sans)" }}>
      {/* Sidebar */}
      <aside style={{ width:256, flex:"none", background:"var(--white)", borderRight:"1px solid var(--border-subtle)",
        padding:"24px 16px", display:"flex", flexDirection:"column", height:"100%", boxSizing:"border-box" }}>
        <div style={{ padding:"0 2px 24px" }}><BrandMark/></div>
        <div style={{ font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)",
          letterSpacing:"0.04em", padding:"0 12px 10px" }}>업무</div>
        <SidebarNav value={active} onChange={onNavigate} items={NAV} />
        <div style={{ marginTop:"auto", paddingTop:16, borderTop:"1px solid var(--border-subtle)" }}>
          <SidebarNav value={active} onChange={onNavigate} items={[{ id:"settings", icon:"settings", label:"설정" }]} />
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 12px 4px" }}>
            <Avatar name="사무 국장" size="sm" />
            <div style={{ minWidth:0 }}>
              <div style={{ font:"var(--fw-demibold) 13px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>사무국 관리자</div>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>강원도개인소형화물협회</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, height:"100%" }}>
        <header style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:24,
          padding:"26px 32px 18px", background:"var(--white)", borderBottom:"1px solid var(--border-subtle)", flex:"none" }}>
          <div>
            <h1 style={{ font:"var(--fw-bold) 26px/1.2 var(--font-sans)", color:"var(--text-primary)", margin:0, letterSpacing:"-0.02em" }}>{title}</h1>
            {subtitle && <p style={{ font:"var(--body-sm)", color:"var(--text-secondary)", margin:"6px 0 0" }}>{subtitle}</p>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12, flex:"none" }}>
            {headerRight}
            <IconButton icon="bell" variant="outline" />
          </div>
        </header>
        <main style={{ flex:1, minHeight:0, overflow:"auto", padding:"24px 32px 40px" }}>{children}</main>
      </div>
    </div>
  );
}

window.AppShell = AppShell;
