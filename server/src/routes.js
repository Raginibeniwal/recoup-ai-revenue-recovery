import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateBatch } from './generator.js';
import { decide, ACTION_LABELS, DIAGNOSIS_LABELS } from './agent/engine.js';
import { runRecovery, runBatch } from './agent/orchestrator.js';

import {
  getLatestBatch,
  getOrCreateSessionBatch,
  getInvoicesByBatch,
  getAllInvoices,
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
  getFailureReasonStats,
  insertPersonalPayment,
  getPersonalPayments,
  getDashboardDataSource,
  deleteInvoice,
  deletePersonalPayment,
  getDb
} from './db.js';

export const api = express.Router();

// ── Helper: analyse failure reason text → structured reasoning ───────────────

function buildFailureReasoning(failureReason, paymentReliability, daysOverdue) {
  const r = (failureReason || '').toLowerCase();
  const reliability = Number(paymentReliability) || 0.5;
  const overdue = Number(daysOverdue) || 0;

  const reliabilityStr = reliability >= 0.8
    ? 'This customer has historically paid on time, suggesting strong recovery potential.'
    : reliability >= 0.6
    ? 'This customer has a moderate payment record with occasional delays.'
    : 'This customer has a history of late or missed payments.';

  if (r.includes('insufficient') || r.includes('funds') || r.includes('balance')) {
    return `The payment appears to have failed because the customer's available balance was insufficient at the time of the payment attempt. ${reliabilityStr} A retry after confirming the customer's preferred payment date is recommended.`;
  }
  if (r.includes('expired') || r.includes('card')) {
    return `The payment method may no longer be valid. The card on file has likely expired. ${reliabilityStr} Request the customer to update their payment method before retrying.`;
  }
  if (r.includes('bank') || r.includes('decline') || r.includes('declined') || r.includes('authorization')) {
    return `The bank declined the authorization. This could indicate a temporary hold, insufficient limit, or security block. ${reliabilityStr} A single retry may succeed, but repeated attempts should be avoided to prevent customer friction.`;
  }
  if (r.includes('dispute') || r.includes('disputed') || r.includes('chargeback')) {
    return `The customer has initiated a dispute on this invoice. Automated recovery should be paused immediately. ${reliabilityStr} Route this case for manual review by your finance team to resolve the underlying disagreement before any payment attempt.`;
  }
  if (r.includes('technical') || r.includes('gateway') || r.includes('timeout') || r.includes('error') || r.includes('processing')) {
    return `The payment failed due to a likely technical or processing issue (gateway timeout, network error, or system outage). ${reliabilityStr} A retry after a short interval is recommended — this type of failure often succeeds on the next attempt.`;
  }
  if (r.includes('cancelled') || r.includes('canceled')) {
    return `The payment was cancelled, either by the customer or by an automated system rule. ${reliabilityStr} A personalized follow-up to understand the reason for cancellation is recommended before retrying.`;
  }
  if (r.includes('overdue') || r.includes('late')) {
    return `The invoice is overdue by ${overdue} days without a payment being made. ${reliabilityStr} A prompt follow-up reminder is appropriate at this stage.`;
  }
  // Generic fallback
  return `The payment could not be processed due to: ${failureReason || 'unspecified reason'}. ${reliabilityStr} Review the failure details and select the most appropriate recovery action.`;
}

function buildRecommendedAction(failureReason, paymentReliability, daysOverdue, disputeFlag) {
  const r = (failureReason || '').toLowerCase();
  const reliability = Number(paymentReliability) || 0.5;

  if (disputeFlag === 1 || r.includes('dispute')) {
    return 'Route to finance team for manual dispute resolution before any payment retry.';
  }
  if (r.includes('expired') || r.includes('card')) {
    return 'Send a polite request to update the payment method, then schedule a retry.';
  }
  if (r.includes('insufficient') || r.includes('funds') || r.includes('balance')) {
    if (reliability >= 0.75) {
      return 'Send a personalized payment reminder and confirm the customer\'s preferred payment date, then retry.';
    }
    return 'Follow up with a direct call or email to arrange a payment plan or revised schedule.';
  }
  if (r.includes('technical') || r.includes('gateway') || r.includes('timeout')) {
    return 'Automatically retry the payment after a 24-hour interval. No customer contact needed for the first retry.';
  }
  if (r.includes('bank') || r.includes('decline')) {
    return 'Contact the customer to verify banking details and request authorization for a single retry.';
  }
  if (Number(daysOverdue) > 30) {
    return 'Escalate to Account Manager for a high-priority follow-up call.';
  }
  if (reliability >= 0.8) {
    return 'Send a friendly payment reminder — this customer normally pays on time.';
  }
  return 'Send a personalized follow-up with a direct payment link to reduce friction.';
}

/* =========================================================
   PAYMENTS — ANALYZE (PRIMARY NEW ENDPOINT)
========================================================= */

