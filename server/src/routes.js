import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { generateBatch } from './generator.js';
import { decide } from './agent/engine.js';
import { runRecovery, runBatch } from './agent/orchestrator.js';

import {
  getLatestBatch,
  getInvoicesByBatch,
  getAuditLog,
  getRecoveryAttempts,
  getCustomerById,
  getInvoiceById,
  insertCustomer,
  insertInvoice,
  getDb
} from './db.js';

export const api = express.Router();

/* =========================================================
   BATCH GENERATION
========================================================= */

api.post('/batch/generate', (req, res) => {
  try {
    const { count } = req.body || {};
    const result = generateBatch(count || 400);
    res.json(result);
  } catch (err) {
    console.error('Generate batch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   MANUAL INVOICE CREATION
========================================================= */

api.post('/invoice/manual', (req, res) => {
  try {
    const batch = getLatestBatch();
    if (!batch) {
      return res.status(400).json({ success: false, error: 'Generate a batch first.' });
    }

    const data = req.body;
    const customerId = uuidv4();
    const invoiceId = uuidv4();

    // 1. Insert customer
    insertCustomer({
      customer_id: customerId,
      company_name: data.company_name,
      industry: 'Software',
      contact_name: data.contact_name,
      email: data.email,
      phone: '+91 0000000000',
      customer_tier: 'Enterprise',
      total_revenue: 10000000,
      payment_reliability: Number(data.payment_reliability) || 0.85,
      average_payment_delay: Number(data.average_payment_delay) || 5,
      preferred_communication_channel: 'email',
      risk_level: data.risk_level || 'Low'
    });

    // Calculate days overdue
    const issue = new Date(data.issue_date);
    const due = new Date(data.due_date);
    const now = new Date();
    let daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
    if (daysOverdue < 0) daysOverdue = 0;

    // 2. Insert invoice
    insertInvoice({
      invoice_id: invoiceId,
      customer_id: customerId,
      invoice_number: data.invoice_number,
      amount: Number(data.amount),
      currency: 'INR',
      issue_date: data.issue_date,
      due_date: data.due_date,
      days_overdue: daysOverdue,
      status: 'active',
      category: data.category || 'Software License',
      priority: 'High',
      dispute_flag: 0,
      true_recovery_probability: Number(data.payment_reliability) || 0.85,
      batch_id: batch.batch_id
    });

    // Update batch totals manually
    const db = getDb();
    db.run(
      'UPDATE batch_runs SET total_cases = total_cases + 1, total_at_risk_amount = total_at_risk_amount + ? WHERE batch_id = ?',
      [Number(data.amount), batch.batch_id]
    );

    res.json({ success: true, invoiceId, customerId });
  } catch (err) {
    console.error('Manual invoice error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   RECOVERY DECISION ENGINE (PHASE 2)
========================================================= */

api.post('/recovery/decide', (req, res) => {
  try {
    const { invoiceId } = req.body || {};
    if (!invoiceId) return res.status(400).json({ success: false, error: 'invoiceId is required' });
    const decision = decide(invoiceId);
    res.json(decision);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   AGENT EXECUTION (PHASE 3)
========================================================= */

api.post('/batch/run', (req, res) => {
  try {
    const batch = getLatestBatch();
    if (!batch) {
      return res.status(400).json({ success: false, error: 'No batch exists. Generate a batch first.' });
    }
    const result = runBatch(batch.batch_id);
    res.json(result);
  } catch (err) {
    console.error('Batch run error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

api.post('/recovery/:invoiceId/run', (req, res) => {
  try {
    const result = runRecovery(req.params.invoiceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/recovery/:invoiceId/status', (req, res) => {
  try {
    const inv = getInvoiceById(req.params.invoiceId);
    if (!inv) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ status: inv.status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/recovery/:invoiceId/timeline', (req, res) => {
  try {
    const audit = getAuditLog(req.params.invoiceId);
    res.json(audit);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   DASHBOARD
========================================================= */

api.get('/dashboard/summary', (req, res) => {
  try {
    const batch = getLatestBatch();
    if (!batch) return res.json({ hasBatch: false });

    const recoveryRate = batch.total_at_risk_amount > 0
      ? batch.agent_recovered_amount / batch.total_at_risk_amount
      : 0;
    const costPerAttempt = 25;
    const estimatedCost = batch.total_cases * 2.5 * costPerAttempt;
    const roi = estimatedCost > 0
      ? (batch.agent_recovered_amount - estimatedCost) / estimatedCost
      : 0;

    res.json({
      hasBatch: true,
      revenueAtRisk: batch.total_at_risk_amount,
      agentRecovered: batch.agent_recovered_amount,
      agentRecoveredCount: batch.agent_recovered_count,
      recoveryRate,
      totalCases: batch.total_cases,
      recoveryROI: roi
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/dashboard/comparison', (req, res) => {
  try {
    const batch = getLatestBatch();
    if (!batch) return res.json({ hasBatch: false });
    res.json({
      hasBatch: true,
      totalAtRisk: batch.total_at_risk_amount,
      agentRecovered: batch.agent_recovered_amount,
      baselineRecovered: batch.baseline_recovered_amount
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   CASE QUEUE
========================================================= */

api.get('/cases', (req, res) => {
  try {
    const batch = getLatestBatch();
    if (!batch) return res.json([]);

    const invoices = getInvoicesByBatch(batch.batch_id);
    const enriched = invoices.map(inv => {
      const cust = getCustomerById(inv.customer_id);
      return {
        case_id: inv.invoice_id,
        invoice_id: inv.invoice_id,
        customer_name: cust ? cust.company_name : 'Unknown',
        amount: inv.amount,
        failure_reason_code: inv.category,
        recovery_probability: inv.true_recovery_probability,
        erv: inv.amount * inv.true_recovery_probability,
        status: inv.status
      };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/cases/:id', (req, res) => {
  try {
    const inv = getInvoiceById(req.params.id);
    if (!inv) return res.status(404).json({ success: false, error: 'Not found' });

    const cust = getCustomerById(inv.customer_id);
    const audit = getAuditLog(inv.invoice_id);
    const attempts = getRecoveryAttempts(inv.invoice_id);

    res.json({
      case_id: inv.invoice_id,
      customer_name: cust ? cust.company_name : 'Unknown',
      amount: inv.amount,
      failure_reason_code: inv.category,
      status: inv.status,
      audit_log: audit,
      recovery_attempts: attempts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   ANALYTICS
========================================================= */

api.get('/analytics/by-failure-reason', (req, res) => {
  res.json([
    { failure_reason: 'Software License', recovery_rate: 0.65 },
    { failure_reason: 'Consulting Services', recovery_rate: 0.45 },
    { failure_reason: 'Hardware', recovery_rate: 0.85 }
  ]);
});

api.get('/analytics/by-intervention', (req, res) => {
  res.json([
    { action: 'SEND_FRIENDLY_REMINDER', success_rate: 0.72 },
    { action: 'SEND_PERSONALIZED_FOLLOWUP', success_rate: 0.48 },
    { action: 'RECORD_PROMISE_TO_PAY', success_rate: 0.88 },
    { action: 'ESCALATE_TO_FINANCE', success_rate: 0.35 }
  ]);
});

export default api;