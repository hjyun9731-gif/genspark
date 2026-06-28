// 엑셀 업로드 — 전체면허자현황(members) / 2026 미수금(arrears) 실API 연동
// 백엔드: POST /api/import/preview  (file_type=members|arrears, file=...)
//         POST /api/import/commit   (file_type=members|arrears, file=...)
const { Card, Icon, Button } = window.PayroleDesignSystem_9db006;

const FILE_TYPES = [
  {
    key: "members",
    label: "전체면허자현황",
    hint: "개인+택배 시트만 읽습니다",
    previewCols: ["지역","성명","차량번호","가입여부","부과구분","부과금액","부과시작월"],
  },
  {
    key: "arrears",
    label: "2026 미수금",
    hint: "2026년회비내역 시트만 읽습니다",
    previewCols: ["지역","성명","차량번호","현재 미수금액","마지막 미수 기준월","매칭상태","비고"],
  },
];

function Upload({ onApply }) {
  const { won } = window.PMData;
  const [ftIdx, setFtIdx] = React.useState(0);
  const [stage, setStage] = React.useState("select"); // select | loading | preview | done
  const [error, setError] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState("");
  const [previewData, setPreviewData] = React.useState(null);
  const [applying, setApplying] = React.useState(false);
  const [applied, setApplied] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const storedFileRef = React.useRef(null); // commit 시 재사용

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
    storedFileRef.current = file;

    const form = new FormData();
    form.append("file_type", ft.key);
    form.append("file", file);
    try {
      const res = await fetch("/api/import/preview", { method: "POST", body: form });
      let json;
      try { json = await res.json(); } catch(_) { json = {}; }
      if (!res.ok) {
        setError(`미리보기 실패 (HTTP ${res.status}): ${json.detail || res.statusText}`);
        setStage("select");
        return;
      }
      setPreviewData(json);
      setStage("preview");
    } catch (e) {
      setError(`POST /api/import/preview 호출 실패: ${e.message} — 브라우저 콘솔에서 상세 확인`);
      setStage("select");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleInputChange = (e) => {
    handleFile(e.target.files[0]);
    e.target.value = "";
  };

  const handleCommit = async () => {
    if (!storedFileRef.current) { setError("파일이 없습니다. 다시 업로드해주세요."); return; }
    setApplying(true);
    const form = new FormData();
    form.append("file_type", ft.key);
    form.append("file", storedFileRef.current);
    try {
      const res = await fetch("/api/import/commit", { method: "POST", body: form });
      let json;
      try { json = await res.json(); } catch(_) { json = {}; }
      if (!res.ok) {
        setError(`반영 실패 (HTTP ${res.status}): ${json.detail || res.statusText}`);
        setApplying(false);
        return;
      }
      setApplied(json);
      setStage("done");
      onApply && onApply(json);
    } catch (e) {
      setError(`POST /api/import/commit 호출 실패: ${e.message}`);
    } finally {
      setApplying(false);
    }
  };

  const reset = () => {
    setStage("select");
    setPreviewData(null);
    setApplied(null);
    setError(null);
    setFileName("");
    storedFileRef.current = null;
  };

  const ErrorBar = () => error ? (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"var(--red-50)", border:"1px solid var(--red-200)", borderRadius:"var(--radius-md)" }}>
      <Icon name="warning" size={18} color="var(--red-500)" />
      <span style={{ font:"var(--body-sm)", color:"var(--red-600)", flex:1 }}>{error}</span>
      <button onClick={()=>setError(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--red-400)", fontSize:18, lineHeight:1 }}>✕</button>
    </div>
  ) : null;

  const downloadUnmatched = (rows) => {
    const header = "이름,차량번호,미수금액,사유";
    const body = rows.map(r => `${r.name},${r.vehicle},${r.amount},${r.reason}`).join("\n");
    const blob = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "미매칭목록.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (stage === "done") {
    const isArrears = applied.type === "arrears";
    const statCards = isArrears ? [
      ["미수항목 추가", applied.inserted ?? 0, "var(--green-500)"],
      ["0원 제외", applied.zero_count ?? 0, "var(--text-tertiary)"],
      ["미매칭", applied.unmatched_count ?? (applied.errors||[]).length, "var(--red-500)"],
    ] : [
      ["회원 신규 추가", applied.inserted ?? 0, "var(--green-500)"],
      ["정보 수정", applied.updated ?? 0, "var(--brand)"],
      ["반영 제외", applied.skipped ?? 0, "var(--text-tertiary)"],
    ];
    const unmatchedList = applied.unmatched || [];

    return (
      <div style={{ maxWidth:640, margin:"40px auto 0", display:"flex", flexDirection:"column", gap:16 }}>
        <ErrorBar />
        <Card>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"20px 10px 8px", textAlign:"center" }}>
            <span style={{ width:60, height:60, borderRadius:"50%", background:"var(--green-50)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="check" size={30} color="var(--green-500)" /></span>
            <div>
              <div style={{ font:"var(--fw-bold) 20px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>반영이 완료되었습니다</div>
              <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginTop:6 }}>{ft.label} · 기존 데이터는 유지되고 변경사항만 업데이트되었습니다.</div>
              {isArrears && (
                <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:4 }}>
                  ※ 미수항목 추가 = 회원과 연결된 미수금 레코드 수 (회원 신규 생성 없음)
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:10, width:"100%", marginTop:6 }}>
              {statCards.map(([l,v,c]) => (
                <div key={l} style={{ flex:1, padding:"14px", borderRadius:"var(--radius-md)", background:"var(--grey-25)", textAlign:"center" }}>
                  <div style={{ font:"var(--fw-bold) 24px/1 var(--font-sans)", color:c }}>{v}</div>
                  <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:4 }}>{l}건</div>
                </div>
              ))}
            </div>
            <Button variant="primary" size="medium" onClick={reset}>새 파일 업로드</Button>
          </div>
        </Card>

        {isArrears && unmatchedList.length > 0 && (
          <Card padded={false}>
            <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid var(--border-subtle)" }}>
              <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--red-600)" }}>
                미매칭 목록 ({unmatchedList.length}건)
              </div>
              <button
                onClick={() => downloadUnmatched(unmatchedList)}
                style={{ font:"var(--body-xs)", color:"var(--brand)", background:"none", border:"1px solid var(--brand)", borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>
                CSV 다운로드
              </button>
            </div>
            <div style={{ overflow:"auto", maxHeight:320 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"var(--grey-25)" }}>
                    {["이름","차량번호","미수금액","사유"].map(h => (
                      <th key={h} style={{ padding:"8px 14px", textAlign: h==="미수금액"?"right":"left", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unmatchedList.map((r,i) => (
                    <tr key={i} style={{ borderTop:"1px solid var(--border-subtle)" }}>
                      <td style={{ padding:"8px 14px", font:"var(--fw-demibold) 13px/1 var(--font-sans)" }}>{r.name}</td>
                      <td style={{ padding:"8px 14px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{r.vehicle}</td>
                      <td style={{ padding:"8px 14px", font:"var(--body-sm)", textAlign:"right", color: r.amount<0?"var(--violet-500)":r.amount>0?"var(--red-500)":"var(--text-tertiary)" }}>
                        {r.amount===0?"0원":(r.amount<0?"-":"")+Math.abs(r.amount).toLocaleString("ko-KR")+"원"}
                      </td>
                      <td style={{ padding:"8px 14px", font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {!isArrears && (applied.errors||[]).length > 0 && (
          <Card>
            <div style={{ font:"var(--body-xs)", color:"#946012", lineHeight:1.8 }}>
              <b>오류 ({applied.errors.length}건):</b><br/>
              {applied.errors.slice(0,10).join("\n")}
              {applied.errors.length > 10 && `\n… 외 ${applied.errors.length-10}건`}
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (stage === "preview" && previewData) {
    const rows = previewData.sample || [];
    const totalRows = previewData.total_rows || rows.length;
    const cols = ft.previewCols;
    const matchedCount = ft.key === "arrears" ? rows.filter(r=>r["매칭상태"]==="매칭").length : null;
    const unmatchedCount = ft.key === "arrears" ? rows.filter(r=>r["매칭상태"]==="미매칭").length : null;

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <ErrorBar />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ width:40, height:40, borderRadius:10, background:"var(--green-50)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="document" size={20} color="var(--green-500)" /></span>
            <div>
              <div style={{ font:"var(--fw-demibold) 15px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{fileName}</div>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>
                {ft.label} · 총 {totalRows}행 분석 {rows.length < totalRows ? `(미리보기 ${rows.length}건)` : ""}
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

        {/* 요약 */}
        <div style={{ display:"grid", gridTemplateColumns: ft.key==="arrears"?"repeat(3,1fr)":"repeat(2,1fr)", gap:12 }}>
          <SumCard label="전체 행 수" value={totalRows+"건"} color="var(--text-primary)" />
          {ft.key === "arrears" && <>
            <SumCard label="DB 회원 매칭" value={matchedCount+"건"} color="var(--green-500)" />
            <SumCard label="미매칭" value={unmatchedCount+"건"} color={unmatchedCount>0?"var(--red-500)":"var(--text-tertiary)"} />
          </>}
          {ft.key === "members" && (
            <SumCard label="메시지" value={previewData.message || ft.hint} color="var(--text-secondary)" small />
          )}
        </div>

        {previewData.message && ft.key === "arrears" && (
          <div style={{ padding:"10px 14px", background:"var(--amber-50)", borderRadius:"var(--radius-md)", font:"var(--body-sm)", color:"#946012" }}>
            {previewData.message}
          </div>
        )}

        <Card padded={false}>
          <div style={{ overflow:"auto", maxHeight:"calc(100vh - 400px)" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
              <thead><tr>
                {cols.map((h,i) => (
                  <th key={h} style={{ textAlign: h.includes("금액")?"right":"left", padding:"10px 14px", whiteSpace:"nowrap", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", background:"var(--grey-25)", borderBottom:"1px solid var(--border-subtle)", position:"sticky", top:0 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={cols.length} style={{ padding:"40px", textAlign:"center", color:"var(--text-tertiary)" }}>데이터가 없습니다.</td></tr>
                )}
                {rows.map((r,i) => {
                  const isUnmatched = ft.key==="arrears" && r["매칭상태"]==="미매칭";
                  return (
                    <tr key={i} style={{ borderBottom: i<rows.length-1?"1px solid var(--border-subtle)":"none", background: isUnmatched?"var(--red-25,#FFF5F5)":"" }}>
                      {cols.map((col,j) => {
                        const val = r[col];
                        const isAmt = col.includes("금액") || col.includes("금");
                        const isStatus = col==="매칭상태";
                        return (
                          <td key={col} style={{ padding:"10px 14px", font: j===1?"var(--fw-demibold) 13px/1 var(--font-sans)":"var(--body-sm)", color: isStatus?(val==="매칭"?"var(--green-600)":"var(--red-500)"): isAmt&&val>0?"var(--red-500)":"var(--text-primary)", textAlign: isAmt?"right":"left", whiteSpace:"nowrap" }}>
                            {val==null||val===""?"—":isAmt?won(Number(val)||0):String(val)}
                          </td>
                        );
                      })}
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
      <ErrorBar />
      <Card>
        <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:6 }}>1. 업로드 파일 종류 선택</div>
        <div style={{ font:"var(--body-sm)", color:"var(--text-secondary)", marginBottom:16 }}>업로드할 협회 엑셀 자료의 종류를 먼저 선택하세요.</div>
        <div style={{ display:"flex", gap:12 }}>
          {FILE_TYPES.map((t,i) => (
            <button key={t.key} type="button" onClick={()=>setFtIdx(i)} style={{
              flex:1, padding:"18px 20px", textAlign:"left", borderRadius:"var(--radius-md)", cursor:"pointer",
              border: ftIdx===i ? "1.5px solid var(--brand)" : "1px solid var(--border-default)",
              background: ftIdx===i ? "var(--brand-subtle)" : "var(--white)",
              transition:"all .12s" }}>
              <div style={{ font:`var(--fw-demibold) 15px/1.3 var(--font-sans)`, color: ftIdx===i?"var(--brand-active)":"var(--text-primary)" }}>{t.label}</div>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:4 }}>{t.hint}</div>
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
          onClick={() => stage !== "loading" && fileInputRef.current?.click()}
          onDragOver={e=>{e.preventDefault();setDragging(true);}}
          onDragLeave={()=>setDragging(false)}
          onDrop={handleDrop}
          style={{
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12,
            padding:"44px 20px", border:`2px dashed ${dragging?"var(--brand)":"var(--border-default)"}`,
            borderRadius:"var(--radius-lg)", cursor:stage==="loading"?"wait":"pointer",
            background:dragging?"var(--brand-subtle)":"var(--grey-25)", transition:"all .15s",
          }}>
          <span style={{ width:52, height:52, borderRadius:"50%", background:"var(--brand-subtle)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
            <Icon name="cloud" size={26} color="var(--brand)" /></span>
          {stage === "loading" ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ font:"var(--fw-demibold) 15px/1.4 var(--font-sans)", color:"var(--text-primary)" }}>서버에서 분석 중…</div>
              <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:4 }}>{fileName}</div>
            </div>
          ) : (
            <div style={{ textAlign:"center" }}>
              <div style={{ font:"var(--fw-demibold) 15px/1.4 var(--font-sans)", color:"var(--text-primary)" }}>
                <span style={{ color:"var(--brand)" }}>{ft.label}</span> 파일을 여기에 끌어다 놓기
              </div>
              <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:4 }}>또는 클릭하여 .xlsx · .xls · .xlsm 선택</div>
            </div>
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

function SumCard({ label, value, color, small }) {
  return (
    <div style={{ background:"var(--white)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-md)", padding:"14px 18px", boxShadow:"var(--shadow-xs)" }}>
      <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{label}</div>
      <div style={{ font:`var(--fw-bold) ${small?"14":"22"}px/1.2 var(--font-sans)`, color:color||"var(--text-primary)", marginTop:4 }}>{value}</div>
    </div>
  );
}

window.Upload = Upload;