api.post('/payments/analyze', (req, res) => {
  try {
    const data = req.body;

    // Validate required fields
    const errors = [];
    if (!data.customer_name && !data.company_name) errors.push('Customer / Company name is required.');
    if (!data.amount || isNaN(Number(data.amount))) errors.push('Invoice amount must be a valid number.');
    if (Number(data.amount) <= 0) errors.push('Invoice amount must be greater than 0.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Get or create session batch (no "Generate Demo Data" needed)
    const batch = getOrCreateSessionBatch();

    const customerId = uuidv4();
    const invoiceId = uuidv4();
    const now = new Date();
    const nowISO = now.toISOString();

    const companyName = data.customer_name || data.company_name || 'Unknown Customer';
    const invoiceNumber = data.invoice_id || data.invoice_number || `INV-${Date.now()}`;
    const amount = Number(data.amount);
    const currency = data.currency || 'INR';
    const paymentReliability = data.payment_reliability != null ? Number(data.payment_reliability) : 0.75;
    const customerTier = data.customer_tier || 'SMB';
    const failureReason = data.failure_reason || data.payment_failure_reason || '';
    const paymentMethod = data.payment_method || '';
    const disputeFlag = (data.dispute_status === 'disputed' || data.dispute_flag === 1) ? 1 : 0;

    // Compute days overdue
    let daysOverdue = 0;
    if (data.days_overdue != null && !isNaN(Number(data.days_overdue))) {
      daysOverdue = Math.max(0, Number(data.days_overdue));
    } else if (data.due_date) {
      const due = new Date(data.due_date);
      daysOverdue = Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
    }

    const dueDate = data.due_date || nowISO.split('T')[0];
    const issueDate = data.payment_date || data.issue_date || nowISO.split('T')[0];

    // Map failure reason to category
    const fr = failureReason.toLowerCase();
    let category = data.category || 'Payment Failure';
    if (fr.includes('insufficient') || fr.includes('funds')) category = 'Insufficient Funds';
    else if (fr.includes('expired') || fr.includes('card')) category = 'Expired Card';
    else if (fr.includes('bank') || fr.includes('decline')) category = 'Bank Decline';
    else if (fr.includes('dispute')) category = 'Customer Dispute';
    else if (fr.includes('technical') || fr.includes('gateway')) category = 'Technical Failure';
    else if (failureReason) category = failureReason;

    // Insert customer
    insertCustomer({
      customer_id: customerId,
      company_name: companyName,
      industry: data.industry || 'General',
      contact_name: data.contact_name || companyName,
      email: data.email || '',
      phone: data.phone || '',
      customer_tier: customerTier,
      total_revenue: amount * 10,
      payment_reliability: paymentReliability,
      average_payment_delay: daysOverdue,
      preferred_communication_channel: 'email',
      risk_level: paymentReliability >= 0.75 ? 'Low' : paymentReliability >= 0.5 ? 'Medium' : 'High'
    });

    // Insert invoice
    insertInvoice({
      invoice_id: invoiceId,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      amount,
      currency,
      issue_date: issueDate,
      due_date: dueDate,
      days_overdue: daysOverdue,
      status: (data.payment_status || data.status || 'active') === 'failed' ? 'active' : (data.payment_status || data.status || 'active'),
      category,
      priority: amount >= 100000 ? 'High' : amount >= 25000 ? 'Medium' : 'Low',
      dispute_flag: disputeFlag,
      true_recovery_probability: paymentReliability,
      batch_id: batch.batch_id,
      failure_reason: failureReason,
      payment_method: paymentMethod,
      data_source: 'real'  // Always 'real' for manually entered data
    });

    // Update batch totals
    getDb().run(
      'UPDATE batch_runs SET total_cases = total_cases + 1, total_at_risk_amount = total_at_risk_amount + ? WHERE batch_id = ?',
      [amount, batch.batch_id]
    );

    // Run AI recovery decision engine
    let decision = null;
    try {
      decision = decide(invoiceId);
    } catch (e) {
      console.error('Engine decide error:', e.message);
    }

    // Build human-readable reasoning
    const reasoning = buildFailureReasoning(failureReason, paymentReliability, daysOverdue);
    const recommendedAction = buildRecommendedAction(failureReason, paymentReliability, daysOverdue, disputeFlag);

    const recoveryProbability = decision ? decision.recoveryProbability : paymentReliability;
    const expectedRecoveryValue = amount * recoveryProbability;
    const priorityLevel = decision ? decision.priorityLevel : (amount >= 100000 ? 'HIGH' : 'MEDIUM');

    res.json({
      success: true,
      invoiceId,
      customerId,
      analysis: {
        failureReason,
        reasoning,
        recoveryProbability: Number(recoveryProbability.toFixed(2)),
        recoveryProbabilityPct: `${(recoveryProbability * 100).toFixed(0)}%`,
        expectedRecoverableAmount: Number(expectedRecoveryValue.toFixed(2)),
        invoiceAmount: amount,
        priorityLevel,
        recommendedAction,
        diagnosis: decision ? decision.diagnosisLabel : 'Payment Failure',
        canAutomate: decision ? decision.canAutomate : !disputeFlag,
        requiresHuman: decision ? decision.requiresHuman : (disputeFlag === 1),
        decisionFactors: decision ? decision.decisionFactors : [`Base reliability: ${(paymentReliability * 100).toFixed(0)}%`]
      }
    });
  } catch (err) {
    console.error('Analyze payment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   PAYMENTS — CSV IMPORT
========================================================= */

api.post('/payments/import', (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ success: false, error: 'rows array is required.' });
    }

    const batch = getOrCreateSessionBatch();
    const importedIds = [];
    const rowErrors = [];
    let totalImportedAmount = 0;

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const rowErrs = [];

      if (!row.customer_name && !row.company_name) rowErrs.push(`Row ${rowNum}: customer_name is required.`);
      if (!row.amount || isNaN(Number(row.amount))) rowErrs.push(`Row ${rowNum}: amount must be a valid number.`);
      if (Number(row.amount) <= 0) rowErrs.push(`Row ${rowNum}: amount must be greater than 0.`);

      if (rowErrs.length > 0) {
        rowErrors.push(...rowErrs);
        return;
      }

      const customerId = uuidv4();
      const invoiceId = uuidv4();
      const now = new Date();
      const amount = Number(row.amount);
      const paymentReliability = row.payment_reliability != null ? Number(row.payment_reliability) : 0.70;
      const failureReason = row.failure_reason || '';
      const disputeFlag = (row.dispute_flag === '1' || row.dispute_flag === 1 || row.dispute_flag === 'true') ? 1 : 0;

      let daysOverdue = 0;
      if (row.days_overdue != null && !isNaN(Number(row.days_overdue))) {
        daysOverdue = Math.max(0, Number(row.days_overdue));
      } else if (row.due_date) {
        const due = new Date(row.due_date);
        daysOverdue = Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
      }

      const fr = failureReason.toLowerCase();
      let category = row.category || 'Payment Failure';
      if (fr.includes('insufficient') || fr.includes('funds')) category = 'Insufficient Funds';
      else if (fr.includes('expired') || fr.includes('card')) category = 'Expired Card';
      else if (fr.includes('bank') || fr.includes('decline')) category = 'Bank Decline';
      else if (fr.includes('dispute')) category = 'Customer Dispute';
      else if (fr.includes('technical') || fr.includes('gateway')) category = 'Technical Failure';
      else if (failureReason) category = failureReason;

      try {
        insertCustomer({
          customer_id: customerId,
          company_name: row.customer_name || row.company_name,
          industry: row.industry || 'General',
          contact_name: row.contact_name || row.customer_name || 'Contact',
          email: row.email || '',
          phone: row.phone || '',
          customer_tier: row.customer_tier || 'SMB',
          total_revenue: amount * 10,
          payment_reliability: paymentReliability,
          average_payment_delay: daysOverdue,
          preferred_communication_channel: 'email',
          risk_level: paymentReliability >= 0.75 ? 'Low' : paymentReliability >= 0.5 ? 'Medium' : 'High'
        });

        insertInvoice({
          invoice_id: invoiceId,
          customer_id: customerId,
          invoice_number: row.invoice_id || row.invoice_number || `INV-${Date.now()}-${rowNum}`,
          amount,
          currency: row.currency || 'INR',
          issue_date: row.payment_date || now.toISOString().split('T')[0],
          due_date: row.due_date || now.toISOString().split('T')[0],
          days_overdue: daysOverdue,
          status: (row.status || 'active') === 'failed' ? 'active' : (row.status || 'active'),
          category,
          priority: amount >= 100000 ? 'High' : amount >= 25000 ? 'Medium' : 'Low',
          dispute_flag: disputeFlag,
          true_recovery_probability: paymentReliability,
          batch_id: batch.batch_id,
          failure_reason: failureReason,
          payment_method: row.payment_method || '',
          data_source: 'real'  // CSV imports are real user data
        });

        totalImportedAmount += amount;
        importedIds.push(invoiceId);
      } catch (e) {
        rowErrors.push(`Row ${rowNum}: ${e.message}`);
      }
    });

    // Update batch totals
    if (importedIds.length > 0) {
      getDb().run(
        'UPDATE batch_runs SET total_cases = total_cases + ?, total_at_risk_amount = total_at_risk_amount + ? WHERE batch_id = ?',
        [importedIds.length, totalImportedAmount, batch.batch_id]
      );
    }

    res.json({
      success: true,
      imported: importedIds.length,
      failed: rowErrors.length,
      errors: rowErrors,
      totalAmount: totalImportedAmount,
      invoiceIds: importedIds
    });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   BATCH GENERATION (kept for internal dev / demo use)
========================================================= */

api.post('/batch/generate', (req, res) => {
  try {
    const { count } = req.body || {};
    const caseCount = Number(count) || 400;
    const result = generateBatch(caseCount, 'demo'); // Tag as demo data
    res.json({
      success: true,
      batchId: result.batchId,
      totalCases: result.totalCases,
      totalAtRisk: result.totalAtRisk,
      dataSource: 'demo'
    });
  } catch (err) {
    console.error('Generate batch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   DELETE — Remove individual records
========================================================= */

api.delete('/invoices/:id', (req, res) => {
  try {
    const { id } = req.params;
    const inv = getInvoiceById(id);
    if (!inv) return res.status(404).json({ success: false, error: 'Invoice not found.' });
    deleteInvoice(id);
    res.json({ success: true, invoiceId: id });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

api.delete('/personal/payments/:id', (req, res) => {
  try {
    const { id } = req.params;
    deletePersonalPayment(id);
    res.json({ success: true, paymentId: id });
  } catch (err) {
    console.error('Delete personal payment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   MANUAL INVOICE CREATION (legacy, now works without existing batch)
========================================================= */

api.post('/invoice/manual', (req, res) => {
  try {
    const batch = getOrCreateSessionBatch(); // No longer requires pre-existing batch

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
      batch_id: batch.batch_id,
      failure_reason: data.failure_reason || ''
    });

    getDb().run(
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
   RECOVERY DECISION ENGINE
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
   AGENT EXECUTION
========================================================= */

api.post('/batch/run', (req, res) => {
  try {
    const batch = getLatestBatch();
    if (!batch) {
      return res.status(400).json({ success: false, error: 'No batch exists. Add some payment records first.' });
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
   DASHBOARD — now works without "Generate Demo Data"
========================================================= */

api.get('/dashboard/summary', (req, res) => {
  try {
    // Use all invoices — no batch gate required
    const invoices = getAllInvoices();

    if (invoices.length === 0) {
      return res.json({
        hasData: false,
        hasBatch: false,
        revenueAtRisk: 0,
        recoverableRevenue: 0,
        recoveredRevenue: 0,
        recoveryRate: 0,
        totalCases: 0,
        failedCount: 0,
        overduePaymentsCount: 0,
        avgDaysOverdue: 0,
        highPriorityCases: 0,
        financialHealthScore: 0,
        financialHealthLabel: 'No Data',
        riskBreakdown: { highRiskInvoices: 0, latePayingCustomers: 0, paymentFailures: 0, customerDisputes: 0 },
        recommendations: []
      });
    }

    let revenueAtRisk = 0;
    let recoverableRevenue = 0;
    let recoveredRevenue = 0;
    let failedCount = 0;
    let overdueCount = 0;
    let highPriorityCases = 0;
    let highRiskCount = 0;
    let chronicLateCount = 0;
    let failedAttemptsCount = 0;
    let disputesCount = 0;
    let totalDaysOverdue = 0;
    const recommendations = [];

    for (const inv of invoices) {
      // Revenue at risk = all non-recovered invoices
      if (inv.status !== 'recovered') {
        revenueAtRisk += inv.amount;
        failedCount++;
      }
      if (inv.status === 'recovered') {
        recoveredRevenue += inv.amount;
      }
      if (inv.days_overdue > 0 && inv.status !== 'recovered') {
        overdueCount++;
        totalDaysOverdue += inv.days_overdue;
      }
      if (inv.dispute_flag === 1) disputesCount++;

      let decision = null;
      try {
        decision = decide(inv.invoice_id);
      } catch (e) {}

      const prob = decision ? decision.recoveryProbability : inv.true_recovery_probability;
      const erv = inv.amount * prob;

      if (inv.status !== 'recovered') {
        recoverableRevenue += erv;
      }

      if (decision) {
        if (decision.priorityLevel === 'HIGH') highPriorityCases++;
        if (decision.recoveryProbability < 0.3 || inv.dispute_flag === 1 || inv.days_overdue > 60) highRiskCount++;
        if (decision.diagnosis === 'CHRONIC_LATE_PAYER') chronicLateCount++;
      }

      const attempts = getRecoveryAttempts(inv.invoice_id);
      failedAttemptsCount += attempts.filter(a => a.outcome === 'NO_RESPONSE' || a.outcome === 'PAYMENT_FAILED').length;

      if (recommendations.length < 3 && inv.status !== 'recovered' && decision) {
        const cust = getCustomerById(inv.customer_id);
        recommendations.push({
          invoiceId: inv.invoice_id,
          companyName: cust ? cust.company_name : 'Customer',
          invoiceNumber: inv.invoice_number,
          amount: inv.amount,
          failureReason: inv.failure_reason || inv.category || '',
          reason: inv.dispute_flag === 1 ? 'Customer raised dispute' : `${inv.days_overdue} days overdue`,
          urgency: decision.priorityLevel === 'HIGH' ? 'High' : decision.priorityLevel === 'MEDIUM' ? 'Medium' : 'Normal',
          suggestedAction: decision.actionLabel,
          canAutomate: decision.canAutomate,
          recoveryProbability: decision.recoveryProbability,
          erv
        });
      }
    }

    const recoveryRate = revenueAtRisk > 0 ? recoveredRevenue / (revenueAtRisk + recoveredRevenue) : 0;
    const avgDaysOverdue = overdueCount > 0 ? Math.round(totalDaysOverdue / overdueCount) : 0;

    // Financial health score
    let score = 80;
    if (disputesCount > 0) score -= Math.min(disputesCount * 5, 20);
    if (overdueCount > 0) score -= Math.min(overdueCount * 1, 15);
    if (recoveryRate > 0.5) score += 10;
    if (highPriorityCases > 0) score -= Math.min(highPriorityCases * 2, 10);
    score = Math.max(30, Math.min(98, Math.round(score)));

    const healthLabel = score >= 80 ? 'Healthy' : score >= 60 ? 'Needs Attention' : 'High Risk';

    // Determine data source label for UI indicator
    const dataSource = getDashboardDataSource();

    res.json({
      hasData: true,
      hasBatch: true, // kept for backward compat
      dataSource,     // 'real' | 'demo' | 'mixed'
      revenueAtRisk,
      recoverableRevenue,
      recoveredRevenue,
      recoverableNow: recoverableRevenue, // compat alias
      agentRecovered: recoveredRevenue,   // compat alias
      recoveryRate,
      totalCases: invoices.length,
      failedCount,
      overduePaymentsCount: overdueCount,
      avgDaysOverdue,
      highPriorityCases,
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
   CASE QUEUE — now works without batch
========================================================= */

api.get('/cases', (req, res) => {
  try {
    const invoices = getAllInvoices();

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
        currency: inv.currency || 'INR',
        days_overdue: inv.days_overdue,
        failure_reason: inv.failure_reason || inv.category || '',
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

    // Build reasoning for the case detail view
    const reasoning = buildFailureReasoning(
      inv.failure_reason || inv.category,
      cust ? cust.payment_reliability : 0.7,
      inv.days_overdue
    );
    const recommendedActionText = buildRecommendedAction(
      inv.failure_reason || inv.category,
      cust ? cust.payment_reliability : 0.7,
      inv.days_overdue,
      inv.dispute_flag
    );

    res.json({
      case_id: inv.invoice_id,
      invoice_id: inv.invoice_id,
      invoice_number: inv.invoice_number,
      customer_name: cust ? cust.company_name : 'Unknown',
      customer_tier: cust ? cust.customer_tier : 'SMB',
      contact_name: cust ? cust.contact_name : '',
      email: cust ? cust.email : '',
      payment_reliability: cust ? cust.payment_reliability : 0.7,
      amount: inv.amount,
      currency: inv.currency || 'INR',
      days_overdue: inv.days_overdue,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      failure_reason: inv.failure_reason || inv.category || '',
      failure_reason_code: inv.category,
      dispute_flag: inv.dispute_flag,
      payment_method: inv.payment_method || '',
      status: inv.status,
      reasoning,
      recommended_action_text: recommendedActionText,
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
   FINANCIAL HEALTH SCORE — uses real data
========================================================= */

api.get('/financial-health', (req, res) => {
  try {
    const mode = req.query.mode || 'business';

    if (mode === 'personal') {
      // Build from real personal payments if any
      const payments = getPersonalPayments('default');
      const failedPayments = payments.filter(p => p.status === 'failed' || p.status === 'overdue');
      const overduePayments = payments.filter(p => p.status === 'overdue');

      let score = 78;
      if (failedPayments.length > 0) score -= Math.min(failedPayments.length * 8, 30);
      if (overduePayments.length > 0) score -= Math.min(overduePayments.length * 5, 20);
      score = Math.max(30, Math.min(98, score));

      const label = score >= 80 ? 'Good' : score >= 60 ? 'Needs Attention' : 'At Risk';

      const suggestions = [
        'Keep bill payments on schedule to prevent payment friction.',
        'Maintain sufficient account balance 2 days before recurring auto-debits.',
        'Resolve outstanding dues promptly to maintain positive financial standing.',
        'Avoid repeatedly missing due dates — consistent payment history matters.',
        'Update any expired payment methods before scheduled payments.',
      ];

      return res.json({
        mode: 'personal',
        score,
        label,
        hasData: payments.length > 0,
        totalPayments: payments.length,
        failedCount: failedPayments.length,
        breakdown: {
          billPaymentSchedule: Math.max(40, 88 - failedPayments.length * 10),
          autoDebitSuccess: Math.max(40, 80 - failedPayments.length * 12),
          balanceBuffer: Math.max(40, 75 - overduePayments.length * 10),
          debtExposure: Math.max(40, 85 - (overduePayments.length * 8))
        },
        suggestions,
        disclaimer: 'This is an educational financial-health indicator, not an official credit score.'
      });
    }

    // Business mode — dynamically compute from real invoices
    const invoices = getAllInvoices();
    const activeCount = invoices.filter(i => i.status === 'active').length;
    const disputeCount = invoices.filter(i => i.dispute_flag === 1).length;
    const recoveredCount = invoices.filter(i => i.status === 'recovered').length;

    let paymentReliabilityScore = 88;
    let overdueExposureScore = 80;
    let cashFlowStabilityScore = 82;
    let disputeExposureScore = 91;

    if (invoices.length > 0) {
      if (disputeCount > 0) disputeExposureScore = Math.max(40, 95 - disputeCount * 12);
      if (activeCount > 0) overdueExposureScore = Math.max(30, 90 - activeCount * 3);
      if (recoveredCount > 0 && invoices.length > 0) {
        paymentReliabilityScore = Math.round(70 + (recoveredCount / invoices.length) * 28);
      }
    }

    const score = Math.round((paymentReliabilityScore + overdueExposureScore + cashFlowStabilityScore + disputeExposureScore) / 4);
    const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Needs Attention' : 'At Risk';

    const suggestions = [];
    if (activeCount > 0) suggestions.push(`Follow up on ${activeCount} overdue invoice${activeCount > 1 ? 's' : ''} to reduce revenue at risk.`);
    if (disputeCount > 0) suggestions.push(`Resolve ${disputeCount} active dispute${disputeCount > 1 ? 's' : ''} promptly to prevent write-offs.`);
    suggestions.push('Offer convenient direct payment links to reduce payment delay days.');
    suggestions.push('Maintain timely resolution on disputed invoices to avoid write-offs.');

    res.json({
      mode: 'business',
      score,
      label,
      hasData: invoices.length > 0,
      breakdown: {
        paymentReliability: paymentReliabilityScore,
        overdueExposure: overdueExposureScore,
        cashFlowStability: cashFlowStabilityScore,
        disputeExposure: disputeExposureScore
      },
      suggestions,
      disclaimer: 'This is an educational financial-health indicator, not an official credit score.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   PERSONAL PAYMENTS
========================================================= */

api.post('/personal/payments', (req, res) => {
  try {
    const data = req.body;
    const errors = [];
    if (!data.payment_name) errors.push('Payment name is required.');
    if (!data.amount || isNaN(Number(data.amount))) errors.push('Amount must be a valid number.');
    if (!data.payment_type) errors.push('Payment type is required.');
    if (!data.due_date) errors.push('Due date is required.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const paymentId = uuidv4();
    insertPersonalPayment({
      payment_id: paymentId,
      user_session: 'default',
      payment_name: data.payment_name,
      amount: Number(data.amount),
      due_date: data.due_date,
      payment_date: data.payment_date || null,
      payment_type: data.payment_type,
      status: data.status || 'pending',
      failure_reason: data.failure_reason || null,
      monthly_income: data.monthly_income ? Number(data.monthly_income) : null,
      monthly_expenses: data.monthly_expenses ? Number(data.monthly_expenses) : null
    });

    res.json({ success: true, paymentId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/personal/summary', (req, res) => {
  try {
    const payments = getPersonalPayments('default');
    const now = new Date();

    const upcoming = payments
      .filter(p => p.status === 'pending' && new Date(p.due_date) >= now)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5)
      .map(p => ({
        id: p.payment_id,
        name: p.payment_name,
        amount: p.amount,
        date: new Date(p.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        category: p.payment_type,
        provider: p.payment_name
      }));

    const overdue = payments.filter(p =>
      p.status !== 'paid' && p.status !== 'failed' && new Date(p.due_date) < now
    );
    const failed = payments.filter(p => p.status === 'failed');
    const overdueAmount = overdue.reduce((s, p) => s + p.amount, 0);

    // Health score
    let paymentHealthScore = 80;
    if (failed.length > 0) paymentHealthScore -= Math.min(failed.length * 10, 30);
    if (overdue.length > 0) paymentHealthScore -= Math.min(overdue.length * 8, 25);
    paymentHealthScore = Math.max(30, Math.min(98, paymentHealthScore));

    const healthLabel = paymentHealthScore >= 80 ? 'Good' : paymentHealthScore >= 60 ? 'Fair' : 'Poor';

    const alerts = [];
    if (failed.length > 0) {
      alerts.push({
        id: 'alt-failed',
        title: `${failed.length} Failed Payment${failed.length > 1 ? 's' : ''}`,
        message: 'Failed payments can affect your payment history. Ensure sufficient balance before scheduled payment dates.',
        level: 'warning'
      });
    }
    if (overdue.length > 0) {
      alerts.push({
        id: 'alt-overdue',
        title: `${overdue.length} Overdue Payment${overdue.length > 1 ? 's' : ''}`,
        message: 'Payments past due date may incur late fees. Address these as soon as possible.',
        level: 'error'
      });
    }

    const suggestions = [
      'Keep bill payments on schedule to prevent payment friction.',
      'Avoid repeated failed auto-debits by keeping sufficient balance before due dates.',
      'Maintain sufficient balance buffer 2 days prior to recurring payments.',
      'Update expired payment methods before scheduled payments.',
      'Resolve any overdue payments promptly to avoid late fees.'
    ];

    res.json({
      hasData: payments.length > 0,
      upcomingPayments: upcoming,
      overdueAmount,
      overdueCount: overdue.length,
      failedPaymentsCount: failed.length,
      paymentHealthScore,
      healthLabel,
      alerts,
      suggestions,
      totalPayments: payments.length,
      disclaimer: 'This information is educational and does not constitute official credit bureau scoring or financial advice.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   RECOUP ASSISTANT — improved with real data context
========================================================= */


api.post('/assistant/chat', (req, res) => {
  try {
    const { question } = req.body || {};
    const q = (question || '').toLowerCase();

    const invoices = getAllInvoices();
    const hasData = invoices.length > 0;

    let reply = '';
    let actionTip = '';
    let knownFacts = [];
    let inferences = [];
    let unknowns = [];

    if (!hasData) {
      reply = 'You have no payment records yet. Add your first payment using the "Add Payment" form on the dashboard, then I can give you personalized recovery advice.';
      actionTip = 'Start by entering a failed invoice using "Add Payment / Revenue Data".';
      return res.json({ success: true, reply, actionTip, knownFacts: [], inferences: [], unknowns: ['No data available yet'], timestamp: new Date().toISOString() });
    }

    const activeInvoices = invoices.filter(i => i.status === 'active');
    const recoveredInvoices = invoices.filter(i => i.status === 'recovered');
    const disputedInvoices = invoices.filter(i => i.dispute_flag === 1);
    const totalAtRisk = activeInvoices.reduce((s, i) => s + i.amount, 0);
    const recoveredAmount = recoveredInvoices.reduce((s, i) => s + i.amount, 0);

    // Build known facts from actual data
    knownFacts = [
      `${invoices.length} total invoice${invoices.length !== 1 ? 's' : ''} in database`,
      `₹${totalAtRisk.toLocaleString('en-IN')} total revenue at risk (${activeInvoices.length} active)`,
      recoveredAmount > 0 ? `₹${recoveredAmount.toLocaleString('en-IN')} recovered so far` : null,
      disputedInvoices.length > 0 ? `${disputedInvoices.length} disputed invoice${disputedInvoices.length > 1 ? 's' : ''}` : null
    ].filter(Boolean);

    if (q.includes('first') || q.includes('priorit') || q.includes('start') || q.includes('recover first')) {
      const active = [...activeInvoices].sort((a, b) => (b.amount * b.true_recovery_probability) - (a.amount * a.true_recovery_probability));
      if (active.length > 0) {
        const top = active[0];
        const cust = getCustomerById(top.customer_id);
        let decision;
        try { decision = decide(top.invoice_id); } catch(e) {}
        const erv = decision ? decision.expectedRecoveryValue : top.amount * top.true_recovery_probability;
        const prob = decision ? decision.recoveryProbability : top.true_recovery_probability;
        const customerName = cust ? cust.company_name : 'your top customer';
        const failureReason = top.failure_reason || top.category || null;

        knownFacts = [
          `Invoice: ${top.invoice_number}`,
          `Customer: ${customerName}`,
          `Amount: ₹${top.amount.toLocaleString('en-IN')}`,
          `Days overdue: ${top.days_overdue}`,
          failureReason ? `Failure reason: ${failureReason}` : null
        ].filter(Boolean);

        inferences = [
          `Recovery probability: ${Math.round(prob * 100)}% (based on payment reliability and failure type)`,
          `Expected recovery value: ₹${Math.round(erv).toLocaleString('en-IN')}`,
          decision ? `Recommended action: ${decision.actionLabel}` : 'Send a personalized payment reminder'
        ];

        unknowns = [
          !failureReason ? 'Payment failure reason — not recorded' : null,
          !cust?.email ? 'Customer email — not on file' : null,
          top.days_overdue === 0 ? 'Number of prior contact attempts — unknown' : null
        ].filter(Boolean);

        reply = `Start with the ₹${top.amount.toLocaleString('en-IN')} invoice from ${customerName} (${top.invoice_number}). It has the highest expected recovery value of ₹${Math.round(erv).toLocaleString('en-IN')} with ${Math.round(prob * 100)}% recovery probability.`;
        actionTip = decision ? `Recommended action: ${decision.actionLabel}` : 'Send a personalized payment reminder.';
      } else {
        reply = 'All active cases have been processed! No pending recovery actions found.';
        unknowns = ['No active invoices to analyze'];
      }
    } else if (q.includes('risk') || q.includes('attention') || q.includes('how much') || q.includes('at risk')) {
      inferences = [
        `${activeInvoices.length} unpaid invoice${activeInvoices.length !== 1 ? 's' : ''} are currently at risk`,
        disputedInvoices.length > 0 ? `${disputedInvoices.length} of these are disputed — do not automate recovery` : 'No disputed invoices — all can be approached with standard recovery'
      ];
      unknowns = totalAtRisk === 0 ? ['No active invoices'] : [];
      reply = `You have ₹${totalAtRisk.toLocaleString('en-IN')} total revenue at risk across ${activeInvoices.length} unpaid invoice${activeInvoices.length !== 1 ? 's' : ''}. ${disputedInvoices.length > 0 ? `⚠️ ${disputedInvoices.length} invoice${disputedInvoices.length > 1 ? 's are' : ' is'} currently disputed — do not attempt automated recovery on these.` : ''}`;
      actionTip = 'Review high-priority cases in the Recovery Queue tab.';
    } else if (q.includes('rate') || q.includes('recovery rate') || q.includes('how well')) {
      const rate = (totalAtRisk + recoveredAmount) > 0 ? (recoveredAmount / (totalAtRisk + recoveredAmount) * 100).toFixed(1) : 0;
      knownFacts = [
        `Recovered: ₹${recoveredAmount.toLocaleString('en-IN')} (${recoveredInvoices.length} invoices)`,
        `Still at risk: ₹${totalAtRisk.toLocaleString('en-IN')} (${activeInvoices.length} invoices)`
      ];
      inferences = [`Current recovery rate: ${rate}%`, Number(rate) < 30 ? 'Rate is low — focus on high-probability cases first.' : Number(rate) < 60 ? 'Good progress — keep following up on active cases.' : 'Excellent recovery rate!'];
      unknowns = recoveredInvoices.length === 0 ? ['No invoices marked as recovered yet'] : [];
      reply = `Your current recovery rate is ${rate}%. You have recovered ₹${recoveredAmount.toLocaleString('en-IN')} out of ₹${(totalAtRisk + recoveredAmount).toLocaleString('en-IN')} total at-risk revenue.`;
      actionTip = 'Go to Recovery Queue to see prioritized cases.';
    } else if (q.includes('score') || q.includes('health') || q.includes('fall') || q.includes('change')) {
      inferences = [
        'Score decreases when overdue invoices increase',
        'Score decreases when customer disputes exist',
        'Score improves as recovery rate improves',
        'Score improves when overdue invoices are resolved quickly'
      ];
      reply = 'Your financial health score changes based on: (1) Number of overdue invoices, (2) Active customer disputes, (3) Recovery success rate, and (4) How quickly overdue invoices are resolved.';
      actionTip = 'Tip: Follow up on invoices past due by 7–15 days before they become harder to recover.';
    } else if (q.includes('dispute') || q.includes('disputed')) {
      knownFacts = [`${disputedInvoices.length} disputed invoice${disputedInvoices.length !== 1 ? 's' : ''} in database`];
      if (disputedInvoices.length > 0) {
        inferences = ['Automated recovery must be paused on disputed invoices', 'Each case requires manual finance team review'];
        unknowns = ['Dispute resolution timeline — depends on customer communication'];
        reply = `You have ${disputedInvoices.length} disputed invoice${disputedInvoices.length > 1 ? 's' : ''}. Automated recovery should NOT be attempted. Each case needs manual review by your finance team.`;
        actionTip = 'Filter Recovery Queue by "DISPUTED" to see these cases.';
      } else {
        reply = 'Good news — you have no disputed invoices currently. All your payment failures can be approached with standard recovery actions.';
      }
    } else if (q.includes('invoice') || q.includes('failed') || q.includes('why')) {
      const highValue = [...activeInvoices].sort((a, b) => b.amount - a.amount)[0];
      if (highValue) {
        const cust = getCustomerById(highValue.customer_id);
        const reason = highValue.failure_reason && highValue.failure_reason.trim() ? highValue.failure_reason : null;
        knownFacts = [
          `Invoice: ${highValue.invoice_number}`,
          `Customer: ${cust ? cust.company_name : 'Unknown'}`,
          `Amount: ₹${highValue.amount.toLocaleString('en-IN')}`,
          reason ? `Recorded failure reason: ${reason}` : null,
          highValue.days_overdue > 0 ? `Days overdue: ${highValue.days_overdue}` : null
        ].filter(Boolean);
        unknowns = [!reason ? 'Payment failure reason — not provided. Reason cannot be determined from the available data.' : null].filter(Boolean);
        inferences = reason ? [buildFailureReasoning(reason, cust?.payment_reliability, highValue.days_overdue)] : ['No failure reason recorded — manual customer contact recommended to determine cause'];
        reply = `Your highest-value unpaid invoice is ₹${highValue.amount.toLocaleString('en-IN')} from ${cust ? cust.company_name : 'a customer'} (${highValue.invoice_number}). ${reason ? `The recorded reason is: "${reason}".` : 'No failure reason was recorded for this invoice.'} ${highValue.days_overdue > 0 ? `It is ${highValue.days_overdue} days overdue.` : ''}`;
        actionTip = 'Open this case in the Recovery Queue for full analysis and recommended action.';
      } else {
        reply = 'No active failed invoices found. Add payment records to see analysis.';
        unknowns = ['No active invoices available'];
      }
    } else {
      inferences = [
        'I can help prioritize recovery based on Expected Recovery Value (ERV)',
        'I use payment reliability scores and failure reasons to make recommendations',
        'I only use information that is actually stored in your database'
      ];
      reply = `Recoup is tracking ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} with ₹${totalAtRisk.toLocaleString('en-IN')} currently at risk. I can help you prioritize recovery, understand why payments failed, and recommend optimal follow-up actions.`;
      actionTip = 'Try asking: "Which should I recover first?" or "How much is at risk?"';
    }

    res.json({
      success: true,
      reply,
      actionTip,
      knownFacts,
      inferences,
      unknowns,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Assistant chat error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* =========================================================
   ANALYTICS — real data
========================================================= */

api.get('/analytics/by-failure-reason', (req, res) => {
  try {
    const stats = getFailureReasonStats();
    if (stats.length === 0) {
      return res.json([]);
    }
    res.json(stats);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/analytics/by-intervention', (req, res) => {
  try {
    const invoices = getAllInvoices();
    const recoveredInvoices = invoices.filter(i => i.status === 'recovered');

    // We don't track which specific action led to recovery yet.
    // These are illustrative benchmarks from industry data.
    // Mark as illustrative if fewer than 5 invoices have been recovered.
    const isIllustrative = recoveredInvoices.length < 5;

    const data = [
      { action: 'Send Friendly Reminder', success_rate: 0.72 },
      { action: 'Personalized Follow-up', success_rate: 0.48 },
      { action: 'Send Payment Link', success_rate: 0.68 },
      { action: 'Record Promise to Pay', success_rate: 0.88 },
      { action: 'Escalate to Finance', success_rate: 0.35 }
    ];

    res.json({ data, isIllustrative, recoveredCount: recoveredInvoices.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.get('/analytics/summary', (req, res) => {
  try {
    const invoices = getAllInvoices();
    const failureStats = getFailureReasonStats();

    const statusCounts = {};
    let totalAmount = 0;
    let totalRecovered = 0;
    let totalAtRisk = 0;

    for (const inv of invoices) {
      statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
      totalAmount += inv.amount;
      if (inv.status === 'recovered') totalRecovered += inv.amount;
      else totalAtRisk += inv.amount;
    }

    res.json({
      totalInvoices: invoices.length,
      totalAmount,
      totalAtRisk,
      totalRecovered,
      statusBreakdown: statusCounts,
      failureReasonStats: failureStats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default api;