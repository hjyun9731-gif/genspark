// 모바일 전용 공용 유틸 — 데스크톱 계산식과 독립.
// 미수개월수는 DB가 내려준 open 미수항목 수(arrearsMonths)만 사용한다.
// (부과기준일로 ceil(금액/월부과액) 추정 → 400개월·14억 과대계산 버그 방지)
export function fmtWon(n) {
  const v = Number(n) || 0
  return v.toLocaleString('ko-KR') + '원'
}
export function fmtNum(n) { return (Number(n) || 0).toLocaleString('ko-KR') }

export function monthCount(member) {
  const total = Number(member.totalArrears) || 0
  if (total <= 0) return 0
  const n = Number(member.arrearsMonths)
  if (Number.isFinite(n) && n >= 0) return n
  return 0
}

export function balanceTone(total) {
  if (total > 0) return 'due'
  if (total < 0) return 'pre'
  return 'clear'
}

export function telHref(phone) {
  const d = String(phone || '').replace(/[^0-9+]/g, '')
  return d ? 'tel:' + d : ''
}
export function smsHref(phone) {
  const d = String(phone || '').replace(/[^0-9+]/g, '')
  return d ? 'sms:' + d : ''
}

export function extractInfo(member, key) {
  const found = String(member.memo || '').split(/\s*\/\s*/).map(v => v.trim()).find(v => v.startsWith(key + ':'))
  return found ? found.slice(key.length + 1).trim() : ''
}
export function addressOf(member) {
  return extractInfo(member, '주소') || member.regionRaw || member.region_raw || ''
}
