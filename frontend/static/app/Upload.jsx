// 엑셀 업로드 — 전체면허자현황 / 2026 미수금 (실제 API 연동)
const { Card, Icon, Button } = window.PayroleDesignSystem_9db006;

const FILE_TYPES = [
  { key: "license", label: "전체면허자현황", previewUrl: "/api/import/license-status/preview", commitUrl: "/api/import/license-status/commit" },
  { key: "misu",    label: "2026 미수금",   previewUrl: "/api/import/misu-2026/preview",      commitUrl: "/api/import/misu-2026/commit" },
];

const KIND_STYLE = {
  "신규":   { bg:"var(--green-50)",  fg:"var(--green-500)",  icon:"add-user" },
  "수정":   { bg:"#EAF3FF",          fg:"var(--blue-600)",   icon:"copy" },
  "중복":   { bg:"var(--grey-50)",   fg:"var(--grey-500)",   icon:"copy" },
  "오류":   { bg:"var(--red-50)",    fg:"var(--red-500)",    icon:"close" },
  "제외":   { bg:"var(--grey-50)",   fg:"var(--grey-400)",   icon:"minus" },
};

function Upload({ onApply }) {
  const { won } = window.PMData;
  const [ftIdx, setFtIdx] = React.useState(0);
  const [stage, setStage] = React.useState("select"); // select | loading | preview | done
  const [error, setError] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState("");
  const [previewData, setPreviewData] = React.useState(null); // { rows, counts, sheet, cols }
  const [tab, setTab] = React.useState("전체");
  const [applying, setApplying] = React.useState(false);
  const [applied, setApplied] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const commitTokenRef = React.useRef(null);

  const ft = FILE_TYPES[ftIdx];

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx","xls","xlsm"].includes(ext)) {
      setError("지원하지 않는 파일 형식입니다. .xlsx · .xls · .xlsm 파일을 선택하세요.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("파일 크기가 30MB를 초과합니다.");
      return;
    }
    setError(null);
    setFileName(file.name);
    setStage("loading");

    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(ft.previewUrl, { method:"POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail || `서버 오류 (${res.status})`);
        setStage("select");
        return;
      }
      commitTokenRef.current = json.token;
      setPreviewData(json);
      setTab("전체");
      setStage("preview");
    } catch (e) {
      setError("서버에 연결할 수 없습니다: " + e.message);
      setStage("select");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleInputChange = (e) => {
    handleFile(e.target.files[0]);
    e.target.value = "";
  };

  const handleCommit = async () => {
    setApplying(true);
    try {
      const res = await fetch(ft.commitUrl, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ token: commitTokenRef.current }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail || `반영 실패 (${res.status})`);
        setApplying(false);
        return;
      }
      setApplied(json);
      setStage("done");
      onApply && onApply();
    } catch (e) {
      setError("반영 중 오류: " + e.message);
    } finally {
      setApplying(false);
    }
  };

  const reset = () => { setStage("select"); setPreviewData(null); setApplied(null); setError(null); setFileName(""); commitTokenRef.current = null; };

  if (stage === "done") {
    return (
      <div style={{ maxWidth:560, margin:"40px auto 0" }}>
        <Card>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"20px 10px 8px", textAlign:"center" }}>
            <span style={{ width:60, height:60, borderRadius:"50%", background:"var(--green-50)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="check" size={30} color="var(--green-500)" /></span>
            <div>
              <div style={{ font:"var(--fw-bold) 20px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>반영이 완료되었습니다</div>
              <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginTop:6 }}>{ft.label} · 기존 데이터는 유지되고 변경사항만 업데이트되었습니다.</div>
            </div>
            <div style={{ display:"flex", gap:10, width:"100%", marginTop:6 }}>
              {[["신규 추가", applied.new_count ?? applied.newCnt ?? 0, "var(--green-500)"],
                ["정보 수정", applied.update_count ?? applied.updated ?? 0, "var(--brand)"],
                ["반영 제외", applied.skip_count ?? applied.skipped ?? 0, "var(--text-tertiary)"]].map(([l,v,c])=>(
                <div key={l} style={{ flex:1, padding:"14px", borderRadius:"var(--radius-md)", background:"var(--grey-25)", textAlign:"center" }}>
                  <div style={{ font:"var(--fw-bold) 24px/1 var(--font-sans)", color:c }}>{v}</div>
                  <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:4 }}>{l}건</div>
                </div>
              ))}
            </div>
            <Button variant="primary" size="medium" onClick={reset}>새 파일 업로드</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (stage === "preview" && previewData) {
    const rows = previewData.rows || [];
    const counts = previewData.counts || {};
    const totalCount = rows.length;
    const TABS = ["전체", ...Object.keys(KIND_STYLE).filter(k => (counts[k] || 0) > 0)];
    const visible = tab === "전체" ? rows : rows.filter(r => r.kind === tab);

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {error && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"var(--red-50)", border:"1px solid var(--red-200)", borderRadius:"var(--radius-md)" }}>
            <Icon name="warning" size={18} color="var(--red-500)" />
            <span style={{ font:"var(--body-sm)", color:"var(--red-600)" }}>{error}</span>
            <button onClick={() => setError(null)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"var(--red-400)", fontSize:16 }}>✕</button>
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ width:40, height:40, borderRadius:10, background:"var(--green-50)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="document" size={20} color="var(--green-500)" /></span>
            <div>
              <div style={{ font:"var(--fw-demibold) 15px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{fileName}</div>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>
                {previewData.sheet && `시트: ${previewData.sheet} · `}{totalCount}행 분석
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Button variant="tertiary" size="medium" onClick={reset}>취소</Button>
            <Button variant="primary" size="medium" leadingIcon="check" onClick={handleCommit} disabled={applying}>
              {applying ? "반영 중…" : "반영하기"}
            </Button>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {["신규","수정","중복","오류"].map(k => {
            const s = KIND_STYLE[k] || KIND_STYLE["오류"];
            return (
              <div key={k} style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-md)", padding:"14px 16px", boxShadow:"var(--shadow-xs)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:26, height:26, borderRadius:7, background:s.bg, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                    <Icon name={s.icon} size={14} color={s.fg} /></span>
                  <span style={{ font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-secondary)" }}>{k}</span>
                </div>
                <div style={{ font:"var(--fw-bold) 24px/1.1 var(--font-sans)", color:"var(--text-primary)", marginTop:10 }}>
                  {counts[k] || 0}<span style={{ fontSize:13, color:"var(--text-tertiary)", fontWeight:500 }}>건</span>
                </div>
              </div>
            );
          })}
        </div>

        <Card padded={false}>
          <div style={{ display:"flex", gap:6, padding:"12px 16px", borderBottom:"1px solid var(--border-subtle)", flexWrap:"wrap" }}>
            {TABS.map(t => (
              <window.PMUI.Chip key={t} active={tab===t} count={t==="전체"?totalCount:(counts[t]||0)} onClick={()=>setTab(t)}>{t}</window.PMUI.Chip>
            ))}
          </div>
          <div style={{ overflow:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>
                {["구분","성명","차량번호","지역","항목","금액","검토내용"].map((h,i)=>(
                  <th key={h} style={{ textAlign:i===5?"right":"left", padding:"10px 18px", whiteSpace:"nowrap",
                    font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)",
                    background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} style={{ padding:"40px", textAlign:"center", color:"var(--text-tertiary)" }}>해당 항목이 없습니다.</td></tr>
                )}
                {visible.map((r,i) => {
                  const s = KIND_STYLE[r.kind] || KIND_STYLE["오류"];
                  return (
                    <tr key={i} style={{ borderBottom: i<visible.length-1?"1px solid var(--border-subtle)":"none" }}>
                      <td style={{ padding:"12px 18px" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:"var(--radius-pill)", background:s.bg, color:s.fg, font:"var(--fw-demibold) 12px/1 var(--font-sans)" }}>{r.kind}</span>
                      </td>
                      <td style={{ padding:"12px 18px", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{r.name || "—"}</td>
                      <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{r.vehicle_no || r.vno || "—"}</td>
                      <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.region || r.sigun || "—"}</td>
                      <td style={{ padding:"12px 18px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.item || "—"}</td>
                      <td style={{ padding:"12px 18px", textAlign:"right", font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-primary)", whiteSpace:"nowrap" }}>{r.amount != null ? won(r.amount) : "—"}</td>
                      <td style={{ padding:"12px 18px", font:"var(--body-sm)", color: r.kind==="오류"?"var(--red-500)":"var(--text-secondary)" }}>{r.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // select / loading
  return (
    <div style={{ maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:20 }}>
      {error && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"var(--red-50)", border:"1px solid var(--red-200)", borderRadius:"var(--radius-md)" }}>
          <Icon name="warning" size={18} color="var(--red-500)" />
          <span style={{ font:"var(--body-sm)", color:"var(--red-600)" }}>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"var(--red-400)", fontSize:16 }}>✕</button>
        </div>
      )}

      <Card>
        <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:6 }}>1. 업로드 파일 종류 선택</div>
        <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginBottom:16 }}>업로드할 협회 엑셀 자료의 종류를 먼저 선택하세요.</div>
        <div style={{ display:"flex", gap:12 }}>
          {FILE_TYPES.map((t, i) => (
            <button key={t.key} type="button" onClick={() => setFtIdx(i)} style={{
              flex:1, padding:"18px 20px", textAlign:"left", borderRadius:"var(--radius-md)", cursor:"pointer",
              border: ftIdx===i ? "1.5px solid var(--brand)" : "1px solid var(--border-default)",
              background: ftIdx===i ? "var(--brand-subtle)" : "var(--white)",
              font:"var(--fw-medium) 14px/1.3 var(--font-sans)",
              color: ftIdx===i ? "var(--brand-active)" : "var(--text-primary)", transition:"all .12s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:14 }}>2. 파일 업로드</div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          style={{ display:"none" }}
          onChange={handleInputChange}
        />
        <div
          onClick={() => !stage.includes("loading") && fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12,
            padding:"44px 20px", border:`2px dashed ${dragging?"var(--brand)":"var(--border-default)"}`,
            borderRadius:"var(--radius-lg)", cursor: stage==="loading"?"wait":"pointer",
            background: dragging?"var(--brand-subtle)":"var(--grey-25)", transition:"all .15s",
          }}>
          {stage === "loading" ? (
            <>
              <span style={{ width:52, height:52, borderRadius:"50%", background:"var(--brand-subtle)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                <Icon name="cloud" size={26} color="var(--brand)" /></span>
              <div style={{ font:"var(--fw-demibold) 15px/1.4 var(--font-sans)", color:"var(--text-primary)" }}>분석 중…</div>
              <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{fileName}</div>
            </>
          ) : (
            <>
              <span style={{ width:52, height:52, borderRadius:"50%", background:"var(--brand-subtle)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                <Icon name="cloud" size={26} color="var(--brand)" /></span>
              <div style={{ textAlign:"center" }}>
                <div style={{ font:"var(--fw-demibold) 15px/1.4 var(--font-sans)", color:"var(--text-primary)" }}>
                  <span style={{ color:"var(--brand)" }}>{ft.label}</span> 파일을 여기에 끌어다 놓기</div>
                <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:4 }}>또는 클릭하여 .xlsx · .xls · .xlsm 선택</div>
              </div>
            </>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:16, padding:"12px 14px", background:"var(--amber-50)", borderRadius:"var(--radius-md)" }}>
          <Icon name="secure" size={18} color="#B9791A" style={{ flex:"none" }} />
          <span style={{ font:"var(--body-sm)", color:"#946012" }}>업로드 즉시 기존 데이터가 변경되지 않습니다. 미리보기에서 <b>반영하기</b>를 눌러야 DB에 저장됩니다.</span>
        </div>
      </Card>
    </div>
  );
}

window.Upload = Upload;
