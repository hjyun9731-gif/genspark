import React, { useMemo, useState } from 'react'
import { Card, PageHead, Badge, formatWon } from '../components.jsx'

const CLOSURE_TYPES = [
  { value: '폐업', title: '폐업', desc: '사업 폐업 · 운행 종료' },
  { value: '양도', title: '양도', desc: '타인 양도 · 명의 이전' },
  { value: '이관', title: '이관', desc: '타 지역 이관' },
  { value: '탈퇴', title: '탈퇴', desc: '협회 탈퇴 처리' },
]

const CONTACT_METHODS = ['전화', '문자', '카카오톡', '방문', '우편', '기타']

function today(){ return new Date().toISOString().slice(0,10) }
function asText(v){ return (v ?? '').toString().trim() }
function normalizeSearch(v){ return asText(v).replace(/\s+/g,'').toLowerCase() }
function onlyContent(content=''){
  const text = asText(content)
  if(!text) return ''
  return text
    .split('\n')
    .filter(line => !/^\[(연락여부|연락일자|연락방법|연락메모|처리내용)\]/.test(line.trim()))
    .join('\n')
    .replace(/^내용\s*[:：]\s*/,'')
    .trim()
}
function parseContact(content=''){
  const text = asText(content)
  const pick = (label) => {
    const m = text.match(new RegExp(`\\[${label}\\]\\s*([^\\n]*)`))
    return m ? m[1].trim() : ''
  }
  const doneText = pick('연락여부')
  return {
    contacted: doneText ? /완료|예|Y|true/i.test(doneText) : /연락완료|통화완료|안내완료/.test(text),
    contactDate: pick('연락일자'),
    contactMethod: pick('연락방법') || '전화',
    contactMemo: pick('연락메모'),
    cleanContent: onlyContent(text),
  }
}
function makeContent({content, contacted, contactDate, contactMethod, contactMemo}){
  const lines = []
  lines.push(`[연락여부] ${contacted ? '연락완료' : '미연락'}`)
  if(contacted && contactDate) lines.push(`[연락일자] ${contactDate}`)
  if(contacted && contactMethod) lines.push(`[연락방법] ${contactMethod}`)
  if(contactMemo) lines.push(`[연락메모] ${contactMemo}`)
  if(content) lines.push(`[처리내용] ${content}`)
  return lines.join('\n')
}
function contactBadge(item){
  const c = parseContact(item.content)
  if(c.contacted) return <Badge tone="green">연락완료</Badge>
  return <Badge tone="orange">미연락</Badge>
}

