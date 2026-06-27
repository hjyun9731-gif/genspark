// 수납 처리 모달 + 회원 상세 패널 (넓은 드로어, 탭 구조, 수정 기능, API 연동)
const { Icon, Button, Avatar } = window.PayroleDesignSystem_9db006;

function Backdrop({ onClose, children, align="center" }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:100,
      background:"rgba(10,17,47,0.38)", display:"flex",
      justifyContent:align==="right"?"flex-end":"center", alignItems:align==="right"?"stretch":"center",
      backdropFilter:"blur(2px)", animation:"pmFade .15s ease" }}>
      {children}
    </div>
  );
}

const fieldLabel = { font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", marginBottom:7, display:"block" };
const inputBase = {
  width:"100%", height:40, padding:"0 12px", boxSizing:"border-box",
  border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)",
  font:"var(--fw-medium) 14px/1 var(--font-sans)", color:"var(--text-primary)", outline:"none", background:"var(--white)",
};
const selectBase = { ...inputBase, appearance:"none", cursor:"pointer", paddingRight:34,
  backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 6 12' fill='%239096A2'><path d='M0 4l3 4 3-4'/></svg>\")",
  backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center" };

// 메모에서 구조화 필드(주소:, 주민등록번호: 등)를 제거하고 순수 메모만 반환
function cleanMemo(raw) {
  if (!raw) return "";
  const STRUCTURED = /^(?:주소|공문\s*주소|주민등록번호|주민번호|핸드폰번호?|전화번호|자격증명\s*(?:발급\s*)?번호|자격번호)\s*[:：]/;
  return raw.split(/\s*\/\s*/).filter(p => !STRUCTURED.test(p.trim())).join(" / ").trim();
}
// 주민등록번호 앞 6자리만 표시
function maskResidentNo(v) {
  if (!v) return "—";
  return String(v).replace(/(\d{6})-\d{7}/, "$1-*******");
}
// 메모에서 대납자/관련인 이름 추출 (이체, 계좌적기 등 일반 토큰 제외)
function relatedName(memo) {
  if (!memo) return "";
  const clean = cleanMemo(memo);
  if (!clean) return "";
  const SKIP = /^(?:이체|계좌|계좌적기|지로\d*|자동이체|관리비|협회비|처리|미납|완납|납부|농협|입금|대납|정상)$/;
  const nameRe = /^[가-힣]([가-힣\s]*[가-힣])?$/;
  return clean.split(/[,/·:]+/).map(s => s.trim()).filter(p => {
    const stripped = p.replace(/\s+/g, "");
    return nameRe.test(p) && !SKIP.test(stripped) && stripped.length >= 2;
  }).map(n => n.trim()).join(", ");
}
window.cleanMemo = cleanMemo;
window.relatedName = relatedName;

// ===== 수납 처리 모달 =====
function PayModal({ member, onClose, onConfirm }) {
  const D = window.PMData;
  const { won } = D;
  const curBalance = D.outstanding(member);
  const [chargeItem, setChargeItem] = React.useState(member.chargeItem || "관리비");
  const [amount, setAmount] = React.useState(Math.max(curBalance, member.monthlyCharge||0));
  const [date, setDate] = React.useState("2026-06-24");
  const [method, setMethod] = React.useState("직접수납");

  const meta = D.incomeMeta(chargeItem);
  const deduct = D.isArrearsIncome(chargeItem);
  const amt = parseInt(amount)||0;

  const preview = React.useMemo(() => {
    if (!deduct) return { rows:[], after:curBalance, overflow:0, months:0 };
    const opens = D.openItems(member);
    let remain = amt; const rows=[]; let months=0;
    for (const it of opens) { if(remain<=0) break; const pay=Math.min(remain,it.amount); rows.push({ ym:it.ym, amount:pay, full:pay>=it.amount }); remain-=pay; if(pay>=it.amount) months++; }
    return { rows, after: curBalance-(amt-remain), overflow: remain, months };
  }, [amt, chargeItem, member]);

  const after = deduct ? preview.after : curBalance;
  const nextStatus = after<0?"선납":after===0?"완납":"미납";

  return (
    <Backdrop onClose={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:480, background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden", animation:"pmPop .18s ease", maxHeight:"92vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ font:"var(--fw-bold) 18px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>수납 반영</div>
            <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:3 }}>{member.name} · {member.sigun} · {member.vehicleNo}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} />
          </button>
        </div>

        <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:18, overflow:"auto" }}>
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:1, padding:"12px 16px", background:"var(--red-50)", borderRadius:"var(--radius-md)" }}>
              <div style={{ font:"var(--body-xs)", color:"#A12D2D" }}>현재잔액</div>
              <div style={{ font:"var(--fw-bold) 18px/1 var(--font-sans)", color:curBalance>0?"var(--red-500)":curBalance<0?"var(--violet-500)":"var(--text-tertiary)", marginTop:4 }}>{won(curBalance)}</div>
            </div>
            <div style={{ flex:1, padding:"12px 16px", background:"var(--grey-25)", borderRadius:"var(--radius-md)" }}>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>미수개월수</div>
              <div style={{ font:"var(--fw-bold) 18px/1 var(--font-sans)", color:"var(--text-primary)", marginTop:4 }}>{D.arrearsMonths(member)}개월</div>
            </div>
          </div>

          <div>
            <label style={fieldLabel}>수납항목 · 회계구분</label>
            <select value={chargeItem} onChange={e=>setChargeItem(e.target.value)} style={selectBase}>
              {D.INCOME_ITEMS.map(it=><option key={it.value} value={it.value}>{it.value} · {it.accounting}</option>)}
            </select>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
              <window.PMUI.AccountingTag accounting={meta.accounting} />
              {!deduct && <span style={{ font:"var(--body-xs)", color:"#B9791A" }}>※ 기록성 수납 — 현재잔액 차감 없음</span>}
            </div>
          </div>

          <div>
            <label style={fieldLabel}>수납액</label>
            <div style={{ position:"relative" }}>
              <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} style={{ ...inputBase, paddingRight:44, textAlign:"right", fontWeight:700, fontSize:17 }} />
              <span style={{ position:"absolute", right:14, top:0, height:40, display:"flex", alignItems:"center", color:"var(--text-tertiary)", font:"var(--fw-medium) 14px/1 var(--font-sans)" }}>원</span>
            </div>
            <div style={{ display:"flex", gap:6, marginTop:8 }}>
              {[["전액",Math.max(curBalance,0)],["월부과금",member.monthlyCharge],["3개월",member.monthlyCharge*3]].map(([l,v])=>(
                <button key={l} type="button" onClick={()=>setAmount(v)} style={{ flex:1, height:32, borderRadius:"var(--radius-sm)", border:"1px solid var(--border-default)", background:"var(--white)", cursor:"pointer", font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-secondary)" }}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={fieldLabel}>납부일</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputBase} />
            </div>
            <div style={{ flex:1 }}>
              <label style={fieldLabel}>납부방식</label>
              <select value={method} onChange={e=>setMethod(e.target.value)} style={selectBase}>
                {["직접수납","통장매칭","현금","CMS"].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {deduct && preview.rows.length > 0 && (
            <div style={{ padding:"12px 14px", background:"var(--grey-25)", borderRadius:"var(--radius-md)", border:"1px dashed var(--border-default)" }}>
              <div style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", marginBottom:8 }}>오래된 달부터 차감 ({preview.months}개월 완납)</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {preview.rows.map(r=>(
                  <span key={r.ym} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"4px 9px", borderRadius:"var(--radius-pill)",
                    background:r.full?"var(--green-50)":"var(--amber-50)", color:r.full?"var(--green-500)":"#B9791A", font:"var(--fw-medium) 12px/1 var(--font-sans)", fontVariantNumeric:"tabular-nums" }}>
                    {r.ym} {won(r.amount)}{!r.full&&" (일부)"}</span>
                ))}
              </div>
              {preview.overflow>0 && <div style={{ font:"var(--body-xs)", color:"var(--violet-500)", marginTop:8 }}>초과 {won(preview.overflow)} → 선납/초과입금으로 기록</div>}
            </div>
          )}

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", background:after<=0?"var(--green-50)":"var(--grey-25)", borderRadius:"var(--radius-md)" }}>
            <div>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>처리 후 현재잔액</div>
              <div style={{ font:"var(--fw-bold) 18px/1.1 var(--font-sans)", color:after<0?"var(--violet-500)":after===0?"var(--green-500)":"var(--text-primary)", marginTop:2 }}>{won(after)}</div>
            </div>
            <window.PMUI.StatusPill status={nextStatus} />
          </div>
        </div>

        <div style={{ display:"flex", gap:10, padding:"16px 24px", borderTop:"1px solid var(--border-subtle)", flex:"none" }}>
          <Button variant="tertiary" size="medium" fullWidth onClick={onClose}>취소</Button>
          <Button variant="primary" size="medium" fullWidth leadingIcon="check"
            onClick={()=>onConfirm(member, { amount:amt, date, method, chargeItem, after, nextStatus })}>반영</Button>
        </div>
      </div>
    </Backdrop>
  );
}

