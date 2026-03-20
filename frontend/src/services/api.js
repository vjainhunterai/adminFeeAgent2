const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const getDashboardStats = () => request('/dashboard/stats');
export const getRecentActivity = () => request('/dashboard/recent-activity');

// ─── Processing ──────────────────────────────────────────────────────────────
export const submitContracts = (contracts, deliveryName, inputType = 'manual') =>
  request('/processing/submit', {
    method: 'POST',
    body: JSON.stringify({ contracts, delivery_name: deliveryName, input_type: inputType }),
  });

export const triggerPipeline = () =>
  request('/processing/trigger-pipeline', { method: 'POST' });

export const getProcessingStatus = () => request('/processing/status');

export const getProcessingContracts = () => request('/processing/contracts');

export const askStatusQuestion = (question, delivery) =>
  request('/processing/status-question', {
    method: 'POST',
    body: JSON.stringify({ question, delivery }),
  });

// ─── Analysis ────────────────────────────────────────────────────────────────
export const getDeliveries = () => request('/analysis/deliveries');

export const normalizeDelivery = (delivery) =>
  request('/analysis/normalize-delivery', {
    method: 'POST',
    body: JSON.stringify({ delivery }),
  });

export const getContractsForDelivery = (delivery) =>
  request('/analysis/contracts', {
    method: 'POST',
    body: JSON.stringify({ delivery }),
  });

export const askAnalysisQuestion = (question, delivery, contracts = null) =>
  request('/analysis/ask', {
    method: 'POST',
    body: JSON.stringify({ question, delivery, contracts }),
  });

// ─── Reports ─────────────────────────────────────────────────────────────────
export const getContractSummary = (delivery) =>
  request('/reports/summary', {
    method: 'POST',
    body: JSON.stringify({ delivery }),
  });

export const getAuditReport = (delivery = null) =>
  request(`/reports/audit${delivery ? `?delivery=${encodeURIComponent(delivery)}` : ''}`);

export const runCustomQuery = (query) =>
  request('/reports/custom-query', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });

// ─── Health ──────────────────────────────────────────────────────────────────
export const healthCheck = () => request('/health');