export default function ClosureBoard({data, updateClosure, restoreClosure, deleteClosure}){
  const [q,setQ]=useState('')
  const [edit,setEdit]=useState(null)
  const [detail,setDetail]=useState(null)

  const rows=useMemo(()=>{
    const keyword = normalizeSearch(q)
    return data.closures.filter(c=>{
      if(!keyword) return true
      const parsed = parseContact(c.content)
      return normalizeSearch([
        c.name,c.vehicleNo,c.docNo,c.content,c.type,c.sigun,
        parsed.contactMethod, parsed.contactMemo, parsed.cleanContent
      ].join(' ')).includes(keyword)
    })
  },[data.closures,q])

  const total=rows.length
  const unpaid=rows.reduce((s,c)=>s+(Number(c.unpaidBalance)||0),0)
  const notify=rows.filter(c=>c.notifyLater).length
  const notContacted=rows.filter(c=>!parseContact(c.content).contacted).length

  return <div>
    <PageHead title="폐업현황" desc="폐업·탈퇴·양도·이관 처리 이력과 추후 납부 안내 대상을 확인합니다."/>

    <div className="grid grid-4" style={{marginBottom:14}}>
      <Card className="stat"><div className="stat-label">전체 처리 건</div><div className="stat-value">{total}</div></Card>
      <Card className="stat"><div className="stat-label">추후 납부 안내</div><div className="stat-value" style={{color:'var(--orange, #d97706)'}}>{notify}건</div></Card>
      <Card className="stat"><div className="stat-label">미납 잔액 합계</div><div className="stat-value" style={{color:'var(--red, #e5484d)'}}>{formatWon(unpaid)}</div></Card>
      <Card className="stat"><div className="stat-label">연락 미확인</div><div className="stat-value" style={{color:'var(--primary, #6d5dfc)'}}>{notContacted}건</div></Card>
    </div>

    <Card className="card-pad" style={{marginBottom:14}}>
      <div className="filters">
        <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="이름 / 차량번호 / 관리번호·접수번호 / 연락여부 / 내용 검색"/>
      </div>
    </Card>

    <Card>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>처리일</th><th>지역</th><th>이름</th><th>차량번호</th><th>사유</th><th>관리번호/접수번호</th><th>내용</th><th className="right">미납잔액</th><th>연락확인</th><th>추후 납부</th><th className="right">처리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c=>{
              const parsed = parseContact(c.content)
              return <tr key={c.id}>
                <td>{c.processDate}</td>
                <td>{c.sigun}</td>
                <td><b>{c.name}</b></td>
                <td className="mono">{c.vehicleNo}</td>
                <td><Badge tone="red">{c.type}</Badge></td>
                <td>{c.docNo||'-'}</td>
                <td className="ellipsis">{parsed.cleanContent || c.content || '-'}</td>
                <td className="right money">{formatWon(c.unpaidBalance)}</td>
                <td>{contactBadge(c)}</td>
                <td>{c.notifyLater?<Badge tone="orange">납부 안내</Badge>:<Badge tone="green">종결</Badge>}</td>
                <td className="right action-cell">
                  <button className="btn soft" onClick={()=>setDetail(c)}>상세</button>
                  <button className="btn" onClick={()=>setEdit(c)}>수정</button>
                  <button className="btn green" onClick={()=>{if(confirm('정상 회원으로 복귀하고 폐업현황 기록을 제거할까요?')) restoreClosure(c.id)}}>복귀</button>
                  <button className="btn red" onClick={()=>{if(confirm('폐업/이탈 처리 기록을 삭제합니다. 회원 상태 복구 여부를 확인하세요. 계속하시겠습니까?')) deleteClosure(c.id,false)}}>삭제</button>
                </td>
              </tr>
            })}
            {!rows.length&&<tr><td colSpan="11" style={{textAlign:'center',padding:32,color:'var(--sub)'}}>폐업/이탈 처리 내역이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>

    {detail&&<ClosureDetailModal item={detail} onClose={()=>setDetail(null)} onEdit={()=>{setEdit(detail); setDetail(null)}}/>}
    {edit&&<ClosureEditModal item={edit} onClose={()=>setEdit(null)} onSave={(payload)=>{updateClosure(edit.id,payload); setEdit(null)}}/>}
  </div>
}

function DetailLine({ label, value, strong }) {
  return <div style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:10, padding:'9px 0', borderBottom:'1px solid var(--line-soft)'}}>
    <b style={{fontSize:13, color:'var(--muted)', fontWeight:700}}>{label}</b>
    <span className={strong ? 'money' : ''} style={{fontSize:14, color:'var(--ink-2)', fontWeight:strong ? 800 : 600}}>{value || '-'}</span>
  </div>
}

