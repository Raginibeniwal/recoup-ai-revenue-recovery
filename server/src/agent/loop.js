// ── Agent Decision Loop ───────────────────────────────────────────────────────
// Processes each invoice through a multi-step agentic loop:
//   observe → diagnose → score → stopping rules → intervene → simulate → log

import { v4 as uuidv4 } from 'uuid';
import {
  getRecoveryAttempts, updateInvoiceStatus, logAudit, insertRecoveryAttempt,
  getInvoicesByBatch, getCustomerById, getLatestBatch,
  updateBatchAgentResults, updateBatchStatus
} from '../db.js';
import { getCustomerProfile, getPaymentHistory, getFailureReason } from './tools.js';
import { calculateRecoveryProbability, calculateExpectedRecoveryValue } from './scoring.js';
import { checkStoppingRules } from './stopping.js';
import { selectIntervention } from './llm.js';
import { simulateOutcome } from '../simulator.js';

// ── Strategy categories ──────────────────────────────────────────────────────

const CATEGORY_MAP = {
  'Software License':       'negotiation',
  'Consulting Services':    'engagement',
  'Hardware Procurement':   'retry_eligible',
  'Monthly Retainer':       'negotiation',
  insufficient_funds:       'retry_eligible',
  network_error:            'retry_eligible',
  expired_card:             'card_update',
  bank_decline:             'negotiation',
  unresponsive:             'engagement',
  disputed:                 'dispute',
  other:                    'general'
};

const ALLOWED_ACTIONS = {
  retry_eligible: ['retry_now', 'retry_scheduled', 'send_reminder'],
  card_update:    ['send_update_payment_link', 'send_reminder', 'generate_payment_link'],
  negotiation:    ['send_reminder', 'generate_payment_link', 'promise_to_pay_tracked'],
  engagement:     ['send_reminder', 'send_update_payment_link', 'escalate'],
  dispute:        ['stop'],
  general:        ['send_reminder', 'retry_scheduled', 'escalate']
};

// ── Map a DB invoice row + customer row into the caseData shape loop expects ──

function toCaseData(invoice, customer) {
  return {
    // Core IDs — use invoice_id as the canonical case identifier
    case_id:                    invoice.invoice_id,
    invoice_id:                 invoice.invoice_id,
    customer_id:                invoice.customer_id,

    // Customer fields
    customer_name:              customer ? customer.company_name : 'Unknown',
    customer_tenure_months:     24,   // default; not stored on customer table
    plan_name:                  invoice.category,
    case_type:                  'b2b_invoice',

    // Invoice fields
    amount:                     invoice.amount,
    currency:                   invoice.currency || 'INR',
    due_date:                   invoice.due_date,
    failure_reason_code:        invoice.category,   // maps category → failure reason
    dispute_flag:               invoice.dispute_flag === 1,
    opted_out:                  false,
    suspicious_activity_flag:   false,

    // Scoring helpers
    prior_failures_count:       0,
    prior_recovery_success_rate: customer ? customer.payment_reliability : 0.5,

    // The hidden ground-truth probability (used by simulator)
    true_recovery_probability:  invoice.true_recovery_probability,
    status:                     invoice.status
  };
}

// ── Step 3: DIAGNOSE (rule-based) ────────────────────────────────────────────

function diagnoseCase(caseData, attempts) {
  let category = CATEGORY_MAP[caseData.failure_reason_code] || 'general';

  // Adaptive strategy: shift category if prior attempts failed
  if (attempts.length > 0) {
    const last = attempts[attempts.length - 1];
    if (last.outcome === 'failure' || last.outcome === 'no_response') {
      if (category === 'retry_eligible')  category = 'card_update';
      else if (category === 'card_update') category = 'engagement';
      else if (category === 'negotiation') category = 'engagement';
    }
  }

  return {
    category,
    failure_reason: caseData.failure_reason_code,
    strategy_description: `${category} strategy for ${caseData.failure_reason_code} failure`
  };
}

// ── Process a single invoice through the full agent loop ─────────────────────

