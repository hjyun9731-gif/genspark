// 폐업현황 — 폐업/양도/이관/탈퇴 회원과 미납잔액 추심 관리
const { Card, Icon } = window.PayroleDesignSystem_9db006;

const CTYPE_STYLE = {
  "폐업": { bg:"var(--grey-50)",  fg:"var(--text-secondary)" },
  "양도": { bg:"#EAF3FF",         fg:"var(--blue-600)" },
  "이관": { bg:"#FBF3DA",         fg:"#9A7B12" },
  "탈퇴": { bg:"var(--red-50)",   fg:"var(--red-500)" },
};

const COLLECT_STYLE = {
  "안내전":   { bg:"var(--grey-50)",   fg:"var(--text-tertiary)" },
  "문자완료": { bg:"#EAF3FF",          fg:"var(--blue-600)" },
  "전화완료": { bg:"var(--green-50)",  fg:"var(--green-600)" },
  "내용증명": { bg:"var(--amber-50)", fg:"#B9791A" },
  "정리완료": { bg:"var(--grey-25)",   fg:"var(--grey-400)" },
};

function CTypeBadge({ type }) {
  const s = CTYPE_STYLE[type] || CTYPE_STYLE["폐업"];
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:"var(--radius-pill)", background:s.bg, color:s.fg, font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>{type}</span>;
}

function CollectBadge({ status }) {
  if (!status) return <span style={{ color:"var(--text-muted)", fontSize:12 }}>—</span>;
  const s = COLLECT_STYLE[status] || COLLECT_STYLE["안내전"];
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:"var(--radius-pill)", background:s.bg, color:s.fg, font:"var(--fw-demibold) 11px/1 var(--font-sans)" }}>{status}</span>;
}

function DetailModal({ row, onClose, onToast }) {
  if (!row) return null;
  const { won } = window.PMData;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"var(--white)", borderRadius:"var(--radius-xl)", width:680, maxHeight:"85vh", overflow:"auto", boxShadow:"var(--shadow-xl)", padding:"28px 32px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div style={{ font:"var(--fw-bold) 18px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>
            {row.name} 상세
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"var(--text-tertiary)" }}>✕</button>
        </div>

        <Section title="회원 정보">
          <InfoGrid rows={[
            ["처리구분", <CTypeBadge type={row.type} />],
            ["지역", row.sigun || "—"],
            ["성명", row.name],
            ["차량번호", row.vehicleNo || "—"],
            ["관리번호", row.mgmtNo || "—"],
            ["처리일", row.processDate || "—"],
            ["공문번호", row.docNo || "—"],
            ["처리출처", row.processSource || "—"],
          ]} />
        </Section>

        <Section title="미납 정보">
          <InfoGrid rows={[
            ["미납잔액", <span style={{ color:"var(--red-500)", fontWeight:700 }}>{won(row.unpaidBalance || 0)}</span>],
            ["미납항목", row.unpaidItems || "—"],
            ["미납기간", row.unpaidPeriod || "—"],
            ["추심상태", <CollectBadge status={row.collectStatus} />],
            ["마지막안내일", row.lastNoticeDate || "—"],
          ]} />
        </Section>

        {row.memo && (
          <Section title="메모">
            <div style={{ padding:"12px 14px", background:"var(--grey-25)", borderRadius:"var(--radius-md)", font:"var(--body-sm)", color:"var(--text-secondary)", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
              {row.memo}
            </div>
          </Section>
        )}

        {row.settlementInfo && (
          <Section title="정산완료 정보">
            <InfoGrid rows={[
              ["정산 항목", row.settlementInfo.item || "—"],
              ["정산일", row.settlementInfo.date || "—"],
              ["처리자", row.settlementInfo.handler || "—"],
              ["정산 전 잔액", won(row.settlementInfo.before || 0)],
              ["정산 후 잔액", won(row.settlementInfo.after || 0)],
            ]} />
          </Section>
        )}

        {row.processHistory && row.processHistory.length > 0 && (
          <Section title="처리 이력">
            {row.processHistory.map((h,i) => (
              <div key={i} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:"1px solid var(--border-subtle)" }}>
                <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", whiteSpace:"nowrap", minWidth:90 }}>{h.date}</span>
                <span style={{ font:"var(--body-sm)", color:"var(--text-primary)" }}>{h.action}</span>
                {h.memo && <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{h.memo}</span>}
              </div>
            ))}
          </Section>
        )}

        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:24 }}>
          <button onClick={onClose} style={{ height:36, padding:"0 20px", borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 14px/1 var(--font-sans)", cursor:"pointer" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", letterSpacing:"0.05em", marginBottom:10, textTransform:"uppercase" }}>{title}</div>
      {children}
    </div>
  );
}

