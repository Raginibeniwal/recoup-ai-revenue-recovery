import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateBatch } from './generator.js';
import { decide, ACTION_LABELS, DIAGNOSIS_LABELS } from './agent/engine.js';
import { runRecovery, runBatch } from './agent/orchestrator.js';

import {
  getLatestBatch,
  getInvoicesByBatch,
  getAuditLog,
  getRecoveryAttempts,
  getCustomerById,
  getInvoiceById,
  getPromisesByInvoice,
  getAllPromises,
  updatePromiseStatus,
  updateInvoiceStatus,
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
    const caseCount = Number(count) || 400;
    const result = generateBatch(caseCount);
    res.json({
      success: true,
      batchId: result.batchId,
      totalCases: result.totalCases,
      totalAtRisk: result.totalAtRisk
    });
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

    insertCustomer({
      customer_id: customerId,
      company_name: data.company_name,
      industry: 'Software',
      contact_name: data.contact_name,
      email: data.email,
      phone: '+91 9876543210',
      customer_tier: 'Enterprise',
      total_revenue: 10000000,
      payment_reliability: Number(data.payment_reliability) || 0.85,
      average_payment_delay: Number(data.average_payment_delay) || 5,
      preferred_communication_channel: 'email',
      risk_level: data.risk_level || 'Low'
    });

    const issue = new Date(data.issue_date);
    const due = new Date(data.due_date);
    const now = new Date();
    let daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
    if (daysOverdue < 0) daysOverdue = 0;

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
    res.json({ success: true, result });
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

    const invoices = getInvoicesByBatch(batch.batch_id);
    let recoverableNow = 0;
    let overdueCount = 0;
    let highRiskCount = 0;
    let chronicLateCount = 0;
    let disputesCount = 0;
    let failedAttemptsCount = 0;

    const recommendations = [];

    invoices.forEach(inv => {
      if (inv.status === 'active') overdueCount++;
      if (inv.dispute_flag === 1) disputesCount++;

      try {
        const d = decide(inv.invoice_id);
        if (inv.status === 'active' && d.canAutomate) {
          recoverableNow += d.expectedRecoveryValue;
        }
        if (d.recoveryProbability < 0.3 || inv.dispute_flag === 1 || inv.days_overdue > 60) {
          highRiskCount++;
        }
        if (d.diagnosis === 'CHRONIC_LATE_PAYER') {
          chronicLateCount++;
        }

        const attempts = getRecoveryAttempts(inv.invoice_id);
        failedAttemptsCount += attempts.filter(a => a.outcome === 'NO_RESPONSE' || a.outcome === 'PAYMENT_FAILED').length;

        // Collect top 3 recommendations
        if (recommendations.length < 3 && inv.status === 'active') {
          const cust = getCustomerById(inv.customer_id);
          recommendations.push({
            invoiceId: inv.invoice_id,
            companyName: cust ? cust.company_name : 'Customer',
            invoiceNumber: inv.invoice_number,
            amount: inv.amount,
            reason: inv.dispute_flag === 1 ? 'Customer raised dispute' : `${inv.days_overdue} days overdue`,
            urgency: d.priorityLevel === 'HIGH' ? 'High' : d.priorityLevel === 'MEDIUM' ? 'Medium' : 'Normal',
            suggestedAction: d.actionLabel,
            canAutomate: d.canAutomate
          });
        }
      } catch (e) {}
    });

    const recoveryRate = batch.total_at_risk_amount > 0
      ? batch.agent_recovered_amount / batch.total_at_risk_amount
      : 0;
      
    const costPerAttempt = 25;
    const estimatedCost = batch.total_cases * 2.5 * costPerAttempt;
    const roi = estimatedCost > 0
      ? (batch.agent_recovered_amount - estimatedCost) / estimatedCost
      : 0;

    // Compute Business Financial Health Score (0-100)
    let score = 80;
    if (disputesCount > 0) score -= Math.min(disputesCount * 3, 15);
    if (overdueCount > 0) score -= Math.min(overdueCount * 0.5, 15);
    if (recoveryRate > 0.5) score += 10;
    score = Math.max(30, Math.min(98, Math.round(score)));

    const healthLabel = score >= 80 ? 'Healthy' : score >= 60 ? 'Watch' : 'At Risk';

    res.json({
      hasBatch: true,
      batchId: batch.batch_id,
      revenueAtRisk: batch.total_at_risk_amount,
      recoverableNow,
      agentRecovered: batch.agent_recovered_amount,
      agentRecoveredCount: batch.agent_recovered_count,
      overduePaymentsCount: overdueCount,
      recoveryRate,
      totalCases: batch.total_cases,
      recoveryROI: roi,
      financialHealthScore: score,
      financialHealthLabel: healthLabel,
      riskBreakdown: {
        highRiskInvoices: highRiskCount,
        latePayingCustomers: chronicLateCount,
        paymentFailures: failedAttemptsCount,
        customerDisputes: disputesCount
      },
      recommendations
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
      let decision = null;
      try {
        decision = decide(inv.invoice_id);
      } catch (e) {}

      return {
        case_id: inv.invoice_id,
        invoice_id: inv.invoice_id,
        invoice_number: inv.invoice_number,
        customer_name: cust ? cust.company_name : 'Unknown',
        customer_tier: cust ? cust.customer_tier : 'SMB',
        amount: inv.amount,
        days_overdue: inv.days_overdue,
        failure_reason_code: inv.category,
        dispute_flag: inv.dispute_flag,
        status: inv.status,
        recovery_probability: decision ? decision.recoveryProbability : inv.true_recovery_probability,
        erv: decision ? decision.expectedRecoveryValue : (inv.amount * inv.true_recovery_probability),
        priority_level: decision ? decision.priorityLevel : 'MEDIUM',
        can_automate: decision ? decision.canAutomate : true,
        requires_human: decision ? decision.requiresHuman : false,
        recommended_action: decision ? decision.recommendedAction : 'SEND_FRIENDLY_REMINDER',
        action_label: decision ? decision.actionLabel : 'Send friendly reminder',
        human_reasons: decision ? decision.humanReasons : [],
        diagnosis_label: decision ? decision.diagnosisLabel : 'Overdue Invoice'
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
    const promises = getPromisesByInvoice(inv.invoice_id);
    
    let decision = null;
    try {
      decision = decide(inv.invoice_id);
    } catch (e) {}

    res.json({
      case_id: inv.invoice_id,
      invoice_id: inv.invoice_id,
      invoice_number: inv.invoice_number,
      customer_name: cust ? cust.company_name : 'Unknown',
      contact_name: cust ? cust.contact_name : '',
      email: cust ? cust.email : '',
      amount: inv.amount,
      days_overdue: inv.days_overdue,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      failure_reason_code: inv.category,
      dispute_flag: inv.dispute_flag,
      status: inv.status,
      decision,
      audit_log: audit,
      recovery_attempts: attempts,
      promises_to_pay: promises
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   PROMISES TO PAY
========================================================= */

api.get('/promises', (req, res) => {
  try {
    const promises = getAllPromises();
    res.json(promises);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.post('/promises/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const promiseId = req.params.id;
    if (!['active', 'fulfilled', 'broken'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    updatePromiseStatus(promiseId, status);
    
    // If marked fulfilled, update invoice status to recovered
    const db = getDb();
    const promise = db.prepare('SELECT * FROM promises_to_pay WHERE promise_id = ?').get([promiseId]);
    if (promise && status === 'fulfilled') {
      updateInvoiceStatus(promise.invoice_id, 'recovered');
    }
    res.json({ success: true, promiseId, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   FINANCIAL HEALTH SCORE
========================================================= */

api.get('/financial-health', (req, res) => {
  try {
    const mode = req.query.mode || 'business';

    if (mode === 'personal') {
      return res.json({
        mode: 'personal',
        score: 78,
        label: 'Good',
        breakdown: {
          billPaymentSchedule: 84,
          autoDebitSuccess: 72,
          balanceBuffer: 75,
          debtExposure: 81
        },
        suggestions: [
          'Keep bill payments on schedule to prevent payment friction.',
          'Maintain sufficient account balance 2 days before recurring auto-debits.',
          'Resolve outstanding dues promptly to maintain positive financial standing.'
        ],
        disclaimer: 'This is an educational financial-health indicator, not an official credit score.'
      });
    }

    // Business mode — dynamically compute from DB
    const batch = getLatestBatch();
    let score = 82;
    let paymentReliabilityScore = 88;
    let overdueExposureScore = 76;
    let cashFlowStabilityScore = 84;
    let disputeExposureScore = 91;

    if (batch) {
      const invoices = getInvoicesByBatch(batch.batch_id);
      const activeCount = invoices.filter(i => i.status === 'active').length;
      const disputeCount = invoices.filter(i => i.dispute_flag === 1).length;
      const totalAmount = batch.total_at_risk_amount || 1;

      if (disputeCount > 0) disputeExposureScore = Math.max(40, 95 - disputeCount * 12);
      if (activeCount > 0) overdueExposureScore = Math.max(30, 90 - activeCount * 2);
    }

    score = Math.round((paymentReliabilityScore + overdueExposureScore + cashFlowStabilityScore + disputeExposureScore) / 4);
    const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Watch' : 'At Risk';

    res.json({
      mode: 'business',
      score,
      label,
      breakdown: {
        paymentReliability: paymentReliabilityScore,
        overdueExposure: overdueExposureScore,
        cashFlowStability: cashFlowStabilityScore,
        disputeExposure: disputeExposureScore
      },
      suggestions: [
        'Follow up on 3 high-value overdue invoices to reduce total revenue at risk.',
        'Offer convenient direct payment links to reduce payment delay days.',
        'Maintain timely resolution on disputed invoices to avoid write-offs.'
      ],
      disclaimer: 'This is an educational financial-health indicator, not an official credit score.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   PERSONAL MODE ENDPOINTS
========================================================= */

api.get('/personal/summary', (req, res) => {
  res.json({
    upcomingPayments: [
      { id: '1', name: 'Netflix Subscription', amount: 649, date: 'Tomorrow', category: 'Subscription', provider: 'Netflix India' },
      { id: '2', name: 'Electricity Bill', amount: 2450, date: 'Sep 08', category: 'Utilities', provider: 'BSES Rajdhani' },
      { id: '3', name: 'Credit Card Dues', amount: 15400, date: 'Sep 10', category: 'Financial', provider: 'HDFC Bank' }
    ],
    overdueAmount: 4200,
    overdueCount: 1,
    failedPaymentsCount: 2,
    paymentHealthScore: 78,
    healthLabel: 'Good',
    alerts: [
      {
        id: 'alt-1',
        title: '2 Recent Auto-Debit Failures',
        message: 'Repeated failed auto-debits can indicate payment friction. Maintain a buffer balance before scheduled payment dates.',
        level: 'warning'
      }
    ],
    suggestions: [
      'Keep bill payments on schedule to prevent payment friction.',
      'Avoid repeated failed auto-debits by keeping sufficient balance before due dates.',
      'Maintain sufficient balance buffer 2 days prior to recurring payments.'
    ],
    disclaimer: 'This information is educational and does not constitute official credit bureau scoring or financial advice.'
  });
});


/* =========================================================
   RECOUP ASSISTANT (RULE-BASED AI ASSISTANT)
========================================================= */

api.post('/assistant/chat', (req, res) => {
  try {
    const { question } = req.body || {};
    const q = (question || '').toLowerCase();

    const batch = getLatestBatch();
    let reply = '';
    let actionTip = '';

    if (q.includes('first') || q.includes('priorit') || q.includes('start')) {
      if (batch) {
        const invoices = getInvoicesByBatch(batch.batch_id);
        const active = invoices.filter(i => i.status === 'active');
        if (active.length > 0) {
          const top = active.sort((a, b) => (b.amount * b.true_recovery_probability) - (a.amount * a.true_recovery_probability))[0];
          const cust = getCustomerById(top.customer_id);
          reply = `Start with the ₹${(top.amount / 100000).toFixed(2)}L invoice from ${cust ? cust.company_name : 'customer'} (${top.invoice_number}). It has high expected recovery value and strong recovery probability.`;
          actionTip = `Recommended action: ${decide(top.invoice_id).actionLabel}`;
        } else {
          reply = 'All active cases have been processed! Check the Analytics or Financial Health tab for summary metrics.';
        }
      } else {
        reply = 'Generate demo data first to analyze active invoices and recovery priorities.';
      }
    } else if (q.includes('attention') || q.includes('wrong') || q.includes('risk')) {
      if (batch) {
        reply = `You have ₹${(batch.total_at_risk_amount / 100000).toFixed(1)}L total revenue at risk across ${batch.total_cases} cases. Key areas needing attention: disputed invoices and chronic late-paying accounts.`;
        actionTip = 'Recommendation: Review high-risk cases that require human intervention first.';
      } else {
        reply = 'No active batch data found. Click "Generate Demo Data" to load realistic cases.';
      }
    } else if (q.includes('score') || q.includes('health') || q.includes('fall') || q.includes('change')) {
      reply = 'Financial health scores change based on: 1) Overdue invoice duration, 2) Repeated payment failures, and 3) Active customer disputes. Resolving disputes and following up on early overdue payments quickly improves your health rating.';
      actionTip = 'Tip: Follow up on invoices past due by 7–15 days to stop recovery decay.';
    } else {
      reply = 'Recoup identifies revenue risks, calculates expected recovery value (ERV), recommends optimal follow-up actions, and protects sensitive customer relationships with bounded autonomy stopping rules.';
      actionTip = 'Suggested question: "What should I recover first?"';
    }

    res.json({
      success: true,
      reply,
      actionTip,
      timestamp: new Date().toISOString()
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
    { failure_reason: 'Hardware Procurement', recovery_rate: 0.85 },
    { failure_reason: 'Monthly Retainer', recovery_rate: 0.72 }
  ]);
});

api.get('/analytics/by-intervention', (req, res) => {
  res.json([
    { action: 'SEND_FRIENDLY_REMINDER', success_rate: 0.72 },
    { action: 'SEND_PERSONALIZED_FOLLOWUP', success_rate: 0.48 },
    { action: 'SEND_PAYMENT_LINK', success_rate: 0.68 },
    { action: 'RECORD_PROMISE_TO_PAY', success_rate: 0.88 },
    { action: 'ESCALATE_TO_FINANCE', success_rate: 0.35 }
  ]);
});

export default api;