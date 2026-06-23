// 엑셀 업로드 — 실파일 선택/미리보기/반영 API 연결
// 샘플/목업 데이터 사용 금지. 업로드 종류는 전체면허자현황, 2026 미수금 2개만 허용.
function Upload({ onApply }) {
  const FILE_TYPES = [
    { key: 'license_status', label: '전체면허자현황', hint: '전체 면허자/회원 기본자료' },
    { key: 'misu_2026', label: '2026 미수금', hint: '2026년 미수금 원장' },
  ];

  const won = window.PMData?.won || ((n) => `${Number(n || 0).toLocaleString()}원`);
  const inputRef = React.useRef(null);
  const [fileType, setFileType] = React.useState(FILE_TYPES[1]);
  const [file, setFile] = React.useState(null);
  const [stage, setStage] = React.useState('select'); // select | preview | done
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [preview, setPreview] = React.useState(null);
  const [tab, setTab] = React.useState('전체');

  const allowed = ['xlsx', 'xls', 'xlsm', 'csv'];
  const boxStyle = {
    border: '1.5px dashed var(--border-default)',
    borderRadius: '18px',
    minHeight: '190px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--grey-25)',
    cursor: 'pointer',
    textAlign: 'center',
    padding: '28px',
  };

  function extOf(f) {
    return String(f?.name || '').split('.').pop().toLowerCase();
  }

  function validateFile(f) {
    if (!f) return '파일이 선택되지 않았습니다.';
    const ext = extOf(f);
    if (!allowed.includes(ext)) return `.xlsx / .xls / .xlsm / .csv 파일만 업로드할 수 있습니다. 현재 확장자: .${ext || '없음'}`;
    if (f.size > 20 * 1024 * 1024) return '파일 용량은 최대 20MB까지만 허용됩니다.';
    return '';
  }

  function normalizePreview(json) {
    const rows = Array.isArray(json?.rows) ? json.rows : Array.isArray(json?.preview_rows) ? json.preview_rows : [];
    const counts = json?.counts || {};
    const normalizedRows = rows.map((r, idx) => ({
      kind: r.kind || r.status || r.type || '검토',
      name: r.name || r.성명 || r.member_name || '',
      vehicleNo: r.vehicleNo || r.vehicle_no || r.차량번호 || '',
      region: r.region || r.sigun || r.지역 || '',
      item: r.item || r.chargeItem || r.부과항목 || '',
      amount: Number(r.amount ?? r.outstanding ?? r.totalArrears ?? r.미수금 ?? 0),
      note: r.note || r.message || r.error || r.검토내용 || '',
      _idx: idx + 1,
    }));
    const computed = normalizedRows.reduce((acc, r) => {
      acc[r.kind] = (acc[r.kind] || 0) + 1;
      return acc;
    }, { 전체: normalizedRows.length });
    return {
      filename: json?.filename || file?.name || '',
      sheet_count: json?.sheet_count || json?.sheets || '-',
      column_count: json?.column_count || json?.columns?.length || '-',
      rows: normalizedRows,
      counts: { ...computed, ...counts, 전체: counts.전체 || counts.total || normalizedRows.length },
      raw: json,
    };
  }

  function parseCsvLocally(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return { rows: [], counts: { 전체: 0 }, filename: file?.name || '' };
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const head = lines[0].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1, 101).map((line, idx) => {
      const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = Object.fromEntries(head.map((h, i) => [h, vals[i] || '']));
      return {
        kind: '검토',
        name: obj.성명 || obj.name || obj.이름 || '',
        vehicleNo: obj.차량번호 || obj.vehicleNo || obj.vehicle_no || '',
        region: obj.지역 || obj.sigun || '',
        item: obj.부과항목 || obj.item || '',
        amount: Number(String(obj.미수금 || obj.amount || obj.현재잔액 || 0).replace(/[^0-9.-]/g, '')) || 0,
        note: 'CSV 로컬 미리보기 · 실제 반영은 서버 API 필요',
        _idx: idx + 1,
      };
    });
    return { filename: file?.name || '', sheet_count: 1, column_count: head.length, rows, counts: { 전체: rows.length, 검토: rows.length } };
  }

  async function previewFile(f = file) {
    setError('');
    const msg = validateFile(f);
    if (msg) { setError(msg); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file_type', fileType.key);
      fd.append('file_type_label', fileType.label);
      fd.append('file', f);
      const res = await fetch('/api/import/preview', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`서버 미리보기 실패 (${res.status}) ${body.slice(0, 300)}`);
      }
      const json = await res.json();
      setPreview(normalizePreview(json));
      setStage('preview');
    } catch (e) {
      if (extOf(f) === 'csv') {
        const text = await f.text();
        setPreview(parseCsvLocally(text));
        setStage('preview');
      } else {
        setError(`${e.message || e}\n\n샘플 데이터로 넘어가지 않습니다. backend /api/import/preview 구현 또는 파싱 오류를 확인하세요.`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function commitFile() {
    setError('');
    const msg = validateFile(file);
    if (msg) { setError(msg); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file_type', fileType.key);
      fd.append('file_type_label', fileType.label);
      fd.append('file', file);
      const res = await fetch('/api/import/commit', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`서버 반영 실패 (${res.status}) ${body.slice(0, 300)}`);
      }
      const json = await res.json().catch(() => ({}));
      setPreview(p => ({ ...(p || {}), commit: json }));
      setStage('done');
      onApply && onApply();
    } catch (e) {
      setError(`${e.message || e}\n\n반영 실패: DB 저장 API와 컬럼 매칭을 확인해야 합니다.`);
    } finally {
      setLoading(false);
    }
  }

  function onFileSelected(f) {
    setError('');
    setFile(f || null);
    setPreview(null);
    const msg = validateFile(f);
    if (msg) setError(msg);
  }

  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelected(f);
  }

  const rows = preview?.rows || [];
  const tabs = ['전체', ...Array.from(new Set(rows.map(r => r.kind))).filter(Boolean)];
  const visible = tab === '전체' ? rows : rows.filter(r => r.kind === tab);

  if (stage === 'done') {
    return <div style={{display:'grid', gap:16}}>
      <div style={{background:'var(--white)', border:'1px solid var(--border-default)', borderRadius:18, padding:28, boxShadow:'var(--shadow-sm)'}}>
        <h2 style={{margin:'0 0 8px'}}>반영 요청 완료</h2>
        <p style={{margin:'0 0 18px', color:'var(--text-secondary)'}}>{fileType.label} · {file?.name}</p>
        <p style={{background:'var(--green-50)', color:'var(--green-500)', padding:14, borderRadius:12, margin:0}}>서버 반영 API가 성공 응답을 반환했습니다. 대시보드 숫자는 실제 DB 집계 기준으로 다시 확인하세요.</p>
        <div style={{marginTop:18, display:'flex', gap:8}}>
          <button className="btn secondary" onClick={() => { setStage('select'); setFile(null); setPreview(null); }}>새 파일 업로드</button>
        </div>
      </div>
    </div>;
  }

  return <div style={{display:'grid', gap:18, maxWidth:960, margin:'0 auto'}}>
    <section style={{background:'var(--white)', border:'1px solid var(--border-default)', borderRadius:18, padding:22, boxShadow:'var(--shadow-sm)'}}>
      <h3 style={{margin:'0 0 6px'}}>1. 업로드 파일 종류 선택</h3>
      <p style={{margin:'0 0 16px', color:'var(--text-secondary)'}}>업로드는 실무 기준상 아래 2종만 허용합니다. 기타 대장은 별도 메뉴에서 관리합니다.</p>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
        {FILE_TYPES.map(t => <button key={t.key} onClick={() => { setFileType(t); setPreview(null); setStage('select'); }} style={{padding:'16px', borderRadius:14, border:fileType.key===t.key?'1.5px solid var(--brand)':'1px solid var(--border-default)', background:fileType.key===t.key?'var(--brand-subtle)':'var(--white)', textAlign:'left', cursor:'pointer'}}>
          <b>{t.label}</b><br/><span style={{color:'var(--text-tertiary)', fontSize:12}}>{t.hint}</span>
        </button>)}
      </div>
    </section>

    <section style={{background:'var(--white)', border:'1px solid var(--border-default)', borderRadius:18, padding:22, boxShadow:'var(--shadow-sm)'}}>
      <h3 style={{margin:'0 0 12px'}}>2. 파일 업로드</h3>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" style={{display:'none'}} onChange={(e) => onFileSelected(e.target.files?.[0])}/>
      <div style={boxStyle} onClick={() => inputRef.current?.click()} onDragOver={(e)=>e.preventDefault()} onDrop={onDrop}>
        <div style={{fontSize:32, marginBottom:10}}>☁️</div>
        <b>{file ? file.name : `${fileType.label} 파일을 선택하거나 끌어다 놓기`}</b>
        <span style={{marginTop:8, color:'var(--text-tertiary)'}}>.xlsx · .xls · .xlsm · .csv / 최대 20MB</span>
      </div>
      <div style={{marginTop:14, display:'flex', gap:8, alignItems:'center'}}>
        <button className="btn primary" disabled={!file || loading} onClick={() => previewFile()}>{loading ? '처리 중…' : '미리보기 분석'}</button>
        {file && <button className="btn secondary" onClick={() => { setFile(null); setPreview(null); setError(''); }}>파일 지우기</button>}
      </div>
      <p style={{margin:'14px 0 0', background:'#FFF4DD', color:'#8A5B08', padding:12, borderRadius:12}}>업로드 즉시 기존 데이터가 삭제되지 않습니다. 미리보기 확인 후 “반영하기”를 눌러야 저장됩니다.</p>
      {error && <pre style={{whiteSpace:'pre-wrap', marginTop:12, background:'var(--red-50)', color:'var(--red-500)', padding:14, borderRadius:12, fontFamily:'inherit'}}>{error}</pre>}
    </section>

    {stage === 'preview' && preview && <section style={{background:'var(--white)', border:'1px solid var(--border-default)', borderRadius:18, padding:22, boxShadow:'var(--shadow-sm)'}}>
      <div style={{display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', marginBottom:14}}>
        <div>
          <h3 style={{margin:'0 0 6px'}}>3. 미리보기</h3>
          <p style={{margin:0, color:'var(--text-secondary)'}}>{preview.filename} · 시트 {preview.sheet_count}개 · 컬럼 {preview.column_count}개 · {rows.length}행</p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn secondary" onClick={() => setStage('select')}>취소</button>
          <button className="btn primary" disabled={loading} onClick={commitFile}>{loading ? '반영 중…' : '반영하기'}</button>
        </div>
      </div>
      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
        {tabs.map(t => <button key={t} onClick={()=>setTab(t)} style={{border:'1px solid var(--border-default)', background:tab===t?'var(--brand)':'var(--white)', color:tab===t?'white':'var(--text-primary)', borderRadius:999, padding:'8px 12px', cursor:'pointer'}}>{t} {t==='전체'?rows.length:(preview.counts?.[t]||0)}</button>)}
      </div>
      <div style={{overflow:'auto', border:'1px solid var(--border-default)', borderRadius:14}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
          <thead><tr style={{background:'var(--grey-25)'}}>{['구분','성명','차량번호','지역','부과항목','금액','검토내용'].map(h=><th key={h} style={{textAlign:'left', padding:12, borderBottom:'1px solid var(--border-default)'}}>{h}</th>)}</tr></thead>
          <tbody>{visible.map((r,i)=><tr key={i}>{[r.kind,r.name,r.vehicleNo,r.region,r.item,won(r.amount),r.note].map((v,j)=><td key={j} style={{padding:12, borderBottom:'1px solid var(--border-default)'}}>{v || '—'}</td>)}</tr>)}</tbody>
        </table>
        {!visible.length && <div style={{padding:24, textAlign:'center', color:'var(--text-tertiary)'}}>미리보기 행이 없습니다.</div>}
      </div>
    </section>}
  </div>;
}
window.Upload = Upload;
