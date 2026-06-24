// 강원도개인소형화물협회 — 미수금 관리 데이터 + 계산 로직
// Genspark 기능 이식: 월별 미수항목(receivable_items) 구조 → 미수개월수·원장미수·수납합계·현재잔액 파생,
// 오래된 달부터 차감하는 수납 반영, 수납항목/회계구분, 통장입금 매칭, 폐업현황.

const REGIONS = [
  "춘천시","원주시","강릉시","동해시","태백시","속초시","삼척시",
  "홍천군","횡성군","영월군","평창군","정선군","철원군","화천군",
  "양구군","인제군","고성군","양양군",
];
const REGION_CODE = {
  "춘천시":"80","원주시":"82","강릉시":"81","동해시":"83","태백시":"84",
  "속초시":"85","삼척시":"86","홍천군":"87","횡성군":"88","영월군":"89",
  "평창군":"90","정선군":"91","철원군":"92","화천군":"93",
  "양구군":"94","인제군":"95","고성군":"96","양양군":"97",
};
const SURNAMES = ["김","이","박","최","정","강","조","윤","장","임","한","오","서","신","권","황","안","송","전","홍","유","고","문","양","손","배","백","허","남","심"];
const GIVEN = ["영수","정호","상철","민수","대현","병호","성민","재석","권택","석규","태웅","종길","현우","경수","동훈","기영","상우","해철","두식","판석","춘배","만수","길동","복남","정자","순옥","말순","점례","영자","미경","숙자","연자","화숙","근태","갑수","칠성","덕배","상규","병철","용대"];
const VEHICLE_KIND = { "개인":"바", "택배":"배" };
const NOTES_POOL = ["", "", "", "", "자동이체", "지로", "신평", "주신평", "결번", "주소불명", "공문발송"];

// 부과 기준
const FEE_ASSOC = 10000;  // 협회비(협회가입)
const FEE_MGMT  = 5000;   // 관리비(협회미가입)
const FEE_SENIOR= 5000;   // 70세 협회비 50% 감면
const BASE_YM   = "2026-06";

// 수납항목 / 회계구분
const INCOME_ITEMS = [
  { value:"협회비",        accounting:"회비수입", tone:"협회비" },
  { value:"관리비",        accounting:"회비수입", tone:"관리비" },
  { value:"협회가입비",    accounting:"가수금",   tone:"가입비" },
  { value:"자격증명발급비",accounting:"잡수입",   tone:"발급비" },
  { value:"기타",          accounting:"기타수입", tone:"기타" },
];
const incomeMeta = (item) => INCOME_ITEMS.find(x=>x.value===item) || { value:item||"-", accounting:"회비수입", tone:"협회비" };
const accountingOf = (item) => incomeMeta(item).accounting;
const isArrearsIncome = (item) => !["협회가입비","자격증명발급비","기타","선납/초과입금"].includes(item||"");

// --- 결정적 난수 ---
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rng = mulberry32(20260620);
const pick = (arr) => arr[Math.floor(rng()*arr.length)];
const ri = (min,max) => Math.floor(rng()*(max-min+1))+min;
const pad = (n) => String(n).padStart(2,"0");
const prevYm = (ym) => { let [y,m]=ym.split("-").map(Number); m--; if(m===0){y--;m=12;} return `${y}-${pad(m)}`; };
const ymLabel = (ym) => ym && ym!=="-" ? ym.slice(2).replace("-",".") : "-";

const STREETS = {
  "춘천시":["석사동","후평동","퇴계동","효자동","우두동"],
  "강릉시":["교동","포남동","입암동","주문진읍","옥계면"],
  "원주시":["단계동","우산동","무실동","지정면","문막읍"],
  "홍천군":["홍천읍","남면","서면","화촌면","내촌면"],
  "횡성군":["횡성읍","우천면","공근면","둔내면","청일면"],
  "영월군":["영월읍","주천면","상동읍","북면","남면"],
  "평창군":["평창읍","대화면","봉평면","진부면","대관령면"],
  "정선군":["정선읍","고한읍","사북읍","신동읍","남면"],
  "철원군":["철원읍","갈말읍","동송읍","김화읍","서면"],
  "화천군":["화천읍","간동면","하남면","상서면","사내면"],
  "양구군":["양구읍","방산면","해안면","남면","동면"],
  "인제군":["인제읍","북면","기린면","서화면","상남면"],
  "고성군":["간성읍","거진읍","현내면","토성면","죽왕면"],
  "양양군":["양양읍","손양면","현남면","현북면","강현면"],
};

