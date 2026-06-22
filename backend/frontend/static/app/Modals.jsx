// 수납 처리 모달 + 회원 상세 패널 (Genspark 이식: 수납항목/회계구분, 오래된 달부터 차감, 월별 미수 상세, 수납내역)
const { Icon, Button, Avatar } = window.PayroleDesignSystem_9db006;

function Backdrop({ onClose, children, align="center" }){
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:100,
      background:"rgba(10,17,47,0.38)", display:"flex",
      justifyContent: align==="right"?"flex-end":"center", alignItems: align==="right"?"stretch":"center",
      backdropFilter:"blur(2px)", animation:"pmFade .15s ease" }}>
      {children}
    </div>
  );
}

const fieldLabel = { font:"var(--fw-medium) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", marginBottom:7, display:"block" };
const inputBase = {
  width:"100%", height:44, padding:"0 14px", boxSizing:"border-box",
  border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)",
  font:"var(--fw-medium) 15px/1 var(--font-sans)", color:"var(--text-primary)", outline:"none", background:"var(--white)",
};
const selectBase = { ...inputBase, appearance:"none", cursor:"pointer", paddingRight:34,
  backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 6 12' fill='%239096A2'><path d='M0 4l3 4 3-4'/></svg>\")",
  backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center" };

// ===== 수납 처리 모달 =====
function PayModal({ member, onClose, onConfirm }){
  const D = window.PMData;
  const { won } = D;
  const curBalance = D.outstanding(member);
  const [chargeItem, setChargeItem] = React.useState(member.chargeItem || "관리비");
  const [amount, setAmount] = React.useState(Math.max(curBalance, member.monthlyCharge||0));
  const [date, setDate] = React.useState("2026-06-20");
  const [method, setMethod] = React.useState("직접수납");

  const meta = D.incomeMeta(chargeItem);
  const deduct = D.isArrearsIncome(chargeItem);
  const amt = parseInt(amount)||0;

  // 미리보기: 오래된 달부터 차감
  const preview = React.useMemo(()=>{
    if (!deduct) return { rows:[], after:curBalance, overflow:0, months:0 };
    const opens = D.openItems(member);
    let remain = amt; const rows=[]; let months=0;
    for (const it of opens){ if(remain<=0) break; const pay=Math.min(remain,it.amount); rows.push({ ym:it.ym, amount:pay, full:pay>=it.amount }); remain-=pay; if(pay>=it.amount) months++; }
    return { rows, after: curBalance - (amt-remain), overflow: remain, months };
  }, [amt, chargeItem, member]);

  const after = deduct ? preview.after : curBalance;
  const nextStatus = after<0 ? "선납" : after===0 ? "완납" : "미납";

  return (
    <Backdrop onClose={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:480, background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden", animation:"pmPop .18s ease", maxHeight:"92vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ font:"var(--fw-bold) 18px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>수납 반영</div>
            <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:3 }}>{member.name} · {member.sigun} · {member.vehicleNo}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} /></button>
        </div>

        <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:18, overflow:"auto" }}>
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:1, padding:"12px 16px", background:"var(--red-50)", borderRadius:"var(--radius-md)" }}>
              <div style={{ font:"var(--body-xs)", color:"#A12D2D" }}>현재잔액</div>
              <div style={{ font:"var(--fw-bold) 18px/1 var(--font-sans)", color: curBalance>0?"var(--red-500)":curBalance<0?"var(--violet-500)":"var(--text-tertiary)", marginTop:4 }}>{won(curBalance)}</div>
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
              <span style={{ position:"absolute", right:14, top:0, height:44, display:"flex", alignItems:"center", color:"var(--text-tertiary)", font:"var(--fw-medium) 14px/1 var(--font-sans)" }}>원</span>
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
                {["계좌","현금","CMS","통장매칭","기타"].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* 차감 미리보기 */}
          {deduct && preview.rows.length>0 && (
            <div style={{ padding:"12px 14px", background:"var(--grey-25)", borderRadius:"var(--radius-md)", border:"1px dashed var(--border-default)" }}>
              <div style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", marginBottom:8 }}>오래된 달부터 차감 ({preview.months}개월 완납)</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {preview.rows.map(r=>(
                  <span key={r.ym} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"4px 9px", borderRadius:"var(--radius-pill)",
                    background: r.full?"var(--green-50)":"var(--amber-50)", color: r.full?"var(--green-500)":"#B9791A", font:"var(--fw-medium) 12px/1 var(--font-sans)", fontVariantNumeric:"tabular-nums" }}>
                    {r.ym} {won(r.amount)}{!r.full && " (일부)"}</span>
                ))}
              </div>
              {preview.overflow>0 && <div style={{ font:"var(--body-xs)", color:"var(--violet-500)", marginTop:8 }}>초과 {won(preview.overflow)} → 선납/초과입금으로 기록</div>}
            </div>
          )}

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", background: after<=0?"var(--green-50)":"var(--grey-25)", borderRadius:"var(--radius-md)" }}>
            <div>
              <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>처리 후 현재잔액</div>
              <div style={{ font:"var(--fw-bold) 18px/1.1 var(--font-sans)", color: after<0?"var(--violet-500)":after===0?"var(--green-500)":"var(--text-primary)", marginTop:2 }}>{won(after)}</div>
            </div>
            <window.PMUI.StatusPill status={nextStatus} />
          </div>
        </div>

        <div style={{ display:"flex", gap:10, padding:"16px 24px", borderTop:"1px solid var(--border-subtle)", flex:"none" }}>
          <Button variant="tertiary" size="medium" fullWidth onClick={onClose}>취소</Button>
          <Button variant="primary" size="medium" fullWidth leadingIcon="check"
            onClick={()=>{
              if(!confirm(`${member.name} 님 ${won(amt)} 수납을 반영할까요?\n반영 후 상태: ${nextStatus} / 잔액 ${won(after)}`)) return;
              onConfirm(member, { amount:amt, date, method, chargeItem, after, nextStatus });
            }}>반영</Button>
        </div>
      </div>
    </Backdrop>
  );
}

