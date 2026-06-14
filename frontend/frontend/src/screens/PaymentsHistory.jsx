import React, { useMemo, useState } from 'react'
import { Card, PageHead, Badge, formatWon } from '../components.jsx'

const INCOME_ITEMS = [
  { value: '전체', label: '전체', accounting: '전체', tone: 'soft' },
  { value: '협회비', label: '협회비', accounting: '회비수입', tone: 'lavender' },
  { value: '관리비', label: '관리비', accounting: '회비수입', tone: 'sky' },
  { value: '협회가입비', label: '협회가입비', accounting: '가수금', tone: 'pink' },
  { value: '자격증명발급비', label: '자격증명발급비', accounting: '잡수입', tone: 'yellow' },
  { value: '기타', label: '기타', accounting: '기타수입', tone: 'green' },
]
function incomeMeta(item){ return INCOME_ITEMS.find(x => x.value === item) || { value:item || '-', label:item || '-', accounting:'회비수입', tone:'soft' } }
function accountingOf(payment){ return payment.accountingType || payment.accounting_type || incomeMeta(payment.chargeItem || payment.charge_item).accounting }

export default function PaymentsHistory({data, updatePayment, cancelPayment, navigate}){
  const [q,setQ]=useState('')
  const [item,setItem]=useState('전체')
  const [edit,setEdit]=useState(null)
  const rows=useMemo(()=>[...data.payments].filter(p=>{
    const text=[p.name,p.vehicleNo,p.method,p.paidForYm,p.sigun,p.chargeItem,p.charge_item,accountingOf(p),p.memo].join(' ')
    const okQ=!q || text.includes(q)
    const charge=p.chargeItem || p.charge_item
    const okItem=item==='전체' || charge===item || accountingOf(p)===item
    return okQ && okItem
  }),[data.payments,q,item])
  const total=rows.reduce((s,p)=>s+(Number(p.amount)||0),0)
  const month='2026-06'
  const monthTotal=rows.filter(p=>(p.paidDate||'').startsWith(month)).reduce((s,p)=>s+(Number(p.amount)||0),0)
  const bank=rows.filter(p=>p.method==='통장매칭').length
  const direct=rows.filter(p=>p.method!=='통장매칭').length
  const receiptTotal=rows.filter(p=>accountingOf(p)==='가수금').reduce((s,p)=>s+(Number(p.amount)||0),0)
  const miscTotal=rows.filter(p=>accountingOf(p)==='잡수입').reduce((s,p)=>s+(Number(p.amount)||0),0)
  return <div><PageHead title="수납내역" desc="직접 수납·통장매칭·CMS 수납 반영 이력입니다."/>
    <div className="grid grid-4" style={{marginBottom:14}}>
      <Card className="stat"><div className="stat-label">총 수납 건수</div><div className="stat-value">{rows.length}건</div></Card>
      <Card className="stat"><div className="stat-label">총 수납액</div><div className="stat-value">{formatWon(total)}</div></Card>
      <Card className="stat"><div className="stat-label">가수금 / 잡수입</div><div className="stat-value">{formatWon(receiptTotal)} / {formatWon(miscTotal)}</div></Card>
      <Card className="stat"><div className="stat-label">통장/직접</div><div className="stat-value">{bank} / {direct}건</div></Card>
    </div>
    <Card className="card-pad" style={{marginBottom:14}}><div className="filters">
      <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="이름 / 차량번호 / 지역 / 방식 / 대상월 검색"/>
      <select className="select" value={item} onChange={e=>setItem(e.target.value)}>{INCOME_ITEMS.map(x=><option key={x.value}>{x.value}</option>)}</select>
      <button className="btn soft">CSV 내보내기</button>
    </div></Card>
    <Card><div className="table-wrap"><table className="table"><thead><tr><th>수납일</th><th>이름</th><th>차량번호</th><th>지역</th><th>대상월</th><th>항목</th><th>회계구분</th><th>방식</th><th className="right">금액</th><th>처리일</th><th>메모</th><th className="right">처리</th></tr></thead><tbody>{rows.map(p=>{const meta=incomeMeta(p.chargeItem || p.charge_item); return <tr key={p.id}><td>{p.paidDate}</td><td><button type="button" className="name-link admin-name" onClick={()=>navigate?.('list',{q:p.vehicleNo || p.name, memberId:p.memberId || p.member_id, amount:'전체', status:'정상', openPayments:true})}><b>{p.name}</b></button></td><td className="mono">{p.vehicleNo}</td><td>{p.sigun || p.region}</td><td>{p.paidForYm}</td><td><Badge tone={meta.tone}>{p.chargeItem}</Badge></td><td>{accountingOf(p)}</td><td><Badge tone={p.method==='통장매칭'?'blue':'gray'}>{p.method}</Badge></td><td className="right money">{formatWon(p.amount)}</td><td>{(p.createdAt||'').slice(0,10)||'-'}</td><td className="ellipsis">{p.memo}</td><td className="right action-cell"><button className="btn soft" onClick={()=>navigate?.('list',{q:p.vehicleNo || p.name, memberId:p.memberId || p.member_id, amount:'전체', status:'정상', openPayments:true})}>회원보기</button><button className="btn" onClick={()=>setEdit(p)}>수정</button><button className="btn red" onClick={()=>{if(confirm('이 수납을 취소하고 미수금액을 복구할까요?')) cancelPayment(p.id)}}>취소</button></td></tr>})}{!rows.length&&<tr><td colSpan="12" style={{textAlign:'center',padding:40,color:'var(--sub)'}}>수납 내역이 없습니다. 미수금명단에서 수납 처리 후 이력이 표시됩니다.</td></tr>}</tbody></table></div></Card>{edit&&<PaymentEditModal item={edit} onClose={()=>setEdit(null)} onSave={(payload)=>{updatePayment(edit.id,payload); setEdit(null)}}/>}</div>
}
function PaymentEditModal({item,onClose,onSave}){const [amount,setAmount]=useState(item.amount||0); const [method,setMethod]=useState(item.method||'직접수납'); const [paidDate,setPaidDate]=useState(item.paidDate||''); const [chargeItem,setChargeItem]=useState(item.chargeItem||'관리비'); return <div className="modal-bg"><div className="modal"><h3>수납내역 수정</h3><div className="form-row"><b>대상</b><span>{item.name} / {item.vehicleNo}</span></div><div className="form-row"><b>수납일</b><input className="input" type="date" value={paidDate} onChange={e=>setPaidDate(e.target.value)}/></div><div className="form-row"><b>항목</b><select className="select" value={chargeItem} onChange={e=>setChargeItem(e.target.value)}>{INCOME_ITEMS.filter(x=>x.value!=='전체').map(x=><option key={x.value}>{x.value}</option>)}</select></div><div className="form-row"><b>수납방법</b><select className="select" value={method} onChange={e=>setMethod(e.target.value)}><option>직접수납</option><option>통장매칭</option><option>CMS</option><option>현금</option></select></div><div className="form-row"><b>금액</b><input className="input" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></div><div className="notice">금액/항목 수정은 수납 기록만 변경합니다. 이미 차감된 미수금 복구는 “취소” 기능을 사용하세요.</div><div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}><button className="btn" onClick={onClose}>취소</button><button className="btn primary" onClick={()=>onSave({amount:Number(amount)||0, method, charge_item:chargeItem, paid_date:paidDate})}>저장</button></div></div></div>}