let _pid = 1;
const nextPid = () => `P${String(_pid++).padStart(5,"0")}`;

// 월별 미수항목 생성 (오래된→최신)
function makeArrears(months, monthly, item){
  const out=[]; let ym=BASE_YM;
  for(let i=0;i<months;i++){ out.unshift({ ym, label:`현재잔액(${ym})`, item, amount:monthly, paid:false }); ym=prevYm(ym); }
  return out;
}

function buildMember(i){
  const sigun = pick(REGIONS);
  const name = pick(SURNAMES) + pick(GIVEN);
  const memberType = (()=>{ const r=rng(); return r<0.72?"개인":"택배"; })();

  const statusRoll = rng();
  const status = statusRoll<0.85 ? "정상"
    : statusRoll<0.90 ? "폐업"
    : statusRoll<0.94 ? "양도"
    : statusRoll<0.97 ? "이관" : "탈퇴";

  const age = ri(38, 81);
  const isSenior = age >= 70;

  const mRoll = rng();
  const membership = mRoll < 0.66 ? "협회가입" : "협회미가입";

  // 부과항목 & 월 부과금
  let chargeItem, monthly;
  if (membership === "협회가입") { chargeItem = "협회비"; monthly = isSenior ? FEE_SENIOR : FEE_ASSOC; }
  else { chargeItem = "관리비"; monthly = FEE_MGMT; }

  // 자격증명
  const certIssued = rng() > 0.12;
  const certY = ri(2018, 2025);
  const certIssueDate = certIssued ? `${certY}-${pad(ri(1,12))}-${pad(ri(1,28))}` : "";
  const assocJoinDate = membership==="협회가입" ? `${ri(2016,2024)}-${pad(ri(1,12))}-${pad(ri(1,28))}` : "";
  const mgmtNo = `${REGION_CODE[sigun]}-${String(ri(1,9999)).padStart(4,"0")}`;

  const note = pick(NOTES_POOL);
  const autoPay = note === "자동이체";
  const disconnected = note === "결번";
  const certMissing = !certIssued;

  // 미수/수납 시나리오
  const arrears = [];
  const payments = [];
  const mkPay = (ym, amount, method, item, paidDate, memo) => ({
    id: nextPid(), paidForYm:ym, chargeItem:item, accounting:accountingOf(item),
    amount, method, paidDate, memo: memo || (method+" 반영"),
  });

  let lastPaymentYm = null;

  if (status !== "정상") {
    // 제외 대상 — 과거 미수가 남은 경우만
    if (rng() < 0.45) { const months=ri(1,8); arrears.push(...makeArrears(months, monthly, chargeItem)); }
  } else if (autoPay) {
    // 자동이체: 완납 + 최근 수납 기록
    lastPaymentYm = BASE_YM;
    payments.push(mkPay(BASE_YM, monthly, "CMS", chargeItem, "2026-06-05", "자동이체"));
  } else {
    const r = rng();
    if (r < 0.42) {
      // 미납 (일부 회원은 과거 일부 수납 → 수납합계 표시)
      const months = ri(1, 30);
      arrears.push(...makeArrears(months, monthly, chargeItem));
      if (rng() < 0.45) { // 과거 일부 수납 이력
        const paid = ri(1, 4);
        let ym = prevYm(arrears[0].ym);
        for (let k=0;k<paid;k++){ payments.push(mkPay(ym, monthly, pick(["통장매칭","현금"]), chargeItem, `2025-${pad(ri(6,12))}-${pad(ri(1,28))}`)); ym=prevYm(ym); }
        lastPaymentYm = arrears[0].ym;
      }
    } else if (r < 0.62) {
      // 완납 (수납 이력 있음, 현재잔액 0)
      const months = ri(2, 6);
      let ym = BASE_YM;
      for (let k=0;k<months;k++){ payments.push(mkPay(ym, monthly, pick(["통장매칭","현금","CMS"]), chargeItem, `2026-${pad(ri(1,6))}-${pad(ri(1,28))}`)); ym=prevYm(ym); }
      lastPaymentYm = BASE_YM;
    } else if (r < 0.80) {
      // 0원 (부과대상 외 / 면제) — 항목/수납 없음
    } else {
      // 선납 / 초과입금 (음수 잔액)
      const k = ri(1, 6);
      arrears.push({ ym:BASE_YM, label:"선납/초과", item:"선납/초과입금", amount:-monthly*k, paid:false });
      payments.push(mkPay(BASE_YM, monthly*k, "통장매칭", chargeItem, "2026-06-12", "선납"));
      lastPaymentYm = BASE_YM;
    }
  }

  // 가끔 협회가입비/자격증명발급비 기록성 수납
  if (status==="정상" && rng() < 0.12) {
    const item = pick(["협회가입비","자격증명발급비"]);
    payments.push(mkPay(BASE_YM, item==="협회가입비"?20000:10000, "통장매칭", item, "2026-05-"+pad(ri(1,28)), item));
  }

  const phone = rng() < 0.06 ? "" : `010-${ri(2000,9999)}-${ri(1000,9999)}`;
  const street = pick(STREETS[sigun]);
  const address = `강원특별자치도 ${sigun} ${street} ${ri(1,499)}-${ri(1,40)}`;
  const vehicleNo = `강원 ${REGION_CODE[sigun]}${VEHICLE_KIND[memberType]} ${String(ri(1000,9999))}`;
  const bizNo = membership==="협회가입" && rng()<0.4 ? `${ri(100,999)}-${ri(10,99)}-${ri(10000,99999)}` : "";

  return {
    id: `GW-${String(i+1).padStart(3,"0")}`,
    mgmtNo, name, vehicleNo, phone, sigun, regionRaw:`${sigun} ${street}`,
    memberType, membership, age, isSenior,
    certIssueDate, assocJoinDate, billingStartYm: BASE_YM,
    chargeItem, monthlyCharge: monthly, lastPaymentYm,
    status, disconnected, certMissing,
    address, pubAddress: address, bizNo, note,
    arrears, payments,
  };
}