function InfoGrid({ rows }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 16px" }}>
      {rows.map(([label, val]) => (
        <div key={label} style={{ display:"flex", gap:8, padding:"7px 0", borderBottom:"1px solid var(--border-subtle)" }}>
          <span style={{ font:"var(--fw-medium) 12px/1.4 var(--font-sans)", color:"var(--text-tertiary)", minWidth:80, flex:"none" }}>{label}</span>
          <span style={{ font:"var(--body-sm)", color:"var(--text-primary)" }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

function StatusChangeModal({ row, onClose, onSave, onToast }) {
  if (!row) return null;
  const TYPES = ["폐업","양도","이관","탈퇴"];
  const COLLECT = Object.keys(COLLECT_STYLE);
  const [newType, setNewType] = React.useState(row.type);
  const [collectStatus, setCollectStatus] = React.useState(row.collectStatus || "안내전");
  const [memo, setMemo] = React.useState("");

  const save = async () => {
    try {
      const res = await fetch(`/api/closures/${row.id}/status`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ type: newType, collect_status: collectStatus, memo }),
      });
      if (!res.ok) { const j = await res.json(); onToast && onToast(j.detail||"저장 실패"); return; }
      onSave && onSave(row.id, { type: newType, collectStatus, memo });
      onClose();
      onToast && onToast("상태가 변경되었습니다.");
    } catch(e) { onToast && onToast("오류: "+e.message); }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9100, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"var(--white)", borderRadius:"var(--radius-xl)", width:440, boxShadow:"var(--shadow-xl)", padding:"24px 28px" }}>
        <div style={{ font:"var(--fw-bold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:20 }}>상태변경 — {row.name}</div>
        <div style={{ marginBottom:14 }}>
          <label style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", display:"block", marginBottom:8 }}>처리구분</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {TYPES.map(t => (
              <button key={t} type="button" onClick={() => setNewType(t)} style={{ padding:"6px 14px", borderRadius:"var(--radius-pill)", border: newType===t?"1px solid var(--brand)":"1px solid var(--border-default)", background: newType===t?"var(--brand)":"var(--white)", color: newType===t?"#fff":"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)", cursor:"pointer" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", display:"block", marginBottom:8 }}>추심상태</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {COLLECT.map(s => (
              <button key={s} type="button" onClick={() => setCollectStatus(s)} style={{ padding:"6px 14px", borderRadius:"var(--radius-pill)", border: collectStatus===s?"1px solid var(--brand)":"1px solid var(--border-default)", background: collectStatus===s?"var(--brand)":"var(--white)", color: collectStatus===s?"#fff":"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)", cursor:"pointer" }}>{s}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", display:"block", marginBottom:8 }}>변경 사유 (선택)</label>
          <textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={3} placeholder="변경 사유 입력 시 이력에 기록됩니다"
            style={{ width:"100%", padding:"10px 12px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"var(--body-sm)", color:"var(--text-primary)", resize:"vertical", boxSizing:"border-box" }} />
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ height:36, padding:"0 16px", borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 14px/1 var(--font-sans)", cursor:"pointer" }}>취소</button>
          <button onClick={save} style={{ height:36, padding:"0 20px", borderRadius:"var(--radius-md)", border:"none", background:"var(--brand)", color:"#fff", font:"var(--fw-demibold) 14px/1 var(--font-sans)", cursor:"pointer" }}>저장</button>
        </div>
      </div>
    </div>
  );
}

function Closures({ closures, onRestore, onStatusChange, onToast, onRefresh }) {
  const D = window.PMData;
  const { won, num } = D;
  const [type, setType] = React.useState("전체");
  const [onlyDebt, setOnlyDebt] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [detail, setDetail] = React.useState(null);
  const [statusRow, setStatusRow] = React.useState(null);

  const isCollectTarget = (c) =>
    ["폐업","양도","이관","탈퇴"].includes(c.type) &&
    (c.unpaidBalance || 0) > 0 &&
    !["정산완료","결손"].includes(c.collectStatus);

  const rows = React.useMemo(() => {
    const nq = q.trim().toLowerCase();
    return closures.filter(c => {
      const displayType = c.type === "폐지" ? "폐업" : c.type;
      if (type !== "전체" && displayType !== type) return false;
      if (onlyDebt && !isCollectTarget(c)) return false;
      if (nq && ![c.name,c.vehicleNo,c.mgmtNo,c.sigun,c.docNo].join(" ").toLowerCase().includes(nq)) return false;
      return true;
    }).sort((a,b) => (b.unpaidBalance||0) - (a.unpaidBalance||0));
  }, [closures, type, onlyDebt, q]);

  const collectCount = closures.filter(isCollectTarget).length;
  const debtTotal = closures.filter(isCollectTarget).reduce((s,c) => s + (c.unpaidBalance||0), 0);
  const countByType = (t) => closures.filter(c => {
    const dt = c.type === "폐지" ? "폐업" : c.type;
    return t === "전체" || dt === t;
  }).length;

  const handleCancelProcess = async (c) => {
    if (!confirm(`${c.name} 회원의 처리를 취소하고 이전 상태로 되돌립니까?\n이 작업은 이력에 기록됩니다.`)) return;
    try {
      const res = await fetch(`/api/closures/${c.id}/cancel`, { method:"POST" });
      if (!res.ok) { const j = await res.json().catch(()=>{}); onToast && onToast(j?.detail||"취소 실패"); return; }
      // cancel API가 폐업 기록을 삭제하므로 onRestore(→restore API 재호출) 대신 onRefresh로 목록 갱신
      if (typeof onRefresh === 'function') await onRefresh();
      onToast && onToast(`${c.name} 처리가 취소되었습니다.`);
    } catch(e) { onToast && onToast("오류: "+e.message); }
  };

  const handleRestore = async (c) => {
    if (!confirm(`${c.name} 회원을 정상 명단으로 복귀할까요?\n미납잔액이 있는 경우 별도 정산이 필요합니다.`)) return;
    try {
      const res = await fetch(`/api/closures/${c.id}/restore`, { method:"POST" });
      if (!res.ok) { const j = await res.json().catch(()=>{}); onToast && onToast(j?.detail||"복귀 실패"); return; }
      // restore API가 폐업 기록을 삭제하므로 onRestore(→restore API 재호출) 대신 onRefresh로 목록 갱신
      if (typeof onRefresh === 'function') await onRefresh();
      onToast && onToast(`${c.name} 회원이 정상 명단으로 복귀되었습니다.`);
    } catch(e) { onToast && onToast("오류: "+e.message); }
  };

  const Th = ({ label, align="left" }) => (
    <th style={{ textAlign:align, padding:"11px 14px", whiteSpace:"nowrap", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-default)", position:"sticky", top:0, zIndex:1 }}>{label}</th>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {detail && <DetailModal row={detail} onClose={() => setDetail(null)} onToast={onToast} />}
      {statusRow && <StatusChangeModal row={statusRow} onClose={() => setStatusRow(null)} onSave={onStatusChange} onToast={onToast} />}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {[
          ["폐업·이탈 전체", `${num(closures.length)}명`, "var(--text-primary)"],
          ["추심 대상 (미납잔액)", `${num(collectCount)}명`, "var(--red-500)"],
          ["미납잔액 합계", won(debtTotal), "var(--red-500)"],
        ].map(([l,v,c]) => (
          <div key={l} style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", padding:"14px 18px", boxShadow:"var(--shadow-xs)" }}>
            <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div>
            <div style={{ font:"var(--fw-bold) 20px/1.1 var(--font-sans)", color:c, marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        {["전체","폐업","양도","이관","탈퇴"].map(t => (
          <window.PMUI.Chip key={t} active={type===t} count={countByType(t)} onClick={() => setType(t)}>{t}</window.PMUI.Chip>
        ))}
        <window.PMUI.Chip active={onlyDebt} onClick={() => setOnlyDebt(!onlyDebt)}>추심대상만</window.PMUI.Chip>
        <div style={{ marginLeft:"auto" }}>
          <window.PMUI.SearchBox value={q} onChange={setQ} width={280} placeholder="이름 · 차량번호 · 관리번호 검색" />
        </div>
      </div>

      <Card padded={false}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 20px", borderBottom:"1px solid var(--border-subtle)" }}>
          <Icon name="secure" size={16} color="#B9791A" />
          <span style={{ font:"var(--body-xs)", color:"var(--text-secondary)" }}>폐업·양도·이관·탈퇴자는 미수금 일반 명단에서 제외됩니다. 미납잔액이 남은 경우 <b style={{ color:"var(--red-500)" }}>추심 대상</b>으로 관리합니다. 회원 데이터는 절대 삭제되지 않습니다.</span>
        </div>
        <div style={{ maxHeight:"calc(100vh - 420px)", overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              <Th label="처리구분" />
              <Th label="지역" />
              <Th label="성명" />
              <Th label="전화번호" />
              <Th label="주소" />
              <Th label="차량번호" />
              <Th label="관리번호" />
              <Th label="처리일" />
              <Th label="공문번호" />
              <Th label="처리출처" />
              <Th label="미납잔액" align="right" />
              <Th label="미납항목" />
              <Th label="미납기간" />
              <Th label="추심상태" />
              <Th label="마지막안내일" />
              <Th label="메모" />
              <Th label="처리" align="right" />
            </tr></thead>
            <tbody>
              {rows.map(c => {
                const displayType = c.type === "폐지" ? "폐업" : c.type;
                return (
                  <tr key={c.id} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                    <td style={{ padding:"10px 14px" }}><CTypeBadge type={displayType} /></td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{c.sigun||"—"}</td>
                    <td style={{ padding:"10px 14px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{c.name}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{c.phone||"—"}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-tertiary)", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={c.address||""}>{c.address||"—"}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{c.vehicleNo||"—"}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{c.mgmtNo||"—"}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{c.processDate||"—"}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{c.docNo||"—"}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{c.processSource||"—"}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", whiteSpace:"nowrap", font:"var(--fw-bold) 13px/1 var(--font-sans)", color:(c.unpaidBalance||0)>0?"var(--red-500)":"var(--text-tertiary)" }}>{won(c.unpaidBalance||0)}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{c.unpaidItems||"—"}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{c.unpaidPeriod||"—"}</td>
                    <td style={{ padding:"10px 14px" }}><CollectBadge status={c.collectStatus} /></td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{c.lastNoticeDate||"—"}</td>
                    <td style={{ padding:"10px 14px", font:"var(--body-sm)", color:"var(--text-tertiary)", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                      title={c.memo||""}>{c.memo||"—"}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <div style={{ display:"inline-flex", gap:4 }}>
                        <ActionBtn onClick={() => setDetail(c)}>이력보기</ActionBtn>
                        <ActionBtn onClick={() => setStatusRow({ ...c, type: displayType })}>상태변경</ActionBtn>
                        <ActionBtn onClick={() => handleRestore(c)} color="var(--brand)">정상복구</ActionBtn>
                        <ActionBtn onClick={() => handleCancelProcess(c)}>처리취소</ActionBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={17} style={{ padding:"60px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-md)" }}>해당하는 폐업·이탈 회원이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ActionBtn({ onClick, children, color }) {
  return (
    <button type="button" onClick={onClick} style={{
      height:26, padding:"0 9px", borderRadius:"var(--radius-pill)", border:"1px solid var(--border-default)",
      cursor:"pointer", background:"var(--white)", color: color || "var(--text-secondary)",
      font:"var(--fw-medium) 11px/1 var(--font-sans)", whiteSpace:"nowrap",
    }}>{children}</button>
  );
}

window.Closures = Closures;
