// 자격증명 자동인쇄 — AutoCertPrint 웹 버전
// 화물운송종사자격증명 정보를 입력 후 미리보기 및 브라우저 인쇄
const { Card, Button, Icon } = window.PayroleDesignSystem_9db006;

const INITIAL = {
  adminNo: "",
  name: "",
  certNo: "",
  year: String(new Date().getFullYear()),
  month: String(new Date().getMonth() + 1).padStart(2, "0"),
  day: String(new Date().getDate()).padStart(2, "0"),
  carNo: "",
};

function formatCarNo(raw) {
  const s = raw.trim();
  if (s.length > 4 && !s.includes(" ")) {
    return s.slice(0, s.length - 4) + " " + s.slice(s.length - 4);
  }
  return s;
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:16, padding:"10px 0", borderBottom:"1px solid var(--border-subtle)" }}>
      <label style={{ width:110, font:"var(--fw-medium) 13px/1 var(--font-sans)", color:"var(--text-secondary)", flex:"none" }}>{label}</label>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  );
}

function InputBox({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ""}
      style={{ width:"100%", height:36, padding:"0 12px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)",
        font:"var(--body-md)", color:"var(--text-primary)", background:"var(--white)", boxSizing:"border-box",
        outline:"none" }}
    />
  );
}

function CertPreview({ data }) {
  const carNo = formatCarNo(data.carNo);
  return (
    <div id="cert-preview" style={{ width:520, margin:"0 auto", border:"2px solid #1a3a6b", borderRadius:8, padding:"32px 40px", background:"#fff",
      fontFamily:"'Malgun Gothic', '맑은 고딕', sans-serif", position:"relative" }}>

      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ fontSize:11, color:"#555", letterSpacing:"0.1em", marginBottom:6 }}>강원도개인소형화물운수사업조합</div>
        <div style={{ fontSize:26, fontWeight:"bold", color:"#1a3a6b", letterSpacing:"0.05em", borderBottom:"3px double #1a3a6b", paddingBottom:12 }}>
          화물운송종사자격증명
        </div>
        <div style={{ fontSize:11, color:"#555", letterSpacing:"0.1em", marginTop:6 }}>
          Certificate of Freight Transport Workers
        </div>
      </div>

      <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:28, fontSize:14 }}>
        <tbody>
          {[
            ["관 리 번 호", data.adminNo || "—"],
            ["성       명", data.name || "—"],
            ["자격증번호", data.certNo || "—"],
            ["차량번호", carNo || "—"],
          ].map(([label, val]) => (
            <tr key={label} style={{ borderBottom:"1px solid #ddd" }}>
              <td style={{ padding:"10px 12px", width:130, color:"#555", fontWeight:"bold", background:"#f8f9fa", verticalAlign:"middle" }}>{label}</td>
              <td style={{ padding:"10px 16px", color:"#111", fontWeight:"bold", verticalAlign:"middle", fontSize:15 }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ display:"inline-block", padding:"10px 28px", background:"#f0f4ff", border:"1px solid #b8c8f0", borderRadius:6 }}>
          <span style={{ fontSize:13, color:"#555" }}>발급일: </span>
          <span style={{ fontSize:15, fontWeight:"bold", color:"#1a3a6b" }}>
            {data.year}년 {data.month}월 {data.day}일
          </span>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:28,
        borderTop:"1px solid #ddd", paddingTop:16 }}>
        <div style={{ fontSize:12, color:"#888", lineHeight:1.7 }}>
          이 증명서는 화물운송종사자격을<br/>증명하는 공식 서류입니다.
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:14, fontWeight:"bold", color:"#1a3a6b", marginBottom:4 }}>강원도개인소형화물운수사업조합</div>
          <div style={{ width:70, height:70, border:"2px solid #1a3a6b", borderRadius:"50%", display:"inline-flex",
            alignItems:"center", justifyContent:"center", fontSize:9, color:"#1a3a6b", textAlign:"center", lineHeight:1.3,
            padding:4, fontWeight:"bold" }}>
            강원도<br/>개인소형<br/>화물운수<br/>사업조합
          </div>
        </div>
      </div>
    </div>
  );
}