const MEMBERS = Array.from({length: 52}, (_,i)=>buildMember(i));

// ===== 계산 헬퍼 (모든 화면 공유) =====
function openItems(m){ return (m.arrears||[]).filter(a=>!a.paid && a.amount>0).sort((a,b)=>a.ym.localeCompare(b.ym)); }
function balanceItems(m){ return (m.arrears||[]).filter(a=>!a.paid && a.amount!==0).sort((a,b)=>a.ym.localeCompare(b.ym)); }
// API에서 오는 totalArrears/arrears_amount를 우선 사용하고, 없으면 arrears 배열에서 계산
function outstanding(m){
  if (m.totalArrears !== undefined && m.totalArrears !== null) return m.totalArrears;
  if (m.arrears_amount !== undefined && m.arrears_amount !== null) return m.arrears_amount;
  return balanceItems(m).reduce((s,a)=>s+a.amount,0);
}
// API에서 오는 arrearsMonths를 우선 사용 (DB에서 미납 건수를 정확히 셈)
function arrearsMonths(m){
  if (m.arrearsMonths !== undefined && m.arrearsMonths !== null) return m.arrearsMonths;
  if (m.arrears_months !== undefined && m.arrears_months !== null) return m.arrears_months;
  const amt = outstanding(m);
  if (amt <= 0) return 0;
  const f = m.monthlyCharge||m.monthly_charge||0;
  return f>0 ? Math.max(1, Math.ceil(amt/f)) : (openItems(m).length||1);
}
function paidTotal(m){ return (m.payments||[]).filter(p=>isArrearsIncome(p.chargeItem||p.charge_item)).reduce((s,p)=>s+p.amount,0); }
function ledgerArrears(m){ return outstanding(m) + paidTotal(m); }                 // 원장미수
function basisYm(m){ const o=openItems(m); return o.length ? o[o.length-1].ym : (m.billingStartYm||"-"); }
function billingBasisDate(m){ const raw = m.chargeItem==="협회비" ? m.assocJoinDate : m.certIssueDate; return raw || "-"; }
function payStatus(m){ const o=outstanding(m); return o<0 ? "선납" : o===0 ? "완납" : "미납"; }

