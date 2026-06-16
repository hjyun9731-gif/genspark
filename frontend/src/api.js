const BASE = '/api';

async function http(path, options = {}) {
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(BASE + path, { headers, ...options });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `요청 실패 (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== '전체') sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  health: () => http('/health'),
  listMembers: (params = {}) => http(`/members${qs(params)}`),
  getMember: (id) => http(`/members/${id}`),
  updateMember: (id, body) => http(`/members/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  applyPayment: (id, body) => http(`/members/${id}/payments`, { method: 'POST', body: JSON.stringify(body) }),
  registerClosure: (id, body) => http(`/members/${id}/closure`, { method: 'POST', body: JSON.stringify(body) }),
  listDeposits: (params = {}) => http(`/deposits${qs(params)}`),
  matchDeposit: (id, body) => http(`/deposits/${id}/match`, { method: 'POST', body: JSON.stringify(body) }),
  matchDepositIncome: (id, body) => http(`/deposits/${id}/income`, { method: 'POST', body: JSON.stringify(body) }),
  matchDepositGroup: (id, body) => http(`/deposits/${id}/group-match`, { method: 'POST', body: JSON.stringify(body || {}) }),
  excludeDeposit: (id) => http(`/deposits/${id}/exclude`, { method: 'POST' }),
  resetPendingDeposits: () => http('/deposits/pending', { method: 'DELETE' }),
  createDeposits: (rows) => http('/deposits/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
  listClosures: () => http('/closures'),
  updateClosure: (id, body) => http(`/closures/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  restoreClosure: (id) => http(`/closures/${id}/restore`, { method: 'POST' }),
  deleteClosure: (id, restoreMember=false) => http(`/closures/${id}?restore_member=${restoreMember ? 'true' : 'false'}`, { method: 'DELETE' }),
  listPending: () => http('/pending'),
  createPending: (body) => http('/pending', { method: 'POST', body: JSON.stringify(body) }),
  updatePending: (id, body) => http(`/pending/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePending: (id) => http(`/pending/${id}`, { method: 'DELETE' }),
  promotePending: (id, body) => http(`/pending/${id}/promote`, { method: 'POST', body: JSON.stringify(body || {}) }),
  listPayments: (params = {}) => http(`/payments${qs(params)}`),
  updatePayment: (id, body) => http(`/payments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  cancelPayment: (id) => http(`/payments/${id}/cancel`, { method: 'POST' }),
  dashboardSummary: () => http('/dashboard/summary'),
  dashboardBySigun: () => http('/dashboard/by-sigun'),
  importPreview: (fileType, file) => {
    const fd = new FormData(); fd.append('file_type', fileType); fd.append('file', file);
    return http('/import/preview', { method: 'POST', body: fd });
  },
  importCommit: (fileType, file) => {
    const fd = new FormData(); fd.append('file_type', fileType); fd.append('file', file);
    return http('/import/commit', { method: 'POST', body: fd });
  },
  resetMisuData: () => http('/import/reset', { method: 'POST' }),
};
