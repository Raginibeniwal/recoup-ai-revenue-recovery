// ── Recovery Workflow Orchestrator ────────────────────────────────────────────
// State machine that drives the adaptive recovery loop for a single invoice.
// Combines Phase 2 (decide) + Phase 3 (executeAction) with a logical clock.
// Hard-capped at MAX_ITERATIONS to prevent infinite loops.

import { v4 as uuidv4 } from 'uuid';
import { decide } from './engine.js';
import {
  executeAction, resolvePromise,
  OUTCOMES, STATES, APPROVED_ACTIONS, makeSimulatedDate
} from './actions.js';
import {
  getInvoiceById, getCustomerById, getRecoveryAttempts,
  getPromisesByInvoice,
  updateInvoiceStatus, logAudit,
  getInvoicesByBatch, getActiveInvoicesByBatch,
  updateBatchAgentResults, updateBatchBaselineResults, updateBatchStatus
} from '../db.js';

const MAX_ITERATIONS = 5; // hard ceiling per invoice

// ── Run the full adaptive recovery workflow for one invoice ──────────────────

export function runRecovery(invoiceId, simStartDate = null) {
  const simStart = simStartDate || new Date().toISOString();
  const invoice  = getInvoiceById(invoiceId);
  if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

  const customer = getCustomerById(invoice.customer_id);

  // Already terminal?
  if (['recovered', 'escalated', 'stopped'].includes(invoice.status)) {
    return { invoiceId, status: invoice.status, iterations: 0, amountRecovered: 0, timeline: [] };
  }

  const timeline = [];
  let simDay     = 0;
  let iteration  = 0;
  let finalStatus = STATES.ACTIVE;
  let amountRecovered = 0;
  let pendingPromiseId = null;

  // ── Audit: workflow started ───────────────────────────────────────────────
  const startTs = makeSimulatedDate(simStart, 0);
  logAudit(invoiceId,
    'REVENUE_AT_RISK_DETECTED',
    JSON.stringify({ amount: invoice.amount, daysOverdue: invoice.days_overdue, customer: customer.company_name }),
    `Invoice ${invoice.invoice_number} from ${customer.company_name} is ₹${invoice.amount.toLocaleString('en-IN')} overdue (${invoice.days_overdue} days).`,
    null, null, 'ANALYZE',
    startTs
  );

  logAudit(invoiceId,
    'CUSTOMER_ANALYZED',
    JSON.stringify({ reliability: customer.payment_reliability, tier: customer.customer_tier, riskLevel: customer.risk_level }),
    `Customer reliability: ${(customer.payment_reliability * 100).toFixed(0)}%. Tier: ${customer.customer_tier}. Risk: ${customer.risk_level}.`,
    'get_customer_profile',
    JSON.stringify({ customer_id: customer.customer_id }),
    'DECIDE',
    makeSimulatedDate(simStart, 0, 1)
  );

  // ── Main adaptive loop ───────────────────────────────────────────────────
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    simDay += (iteration === 1 ? 0 : 2); // space actions 2 simulated days apart

    // ── 1. Make decision ──────────────────────────────────────────────────
    const decision = decide(invoiceId);

    timeline.push({
      simDay,
      event:    'DECISION',
      action:   decision.recommendedAction,
      diagnosis: decision.diagnosis,
      probability: decision.recoveryProbability,
      erv:      decision.expectedRecoveryValue
    });

    // ── 2. Check stopping rules from engine ───────────────────────────────
    if (!decision.canAutomate) {
      if (decision.requiresHuman) {
        finalStatus = STATES.ESCALATED;
        updateInvoiceStatus(invoiceId, STATES.ESCALATED);
        logAudit(invoiceId, 'HUMAN_ESCALATION',
          JSON.stringify({ reason: decision.stopReason, action: decision.recommendedAction }),
          decision.stopReason || 'Requires human review.',
          decision.recommendedAction, 'Escalated.',
          'WAIT_FOR_HUMAN',
          makeSimulatedDate(simStart, simDay)
        );
        timeline.push({ simDay, event: 'ESCALATED', reason: decision.stopReason });
      } else {
        finalStatus = STATES.STOPPED;
        updateInvoiceStatus(invoiceId, STATES.STOPPED);
        logAudit(invoiceId, 'WORKFLOW_STOPPED',
          JSON.stringify({ reason: decision.stopReason }),
          decision.stopReason || 'Automated recovery halted.',
          'STOP_AUTOMATED_RECOVERY', 'Stopped.',
          null,
          makeSimulatedDate(simStart, simDay)
        );
        timeline.push({ simDay, event: 'STOPPED', reason: decision.stopReason });
      }
      break;
    }

    // ── 3. Resolve a pending promise before taking new action ─────────────
    if (pendingPromiseId && iteration > 1) {
      const promiseResult = resolvePromise(invoiceId, pendingPromiseId, invoice, simDay, simStart);
      if (promiseResult) {
        if (promiseResult.fulfilled) {
          amountRecovered = promiseResult.amountRecovered;
          finalStatus = STATES.RECOVERED;
          timeline.push({ simDay, event: 'PROMISE_FULFILLED', amountRecovered });
          break;
        } else {
          // Promise broken — re-evaluate with updated state (loop continues)
          pendingPromiseId = null;
          timeline.push({ simDay, event: 'PROMISE_BROKEN' });
          continue;
        }
      }
    }

    // ── 4. Execute action ─────────────────────────────────────────────────
    const execResult = executeAction({
      invoiceId,
      action:   decision.recommendedAction,
      decision,
      invoice,
      customer,
      simDay,
      simStart
    });

    timeline.push({
      simDay,
      event:         'ACTION_EXECUTED',
      action:        decision.recommendedAction,
      outcome:       execResult.outcome,
      attemptNumber: execResult.attemptNumber
    });

    // ── 5. React to outcome ───────────────────────────────────────────────
    if (execResult.outcome === OUTCOMES.PAYMENT_RECEIVED) {
      amountRecovered = execResult.amountRecovered;
      finalStatus = STATES.RECOVERED;
      updateInvoiceStatus(invoiceId, STATES.RECOVERED);
      logAudit(invoiceId, 'PAYMENT_RECEIVED',
        JSON.stringify({ amount: invoice.amount }),
        `Payment of ₹${invoice.amount.toLocaleString('en-IN')} received.`,
        'MARK_RECOVERED',
        `₹${invoice.amount.toLocaleString('en-IN')} RECOVERED`,
        'WORKFLOW_STOPPED',
        makeSimulatedDate(simStart, simDay, 3)
      );
      logAudit(invoiceId, 'WORKFLOW_STOPPED',
        JSON.stringify({ status: 'recovered', amount: invoice.amount }),
        `Recovery workflow complete. ₹${invoice.amount.toLocaleString('en-IN')} recovered after ${iteration} iteration(s).`,
        null, null, null,
        makeSimulatedDate(simStart, simDay, 4)
      );
      timeline.push({ simDay, event: 'RECOVERED', amountRecovered });
      break;
    }

    if (execResult.outcome === OUTCOMES.PROMISE_TO_PAY) {
      pendingPromiseId = execResult.promiseId;
      updateInvoiceStatus(invoiceId, STATES.PROMISE_ACTIVE);
      finalStatus = STATES.PROMISE_ACTIVE;
      timeline.push({ simDay, event: 'PROMISE_ACTIVE', promiseId: pendingPromiseId });
      simDay += 5; // fast-forward to promise date
      // Resolve immediately (next iteration will check)
      const promiseResult = resolvePromise(invoiceId, pendingPromiseId, invoice, simDay, simStart);
      if (promiseResult && promiseResult.fulfilled) {
        amountRecovered = promiseResult.amountRecovered;
        finalStatus = STATES.RECOVERED;
        timeline.push({ simDay, event: 'PROMISE_FULFILLED', amountRecovered });
        break;
      } else {
        pendingPromiseId = null;
        timeline.push({ simDay, event: 'PROMISE_BROKEN' });
        // continue loop — re-evaluate
      }
    }

    if (execResult.outcome === OUTCOMES.ESCALATION_REQUIRED) {
      finalStatus = STATES.ESCALATED;
      updateInvoiceStatus(invoiceId, STATES.ESCALATED);
      timeline.push({ simDay, event: 'ESCALATED' });
      break;
    }

    if (execResult.outcome === OUTCOMES.STOPPED) {
      finalStatus = STATES.STOPPED;
      updateInvoiceStatus(invoiceId, STATES.STOPPED);
      timeline.push({ simDay, event: 'STOPPED' });
      break;
    }

    // NO_RESPONSE or CUSTOMER_RESPONDED (no payment yet) → re-evaluate
    // The loop re-runs; Phase 2 engine will detect more attempts and escalate/stop if appropriate
  }

  // ── Hit max iterations without resolution ────────────────────────────────
  if (iteration >= MAX_ITERATIONS && finalStatus === STATES.ACTIVE) {
    finalStatus = STATES.ESCALATED;
    updateInvoiceStatus(invoiceId, STATES.ESCALATED);
    logAudit(invoiceId, 'MAX_ITERATIONS_REACHED',
      JSON.stringify({ iterations: iteration }),
      `Automated recovery exhausted after ${iteration} iterations without resolution. Escalating.`,
      null, null, 'ESCALATE',
      makeSimulatedDate(simStart, simDay)
    );
    timeline.push({ simDay, event: 'ESCALATED', reason: 'max_iterations_reached' });
  }

  return { invoiceId, status: finalStatus, iterations: iteration, amountRecovered, timeline };
}