export async function processCase(caseData, options = {}) {
  let attemptNumber = 0;

  while (true) {
    attemptNumber++;
    const attempts = getRecoveryAttempts(caseData.case_id);

    // ── Step 1-2: OBSERVE & RETRIEVE ──────────────────────────────────────
    const profile    = getCustomerProfile(caseData);
    const history    = getPaymentHistory(caseData.case_id);
    const failureInf = getFailureReason(caseData);

    logAudit(
      caseData.case_id, 'observe',
      JSON.stringify({ customer: caseData.customer_name, amount: caseData.amount, category: caseData.failure_reason_code }),
      `Loading case — ₹${caseData.amount.toLocaleString('en-IN')} | ${caseData.failure_reason_code} | from ${caseData.customer_name}`,
      'get_customer_profile, get_payment_history, get_failure_reason',
      JSON.stringify({ profile_id: profile.customer_id, history_count: history.length }),
      'diagnose'
    );

    // ── Step 3: DIAGNOSE (rule-based) ────────────────────────────────────
    const diagnosis = diagnoseCase(caseData, attempts);

    logAudit(
      caseData.case_id, 'diagnose',
      JSON.stringify({ failure_reason: diagnosis.failure_reason, prior_attempts: attempts.length }),
      `Strategy: ${diagnosis.category} — ${diagnosis.strategy_description}`,
      null, null, 'score'
    );

    // ── Step 4: SCORE ────────────────────────────────────────────────────
    const probability = calculateRecoveryProbability(caseData, attemptNumber);
    const prelimErv   = calculateExpectedRecoveryValue(caseData.amount, probability, 'send_reminder');

    logAudit(
      caseData.case_id, 'score',
      JSON.stringify({ probability, erv: prelimErv }),
      `Recovery probability: ${(probability * 100).toFixed(1)}% | Preliminary ERV: ₹${prelimErv.toFixed(2)}`,
      'calculate_recovery_probability, calculate_expected_recovery_value',
      JSON.stringify({ probability, preliminary_erv: prelimErv }),
      'check_stopping_rules'
    );

    // ── Step 5: CHECK stopping rules (deterministic gate) ────────────────
    const gate = checkStoppingRules(caseData, attempts, probability, prelimErv, attemptNumber);

    if (gate.should_escalate) {
      updateInvoiceStatus(caseData.case_id, 'escalated');
      logAudit(caseData.case_id, 'escalated',
        JSON.stringify({ rule: gate.rule_triggered }),
        gate.rule_triggered,
        'check_stopping_rules', JSON.stringify(gate), null);
      return { status: 'escalated', rule: gate.rule_triggered };
    }

    if (gate.should_stop) {
      updateInvoiceStatus(caseData.case_id, 'stopped');
      logAudit(caseData.case_id, 'stopped',
        JSON.stringify({ rule: gate.rule_triggered }),
        gate.rule_triggered,
        'check_stopping_rules', JSON.stringify(gate), null);
      return { status: 'stopped', rule: gate.rule_triggered };
    }

    // ── Step 6: SELECT intervention ──────────────────────────────────────
    const allowed   = ALLOWED_ACTIONS[diagnosis.category] || ALLOWED_ACTIONS.general;
    const selection = await selectIntervention(caseData, diagnosis, attempts, allowed, options);
    const actionErv = calculateExpectedRecoveryValue(caseData.amount, probability, selection.action);

    logAudit(
      caseData.case_id, 'select_intervention',
      JSON.stringify({ action: selection.action, allowed }),
      selection.reasoning,
      'select_intervention',
      JSON.stringify({ action: selection.action, erv: actionErv }),
      'execute'
    );

    // ── Step 7: EXECUTE intervention (simulated) ─────────────────────────
    const outcome = simulateOutcome(caseData, attemptNumber);

    // Record attempt in recovery_attempts table
    insertRecoveryAttempt({
      attempt_id: uuidv4(),
      invoice_id: caseData.case_id,
      timestamp:  new Date().toISOString(),
      channel:    'automated',
      action:     selection.action,
      message:    selection.reasoning,
      response:   null,
      outcome
    });

    // ── Step 8-9: OBSERVE outcome & LOG ──────────────────────────────────
    logAudit(
      caseData.case_id, 'execute',
      JSON.stringify({ action: selection.action, outcome, attempt: attemptNumber }),
      `Executed ${selection.action} → ${outcome}`,
      selection.action,
      JSON.stringify({ outcome, attempt_number: attemptNumber }),
      outcome === 'success' ? 'mark_recovered' : 'decide_next'
    );

    // ── Step 10: DECIDE ──────────────────────────────────────────────────

    if (outcome === 'success') {
      // Terminal: recovered
      updateInvoiceStatus(caseData.case_id, 'recovered');
      logAudit(caseData.case_id, 'recovered',
        JSON.stringify({ amount: caseData.amount, attempt: attemptNumber }),
        `Payment recovered: ₹${caseData.amount.toLocaleString('en-IN')} on attempt ${attemptNumber}`,
        'mark_recovered',
        JSON.stringify({ recovered_amount: caseData.amount }),
        null);
      return { status: 'recovered', amount: caseData.amount, attempts: attemptNumber };
    }

    // Failure — check if max attempts reached
    if (attemptNumber >= 3) {
      // Route significant remaining value to human
      if (caseData.amount > 5000) {
        updateInvoiceStatus(caseData.case_id, 'escalated');
        logAudit(caseData.case_id, 'escalated',
          JSON.stringify({ reason: 'max_attempts_exhausted', amount: caseData.amount }),
          `escalated: all ${attemptNumber} automated attempts exhausted, amount ₹${caseData.amount.toLocaleString('en-IN')} still significant`,
          null, null, null);
        return { status: 'escalated', rule: 'max_attempts_exhausted' };
      }
      updateInvoiceStatus(caseData.case_id, 'stopped');
      logAudit(caseData.case_id, 'stopped',
        JSON.stringify({ reason: 'max_attempts', count: attemptNumber }),
        `stopped: attempt_count ${attemptNumber} >= 3 (max retries)`,
        null, null, null);
      return { status: 'stopped', rule: 'max_attempts' };
    }

    // ── Step 10 loop-back: RE-DIAGNOSE ───────────────────────────────────
    logAudit(caseData.case_id, 're_diagnose',
      JSON.stringify({ failed_action: selection.action, attempt: attemptNumber }),
      `Attempt ${attemptNumber} failed (${selection.action} → ${outcome}). Adapting strategy for next attempt.`,
      null, null, 'diagnose');

    // Loop continues → back to step 3 with updated history
  }
}

