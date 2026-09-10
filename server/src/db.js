import { v4 as uuidv4 } from 'uuid';

import initSqlJs from 'sql.js';

let db = null;

export async function initDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  db = new SQL.Database();
  initSchema();
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized — call initDb() first');
  return db;
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      industry TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      customer_tier TEXT NOT NULL,
      total_revenue REAL NOT NULL,
      payment_reliability REAL NOT NULL,
      average_payment_delay INTEGER NOT NULL,
      preferred_communication_channel TEXT NOT NULL,
      risk_level TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      days_overdue INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      dispute_flag INTEGER NOT NULL DEFAULT 0,
      true_recovery_probability REAL NOT NULL,
      batch_id TEXT NOT NULL,
      failure_reason TEXT,
      payment_method TEXT,
      data_source TEXT NOT NULL DEFAULT 'real',
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payment_history (
      payment_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      invoice_id TEXT,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      status TEXT NOT NULL,
      delay_days INTEGER NOT NULL,
      method TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS promises_to_pay (
      promise_id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      promised_amount REAL NOT NULL,
      promised_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recovery_attempts (
      attempt_id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      channel TEXT NOT NULL,
      action TEXT NOT NULL,
      message TEXT,
      response TEXT,
      outcome TEXT NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      event TEXT NOT NULL,
      evidence TEXT,
      reasoning TEXT,
      tool_called TEXT,
      tool_result TEXT,
      next_action TEXT,
      FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS batch_runs (
      batch_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      total_cases INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      agent_recovered_amount REAL NOT NULL DEFAULT 0,
      baseline_recovered_amount REAL NOT NULL DEFAULT 0,
      agent_recovered_count INTEGER NOT NULL DEFAULT 0,
      baseline_recovered_count INTEGER NOT NULL DEFAULT 0,
      agent_stopped_count INTEGER NOT NULL DEFAULT 0,
      agent_escalated_count INTEGER NOT NULL DEFAULT 0,
      total_at_risk_amount REAL NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS personal_payments (
      payment_id TEXT PRIMARY KEY,
      user_session TEXT NOT NULL DEFAULT 'default',
      payment_name TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      payment_date TEXT,
      payment_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      failure_reason TEXT,
      monthly_income REAL,
      monthly_expenses REAL,
      created_at TEXT NOT NULL,
      data_source TEXT NOT NULL DEFAULT 'real'
    )
  `);

  // Indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_invoices_batch ON invoices(batch_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attempts_invoice ON recovery_attempts(invoice_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_invoice ON audit_log(invoice_id)');
}

export function resetDb() {
  const d = getDb();
  d.run('DELETE FROM audit_log');
  d.run('DELETE FROM recovery_attempts');
  d.run('DELETE FROM promises_to_pay');
  d.run('DELETE FROM payment_history');
  d.run('DELETE FROM invoices');
  d.run('DELETE FROM customers');
  d.run('DELETE FROM batch_runs');
  d.run('DELETE FROM personal_payments');
}

/**
 * Returns the overall data source status of the dashboard:
 * 'empty'  — no invoices
 * 'real'   — all invoices are user-entered
 * 'demo'   — all invoices are generated demo data
 * 'mixed'  — mix of real and demo
 */
export function getDashboardDataSource() {
  const invoices = queryAll('SELECT data_source FROM invoices');
  if (invoices.length === 0) return 'empty';
  const hasReal = invoices.some(i => i.data_source === 'real');
  const hasDemo = invoices.some(i => i.data_source === 'demo');
  if (hasReal && hasDemo) return 'mixed';
  if (hasReal) return 'real';
  return 'demo';
}

/** Delete a single invoice and its related records */
export function deleteInvoice(invoiceId) {
  execute('DELETE FROM audit_log WHERE invoice_id = ?', [invoiceId]);
  execute('DELETE FROM recovery_attempts WHERE invoice_id = ?', [invoiceId]);
  execute('DELETE FROM promises_to_pay WHERE invoice_id = ?', [invoiceId]);
  execute('DELETE FROM invoices WHERE invoice_id = ?', [invoiceId]);
}

/** Delete a personal payment record */
export function deletePersonalPayment(paymentId) {
  execute('DELETE FROM personal_payments WHERE payment_id = ?', [paymentId]);
}

// ── Helpers — sql.js returns arrays, we convert to objects ───────────────────

function rowsToObjects(stmt) {
  const cols = stmt.getColumnNames();
  const results = [];
  while (stmt.step()) {
    const row = stmt.get();
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i]; });
    results.push(obj);
  }
  stmt.free();
  return results;
}

function queryAll(sql, params = []) {
  const stmt = getDb().prepare(sql);
  if (params.length) stmt.bind(params);
  return rowsToObjects(stmt);
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execute(sql, params = []) {
  getDb().run(sql, params);
}

// ── Public query helpers ─────────────────────────────────────────────────────

export function getInvoiceById(invoiceId) {
  return queryOne('SELECT * FROM invoices WHERE invoice_id = ?', [invoiceId]);
}

export function getInvoicesByBatch(batchId) {
  return queryAll('SELECT * FROM invoices WHERE batch_id = ? ORDER BY amount DESC', [batchId]);
}

export function getActiveInvoicesByBatch(batchId) {
  return queryAll("SELECT * FROM invoices WHERE batch_id = ? AND status = 'active' ORDER BY amount DESC", [batchId]);
}

/** Return ALL invoices across all batches, ordered by creation/amount */
export function getAllInvoices() {
  return queryAll('SELECT * FROM invoices ORDER BY amount DESC');
}

/** Return all invoices for a given status */
export function getInvoicesByStatus(status) {
  return queryAll('SELECT * FROM invoices WHERE status = ? ORDER BY amount DESC', [status]);
}

export function updateInvoiceStatus(invoiceId, status) {
  execute('UPDATE invoices SET status = ? WHERE invoice_id = ?', [status, invoiceId]);
}

export function getCustomerById(customerId) {
  return queryOne('SELECT * FROM customers WHERE customer_id = ?', [customerId]);
}

export function getPaymentHistoryByCustomer(customerId) {
  return queryAll('SELECT * FROM payment_history WHERE customer_id = ? ORDER BY payment_date DESC', [customerId]);
}

export function getPromisesByInvoice(invoiceId) {
  return queryAll('SELECT * FROM promises_to_pay WHERE invoice_id = ?', [invoiceId]);
}

export function getAllPromises() {
  return queryAll(`
    SELECT p.*, i.invoice_number, c.company_name
    FROM promises_to_pay p
    JOIN invoices i ON p.invoice_id = i.invoice_id
    JOIN customers c ON i.customer_id = c.customer_id
    ORDER BY p.created_at DESC
  `);
}

export function getRecoveryAttempts(invoiceId) {
  return queryAll('SELECT * FROM recovery_attempts WHERE invoice_id = ? ORDER BY timestamp ASC', [invoiceId]);
}

export function insertRecoveryAttempt(attempt) {
  execute(
    `INSERT INTO recovery_attempts (attempt_id, invoice_id, timestamp, channel, action, message, response, outcome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attempt.attempt_id, attempt.invoice_id, attempt.timestamp || new Date().toISOString(),
      attempt.channel, attempt.action, attempt.message, attempt.response, attempt.outcome
    ]
  );
}

export function insertPromiseToPay(promise) {
  execute(
    `INSERT INTO promises_to_pay (promise_id, invoice_id, promised_amount, promised_date, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      promise.promise_id, promise.invoice_id, promise.promised_amount,
      promise.promised_date, promise.created_at || new Date().toISOString(), promise.status || 'active'
    ]
  );
}

export function updatePromiseStatus(promiseId, status) {
  execute('UPDATE promises_to_pay SET status = ? WHERE promise_id = ?', [status, promiseId]);
}

export function logAudit(invoiceId, event, evidence, reasoning, toolCalled, toolResult, nextAction, simulatedDate = null) {
  execute(
    `INSERT INTO audit_log (invoice_id, timestamp, event, evidence, reasoning, tool_called, tool_result, next_action)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoiceId, simulatedDate || new Date().toISOString(), event, evidence, reasoning, toolCalled, toolResult, nextAction]
  );
}

export function getAuditLog(invoiceId) {
  return queryAll('SELECT * FROM audit_log WHERE invoice_id = ? ORDER BY timestamp ASC, id ASC', [invoiceId]);
}

export function getLatestBatch() {
  return queryOne('SELECT * FROM batch_runs ORDER BY created_at DESC LIMIT 1');
}

/**
 * Get or create a session batch. This eliminates the "Generate Demo Data first" requirement.
 * The batch is just a container for user-entered data.
 */
export function getOrCreateSessionBatch() {
  const existing = getLatestBatch();
  if (existing) return existing;

  const batchId = uuidv4();
  const now = new Date().toISOString();
  execute(
    `INSERT INTO batch_runs (batch_id, created_at, total_cases, status, total_at_risk_amount)
    VALUES (?, ?, 0, 'active', 0)`,
    [batchId, now]
  );
  return getLatestBatch();
}

export function updateBatchStatus(batchId, status) {
  execute('UPDATE batch_runs SET status = ? WHERE batch_id = ?', [status, batchId]);
}

export function updateBatchAgentResults(batchId, recoveredAmount, recoveredCount, stoppedCount, escalatedCount) {
  execute(
    `UPDATE batch_runs SET
      agent_recovered_amount = ?,
      agent_recovered_count = ?,
      agent_stopped_count = ?,
      agent_escalated_count = ?,
      status = 'completed'
    WHERE batch_id = ?`,
    [recoveredAmount, recoveredCount, stoppedCount, escalatedCount, batchId]
  );
}

export function updateBatchBaselineResults(batchId, recoveredAmount, recoveredCount) {
  execute(
    `UPDATE batch_runs SET
      baseline_recovered_amount = ?,
      baseline_recovered_count = ?
    WHERE batch_id = ?`,
    [recoveredAmount, recoveredCount, batchId]
  );
}

// ── Failure reason stats from actual data ────────────────────────────────────

export function getFailureReasonStats() {
  // Group by failure_reason (or category) and compute stats
  const invoices = getAllInvoices();
  const statsMap = {};

  for (const inv of invoices) {
    const reason = inv.failure_reason || inv.category || 'Unknown';
    if (!statsMap[reason]) {
      statsMap[reason] = { total: 0, recovered: 0 };
    }
    statsMap[reason].total++;
    if (inv.status === 'recovered') statsMap[reason].recovered++;
  }

  return Object.entries(statsMap).map(([reason, s]) => ({
    failure_reason: reason,
    count: s.total,
    recovery_rate: s.total > 0 ? s.recovered / s.total : 0
  }));
}

// ── Personal Payments ─────────────────────────────────────────────────────────

export function insertPersonalPayment(p) {
  execute(
    `INSERT INTO personal_payments (payment_id, user_session, payment_name, amount, due_date, payment_date, payment_type, status, failure_reason, monthly_income, monthly_expenses, created_at, data_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.payment_id || uuidv4(), p.user_session || 'default',
      p.payment_name, p.amount, p.due_date, p.payment_date || null,
      p.payment_type, p.status, p.failure_reason || null,
      p.monthly_income || null, p.monthly_expenses || null,
      p.created_at || new Date().toISOString(),
      p.data_source || 'real'
    ]
  );
}

export function getPersonalPayments(userSession = 'default') {
  return queryAll(
    'SELECT * FROM personal_payments WHERE user_session = ? ORDER BY created_at DESC',
    [userSession]
  );
}

// ── Bulk insert helpers used by generator ─────────────────────────────────────
export function insertCustomer(c) {
  execute(
    `INSERT INTO customers (customer_id, company_name, industry, contact_name, email, phone,
      customer_tier, total_revenue, payment_reliability, average_payment_delay,
      preferred_communication_channel, risk_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.customer_id, c.company_name, c.industry, c.contact_name, c.email, c.phone,
      c.customer_tier, c.total_revenue, c.payment_reliability, c.average_payment_delay,
      c.preferred_communication_channel, c.risk_level
    ]
  );
}

export function insertInvoice(i) {
  execute(
    `INSERT INTO invoices (invoice_id, customer_id, invoice_number, amount, currency,
      issue_date, due_date, days_overdue, status, category, priority, dispute_flag,
      true_recovery_probability, batch_id, failure_reason, payment_method, data_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      i.invoice_id, i.customer_id, i.invoice_number, i.amount, i.currency,
      i.issue_date, i.due_date, i.days_overdue, i.status, i.category, i.priority, i.dispute_flag,
      i.true_recovery_probability, i.batch_id, i.failure_reason || null, i.payment_method || null,
      i.data_source || 'real'
    ]
  );
}

export function insertPaymentHistory(p) {
  execute(
    `INSERT INTO payment_history (payment_id, customer_id, invoice_id, amount, payment_date, status, delay_days, method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.payment_id, p.customer_id, p.invoice_id, p.amount, p.payment_date, p.status, p.delay_days, p.method]
  );
}

export function insertBatchRun(batchId, now, totalCases, totalAtRisk) {
  execute(
    `INSERT INTO batch_runs (batch_id, created_at, total_cases, status, total_at_risk_amount)
    VALUES (?, ?, ?, 'pending', ?)`,
    [batchId, now, totalCases, totalAtRisk]
  );
}

// ── Backwards Compatibility Aliases (for Phase 1 transition) ────────────────
export const getCaseById = getInvoiceById;
export const getCasesByBatch = getInvoicesByBatch;
export const getActiveCasesByBatch = getActiveInvoicesByBatch;
export const updateCaseStatus = updateInvoiceStatus;
export const getAttemptsByCase = getRecoveryAttempts;

export function insertAttempt(caseId, channel, action, message, response, outcome) {
  insertRecoveryAttempt({
    attempt_id: uuidv4(),
    invoice_id: caseId,
    timestamp: new Date().toISOString(),
    channel,
    action,
    message,
    response,
    outcome
  });
}