// 차량번호 정규화 + 뒤4자리
function normVehicle(s){ return (s||"").replace(/[\s-]/g,"").replace(/호/g,""); }
function last4(s){ const m = normVehicle(s).match(/(\d{4})(?!.*\d)/); return m?m[1]:""; }

// ===== 수납 반영 (오래된 달부터 차감) — 불변 객체 반환 =====
function applyPayment(m, { amount, method="직접수납", chargeItem, paidDate }){
  amount = Number(amount)||0;
  const item = chargeItem || m.chargeItem;
  const deduct = isArrearsIncome(item);
  const nm = { ...m, arrears: (m.arrears||[]).map(a=>({...a})), payments:[...(m.payments||[])] };
  const date = paidDate || "2026-06-20";
  const pays = [];

  if (!deduct) {
    pays.push({ id:nextPid(), paidForYm:date.slice(0,7), chargeItem:item, accounting:accountingOf(item), amount, method, paidDate:date, memo:method+" 반영" });
  } else {
    let remain = amount;
    const opens = nm.arrears.filter(a=>!a.paid && a.amount>0).sort((a,b)=>a.ym.localeCompare(b.ym));
    for (const it of opens){
      if (remain<=0) break;
      const pay = Math.min(remain, it.amount);
      pays.push({ id:nextPid(), paidForYm:it.ym, chargeItem:item, accounting:accountingOf(item), amount:pay, method, paidDate:date, memo:method+" 반영" });
      remain -= pay;
      if (pay >= it.amount) it.paid = true; else it.amount -= pay;
      nm.lastPaymentYm = it.ym;
    }
    if (remain > 0) {
      nm.arrears.push({ ym:date.slice(0,7), label:"선납/초과", item:"선납/초과입금", amount:-remain, paid:false });
    }
  }
  nm.payments = [...pays, ...nm.payments];
  return { member: nm, applied: amount, payments: pays };
}

// ===== 통장 입금내역 (통장매칭) =====
function buildDeposits(members){
  const deps=[]; let id=1;
  const overdue = members.filter(m=>m.status==="정상" && outstanding(m)>0);
  const mkCand = (m, reason, amt) => ({ id:m.id, name:m.name, vehicleNo:m.vehicleNo, mgmtNo:m.mgmtNo, sigun:m.sigun, totalArrears:outstanding(m), reason, diff: amt - outstanding(m) });
  const dDate = () => `2026-06-${pad(ri(1,18))}`;

  // 자동매칭 — 이름+입금액(현재미수) 일치
  overdue.slice(0,9).forEach(m=>{
    const amt = outstanding(m);
    deps.push({ id:id++, depositDate:dDate(), depositorName:m.name, amount:amt,
      memo:`${m.name}${last4(m.vehicleNo)}`, description:"타행이체", status:"자동매칭",
      candidates:[ mkCand(m,"이름+입금액 일치",amt) ] });
  });
  // 후보확인 — 이름 일치, 금액 상이
  overdue.slice(9,14).forEach(m=>{
    const amt = m.monthlyCharge*ri(1,3);
    deps.push({ id:id++, depositDate:dDate(), depositorName:m.name, amount:amt,
      memo:`${m.name} 회비`, description:"CMS", status:"후보확인",
      candidates:[ mkCand(m,"이름 일치·금액 상이",amt) ] });
  });
  // 중복후보 — 동일 입금자명에 2명 후보
  if (overdue.length>=16){
    const a=overdue[14], b=overdue[15], amt=a.monthlyCharge*2;
    deps.push({ id:id++, depositDate:dDate(), depositorName:a.name, amount:amt,
      memo:`${a.name}`, description:"무통장", status:"중복후보",
      candidates:[ mkCand(a,"이름 일치",amt), { ...mkCand(b,"이름 유사",amt), name:a.name } ] });
  }
  // 미매칭 — 회원 미발견
  ["박상수","김복동","이장우","미확인"].forEach(n=>{
    deps.push({ id:id++, depositDate:dDate(), depositorName:n, amount:[10000,30000,5000,50000][ri(0,3)],
      memo:`${n} 입금`, description:"타행이체", status:"미매칭", candidates:[] });
  });
  // 묶음수납 후보 — 한 입금이 여러 회원 미수를 대납 (대납자 묶음)
  if (overdue.length>=19){
    const g = overdue.slice(16,19);
    const expected = g.reduce((s,m)=>s+outstanding(m),0);
    deps.push({ id:id++, depositDate:dDate(), depositorName:g[0].name, amount:expected,
      memo:`${g.map(m=>m.name).join(' ')} 합동`, description:"무통장", status:"후보확인",
      candidates: g.map(m=>mkCand(m,"묶음 대납 후보",outstanding(m))),
      groupCandidates:[{ code:"GRP-1", title:`${g[0].name} 외 ${g.length-1}명 묶음`, reason:"동일 입금자 합동/화물유지계약 대납",
        resolvedCount:g.length, targetCount:g.length, expectedAmount:expected, diff: expected-expected,
        members: g.map(m=>({ id:m.id, name:m.name, amount:outstanding(m) })) }] });
  }
  // 매칭완료 / 제외 예시
  if (overdue.length){ const m=overdue[2]; deps.push({ id:id++, depositDate:"2026-06-02", depositorName:m.name, amount:m.monthlyCharge, memo:`${m.name}`, description:"CMS", status:"매칭완료", candidates:[mkCand(m,"처리완료",m.monthlyCharge)] }); }
  deps.push({ id:id++, depositDate:"2026-06-01", depositorName:"환불반제", amount:3000, memo:"수수료 환급", description:"내부", status:"제외", candidates:[] });
  return deps;
}

