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

function ClosureDetailModal({item,onClose,onEdit}){
  const parsed = parseContact(item.content)
  return <div className="modal-bg">
    <div className="modal wide" style={{maxWidth:760}}>
      <div className="modal-title-row">
        <div>
          <h3>{item.name} · {item.type}</h3>
          <p>{item.sigun || '-'} · {item.vehicleNo || '-'} · {item.docNo || '-'}</p>
        </div>
        <button className="btn" onClick={onClose}>닫기</button>
      </div>
      <div className="info-grid three-col">
        <div className="info"><b>처리일</b><span>{item.processDate}</span></div>
        <div className="info"><b>미납잔액</b><span className="money">{formatWon(item.unpaidBalance)}</span></div>
        <div className="info"><b>추후 납부 안내</b><span>{item.notifyLater ? '예' : '아니오'}</span></div>
        <div className="info"><b>연락확인</b><span>{parsed.contacted ? '연락완료' : '미연락'}</span></div>
        <div className="info"><b>연락일자</b><span>{parsed.contactDate || '-'}</span></div>
        <div className="info"><b>연락방법</b><span>{parsed.contactMethod || '-'}</span></div>
      </div>
      <div className="detail-section">
        <h4 className="compact-title">처리 내용</h4>
        <div className="notice" style={{background:'var(--panel-soft)', color:'var(--text)', borderColor:'var(--line)'}}>{parsed.cleanContent || item.content || '내용 없음'}</div>
      </div>
      {parsed.contactMemo && <div className="detail-section">
        <h4 className="compact-title">연락 메모</h4>
        <div className="notice" style={{background:'var(--primary-tint)', color:'var(--primary-ink)', borderColor:'var(--primary-line)'}}>{parsed.contactMemo}</div>
      </div>}
      <div className="action-row right"><button className="btn" onClick={onEdit}>기록 수정</button><button className="btn primary" onClick={onClose}>확인</button></div>
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
  const selected = CLOSURE_TYPES.find(x=>x.value===type) || CLOSURE_TYPES[0]

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
    <div className="modal wide" style={{maxWidth:820}}>
      <div className="modal-title-row">
        <div>
          <h3>폐업/이탈 기록 수정</h3>
          <p>{item.name} · {item.vehicleNo} · {item.sigun || '-'}</p>
        </div>
        <button className="btn" onClick={onClose}>닫기</button>
      </div>

      <div className="notice compact-notice" style={{marginBottom:14}}>
        처리사유, 미납잔액, 추후 안내, 연락 여부를 한 번에 정리합니다. 연락완료 체크 시 연락일자/방법/메모가 같이 저장됩니다.
      </div>

      <div className="grid grid-4" style={{marginBottom:14}}>
        {CLOSURE_TYPES.map(opt => <button key={opt.value} type="button" onClick={()=>setType(opt.value)} className={`card ${type===opt.value ? 'closure-type-card active' : 'closure-type-card'}`} style={{textAlign:'left', padding:14, borderColor:type===opt.value?'var(--primary)':'var(--line)', background:type===opt.value?'var(--primary-tint)':'#fff'}}>
          <b style={{display:'block', color:'var(--ink)', marginBottom:3}}>{opt.title}</b>
          <span className="small">{opt.desc}</span>
        </button>)}
      </div>

      <div className="info-grid three-col" style={{marginBottom:14}}>
        <label className="info"><b>처리사유</b><span>{selected.title}</span></label>
        <label className="info"><b>현재 상태</b><span>{item.memberStatus || item.type || '-'}</span></label>
        <label className="info"><b>기록 대상</b><span>{item.name || '-'} / {item.vehicleNo || '-'}</span></label>
      </div>

      <div className="edit-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
        <label><b>처리일자</b><input className="input" type="date" value={processDate} onChange={e=>setProcessDate(e.target.value)}/></label>
        <label><b>관리번호/접수번호</b><input className="input" value={docNo} onChange={e=>setDocNo(e.target.value)} placeholder="예: 폐-119, 양-46"/></label>
        <label><b>미납잔액</b><input className="input" type="number" value={unpaid} onChange={e=>setUnpaid(e.target.value)} /></label>
      </div>

      <div className="detail-section">
        <h4 className="compact-title">연락 확인</h4>
        <div className="card" style={{padding:14, background:'var(--panel-soft)'}}>
          <label style={{display:'flex', alignItems:'center', gap:10, fontWeight:700, marginBottom:12}}>
            <input type="checkbox" checked={contacted} onChange={e=>setContacted(e.target.checked)} style={{width:18, height:18}}/>
            회원/차주에게 연락 완료
          </label>
          <div className="edit-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))', marginTop:0}}>
            <label><b>연락일자</b><input className="input" type="date" value={contactDate} onChange={e=>setContactDate(e.target.value)} disabled={!contacted}/></label>
            <label><b>연락방법</b><select className="select" value={contactMethod} onChange={e=>setContactMethod(e.target.value)} disabled={!contacted}>{CONTACT_METHODS.map(m=><option key={m}>{m}</option>)}</select></label>
            <label><b>추후 납부 안내</b><select className="select" value={notify?'예':'아니오'} onChange={e=>setNotify(e.target.value==='예')}><option>예</option><option>아니오</option></select></label>
          </div>
          <label className="block-label"><b>연락 메모</b><input className="input" value={contactMemo} onChange={e=>setContactMemo(e.target.value)} disabled={!contacted} placeholder="예: 전화 안내 완료, 미납잔액 추후 납부 안내"/></label>
        </div>
      </div>

      <label className="block-label"><b>처리 내용</b><textarea className="textarea" value={content} onChange={e=>setContent(e.target.value)} placeholder="시청 접수 후 처리, 양도 완료, 이관 처리 등"/></label>

      <div className="action-row right">
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn primary" onClick={save}>저장</button>
      </div>
    </div>
  </div>
}
