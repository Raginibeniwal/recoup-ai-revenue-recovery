// ── Recoup API Service ──────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3001/api';

async function fetchJson(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });

    if (!res.ok) {
      const errText = await res.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch {}
      throw new Error(errJson?.error || errText || `Server error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Recoup server is not running. Please start the backend server on port 3001.');
    }
    throw err;
  }
}

export const api = {
  // Batch (internal/dev use only — generates demo-tagged data)
  generateBatch: (count = 400) => fetchJson('/batch/generate', { method: 'POST', body: JSON.stringify({ count }) }),
  runBatch: () => fetchJson('/batch/run', { method: 'POST', body: JSON.stringify({}) }),

  // Sample data — alias for generateBatch, used in the empty-state "Load Sample Data" link
  loadSampleData: (count = 15) => fetchJson('/batch/generate', { method: 'POST', body: JSON.stringify({ count }) }),

  // Payments — primary real-data endpoints
  analyzePayment: (data) => fetchJson('/payments/analyze', { method: 'POST', body: JSON.stringify(data) }),
  importCSV: (rows) => fetchJson('/payments/import', { method: 'POST', body: JSON.stringify({ rows }) }),

  // Delete — allow users to remove records
  deleteInvoice: (id) => fetchJson(`/invoices/${id}`, { method: 'DELETE' }),
  deletePersonalPayment: (id) => fetchJson(`/personal/payments/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboardSummary: () => fetchJson('/dashboard/summary'),
  getComparison: () => fetchJson('/dashboard/comparison'),

  // Cases
  getCases: () => fetchJson('/cases'),
  getCaseDetails: (id) => fetchJson(`/cases/${id}`),
  runSingleRecovery: (id) => fetchJson(`/recovery/${id}/run`, { method: 'POST' }),
  decideCase: (id) => fetchJson('/recovery/decide', { method: 'POST', body: JSON.stringify({ invoiceId: id }) }),

  // Promises
  getPromises: () => fetchJson('/promises'),
  updatePromiseStatus: (id, status) => fetchJson(`/promises/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  // Financial Health
  getFinancialHealth: (mode = 'business') => fetchJson(`/financial-health?mode=${mode}`),

  // Personal
  getPersonalSummary: () => fetchJson('/personal/summary'),
  addPersonalPayment: (data) => fetchJson('/personal/payments', { method: 'POST', body: JSON.stringify(data) }),

  // Assistant
  askAssistant: (question) => fetchJson('/assistant/chat', { method: 'POST', body: JSON.stringify({ question }) }),

  // Analytics
  getAnalyticsByReason: () => fetchJson('/analytics/by-failure-reason'),
  getAnalyticsByIntervention: () => fetchJson('/analytics/by-intervention'),
  getAnalyticsSummary: () => fetchJson('/analytics/summary'),
};

export default api;