// ===== 회원 상세 패널 =====
const DETAIL_TABS = ["기본정보","미수원장","수납내역","처리이력"];

const SIGUN_LIST = ["춘천시","원주시","강릉시","동해시","태백시","속초시","삼척시","홍천군","횡성군","영월군","평창군","정선군","철원군","화천군","양구군","인제군","고성군","양양군"];

function MemberDetail({ member: initialMember, onClose, onPay, onClosure, onUpdate, onToast }) {
  const D = window.PMData;
  const { won } = D;
  const [tab, setTab] = React.useState("기본정보");
  const [member, setMember] = React.useState(initialMember);
  const [loading, setLoading] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [editForm, setEditForm] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(null);

  // 상세 데이터 API에서 로드
  React.useEffect(() => {
    if (!member?.id) return;
    setLoading(true);
    fetch(`/api/members/${member.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setMember(data); })
      .catch(() => {}) // 오프라인 시 initialMember 그대로 사용
      .finally(() => setLoading(false));
  }, [initialMember?.id]);

  const startEdit = () => {
    setEditForm({
      name: member.name || "",
      sigun: member.sigun || "",
      vehicle_no: member.vehicleNo || member.vehicle_no || "",
      mgmt_no: member.mgmtNo || member.mgmt_no || "",
      phone: member.phone || "",
      address: member.address || "",
      public_address: member.publicAddress || member.public_address || "",
      membership: member.membership || "",
      member_type: member.memberType || member.member_type || "",
      status: member.status || "",
      memo: member.memo || "",
    });
    setEditMode(true);
    setSaveError(null);
  };

  const cancelEdit = () => { setEditMode(false); setSaveError(null); };

  const saveEdit = async () => {
    setSaving(true); setSaveError(null);
    try {
      const body = {
        name: editForm.name,
        sigun: editForm.sigun,
        vehicle_no: editForm.vehicle_no,
        mgmt_no: editForm.mgmt_no,
        phone: editForm.phone,
        address: editForm.address,
        public_address: editForm.public_address,
        membership: editForm.membership,
        member_type: editForm.member_type,
        status: editForm.status,
        memo: editForm.memo,
      };
      const res = await fetch(`/api/members/${member.id}`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.detail || "저장 실패"); return; }
      setMember(json);
      onUpdate && onUpdate(json);
      onToast && onToast(`${json.name} 회원 정보가 저장되었습니다.`);
      setEditMode(false);
    } catch(e) { setSaveError("저장 중 오류: "+e.message); }
    finally { setSaving(false); }
  };

  const ef = (key) => (val) => setEditForm(f=>({...f,[key]:val}));

  const curBalance = D.outstanding(member);
  const open = D.openItems ? D.openItems(member) : (member.arrears||[]).filter(a=>!a.paid&&a.amount>0);
  const ledgerArrears = open.reduce((s,a)=>s+a.amount,0);
  const paidTotal = (member.payments||[]).reduce((s,p)=>s+p.amount,0);
  const arrearsMonths = open.length;

  const InfoRow = ({ label, value, strong, mono }) => (
    <div style={{ display:"flex", gap:12, padding:"9px 0", borderBottom:"1px solid var(--border-subtle)" }}>
      <span style={{ font:"var(--fw-medium) 12px/1.4 var(--font-sans)", color:"var(--text-tertiary)", minWidth:110, flex:"none" }}>{label}</span>
      <span style={{ font: strong?"var(--fw-demibold) 14px/1.4 var(--font-sans)":"var(--body-sm)", color:"var(--text-primary)", wordBreak:"break-all", fontVariantNumeric:mono?"tabular-nums":"normal" }}>{value||"—"}</span>
    </div>
  );

  const EditRow = ({ label, fieldKey, type="text", options }) => (
    <div style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:"1px solid var(--border-subtle)", alignItems:"center" }}>
      <span style={{ font:"var(--fw-medium) 12px/1.4 var(--font-sans)", color:"var(--text-tertiary)", minWidth:110, flex:"none" }}>{label}</span>
      <div style={{ flex:1 }}>
        {options ? (
          <select value={editForm[fieldKey]||""} onChange={e=>ef(fieldKey)(e.target.value)} style={{ ...selectBase, height:34, font:"13px/1 var(--font-sans)" }}>
            {options.map(o=><option key={o}>{o}</option>)}
          </select>
        ) : (
          <input type={type} value={editForm[fieldKey]||""} onChange={e=>ef(fieldKey)(e.target.value)}
            style={{ ...inputBase, height:34, font:"13px/1 var(--font-sans)" }} />
        )}
      </div>
    </div>
  );

  return (
    <Backdrop onClose={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"min(980px, calc(100vw - 48px))", maxHeight:"92vh", background:"var(--white)", borderRadius:"var(--radius-xl)", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)", animation:"pmPop .18s ease", overflow:"hidden" }}>
        {/* 헤더 */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", borderBottom:"1px solid var(--border-subtle)", background:"var(--white)", zIndex:2, flex:"none" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <Avatar name={member.name} size="md" />
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ font:"var(--fw-bold) 18px/1.2 var(--font-sans)", color:"var(--text-primary)" }}>{member.name}</span>
                {member.isSenior && <span style={{ font:"10px/1 var(--font-sans)", color:"var(--green-500)", fontWeight:700, padding:"2px 6px", background:"#EAF7F0", borderRadius:5 }}>70세</span>}
                <window.PMUI.MemberStatusChip status={member.status} />
              </div>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:2 }}>{member.mgmtNo||member.mgmt_no} · {member.sigun} · {member.vehicleNo||member.vehicle_no}</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {loading && <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>로딩중…</span>}
            {!editMode && <button onClick={startEdit} style={{ height:32, padding:"0 14px", borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)", cursor:"pointer" }}>수정</button>}
            <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} />
            </button>
          </div>
        </div>

        {/* 요약 카드 */}
        <div style={{ display:"flex", gap:8, padding:"14px 24px", borderBottom:"1px solid var(--border-subtle)", background:"var(--grey-25)", flex:"none" }}>
          {[
            ["원장미수", won(ledgerArrears), "var(--text-primary)","var(--white)"],
            ["수납합계", won(paidTotal), "var(--green-500)","#F0FBF5"],
            ["현재잔액", won(curBalance), curBalance>0?"var(--red-500)":curBalance<0?"var(--violet-500)":"var(--text-tertiary)", curBalance>0?"#FEF0F0":"var(--white)"],
            ["미수개월", arrearsMonths+"개월", "var(--text-primary)","var(--white)"],
          ].map(([l,v,c,bg])=>(
            <div key={l} style={{ flex:1, padding:"10px 12px", borderRadius:"var(--radius-md)", background:bg, border:"1px solid var(--border-subtle)", textAlign:"center" }}>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div>
              <div style={{ font:"var(--fw-bold) 14px/1.1 var(--font-sans)", color:c, marginTop:3, fontVariantNumeric:"tabular-nums" }}>{v}</div>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div style={{ display:"flex", gap:0, padding:"0 24px", borderBottom:"1px solid var(--border-subtle)", flex:"none" }}>
          {DETAIL_TABS.map(t=>(
            <button key={t} type="button" onClick={()=>setTab(t)} style={{
              border:"none", background:"none", cursor:"pointer", padding:"12px 14px", whiteSpace:"nowrap",
              font:"var(--fw-demibold) 13px/1 var(--font-sans)", color:tab===t?"var(--brand)":"var(--text-tertiary)",
              borderBottom:tab===t?"2px solid var(--brand)":"2px solid transparent", marginBottom:-1,
            }}>{t}</button>
          ))}
        </div>

        {/* 탭 내용 — 스크롤 */}
        <div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>
          {/* ── 기본정보 탭 ── */}
          {tab==="기본정보" && (
            <div>
              {saveError && (
                <div style={{ padding:"10px 14px", background:"var(--red-50)", border:"1px solid var(--red-200)", borderRadius:"var(--radius-md)", font:"var(--body-sm)", color:"var(--red-600)", marginBottom:16 }}>
                  {saveError}
                </div>
              )}
              {editMode ? (
                <>
                  <SectionLabel>기본 정보 수정</SectionLabel>
                  <EditRow label="성명 *" fieldKey="name" />
                  <EditRow label="지역" fieldKey="sigun" options={["", ...SIGUN_LIST]} />
                  <EditRow label="차량번호" fieldKey="vehicle_no" />
                  <EditRow label="관리번호" fieldKey="mgmt_no" />
                  <EditRow label="핸드폰번호" fieldKey="phone" />
                  <EditRow label="주소" fieldKey="address" />
                  <EditRow label="공문주소" fieldKey="public_address" />
                  <EditRow label="가입상태" fieldKey="status" options={["정상","폐업","양도","이관","탈퇴"]} />
                  <EditRow label="회원구분" fieldKey="member_type" options={["개인","택배","대리"]} />
                  <EditRow label="가입여부" fieldKey="membership" options={["협회가입","협회미가입"]} />
                  <div style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:"1px solid var(--border-subtle)", alignItems:"flex-start" }}>
                    <span style={{ font:"var(--fw-medium) 12px/1.4 var(--font-sans)", color:"var(--text-tertiary)", minWidth:110, flex:"none", paddingTop:8 }}>비고</span>
                    <textarea value={editForm.memo||""} onChange={e=>ef("memo")(e.target.value)} rows={3}
                      style={{ flex:1, padding:"8px 12px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"13px/1.5 var(--font-sans)", color:"var(--text-primary)", resize:"vertical", boxSizing:"border-box" }} />
                  </div>
                  <div style={{ display:"flex", gap:10, marginTop:20 }}>
                    <button onClick={cancelEdit} style={{ flex:1, height:38, borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 14px/1 var(--font-sans)", cursor:"pointer" }}>취소</button>
                    <button onClick={saveEdit} disabled={saving} style={{ flex:2, height:38, borderRadius:"var(--radius-md)", border:"none", background:"var(--brand)", color:"#fff", font:"var(--fw-demibold) 14px/1 var(--font-sans)", cursor:saving?"wait":"pointer" }}>
                      {saving?"저장 중…":"저장"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <SectionLabel>회원 기본정보</SectionLabel>
                  <InfoRow label="성명" value={member.name} strong />
                  <InfoRow label="지역" value={member.sigun} />
                  <InfoRow label="차량번호" value={member.vehicleNo||member.vehicle_no} strong mono />
                  <InfoRow label="관리번호" value={member.mgmtNo||member.mgmt_no} mono />
                  <InfoRow label="회원구분" value={member.memberType||member.member_type} />
                  <InfoRow label="가입상태" value={member.membership} />
                  <InfoRow label="회원상태" value={member.status} />
                  <SectionLabel style={{ marginTop:20 }}>연락처 · 주소</SectionLabel>
                  <InfoRow label="핸드폰번호" value={member.phone} />
                  <InfoRow label="주소" value={member.address||member.addr||member.homeAddress||member.home_address} />
                  <InfoRow label="공문주소" value={member.publicAddress||member.public_address||member.officialAddress||member.official_address} />
                  <InfoRow label="주민등록번호" value={maskResidentNo(member.residentNo||member.resident_no)} />
                  <InfoRow label="자격증명 발급번호" value={member.certIssueNo||member.cert_issue_no} />
                  <SectionLabel style={{ marginTop:20 }}>자격 · 부과</SectionLabel>
                  <InfoRow label="자격증명 발급일" value={member.certIssueDate||member.cert_issue_date||"미발급"} />
                  <InfoRow label="협회 가입일" value={member.assocJoinDate||member.assoc_join_date} />
                  <InfoRow label="부과시작월" value={member.billingStartYm||member.billing_start_ym} />
                  <InfoRow label="부과항목" value={member.chargeItem||member.charge_item} />
                  <InfoRow label="월부과금" value={won(member.monthlyCharge||member.monthly_charge||0)} />
                  <InfoRow label="70세 감면" value={member.isSenior?"예 (50% 감면)":"아니오"} />
                  <InfoRow label="최근 납부월" value={member.lastPaymentYm||member.last_payment_ym} />
                  <SectionLabel style={{ marginTop:20 }}>메모</SectionLabel>
                  <div style={{ padding:"10px 14px", background:"var(--grey-25)", borderRadius:"var(--radius-md)", font:"var(--body-sm)", color:"var(--text-secondary)", lineHeight:1.7, whiteSpace:"pre-wrap", minHeight:48 }}>
                    {cleanMemo(member.memo) || "—"}
                  </div>
                  {relatedName(member.memo) && (
                    <InfoRow label="관련명" value={relatedName(member.memo)} />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── 미수원장 탭 ── */}
          {tab==="미수원장" && (
            <div>
              {/* 요약 */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
                {[
                  ["총 원장미수", won(ledgerArrears), curBalance>0?"var(--red-500)":"var(--text-primary)"],
                  ["수납합계", won(paidTotal), "var(--green-500)"],
                  ["현재잔액", won(curBalance), curBalance>0?"var(--red-500)":curBalance<0?"var(--violet-500)":"var(--green-500)"],
                  ["미수개월", arrearsMonths+"개월", "var(--text-primary)"],
                ].map(([l,v,c])=>(
                  <div key={l} style={{ padding:"12px 16px", borderRadius:"var(--radius-md)", border:"1px solid var(--border-subtle)", background:"var(--white)" }}>
                    <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div>
                    <div style={{ font:"var(--fw-bold) 18px/1.1 var(--font-sans)", color:c, marginTop:4, fontVariantNumeric:"tabular-nums" }}>{v}</div>
                  </div>
                ))}
              </div>

              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>
                  {["기준월","항목","부과금액","상태"].map((h,i)=>(
                    <th key={h} style={{ textAlign:i===2?"right":"left", padding:"9px 10px", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", borderBottom:"1px solid var(--border-default)", background:"var(--grey-25)" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(member.arrears||[]).map((it,i)=>(
                    <tr key={it.id||i} style={{ borderBottom:"1px solid var(--border-subtle)", background: it.paid||it.is_paid?"var(--grey-25)":"" }}>
                      <td style={{ padding:"10px", font:"var(--body-sm)", fontVariantNumeric:"tabular-nums", color:"var(--text-primary)" }}>{it.ym}</td>
                      <td style={{ padding:"10px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{it.charge_item||it.item}</td>
                      <td style={{ padding:"10px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color: (it.paid||it.is_paid)?"var(--text-tertiary)":it.amount<0?"var(--violet-500)":"var(--red-500)", fontVariantNumeric:"tabular-nums" }}>{won(it.amount)}</td>
                      <td style={{ padding:"10px" }}><window.PMUI.StatusPill status={(it.paid||it.is_paid)?"완납":it.amount<0?"선납":"미납"} /></td>
                    </tr>
                  ))}
                  {!(member.arrears||[]).length && <tr><td colSpan={4} style={{ padding:"30px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>미수 내역이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 수납내역 탭 ── */}
          {tab==="수납내역" && (
            <div>
              {(member.payments||[]).length === 0 && (
                <div style={{ padding:"40px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>수납내역이 없습니다.</div>
              )}
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>
                  {["입금일","항목","납부방식","입금액"].map((h,i)=>(
                    <th key={h} style={{ textAlign:i===3?"right":"left", padding:"9px 10px", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", borderBottom:"1px solid var(--border-default)", background:"var(--grey-25)" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(member.payments||[]).map((p,i)=>(
                    <tr key={p.id||i} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                      <td style={{ padding:"10px", font:"var(--body-sm)", color:"var(--text-secondary)", fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{p.paidDate||p.paid_date}</td>
                      <td style={{ padding:"10px" }}>
                        <div style={{ font:"var(--fw-medium) 13px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{p.chargeItem||p.charge_item}</div>
                        <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>대상월 {p.paidForYm||p.paid_for_ym}</div>
                      </td>
                      <td style={{ padding:"10px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{p.method}</td>
                      <td style={{ padding:"10px", textAlign:"right", font:"var(--fw-bold) 14px/1 var(--font-sans)", color:"var(--green-500)", fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>+{won(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(member.payments||[]).length > 0 && (
                <div style={{ display:"flex", justifyContent:"flex-end", padding:"12px 10px", borderTop:"1px solid var(--border-subtle)", font:"var(--fw-demibold) 14px/1 var(--font-sans)", color:"var(--green-500)" }}>
                  합계 {won(paidTotal)}
                </div>
              )}
            </div>
          )}

          {/* ── 처리이력 탭 ── */}
          {tab==="처리이력" && (
            <div>
              <HistoryTab memberId={member.id} />
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{ flex:"none", padding:"14px 24px", borderTop:"1px solid var(--border-subtle)", background:"var(--white)", display:"flex", gap:10 }}>
          <button onClick={()=>onClosure(member)} style={{ height:38, minWidth:104, flex:"0 0 auto", padding:"0 16px", borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)", background:"var(--white)", color:"var(--text-secondary)", font:"var(--fw-medium) 14px/1 var(--font-sans)", cursor:"pointer", whiteSpace:"nowrap" }}>폐업·이탈</button>
          <Button variant="primary" size="medium" fullWidth leadingIcon="dollar" onClick={()=>onPay(member)}>수납 반영</Button>
        </div>
      </div>
    </Backdrop>
  );
}

function SectionLabel({ children, style }) {
  return <div style={{ font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:4, marginTop:16, ...style }}>{children}</div>;
}

function HistoryTab({ memberId }) {
  const [history, setHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    fetch(`/api/members/${memberId}/history`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [memberId]);

  if (loading) return <div style={{ padding:"30px", textAlign:"center", color:"var(--text-tertiary)" }}>로딩중…</div>;
  if (!history.length) return <div style={{ padding:"30px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>처리이력이 없습니다.</div>;

  return (
    <div>
      {history.map((h,i) => (
        <div key={h.id||i} style={{ display:"flex", gap:12, padding:"10px 0", borderBottom:"1px solid var(--border-subtle)" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--brand)", marginTop:6, flex:"none" }} />
          <div style={{ flex:1 }}>
            <div style={{ font:"var(--body-sm)", color:"var(--text-primary)", lineHeight:1.5 }}>{h.content}</div>
            <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", marginTop:3 }}>
              {h.actor && `${h.actor} · `}{h.created_at ? new Date(h.created_at).toLocaleString("ko-KR") : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== 폐업·이탈 등록 모달 =====
function ClosureModal({ member, onClose, onConfirm }) {
  const D = window.PMData;
  const { won } = D;
  const [type, setType] = React.useState("폐업");
  const [processDate, setProcessDate] = React.useState("2026-06-24");
  const [docNo, setDocNo] = React.useState("");
  const [content, setContent] = React.useState("");
  const [notifyLater, setNotifyLater] = React.useState(D.outstanding(member)>0);
  const balance = D.outstanding(member);

  return (
    <Backdrop onClose={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:460, background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden", animation:"pmPop .18s ease" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--border-subtle)" }}>
          <div style={{ font:"var(--fw-bold) 18px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>폐업 / 이탈 등록</div>
          <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} />
          </button>
        </div>
        <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{member.name} · {member.sigun} · {member.vehicleNo}</div>

          <div>
            <label style={fieldLabel}>처리구분 *</label>
            <div style={{ display:"flex", gap:6 }}>
              {["폐업","탈퇴","양도","이관"].map(t=>(
                <button key={t} type="button" onClick={()=>setType(t)} style={{ flex:1, height:42, borderRadius:"var(--radius-md)", cursor:"pointer",
                  border:type===t?"1.5px solid var(--brand)":"1px solid var(--border-default)",
                  background:type===t?"var(--brand-subtle)":"var(--white)",
                  color:type===t?"var(--brand-active)":"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)" }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={fieldLabel}>처리일 *</label>
              <input type="date" value={processDate} onChange={e=>setProcessDate(e.target.value)} style={inputBase} />
            </div>
            <div style={{ flex:1 }}>
              <label style={fieldLabel}>공문/접수번호</label>
              <input value={docNo} onChange={e=>setDocNo(e.target.value)} placeholder={type==="폐업"?"예: 폐-26":type==="양도"?"예: 양-18":type==="이관"?"예: 이-8":"예: 탈-3"} style={inputBase} />
            </div>
          </div>

          <div>
            <label style={fieldLabel}>메모 (선택)</label>
            <textarea value={content} onChange={e=>setContent(e.target.value)} rows={2} placeholder="필수 아님. 필요할 때만 입력"
              style={{ width:"100%", padding:"10px 12px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", font:"var(--body-sm)", color:"var(--text-primary)", resize:"vertical", boxSizing:"border-box" }} />
          </div>

          {balance > 0 && (
            <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
              <input type="checkbox" checked={notifyLater} onChange={e=>setNotifyLater(e.target.checked)} style={{ width:18, height:18, accentColor:"var(--brand)" }} />
              <span style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>미납잔액 <b style={{ color:"var(--red-500)" }}>{won(balance)}</b> — 추심대상으로 자동 이동</span>
            </label>
          )}

          <div style={{ padding:"12px 14px", background:"var(--amber-50)", borderRadius:"var(--radius-md)", display:"flex", gap:8 }}>
            <Icon name="secure" size={18} color="#B9791A" style={{ flex:"none" }} />
            <span style={{ font:"var(--body-sm)", color:"#946012" }}>회원 데이터는 삭제하지 않고 상태만 변경합니다. 처리이력이 남습니다.</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, padding:"16px 24px", borderTop:"1px solid var(--border-subtle)" }}>
          <Button variant="tertiary" size="medium" fullWidth onClick={onClose}>취소</Button>
          <Button variant="primary" size="medium" fullWidth onClick={()=>onConfirm(member, { type, processDate, docNo, content, notifyLater })}>처리 저장</Button>
        </div>
      </div>
    </Backdrop>
  );
}

window.PayModal = PayModal;
window.MemberDetail = MemberDetail;
window.ClosureModal = ClosureModal;