// ===== 폐업현황 =====
function buildClosures(members){
  return members.filter(m=>m.status!=="정상").map((m,i)=>({
    id:i+1, memberId:m.id, name:m.name, sigun:m.sigun, vehicleNo:m.vehicleNo, mgmtNo:m.mgmtNo,
    type:m.status, processDate:`2025-${pad(ri(1,12))}-${pad(ri(1,28))}`,
    docNo:`접수${ri(2024,2025)}-${ri(100,999)}`,
    content: m.status==="폐업"?"시청 접수 후 처리": m.status+" 처리",
    unpaidBalance: outstanding(m), notifyLater: outstanding(m)>0,
  }));
}

// ===== 신규 · 예정자 (자격증명 발급 예정 / 신규 등록 대기) =====
function buildPending(){
  const rows = [
    { name:"권상호", sigun:"춘천시", vehicleNo:"강원 80바 7741", phone:"010-2231-7741", membership:"협회미가입", certIssueDate:"2026-05-18", billingStartYm:"2026-06", reason:"자격증명 발급 — 익월 관리비 부과 예정", kind:"예정" },
    { name:"맹순자", sigun:"평창군", vehicleNo:"강원 86아 2210", phone:"010-5532-2210", membership:"협회가입", certIssueDate:"2026-05-22", billingStartYm:"2026-06", reason:"70세 감면 대상 — 협회비 5,000원", kind:"예정" },
    { name:"오태웅", sigun:"강릉시", vehicleNo:"강원 81배 3392", phone:"", membership:"협회미가입", certIssueDate:"2026-06-02", billingStartYm:"2026-07", reason:"신규 택배 등록 — 전화번호 확인 필요", kind:"신규" },
    { name:"한경수", sigun:"원주시", vehicleNo:"강원 82바 5520", phone:"010-7781-5520", membership:"협회가입", certIssueDate:"2026-06-05", billingStartYm:"2026-07", reason:"협회 가입 승인 대기", kind:"신규" },
    { name:"신덕배", sigun:"홍천군", vehicleNo:"강원 83바 1180", phone:"010-3344-1180", membership:"협회미가입", certIssueDate:"2026-06-09", billingStartYm:"2026-07", reason:"자격증명 발급 — 익월 부과 예정", kind:"예정" },
  ];
  return rows.map((r,i)=>({ id:i+1, ...r, monthlyCharge: r.membership==="협회가입"?(r.reason.includes("70세")?5000:10000):5000 }));
}

const DEPOSITS = buildDeposits(MEMBERS);
const CLOSURES = buildClosures(MEMBERS);
const PENDING = buildPending();

