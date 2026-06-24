// 실사용 엑셀 업로드 — 전체면허자현황 / 2026 미수금 2종만 허용
// - 샘플/목업 데이터 없음
// - 클릭/드래그 파일 선택
// - /api/import/preview 미리보기
// - 사용자가 '반영하기'를 눌렀을 때만 /api/import/commit 저장

const UPLOAD_TYPES = [
  {
    key: "members",
    label: "전체면허자현황",
    help: "개인 + 택배 시트를 읽어 회원 원장을 갱신합니다.",
  },
  {
    key: "arrears",
    label: "2026 미수금",
    help: "2026년회비내역 시트의 마지막 입력월 현재 미수금만 반영합니다.",
  },
];

function Upload({ onApply }) {
  const won = window.PMData?.won || ((v) => `${Number(v || 0).toLocaleString()}원`);
  const [selectedType, setSelectedType] = React.useState(UPLOAD_TYPES[1]);
  const [file, setFile] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const inputRef = React.useRef(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const validateFile = (f) => {
    if (!f) return "파일이 선택되지 않았습니다.";
    const ok = /\.(xlsx|xls|xlsm)$/i.test(f.name);
    if (!ok) return ".xlsx / .xls / .xlsm 파일만 업로드할 수 있습니다.";
    if (f.size > 30 * 1024 * 1024) return "파일 용량은 30MB 이하만 가능합니다.";
    return "";
  };

  const requestImport = async (mode, targetFile = file) => {
    const v = validateFile(targetFile);
    if (v) {
      setError(v);
      return;
    }

    const form = new FormData();
    form.append("file_type", selectedType.key);
    form.append("file", targetFile);

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/import/${mode}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.detail || data.message || `서버 오류 ${res.status}`);
      }
      if (mode === "preview") {
        setPreview(data);
        setResult(null);
      } else {
        setResult(data);
        setPreview(null);
        onApply && onApply(data);
      }
    } catch (e) {
      console.error("엑셀 업로드 실패", e);
      setError(e.message || "업로드 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (f) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    const v = validateFile(f);
    if (v) {
      setError(v);
      return;
    }
    setError("");
    requestImport("preview", f);
  };

  const sample = preview?.sample || [];
  const columns = preview?.columns || (sample[0] ? Object.keys(sample[0]) : []);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 980 }}>
      <section className="card" style={{ background: "#fff", border: "1px solid var(--border-default)", borderRadius: 18, padding: 24, boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, font: "var(--fw-bold) 18px/1.4 var(--font-sans)", color: "var(--text-primary)" }}>1. 업로드 파일 종류 선택</h3>
            <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", font: "13px/1.5 var(--font-sans)" }}>
              운영 업로드는 2종만 사용합니다. 다른 대장은 여기서 받지 않습니다.
            </p>
          </div>
          <span style={{ padding: "7px 10px", borderRadius: 999, background: "#EEF4FF", color: "#2563EB", font: "var(--fw-bold) 12px/1 var(--font-sans)" }}>
            실제 API 연결
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 18 }}>
          {UPLOAD_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setSelectedType(t); reset(); }}
              style={{
                textAlign: "left",
                padding: "16px 18px",
                borderRadius: 14,
                border: selectedType.key === t.key ? "2px solid var(--brand)" : "1px solid var(--border-default)",
                background: selectedType.key === t.key ? "var(--brand-subtle)" : "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ font: "var(--fw-bold) 15px/1.3 var(--font-sans)", color: selectedType.key === t.key ? "var(--brand-active)" : "var(--text-primary)" }}>{t.label}</div>
              <div style={{ marginTop: 6, font: "12px/1.45 var(--font-sans)", color: "var(--text-secondary)" }}>{t.help}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="card" style={{ background: "#fff", border: "1px solid var(--border-default)", borderRadius: 18, padding: 24, boxShadow: "var(--shadow-card)" }}>
        <h3 style={{ margin: 0, font: "var(--fw-bold) 18px/1.4 var(--font-sans)", color: "var(--text-primary)" }}>2. 파일 업로드</h3>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--brand)"; e.currentTarget.style.background = "var(--brand-subtle)"; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.background = "var(--grey-25)"; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = "var(--border-default)";
            e.currentTarget.style.background = "var(--grey-25)";
            handleFile(e.dataTransfer.files?.[0]);
          }}
          style={{
            marginTop: 18,
            minHeight: 155,
            border: "1.5px dashed var(--border-default)",
            borderRadius: 18,
            background: "var(--grey-25)",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            cursor: "pointer",
            padding: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 34, marginBottom: 10 }}>☁️</div>
            <div style={{ color: "var(--brand-active)", font: "var(--fw-bold) 15px/1.4 var(--font-sans)" }}>
              {selectedType.label} 파일을 클릭하거나 끌어다 놓기
            </div>
            <div style={{ marginTop: 6, color: "var(--text-tertiary)", font: "13px/1.4 var(--font-sans)" }}>
              .xlsx · .xls · .xlsm / 선택 즉시 미리보기만 실행
            </div>
            {file && <div style={{ marginTop: 10, color: "var(--text-secondary)", font: "12px/1.4 var(--font-sans)" }}>선택 파일: {file.name}</div>}
          </div>
        </div>

        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "#FFF7E6", color: "#9A6500", font: "13px/1.5 var(--font-sans)" }}>
          업로드 즉시 기존 데이터가 삭제되지 않습니다. 미리보기 확인 후 <b>반영하기</b>를 눌러야 저장됩니다.
        </div>

        {loading && <div style={{ marginTop: 14, color: "var(--brand-active)", font: "var(--fw-bold) 13px/1.5 var(--font-sans)" }}>처리 중입니다...</div>}
        {error && <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "#FEE2E2", color: "#B91C1C", font: "13px/1.5 var(--font-sans)" }}>오류: {error}</div>}
      </section>

      {preview && (
        <section className="card" style={{ background: "#fff", border: "1px solid var(--border-default)", borderRadius: 18, padding: 24, boxShadow: "var(--shadow-card)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <h3 style={{ margin: 0, font: "var(--fw-bold) 18px/1.4 var(--font-sans)", color: "var(--text-primary)" }}>3. 미리보기</h3>
              <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", font: "13px/1.5 var(--font-sans)" }}>{preview.message || "업로드 내용을 분석했습니다."}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--text-tertiary)", font: "12px/1.4 var(--font-sans)" }}>{preview.filename}</div>
              <div style={{ color: "var(--text-primary)", font: "var(--fw-bold) 22px/1.2 var(--font-sans)" }}>{Number(preview.total_rows || sample.length).toLocaleString()}건</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button type="button" onClick={() => requestImport("commit")} disabled={loading} style={{ padding: "11px 18px", border: 0, borderRadius: 12, background: "var(--brand)", color: "#fff", font: "var(--fw-bold) 14px/1 var(--font-sans)", cursor: "pointer" }}>반영하기</button>
            <button type="button" onClick={reset} disabled={loading} style={{ padding: "11px 18px", border: "1px solid var(--border-default)", borderRadius: 12, background: "#fff", color: "var(--text-primary)", font: "var(--fw-bold) 14px/1 var(--font-sans)", cursor: "pointer" }}>취소</button>
          </div>

          <div style={{ marginTop: 18, overflow: "auto", border: "1px solid var(--border-default)", borderRadius: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", font: "12px/1.45 var(--font-sans)", minWidth: 900 }}>
              <thead style={{ background: "var(--grey-25)", color: "var(--text-tertiary)" }}>
                <tr>{columns.slice(0, 10).map((c) => <th key={c} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--border-default)", whiteSpace: "nowrap" }}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {sample.slice(0, 80).map((row, i) => (
                  <tr key={i}>
                    {columns.slice(0, 10).map((c) => <td key={c} style={{ padding: "9px 12px", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{typeof row[c] === "number" && /금액|미수|이월/.test(c) ? won(row[c]) : String(row[c] ?? "")}</td>)}
                  </tr>
                ))}
                {sample.length === 0 && <tr><td colSpan={columns.length || 1} style={{ padding: 18, color: "var(--text-tertiary)", textAlign: "center" }}>미리보기 데이터가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result && (
        <section className="card" style={{ background: "#fff", border: "1px solid var(--border-default)", borderRadius: 18, padding: 24, boxShadow: "var(--shadow-card)" }}>
          <h3 style={{ margin: 0, font: "var(--fw-bold) 18px/1.4 var(--font-sans)", color: "var(--text-primary)" }}>반영 완료</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 }}>
            <div style={{ padding: 16, borderRadius: 14, background: "#F0FDF4" }}><b>{Number(result.inserted || 0).toLocaleString()}</b><br />신규/반영</div>
            <div style={{ padding: 16, borderRadius: 14, background: "#EEF4FF" }}><b>{Number(result.updated || 0).toLocaleString()}</b><br />갱신</div>
            <div style={{ padding: 16, borderRadius: 14, background: "#FFF7E6" }}><b>{Number(result.skipped || 0).toLocaleString()}</b><br />제외/미매칭</div>
          </div>
          {Array.isArray(result.errors) && result.errors.length > 0 && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#FEF2F2", color: "#991B1B", font: "12px/1.5 var(--font-sans)", maxHeight: 180, overflow: "auto" }}>
              {result.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "11px 18px", border: "1px solid var(--border-default)", borderRadius: 12, background: "#fff", color: "var(--text-primary)", font: "var(--fw-bold) 14px/1 var(--font-sans)", cursor: "pointer" }}>새 파일 업로드</button>
        </section>
      )}
    </div>
  );
}

window.Upload = Upload;
