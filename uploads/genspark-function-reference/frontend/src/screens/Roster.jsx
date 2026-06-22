import React, { useMemo, useState } from 'react'
import { Badge, Card, PageHead, formatWon, formatNum } from '../components.jsx'
import { SIGUN } from '../data.js'

const PER_PAGE = 50

function memoParts(member){
  return String(member.memo || '').split(/\s*\/\s*/).map(v=>v.trim()).filter(Boolean)
}
function extractInfo(member, key){
  const found = memoParts(member).find(v => v.startsWith(key + ':'))
  return found ? found.slice(key.length + 1).trim() : ''
}
function addressOf(member){
  return extractInfo(member, '주소') || '-'
}
function noteOf(member){
  return memoParts(member)
    .filter(v => !['주소:','사업자등록번호:','공문주소:','비고:','전화메모:','부과시작일:'].some(prefix => v.startsWith(prefix)))
    .join(' / ') || '-'
}

export default function Roster({ data, navigate, registerClosure, saveMemo }){
  const [sigun, setSigun] = useState('전체')
  const [membership, setMembership] = useState('전체')
  const [status, setStatus] = useState('정상')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [closeTarget, setCloseTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const rows = useMemo(() => {
    let arr = [...data.members]
    if (sigun !== '전체') arr = arr.filter(member => member.sigun === sigun)
    if (membership !== '전체') arr = arr.filter(member => member.membership === membership)
    if (status !== '전체') arr = arr.filter(member => member.status === status)
    if (q.trim()) {
      const keyword = q.trim().toLowerCase()
      arr = arr.filter(member => [member.name, member.vehicleNo, member.mgmtNo, member.phone, member.memo, addressOf(member)].join(' ').toLowerCase().includes(keyword))
    }
    return arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'))
  }, [data.members, sigun, membership, status, q])

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function reset(){
    setSigun('전체')
    setMembership('전체')
    setStatus('정상')
    setQ('')
    setPage(1)
  }

  return <div className="screen-shell admin-screen">
    <PageHead title="전체자명단" desc="전체자명단과 미수금명단의 표형 UI를 통일했습니다. 이름을 누르면 상세정보가 열립니다.">
      <button className="btn mini" onClick={reset}>초기화</button>
      <button className="btn soft mini" onClick={() => navigate('list', { amount: '전체', sigun })}>미수금명단에서 보기</button>
    </PageHead>

    <div className="summary-strip four">
      <div className="summary-box"><span>전체 회원</span><strong>{formatNum(rows.length)}명</strong></div>
      <div className="summary-box"><span>정상 회원</span><strong>{formatNum(rows.filter(member => member.status === '정상').length)}명</strong></div>
      <div className="summary-box"><span>미수 회원</span><strong className="warning-text">{formatNum(rows.filter(member => Number(member.totalArrears) > 0).length)}명</strong></div>
      <div className="summary-box"><span>미수금 합계</span><strong className="danger-text">{formatWon(rows.reduce((sum, member) => sum + (Number(member.totalArrears) || 0), 0))}</strong></div>
    </div>

    <Card className="admin-control-card">
      <div className="admin-filter-row">
        <input className="input admin-search" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="이름, 차량번호, 관리번호, 주소, 연락처 검색" />
        <select className="select" value={sigun} onChange={e => { setSigun(e.target.value); setPage(1) }}>
          <option value="전체">전체 지역</option>
          {SIGUN.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="select" value={membership} onChange={e => { setMembership(e.target.value); setPage(1) }}>
          <option value="전체">가입여부 전체</option>
          <option value="협회가입">협회가입</option>
          <option value="협회미가입">협회미가입</option>
        </select>
        <select className="select" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="정상">정상</option>
          <option value="전체">상태 전체</option>
          <option value="폐업">폐업</option>
          <option value="양도">양도</option>
          <option value="이관">이관</option>
          <option value="탈퇴">탈퇴</option>
        </select>
        <button className="btn soft" onClick={() => setPage(1)}>조회</button>
        <button className="btn" onClick={reset}>초기화</button>
      </div>
    </Card>

    <Card className="admin-list-card">
      <div className="admin-list-head">
        <b>{sigun === '전체' ? '전체자명단' : `${sigun} 회원명단`}</b>
        <span>{formatNum(rows.length)}명 · 이름 클릭 시 상세정보</span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table roster-like-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>차량번호</th>
              <th>핸드폰번호</th>
              <th>주소</th>
              <th>지역</th>
              <th>가입여부</th>
              <th>계정</th>
              <th className="right">미수금</th>
              <th>관리번호</th>
              <th>상태</th>
              <th className="right">처리</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(member => <tr key={member.id}>
              <td><button className="name-link admin-name" onClick={() => setSelected(member)}>{member.name}</button></td>
              <td className="mono nowrap">{member.vehicleNo || '-'}</td>
              <td className="mono nowrap">{member.phone || '-'}</td>
              <td className="clip-cell" title={addressOf(member)}>{addressOf(member)}</td>
              <td>{member.sigun || '-'}</td>
              <td><Badge tone={member.membership === '협회가입' ? 'blue' : 'gray'}>{member.membership}</Badge></td>
              <td>
                <div className="stack-cell">
                  <Badge tone={member.chargeItem === '협회비' ? 'blue' : 'green'}>{member.chargeItem}</Badge>
                  <small>{formatWon(member.monthlyCharge)}</small>
                </div>
              </td>
              <td className="right money" style={{ color: Number(member.totalArrears) > 0 ? 'var(--red)' : undefined }}>{formatWon(member.totalArrears)}</td>
              <td className="mono nowrap">{member.mgmtNo || '-'}</td>
              <td><Badge tone={member.status === '정상' ? 'green' : 'red'}>{member.status || '-'}</Badge></td>
              <td className="right action-cell left">
                <button className="btn mini soft" onClick={() => navigate('list', { q: member.vehicleNo, amount: '전체', sigun: member.sigun })}>미수보기</button>
                <button className="btn mini" onClick={() => setEditTarget(member)}>메모</button>
                <button className="btn mini red" onClick={() => setCloseTarget(member)}>폐업</button>
              </td>
            </tr>)}
            {!pageRows.length && <tr><td colSpan="11" className="empty-cell compact">조건에 맞는 회원이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pager-row">
        <span>{formatNum(rows.length)}명 중 {rows.length ? formatNum((page - 1) * PER_PAGE + 1) : 0}–{formatNum(Math.min(page * PER_PAGE, rows.length))}</span>
        <div>
          <button className="btn mini" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
          <b style={{ margin: '0 8px' }}>{page}/{pageCount}</b>
          <button className="btn mini" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>다음</button>
        </div>
      </div>
    </Card>

    {selected && <RosterDetail member={selected} onClose={() => setSelected(null)} />}
    {closeTarget && <ClosureModal member={closeTarget} onClose={() => setCloseTarget(null)} onSave={(payload) => { registerClosure(closeTarget.id, payload); setCloseTarget(null) }} />}
    {editTarget && <EditModal member={editTarget} onClose={() => setEditTarget(null)} onSave={(memo) => { saveMemo(editTarget.id, memo); setEditTarget(null) }} />}
  </div>
}

function RosterDetail({ member, onClose }){
  return <div className="modal-bg"><div className="modal modern-detail-modal">
    <div className="modal-title-row">
      <div>
        <h3>{member.name}</h3>
        <p>{member.sigun} · {member.vehicleNo} · {member.mgmtNo}</p>
      </div>
      <button className="btn mini" onClick={onClose}>닫기</button>
    </div>
    <div className="info-grid compact-info three-col">
      <Info k="이름" v={member.name} />
      <Info k="차량번호" v={member.vehicleNo} />
      <Info k="관리번호" v={member.mgmtNo} />
      <Info k="핸드폰번호" v={member.phone || '-'} />
      <Info k="지역" v={member.sigun || '-'} />
      <Info k="가입여부" v={member.membership || '-'} />
      <Info k="상태" v={member.status || '-'} />
      <Info k="주소" v={addressOf(member)} />
      <Info k="내부메모" v={noteOf(member)} />
    </div>
  </div></div>
}

function Info({ k, v }){
  return <div className="info"><b>{k}</b><span>{v || '-'}</span></div>
}

function ClosureModal({ member, onClose, onSave }){
  const [type, setType] = useState('폐업')
  const [docNo, setDocNo] = useState('')
  const [content, setContent] = useState('시청 공문 접수 후 처리')
  return <div className="modal-bg"><div className="modal">
    <h3>폐업/이탈 등록</h3>
    <div className="form-row"><b>처리사유</b><select className="select" value={type} onChange={e => setType(e.target.value)}><option>폐업</option><option>탈퇴</option><option>양도</option><option>이관</option></select></div>
    <div className="form-row"><b>관리번호</b><input className="input" value={docNo} onChange={e => setDocNo(e.target.value)} placeholder="관리번호 또는 접수번호" /></div>
    <div className="form-row"><b>내용</b><textarea className="textarea" value={content} onChange={e => setContent(e.target.value)} /></div>
    <div className="notice">현재 미수잔액 {formatWon(member.totalArrears)} 기준으로 폐업현황에 저장됩니다.</div>
    <div className="action-row right"><button className="btn" onClick={onClose}>취소</button><button className="btn red" onClick={() => onSave({ type, docNo, content })}>처리 저장</button></div>
  </div></div>
}

function EditModal({ member, onClose, onSave }){
  const [memo, setMemo] = useState(noteOf(member) === '-' ? '' : noteOf(member))
  return <div className="modal-bg"><div className="modal">
    <h3>메모 수정</h3>
    <textarea className="textarea" value={memo} onChange={e => setMemo(e.target.value)} />
    <div className="action-row right"><button className="btn" onClick={onClose}>취소</button><button className="btn primary" onClick={() => onSave(memo)}>저장</button></div>
  </div></div>
}
