const API = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// ─── Panel 1: Processing Agent Chat ──────────────────────────────────────────
export const agentStart = () =>
  request('/agent/start', { method: 'POST' });

export const agentChat = (sessionId, message) =>
  request('/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, message }),
  });

// ─── Panel 2: Status Monitor ─────────────────────────────────────────────────
export const getStatusSummary = () => request('/status/summary');

export const getStatusContracts = () => request('/status/contracts');

export const askStatusQuestion = (question, delivery) =>
  request('/status/ask', {
    method: 'POST',
    body: JSON.stringify({ question, delivery }),
  });

// ─── Panel 3: Contract Analysis ──────────────────────────────────────────────
export const getDeliveries = () => request('/analysis/deliveries');

export const analysisSetup = (delivery) =>
  request('/analysis/setup', {
    method: 'POST',
    body: JSON.stringify({ delivery }),
  });

export const analysisAsk = (question, delivery, contracts = null) =>
  request('/analysis/ask', {
    method: 'POST',
    body: JSON.stringify({ question, delivery, contracts }),
  });

// ─── Reports ─────────────────────────────────────────────────────────────────
export const getReconciliation = (delivery) =>
  request('/reports/reconciliation', {
    method: 'POST',
    body: JSON.stringify({ delivery }),
  });

export const getAuditReport = (delivery = null) =>
  request(`/reports/audit${delivery ? `?delivery=${encodeURIComponent(delivery)}` : ''}`);

// ─── Health ──────────────────────────────────────────────────────────────────
export const healthCheck = () => request('/health');