// ===== 포맷 =====
const won = (n) => { const v=Math.abs(n||0); return (n<0?"-":"") + v.toLocaleString("ko-KR") + "원"; };
const wonShort = (n) => { const v=Math.abs(n||0), s=n<0?"-":""; if(v>=100000000) return s+(v/100000000).toFixed(1).replace(/\.0$/,"")+"억"; if(v>=10000) return s+(v/10000).toFixed(v%10000?1:0).replace(/\.0$/,"")+"만"; return s+v.toLocaleString("ko-KR"); };
const num = (n) => (n||0).toLocaleString("ko-KR");

const isExcludedStatus = (m) => m.status !== "정상";

// ===== 대시보드 집계 =====
function aggregate(list){
  const active = list.filter(m=>m.status==="정상");
  const overdue = active.filter(m=>outstanding(m)>0);
  const totalOutstanding = overdue.reduce((s,m)=>s+outstanding(m),0);
  const thisMonthCollected = list.reduce((s,m)=> s + (m.payments||[]).filter(p=>String(p.paidDate||"").startsWith("2026-06")).reduce((a,p)=>a+p.amount,0), 0);
  const thisMonthCharge = active.filter(m=>outstanding(m)>=0).reduce((s,m)=>s+m.monthlyCharge,0);
  const prepaid = active.filter(m=>outstanding(m)<0).length;
  const highValue = overdue.filter(m=>outstanding(m)>=300000).length;
  const longOverdue = overdue.filter(m=>arrearsMonths(m)>=12).length;
  const seniors = active.filter(m=>m.isSenior).length;
  const disconnected = active.filter(m=>m.disconnected).length;
  const certMissing = active.filter(m=>m.certMissing).length;

  // 지역별 TOP
  const byRegion = {};
  overdue.forEach(m=>{ byRegion[m.sigun]=(byRegion[m.sigun]||0)+outstanding(m); });
  const regionTop = Object.entries(byRegion).map(([sigun,amt])=>({ region:sigun, amt, count: overdue.filter(m=>m.sigun===sigun).length }))
    .sort((a,b)=>b.amt-a.amt).slice(0,6);

  // 계정별
  const byAccount = {};
  overdue.forEach(m=>{ byAccount[m.chargeItem]=(byAccount[m.chargeItem]||0)+outstanding(m); });

  // 미수개월수 버킷
  const buckets = [
    { key:"1-3개월", min:1, max:3 }, { key:"4-6개월", min:4, max:6 },
    { key:"7-12개월", min:7, max:12 }, { key:"12개월 이상", min:13, max:9999 },
  ].map(b=>{ const rows=overdue.filter(m=>{ const mo=arrearsMonths(m); return mo>=b.min && mo<=b.max; }); return { ...b, count:rows.length, amount:rows.reduce((s,m)=>s+outstanding(m),0) }; });

  // 비율
  const personal = active.filter(m=>m.memberType==="개인").length;
  const delivery = active.filter(m=>m.memberType==="택배").length;
  const joined = active.filter(m=>m.membership==="협회가입").length;

  return {
    totalMembers:list.length, activeMembers:active.length, overdueCount:overdue.length,
    totalOutstanding, thisMonthCharge, thisMonthCollected, prepaid, highValue, longOverdue,
    seniors, disconnected, certMissing,
    regionTop, byAccount, buckets,
    personal, delivery, joined, notJoined: active.length-joined,
    longOverdueList: overdue.filter(m=>arrearsMonths(m)>=12).sort((a,b)=>outstanding(b)-outstanding(a)).slice(0,6),
  };
}

window.PMData = {
  MEMBERS, REGIONS, DEPOSITS, CLOSURES, PENDING, INCOME_ITEMS,
  won, wonShort, num, ymLabel, aggregate, isExcludedStatus,
  openItems, balanceItems, outstanding, arrearsMonths, paidTotal, ledgerArrears,
  basisYm, billingBasisDate, payStatus, applyPayment, normVehicle, last4,
  incomeMeta, accountingOf, isArrearsIncome,
  FEE_ASSOC, FEE_MGMT, FEE_SENIOR, BASE_YM,
};