// ===== 회원 상세 패널 =====
function MemberDetail({ member, onClose, onPay, onClosure }){
  const D = window.PMData;
  const { won } = D;
  const open = D.balanceItems(member);
  const curBalance = D.outstanding(member);
  const [tab, setTab] = React.useState("미수");

  const Row = ({ label, value, strong })=>(
    <div style={{ display:"flex", justifyContent:"space-between", gap:16, padding:"9px 0" }}>
      <span style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", flex:"none" }}>{label}</span>
      <span style={{ font: strong?"var(--fw-demibold) 14px/1.4 var(--font-sans)":"var(--body-sm)", color:"var(--text-primary)", textAlign:"right" }}>{value||"—"}</span>
    </div>
  );
  const SectionTitle = ({ children })=>(
    <div style={{ font:"var(--fw-demibold) 12px/1 var(--font-sans)", color:"var(--text-tertiary)", letterSpacing:"0.03em", margin:"20px 0 4px" }}>{children}</div>
  );

  return (
    <Backdrop onClose={onClose} align="right">
      <div onClick={e=>e.stopPropagation()} style={{ width:460, background:"var(--white)", height:"100%", overflow:"auto", boxShadow:"var(--shadow-lg)", animation:"pmSlide .22s ease" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--border-subtle)", position:"sticky", top:0, background:"var(--white)", zIndex:2 }}>
          <div style={{ font:"var(--fw-bold) 17px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>회원 상세</div>
          <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} /></button>
        </div>

        <div style={{ padding:"24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:8 }}>
            <Avatar name={member.name} size="lg" />
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ font:"var(--fw-bold) 20px/1.2 var(--font-sans)", color:"var(--text-primary)" }}>{member.name}</span>
                {member.isSenior && <span style={{ font:"10px/1 var(--font-sans)", color:"var(--green-500)", fontWeight:700, padding:"2px 6px", background:"#EAF7F0", borderRadius:5 }}>70세</span>}
                <window.PMUI.MemberStatusChip status={member.status} />
              </div>
              <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)", marginTop:3 }}>{member.mgmtNo} · {member.sigun} · {member.membership}</div>
            </div>
          </div>

          {/* 원장미수 / 수납합계 / 현재잔액 */}
          <div style={{ display:"flex", gap:8, marginTop:16 }}>
            {[["원장미수",won(D.ledgerArrears(member)),"var(--text-primary)","var(--grey-25)"],
              ["수납합계",won(D.paidTotal(member)),"var(--green-500)","var(--green-50)"],
              ["현재잔액",won(curBalance), curBalance>0?"var(--red-500)":curBalance<0?"var(--violet-500)":"var(--text-tertiary)", curBalance>0?"var(--red-50)":"var(--grey-25)"]].map(([l,v,c,bg])=>(
              <div key={l} style={{ flex:1, padding:"12px 12px", borderRadius:"var(--radius-md)", background:bg, textAlign:"center" }}>
                <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{l}</div>
                <div style={{ font:"var(--fw-bold) 15px/1.1 var(--font-sans)", color:c, marginTop:4, fontVariantNumeric:"tabular-nums" }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ font:"var(--body-xs)", color:"var(--text-tertiary)", textAlign:"center", marginTop:8 }}>원장미수 − 수납합계 = 현재잔액 · 미수 {D.arrearsMonths(member)}개월</div>

          {/* 탭 */}
          <div style={{ display:"flex", gap:6, marginTop:18, borderBottom:"1px solid var(--border-subtle)" }}>
            {["미수","수납내역","정보"].map(t=>(
              <button key={t} type="button" onClick={()=>setTab(t)} style={{ border:"none", background:"none", cursor:"pointer", padding:"8px 12px",
                font:"var(--fw-demibold) 13px/1 var(--font-sans)", color: tab===t?"var(--brand)":"var(--text-tertiary)",
                borderBottom: tab===t?"2px solid var(--brand)":"2px solid transparent", marginBottom:-1 }}>{t}{t==="수납내역"&&` ${(member.payments||[]).length}`}</button>
            ))}
          </div>

          {tab==="미수" && (
            <div style={{ marginTop:14 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>
                  {["기준월","항목","금액","상태"].map((h,i)=><th key={h} style={{ textAlign:i===2?"right":"left", padding:"8px 6px", font:"var(--fw-demibold) 11px/1 var(--font-sans)", color:"var(--text-tertiary)", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {open.map((it)=>(
                    <tr key={it.ym} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                      <td style={{ padding:"10px 6px", font:"var(--body-sm)", color:"var(--text-primary)", fontVariantNumeric:"tabular-nums" }}>{it.ym}</td>
                      <td style={{ padding:"10px 6px", font:"var(--body-sm)", color:"var(--text-secondary)" }}>{it.item}</td>
                      <td style={{ padding:"10px 6px", textAlign:"right", font:"var(--fw-demibold) 13px/1 var(--font-sans)", color: it.amount<0?"var(--violet-500)":"var(--red-500)", fontVariantNumeric:"tabular-nums" }}>{won(it.amount)}</td>
                      <td style={{ padding:"10px 6px" }}><window.PMUI.StatusPill status={it.amount<0?"선납":"미납"} /></td>
                    </tr>
                  ))}
                  {open.length===0 && <tr><td colSpan={4} style={{ padding:"24px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>현재 미수금이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab==="수납내역" && (
            <div style={{ marginTop:14 }}>
              {(member.payments||[]).length ? (member.payments||[]).map((p)=>(
                <div key={p.id} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom:"1px solid var(--border-subtle)" }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--green-500)", marginTop:6, flex:"none" }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ font:"var(--fw-demibold) 13px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>{won(p.amount)} <span style={{ color:"var(--text-tertiary)", fontWeight:500 }}>· {p.chargeItem}</span></span>
                      <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>{p.paidDate}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                      <window.PMUI.AccountingTag accounting={p.accounting} />
                      <span style={{ font:"var(--body-xs)", color:"var(--text-tertiary)" }}>대상월 {p.paidForYm} · {p.method}</span>
                    </div>
                  </div>
                </div>
              )) : <div style={{ padding:"24px", textAlign:"center", color:"var(--text-tertiary)", font:"var(--body-sm)" }}>수납내역이 없습니다.</div>}
            </div>
          )}

          {tab==="정보" && (
            <div>
              <SectionTitle>기본 정보</SectionTitle>
              <Row label="차량번호" value={member.vehicleNo} strong />
              <Row label="구분" value={member.memberType} />
              <Row label="연락처" value={member.phone} />
              <Row label="주소" value={member.address} />
              <Row label="비고" value={member.note} />
              <SectionTitle>자격 · 부과</SectionTitle>
              <Row label="자격증명 발급일" value={member.certIssueDate || "미발급"} />
              <Row label="협회 가입일" value={member.assocJoinDate} />
              <Row label="계정 / 월부과금" value={`${member.chargeItem} / ${won(member.monthlyCharge)}`} strong />
              <Row label="70세 감면" value={member.isSenior?"예 (50% 감면)":"아니오"} />
              <Row label="결번 / 자격증명" value={`${member.disconnected?"결번":"정상"} / ${member.certMissing?"미발급":"발급"}`} />
              <Row label="최근 납부월" value={member.lastPaymentYm} />
            </div>
          )}
        </div>

        <div style={{ position:"sticky", bottom:0, padding:"14px 24px", borderTop:"1px solid var(--border-subtle)", background:"var(--white)", display:"flex", gap:10 }}>
          <Button variant="tertiary" size="medium" onClick={()=>onClosure(member)}>폐업/이탈</Button>
          <Button variant="primary" size="medium" fullWidth leadingIcon="dollar" onClick={()=>onPay(member)}>수납 반영</Button>
        </div>
      </div>
    </Backdrop>
  );
}

// ===== 폐업/이탈 등록 모달 =====
function ClosureModal({ member, onClose, onConfirm }){
  const D = window.PMData; const { won } = D;
  const [type, setType] = React.useState("폐업");
  const [docNo, setDocNo] = React.useState("");
  const [content, setContent] = React.useState("시청 접수 후 처리");
  const [notifyLater, setNotifyLater] = React.useState(D.outstanding(member)>0);
  return (
    <Backdrop onClose={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:440, background:"var(--white)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-lg)", overflow:"hidden", animation:"pmPop .18s ease" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid var(--border-subtle)" }}>
          <div style={{ font:"var(--fw-bold) 18px/1.3 var(--font-sans)", color:"var(--text-primary)" }}>폐업 / 이탈 등록</div>
          <button type="button" onClick={onClose} style={{ border:"none", background:"var(--grey-50)", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="close" size={16} style={{ color:"var(--text-secondary)" }} /></button>
        </div>
        <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ font:"var(--body-sm)", color:"var(--text-tertiary)" }}>{member.name} · {member.sigun} · {member.vehicleNo}</div>
          <div>
            <label style={fieldLabel}>처리사유</label>
            <div style={{ display:"flex", gap:6 }}>
              {["폐업","탈퇴","양도","이관"].map(t=>(
                <button key={t} type="button" onClick={()=>setType(t)} style={{ flex:1, height:42, borderRadius:"var(--radius-md)", cursor:"pointer",
                  border: type===t?"1.5px solid var(--brand)":"1px solid var(--border-default)", background: type===t?"var(--brand-subtle)":"var(--white)",
                  color: type===t?"var(--brand-active)":"var(--text-secondary)", font:"var(--fw-medium) 13px/1 var(--font-sans)" }}>{t}</button>
              ))}
            </div>
          </div>
          <div><label style={fieldLabel}>공문/접수번호</label><input value={docNo} onChange={e=>setDocNo(e.target.value)} placeholder="예: 접수2026-114" style={inputBase} /></div>
          <div><label style={fieldLabel}>내용</label><input value={content} onChange={e=>setContent(e.target.value)} style={inputBase} /></div>
          <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
            <input type="checkbox" checked={notifyLater} onChange={e=>setNotifyLater(e.target.checked)} style={{ width:18, height:18, accentColor:"var(--brand)" }} />
            <span style={{ font:"var(--body-sm)", color:"var(--text-secondary)" }}>미납잔액 추후 안내 대상</span>
          </label>
          <div style={{ padding:"12px 14px", background:"var(--amber-50)", borderRadius:"var(--radius-md)", display:"flex", gap:8 }}>
            <Icon name="secure" size={18} color="#B9791A" style={{ flex:"none" }} />
            <span style={{ font:"var(--body-sm)", color:"#946012" }}>현재 미수잔액 <b>{won(D.outstanding(member))}</b> 기준으로 폐업현황에 저장됩니다. 회원 데이터는 삭제하지 않고 상태만 변경합니다.</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, padding:"16px 24px", borderTop:"1px solid var(--border-subtle)" }}>
          <Button variant="tertiary" size="medium" fullWidth onClick={onClose}>취소</Button>
          <Button variant="primary" size="medium" fullWidth onClick={()=>onConfirm(member, { type, docNo, content, notifyLater })}>처리 저장</Button>
        </div>
      </div>
    </Backdrop>
  );
}

window.PayModal = PayModal;
window.MemberDetail = MemberDetail;
window.ClosureModal = ClosureModal;