function ClosureDetailModal({item,onClose,onEdit}){
  const parsed = parseContact(item.content)
  return <div className="modal-bg">
    <div className="modal" style={{width:'min(560px, calc(100vw - 48px))', padding:0, overflow:'hidden'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, padding:'20px 22px 14px', borderBottom:'1px solid var(--line)'}}>
        <div>
          <h3 style={{fontSize:20, fontWeight:800, margin:0}}>폐업/이탈 상세</h3>
          <p style={{margin:'5px 0 0', color:'var(--muted)', fontSize:13}}>{item.name} · {item.vehicleNo || '-'} · {item.sigun || '-'}</p>
        </div>
        <button className="btn" onClick={onClose}>닫기</button>
      </div>
      <div style={{padding:'18px 22px 20px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:10}}>
          <Badge tone="red">{item.type || '폐업'}</Badge>
          {contactBadge(item)}
        </div>
        <div style={{borderTop:'1px solid var(--line-soft)'}}>
          <DetailLine label="처리일자" value={item.processDate} />
          <DetailLine label="관리번호" value={item.docNo || '-'} />
          <DetailLine label="미납잔액" value={formatWon(item.unpaidBalance)} strong />
          <DetailLine label="추후 납부" value={item.notifyLater ? '예' : '아니오'} />
          <DetailLine label="연락일자" value={parsed.contactDate || '-'} />
          <DetailLine label="연락방법" value={parsed.contactMethod || '-'} />
        </div>
        <label className="block-label" style={{marginTop:14}}>
          <b>처리 내용</b>
          <div className="textarea" style={{height:'auto', minHeight:64, background:'var(--panel-soft)', whiteSpace:'pre-wrap'}}>{parsed.cleanContent || item.content || '내용 없음'}</div>
        </label>
        {parsed.contactMemo && <label className="block-label" style={{marginTop:10}}>
          <b>연락 메모</b>
          <div className="input" style={{height:'auto', minHeight:40, background:'var(--panel-soft)'}}>{parsed.contactMemo}</div>
        </label>}
        <div className="action-row right" style={{marginTop:16}}>
          <button className="btn" onClick={onEdit}>수정</button>
          <button className="btn primary" onClick={onClose}>확인</button>
        </div>
      </div>
    </div>
  </div>
}

function ClosureEditModal({item,onClose,onSave}){
  const parsed = parseContact(item.content)
  const [type,setType]=useState(item.type||'폐업')
  const [processDate,setProcessDate]=useState(item.processDate||today())
  const [docNo,setDocNo]=useState(item.docNo||'')
  const [content,setContent]=useState(parsed.cleanContent||'')
  const [unpaid,setUnpaid]=useState(item.unpaidBalance||0)
  const [notify,setNotify]=useState(!!item.notifyLater)
  const [contacted,setContacted]=useState(!!parsed.contacted)
  const [contactDate,setContactDate]=useState(parsed.contactDate || today())
  const [contactMethod,setContactMethod]=useState(parsed.contactMethod || '전화')
  const [contactMemo,setContactMemo]=useState(parsed.contactMemo || '')

  const save = () => {
    const finalContent = makeContent({content, contacted, contactDate, contactMethod, contactMemo})
    onSave({
      type,
      process_date: processDate,
      doc_no: docNo,
      content: finalContent,
      unpaid_balance: Number(unpaid)||0,
      notify_later: notify,
    })
  }

  return <div className="modal-bg">
    <div className="modal" style={{width:'min(520px, calc(100vw - 48px))', padding:0, overflow:'hidden'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, padding:'18px 20px 12px', borderBottom:'1px solid var(--line)'}}>
        <div>
          <h3 style={{fontSize:18, fontWeight:800, margin:0}}>폐업 처리</h3>
          <p style={{margin:'5px 0 0', color:'var(--muted)', fontSize:13}}>{item.name} · {item.vehicleNo || '-'} · {item.sigun || '-'}</p>
        </div>
        <button className="btn mini" onClick={onClose}>닫기</button>
      </div>

      <div style={{padding:'16px 20px 18px'}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:8, marginBottom:14}}>
          {CLOSURE_TYPES.map(opt => <button
            key={opt.value}
            type="button"
            onClick={()=>setType(opt.value)}
            className={type===opt.value ? 'btn soft' : 'btn'}
            style={{height:42, padding:'0 10px', fontWeight:800}}
          >{opt.title}</button>)}
        </div>

        <div className="form-row"><b>처리일자</b><input className="input" type="date" value={processDate} onChange={e=>setProcessDate(e.target.value)}/></div>
        <div className="form-row"><b>관리번호</b><input className="input" value={docNo} onChange={e=>setDocNo(e.target.value)} placeholder="관리번호 또는 접수번호"/></div>
        <div className="form-row"><b>미납잔액</b><input className="input" type="number" value={unpaid} onChange={e=>setUnpaid(e.target.value)} /></div>
        <div className="form-row"><b>추후 안내</b><select className="select" value={notify?'예':'아니오'} onChange={e=>setNotify(e.target.value==='예')}><option>예</option><option>아니오</option></select></div>

        <div style={{borderTop:'1px solid var(--line-soft)', margin:'12px 0', paddingTop:12}}>
          <div className="form-row"><b>연락 확인</b><label style={{display:'flex', alignItems:'center', gap:8, fontWeight:700}}><input type="checkbox" checked={contacted} onChange={e=>setContacted(e.target.checked)} style={{width:17, height:17}}/> 연락했음</label></div>
          {contacted && <>
            <div className="form-row"><b>연락일자</b><input className="input" type="date" value={contactDate} onChange={e=>setContactDate(e.target.value)}/></div>
            <div className="form-row"><b>연락방법</b><select className="select" value={contactMethod} onChange={e=>setContactMethod(e.target.value)}>{CONTACT_METHODS.map(m=><option key={m}>{m}</option>)}</select></div>
            <div className="form-row"><b>연락메모</b><input className="input" value={contactMemo} onChange={e=>setContactMemo(e.target.value)} placeholder="예: 전화 안내 완료"/></div>
          </>}
        </div>

        <div className="form-row"><b>내용</b><textarea className="textarea" value={content} onChange={e=>setContent(e.target.value)} placeholder="시청 접수 후 처리 등" /></div>
        <div className="action-row right" style={{marginTop:14}}>
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn primary" onClick={save}>저장</button>
        </div>
      </div>
    </div>
  </div>
}