// ── Run the full batch ───────────────────────────────────────────────────────

export function runBatch(batchId) {
  const simStart = new Date().toISOString();

  updateBatchStatus(batchId, 'running');

  const invoices = getActiveInvoicesByBatch(batchId);

  let recoveredAmount  = 0;
  let recoveredCount   = 0;
  let stoppedCount     = 0;
  let escalatedCount   = 0;

  const results = [];

  for (const invoice of invoices) {
    try {
      const result = runRecovery(invoice.invoice_id, simStart);

      results.push(result);

      if (result.status === STATES.RECOVERED) {
        recoveredAmount += result.amountRecovered;
        recoveredCount++;
      } else if (result.status === STATES.STOPPED) {
        stoppedCount++;
      } else if (result.status === STATES.ESCALATED) {
        escalatedCount++;
      } else if (result.status === STATES.PROMISE_ACTIVE) {
        // Still pending — count as potential
        escalatedCount++;
      }
    } catch (err) {
      console.error(`Orchestrator: invoice ${invoice.invoice_id} failed:`, err.message);
      try { updateInvoiceStatus(invoice.invoice_id, STATES.STOPPED); } catch {}
      stoppedCount++;
    }
  }

  // Compute baseline: naive 25%-probability flat strategy
  let baselineRecoveredAmount = 0;
  let baselineRecoveredCount  = 0;
  const allBatchInvoices = getInvoicesByBatch(batchId);
  for (const inv of allBatchInvoices) {
    if ((inv.true_recovery_probability || 0) > 0.25) {
      baselineRecoveredAmount += inv.amount * 0.25;
      baselineRecoveredCount++;
    }
  }

  updateBatchAgentResults(batchId, recoveredAmount, recoveredCount, stoppedCount, escalatedCount);
  updateBatchBaselineResults(batchId, baselineRecoveredAmount, baselineRecoveredCount);

  return {
    batchId,
    totalProcessed:          invoices.length,
    recovered:               recoveredCount,
    recoveredAmount,
    stopped:                 stoppedCount,
    escalated:               escalatedCount,
    baselineRecoveredAmount,
    baselineRecoveredCount,
    recoveryRate:            invoices.length > 0 ? recoveredCount / invoices.length : 0,
    liftVsBaseline:          baselineRecoveredAmount > 0
                               ? (recoveredAmount - baselineRecoveredAmount) / baselineRecoveredAmount
                               : 0
  };
}