function CertPrint({ onToast }) {
  const [form, setForm] = React.useState(INITIAL);
  const [showPreview, setShowPreview] = React.useState(false);
  const [history, setHistory] = React.useState([]);

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const handlePreview = () => {
    if (!form.name || !form.certNo || !form.carNo) {
      onToast && onToast("성명, 자격증번호, 차량번호를 입력해 주세요.");
      return;
    }
    setShowPreview(true);
  };

  const handlePrint = () => {
    if (!form.name || !form.certNo || !form.carNo) {
      onToast && onToast("성명, 자격증번호, 차량번호를 입력해 주세요.");
      return;
    }
    const entry = { ...form, id: Date.now(), printedAt: new Date().toLocaleString("ko-KR") };
    setHistory(h => [entry, ...h.slice(0, 19)]);
    setShowPreview(true);
    setTimeout(() => window.print(), 400);
    onToast && onToast(`${form.name} 님 자격증명 인쇄 요청 완료`);
  };

  const handleReset = () => {
    setForm(INITIAL);
    setShowPreview(false);
  };

  const loadHistory = (entry) => {
    setForm({ adminNo:entry.adminNo, name:entry.name, certNo:entry.certNo,
      year:entry.year, month:entry.month, day:entry.day, carNo:entry.carNo });
    setShowPreview(true);
  };

  return (
    <div style={{ display:"flex", gap:24, alignItems:"flex-start" }}>
      {/* 입력 폼 */}
      <div style={{ flex:"0 0 420px" }}>
        <Card>
          <div style={{ font:"var(--fw-demibold) 16px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:20,
            display:"flex", alignItems:"center", gap:8 }}>
            <Icon name="document" size={18} color="var(--brand)" />
            자격증명 정보 입력
          </div>

          <FieldRow label="관리번호">
            <InputBox value={form.adminNo} onChange={set("adminNo")} placeholder="예: 21-462" />
          </FieldRow>
          <FieldRow label="성명 *">
            <InputBox value={form.name} onChange={set("name")} placeholder="예: 홍길동" />
          </FieldRow>
          <FieldRow label="자격증번호 *">
            <InputBox value={form.certNo} onChange={set("certNo")} placeholder="예: 1-21-042414" />
          </FieldRow>
          <FieldRow label="발급연도">
            <InputBox value={form.year} onChange={set("year")} placeholder="예: 2026" />
          </FieldRow>
          <FieldRow label="발급월">
            <InputBox value={form.month} onChange={set("month")} placeholder="예: 06" />
          </FieldRow>
          <FieldRow label="발급일">
            <InputBox value={form.day} onChange={set("day")} placeholder="예: 17" />
          </FieldRow>
          <FieldRow label="차량번호 *">
            <InputBox value={form.carNo} onChange={set("carNo")} placeholder="예: 강원83배1166" />
          </FieldRow>

          <div style={{ display:"flex", gap:10, marginTop:20 }}>
            <button onClick={handlePreview}
              style={{ flex:1, height:42, borderRadius:"var(--radius-md)", border:"1px solid var(--brand)",
                background:"var(--white)", color:"var(--brand)", font:"var(--fw-demibold) 14px/1 var(--font-sans)", cursor:"pointer" }}>
              미리보기
            </button>
            <button onClick={handlePrint}
              style={{ flex:1, height:42, borderRadius:"var(--radius-md)", border:"none",
                background:"var(--brand)", color:"#fff", font:"var(--fw-demibold) 14px/1 var(--font-sans)", cursor:"pointer" }}>
              인쇄
            </button>
            <button onClick={handleReset}
              style={{ height:42, padding:"0 16px", borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)",
                background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)", cursor:"pointer" }}>
              초기화
            </button>
          </div>

          <div style={{ marginTop:16, padding:"10px 14px", background:"var(--grey-25)", borderRadius:"var(--radius-md)",
            font:"var(--body-xs)", color:"var(--text-tertiary)", lineHeight:1.6 }}>
            * 표시 항목은 필수입니다. 차량번호는 마지막 4자리 앞에 공백이 자동으로 삽입됩니다.
          </div>
        </Card>

        {/* 인쇄 이력 */}
        {history.length > 0 && (
          <Card style={{ marginTop:16 }}>
            <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-primary)", marginBottom:12 }}>
              최근 인쇄 이력
            </div>
            {history.map(h => (
              <div key={h.id} onClick={() => loadHistory(h)}
                style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--border-subtle)",
                  cursor:"pointer" }}>
                <div>
                  <span style={{ font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:"var(--text-primary)" }}>{h.name}</span>
                  <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginLeft:8 }}>{h.certNo}</span>
                </div>
                <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{h.printedAt}</span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* 미리보기 영역 */}
      <div style={{ flex:1 }}>
        {showPreview ? (
          <Card>
            <div style={{ font:"var(--fw-demibold) 14px/1.3 var(--font-sans)", color:"var(--text-secondary)", marginBottom:16 }}>
              미리보기 — 실제 인쇄 결과와 유사합니다
            </div>
            <CertPreview data={form} />
          </Card>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            height:400, border:"2px dashed var(--border-default)", borderRadius:"var(--radius-lg)",
            color:"var(--text-tertiary)", gap:12 }}>
            <Icon name="document" size={40} color="var(--border-default)" />
            <div style={{ font:"var(--body-md)", textAlign:"center", lineHeight:1.6 }}>
              왼쪽에서 정보를 입력하고<br/>미리보기 또는 인쇄 버튼을 눌러주세요.
            </div>
          </div>
        )}
      </div>

      {/* 인쇄 전용 스타일 */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #cert-preview { display: block !important; }
          #root { display: block !important; }
          #root > * { display: none !important; }
          #cert-preview {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

window.CertPrint = CertPrint;
