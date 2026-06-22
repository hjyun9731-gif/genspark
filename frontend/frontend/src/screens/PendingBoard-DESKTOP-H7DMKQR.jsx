import React, { useState } from 'react'
import { Card, PageHead, Badge } from '../components.jsx'
import { SIGUN } from '../data.js'

function nextMonthSameDay(dateStr){
  if(!dateStr) return '2026-07-10'
  const d=new Date(dateStr+'T00:00:00')
  if(Number.isNaN(d.getTime())) return ''
  const y=d.getFullYear(), m=d.getMonth(), day=d.getDate()
  const next=new Date(y, m+1, day)
  if(next.getDate()!==day) next.setDate(0)
  return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`
}
function chargeItem(membership){return membership==='협회가입'?'협회비':'관리비'}
function monthlyCharge(membership){return membership==='협회가입'?10000:5000}
function parts(note){return String(note||'').split(/\s*\/\s*/).filter(Boolean)}
function getPart(note,key){const f=parts(note).find(x=>x.startsWith(key+':')); return f?f.slice(key.length+1).trim():''}
function memoOnly(note){return parts(note).filter(x=>!x.startsWith('주소:')&&!x.startsWith('부과시작일:')).join(' / ')}
function buildNote(address,note,startDate){
  const out=[]
  if(address) out.push(`주소:${address}`)
  if(startDate) out.push(`부과시작일:${startDate}`)
  if(note) out.push(note)
  return out.join(' / ')
}

export default function PendingBoard({data,addPending,updatePending,deletePending,promotePending}){
  const [form,setForm]=useState({name:'',vehicleNo:'',phone:'',address:'',sigun:'춘천시',memberType:'택배',membership:'협회미가입',certIssueDate:'2026-06-10',note:''})
  const [edit,setEdit]=useState(null)
  const [promote,setPromote]=useState(null)
  const startDate=nextMonthSameDay(form.certIssueDate)
  const pendingCount = data.pending.length

  function submit(){
    if(!form.name||!form.vehicleNo) return alert('이름과 차량번호는 필수입니다.')
    addPending({...form, note: buildNote(form.address, form.note, startDate)})
    setForm({...form,name:'',vehicleNo:'',phone:'',address:'',note:''})
  }

  return <div className="compact-page pending-page">
    <PageHead title="신규 · 예정자" />

    <div className="grid grid-2 pending-layout">
      <Card className="card-pad pending-form-card">
        <div className="pending-card-head">
          <div>
            <h3>예정자 등록</h3>
            <p>자격증명 발급 후 정식 등록 전까지 관리합니다.</p>
          </div>
          <Badge tone="blue">부과시작 {startDate}</Badge>
        </div>

        <div className="edit-grid pending-edit-grid">
          <label><b>이름</b><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label><b>차량번호</b><input className="input" value={form.vehicleNo} onChange={e=>setForm({...form,vehicleNo:e.target.value})}/></label>
          <label><b>연락처</b><input className="input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="010-0000-0000"/></label>
          <label><b>지역</b><select className="select" value={form.sigun} onChange={e=>setForm({...form,sigun:e.target.value})}>{SIGUN.map(s=><option key={s}>{s}</option>)}</select></label>
          <label><b>구분</b><select className="select" value={form.memberType} onChange={e=>setForm({...form,memberType:e.target.value})}><option>개인</option><option>택배</option></select></label>
          <label><b>가입여부</b><select className="select" value={form.membership} onChange={e=>setForm({...form,membership:e.target.value})}><option>협회가입</option><option>협회미가입</option></select></label>
          <label><b>발급일자</b><input className="input" type="date" value={form.certIssueDate} onChange={e=>setForm({...form,certIssueDate:e.target.value})}/></label>
          <label><b>비고</b><input className="input" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label>
          <label className="wide-field"><b>주소</b><input className="input" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="주소 입력"/></label>
        </div>

        <div className="pending-charge-box">
          <span>예상 부과</span>
          <strong>{chargeItem(form.membership)} {monthlyCharge(form.membership).toLocaleString()}원</strong>
          <em>{startDate}부터 부과</em>
        </div>
        <button className="btn primary" style={{marginTop:12}} onClick={submit}>예정자 추가</button>
      </Card>

      <Card className="pending-list-card">
        <div className="admin-list-head">
          <b>예정자 목록</b>
          <span>{pendingCount.toLocaleString()}명</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table dense" style={{minWidth:980}}>
            <thead><tr><th>이름</th><th>차량번호</th><th>지역</th><th>연락처</th><th>주소</th><th>가입</th><th>발급일</th><th>부과시작일</th><th>단계</th><th className="right">처리</th></tr></thead>
            <tbody>{data.pending.map(p=>{const note=p.note||''; const addr=getPart(note,'주소'); const start=getPart(note,'부과시작일') || nextMonthSameDay(p.certIssueDate); return <tr key={p.id}><td><b>{p.name}</b></td><td className="mono nowrap">{p.vehicleNo}</td><td>{p.sigun}</td><td className="mono nowrap">{p.phone||'-'}</td><td className="clip-cell" title={addr}>{addr||'-'}</td><td>{p.membership}</td><td>{p.certIssueDate}</td><td className="mono nowrap">{start}</td><td><Badge tone={p.step==='전환완료'?'green':'blue'}>{p.step}</Badge></td><td className="right action-cell"><button className="btn mini" onClick={()=>setEdit(p)}>수정</button><button className="btn mini red" onClick={()=>{if(confirm('예정자를 삭제할까요?')) deletePending(p.id)}}>삭제</button><button className="btn mini green" disabled={p.step==='전환완료'} onClick={()=>setPromote(p)}>전환</button></td></tr>})}{!data.pending.length&&<tr><td colSpan="10" className="empty-cell compact">등록된 예정자가 없습니다.</td></tr>}</tbody>
          </table>
        </div>
      </Card>
    </div>
    {edit&&<PendingEditModal item={edit} onClose={()=>setEdit(null)} onSave={(payload)=>{updatePending(edit.id,payload); setEdit(null)}}/>}
    {promote&&<PromoteModal item={promote} onClose={()=>setPromote(null)} onSave={(payload)=>{promotePending(promote.id,payload); setPromote(null)}}/>}
  </div>
}
function PendingEditModal({item,onClose,onSave}){const currentAddress=getPart(item.note,'주소'); const currentStart=getPart(item.note,'부과시작일') || nextMonthSameDay(item.certIssueDate); const [f,setF]=useState({...item,address:currentAddress,note:memoOnly(item.note),billingStartDate:currentStart}); return <div className="modal-bg"><div className="modal"><h3>예정자 수정</h3><div className="form-row"><b>이름</b><input className="input" value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></div><div className="form-row"><b>차량번호</b><input className="input" value={f.vehicleNo||''} onChange={e=>setF({...f,vehicleNo:e.target.value})}/></div><div className="form-row"><b>연락처</b><input className="input" value={f.phone||''} onChange={e=>setF({...f,phone:e.target.value})}/></div><div className="form-row"><b>주소</b><input className="input" value={f.address||''} onChange={e=>setF({...f,address:e.target.value})}/></div><div className="form-row"><b>부과시작일</b><input className="input" type="date" value={f.billingStartDate||''} onChange={e=>setF({...f,billingStartDate:e.target.value})}/></div><div className="form-row"><b>비고</b><input className="input" value={f.note||''} onChange={e=>setF({...f,note:e.target.value})}/></div><div className="action-row right"><button className="btn" onClick={onClose}>취소</button><button className="btn primary" onClick={()=>onSave({...f,note:buildNote(f.address,f.note,f.billingStartDate)})}>저장</button></div></div></div>}
function PromoteModal({item,onClose,onSave}){const startFromNote=getPart(item.note,'부과시작일') || nextMonthSameDay(item.certIssueDate); const [mgmtNo,setMgmtNo]=useState(item.mgmtNo||''); const [membership,setMembership]=useState(item.membership||'협회미가입'); const [billingDate,setBillingDate]=useState(startFromNote); const [phone,setPhone]=useState(item.phone||''); const [address,setAddress]=useState(getPart(item.note,'주소')||''); const [note,setNote]=useState(memoOnly(item.note)); return <div className="modal-bg"><div className="modal"><h3>전체자명단 전환</h3><div className="form-row"><b>대상</b><span>{item.name} / {item.vehicleNo}</span></div><div className="form-row"><b>관리번호</b><input className="input" value={mgmtNo} onChange={e=>setMgmtNo(e.target.value)} placeholder="비워두면 자동 부여"/></div><div className="form-row"><b>가입여부</b><select className="select" value={membership} onChange={e=>setMembership(e.target.value)}><option>협회가입</option><option>협회미가입</option></select></div><div className="form-row"><b>부과구분</b><span>{chargeItem(membership)} / {monthlyCharge(membership).toLocaleString()}원</span></div><div className="form-row"><b>부과시작일</b><input className="input" type="date" value={billingDate} onChange={e=>setBillingDate(e.target.value)}/></div><div className="form-row"><b>연락처</b><input className="input" value={phone} onChange={e=>setPhone(e.target.value)}/></div><div className="form-row"><b>주소</b><input className="input" value={address} onChange={e=>setAddress(e.target.value)}/></div><div className="form-row"><b>비고</b><input className="input" value={note} onChange={e=>setNote(e.target.value)}/></div><div className="action-row right"><button className="btn" onClick={onClose}>취소</button><button className="btn green" onClick={()=>onSave({mgmtNo, membership, billingStartYm:billingDate.slice(0,7), chargeItem:chargeItem(membership), monthlyCharge:monthlyCharge(membership), phone, note:buildNote(address,note,billingDate)})}>전환</button></div></div></div>}