// ── Run agent across an entire batch ─────────────────────────────────────────

export async function runAgentOnBatch(batchId, options = {}) {
  // Get all active invoices in this batch, joined with customer data
  const invoices = getInvoicesByBatch(batchId).filter(i => i.status === 'active');
  updateBatchStatus(batchId, 'running');

  let recoveredAmount = 0;
  let recoveredCount  = 0;
  let stoppedCount    = 0;
  let escalatedCount  = 0;

  for (const invoice of invoices) {
    try {
      // Load customer profile to enrich the case data
      const customer = getCustomerById(invoice.customer_id);

      // Map DB row into the caseData shape the agent loop expects
      const caseData = toCaseData(invoice, customer);

      const result = await processCase(caseData, options);

      if (result.status === 'recovered') {
        recoveredAmount += invoice.amount;
        recoveredCount++;
      } else if (result.status === 'stopped') {
        stoppedCount++;
      } else if (result.status === 'escalated') {
        escalatedCount++;
      }
    } catch (err) {
      console.error(`Error processing invoice ${invoice.invoice_id}:`, err.message);
      // Don't crash the whole batch — mark this case as stopped and continue
      try { updateInvoiceStatus(invoice.invoice_id, 'stopped'); } catch {}
      stoppedCount++;
    }
  }

  updateBatchAgentResults(batchId, recoveredAmount, recoveredCount, stoppedCount, escalatedCount);

  return {
    batchId,
    totalProcessed: invoices.length,
    recovered: recoveredCount,
    stopped: stoppedCount,
    escalated: escalatedCount,
    recoveredAmount,
    mode: options.useLLM ? 'llm' : 'deterministic'
  };
}
