// ── Action Execution Service ──────────────────────────────────────────────────
// Executes approved recovery actions against the simulated environment.
// Uses a logical/simulated clock for the audit trail timeline.
// NO real emails, SMS, payments, or API calls are made.

import { v4 as uuidv4 } from 'uuid';
import {
  getCustomerById,
  getPaymentHistoryByCustomer,
  getPromisesByInvoice,
  getRecoveryAttempts,
  insertRecoveryAttempt,
  insertPromiseToPay,
  updatePromiseStatus,
  updateInvoiceStatus,
  logAudit
} from '../db.js';

// ── Approved Action Registry ─────────────────────────────────────────────────

export const APPROVED_ACTIONS = {
  SEND_FRIENDLY_REMINDER:      'SEND_FRIENDLY_REMINDER',
  SEND_PERSONALIZED_FOLLOWUP:  'SEND_PERSONALIZED_FOLLOWUP',
  SEND_PAYMENT_LINK:           'SEND_PAYMENT_LINK',
  RECORD_PROMISE_TO_PAY:       'RECORD_PROMISE_TO_PAY',
  FOLLOW_UP_ON_PROMISE:        'FOLLOW_UP_ON_PROMISE',
  ESCALATE_TO_FINANCE:         'ESCALATE_TO_FINANCE',
  ESCALATE_TO_ACCOUNT_MANAGER: 'ESCALATE_TO_ACCOUNT_MANAGER',
  STOP_AUTOMATED_RECOVERY:     'STOP_AUTOMATED_RECOVERY'
};

// ── Outcome Types ─────────────────────────────────────────────────────────────

export const OUTCOMES = {
  PAYMENT_RECEIVED:    'PAYMENT_RECEIVED',
  CUSTOMER_RESPONDED:  'CUSTOMER_RESPONDED',
  PROMISE_TO_PAY:      'PROMISE_TO_PAY',
  NO_RESPONSE:         'NO_RESPONSE',
  PAYMENT_FAILED:      'PAYMENT_FAILED',
  DISPUTE_RAISED:      'DISPUTE_RAISED',
  ESCALATION_REQUIRED: 'ESCALATION_REQUIRED',
  STOPPED:             'STOPPED'
};

// ── Workflow States ───────────────────────────────────────────────────────────

export const STATES = {
  ACTIVE:          'active',
  ANALYZING:       'analyzing',
  ACTION_SELECTED: 'action_selected',
  ACTION_EXECUTED: 'action_executed',
  AWAITING:        'awaiting',
  PROMISE_ACTIVE:  'promise_active',
  RECOVERED:       'recovered',
  ESCALATED:       'escalated',
  STOPPED:         'stopped',
  FAILED:          'failed'
};

// ── Base success rates per action (tuned for realistic demo) ─────────────────

const ACTION_BASE_RATES = {
  SEND_FRIENDLY_REMINDER:      0.70,
  SEND_PERSONALIZED_FOLLOWUP:  0.55,
  SEND_PAYMENT_LINK:           0.65,
  RECORD_PROMISE_TO_PAY:       0.80,
  FOLLOW_UP_ON_PROMISE:        0.55,
  ESCALATE_TO_FINANCE:         0.40,
  ESCALATE_TO_ACCOUNT_MANAGER: 0.50,
  STOP_AUTOMATED_RECOVERY:     0.00
};

// ── Deterministic PRNG seeded from invoice ID ─────────────────────────────────
// Makes demos reproducible — same invoice always gets same outcome.

function seededRandom(invoiceId, salt = 0) {
  let hash = salt;
  for (let i = 0; i < invoiceId.length; i++) {
    hash = ((hash << 5) - hash) + invoiceId.charCodeAt(i);
    hash |= 0;
  }
  // Shift with salt to get different values per attempt
  hash = ((hash << 3) - hash) + salt * 31337;
  hash |= 0;
  return Math.abs(hash % 10000) / 10000;
}

// ── Simulate the customer's response to an action ────────────────────────────

export function simulateOutcome(invoiceId, action, customer, invoice, attemptNumber) {
  const baseRate   = ACTION_BASE_RATES[action] ?? 0.50;
  const reliability = customer.payment_reliability ?? 0.5;

  // Diminishing returns on repeated attempts
  const attemptPenalty = Math.min((attemptNumber - 1) * 0.12, 0.40);

  // Combine: customer factor weighted 60%, action effectiveness 40%
  const threshold = (reliability * 0.60 + baseRate * 0.40) - attemptPenalty;
  const roll = seededRandom(invoiceId, attemptNumber);

  // Special cases
  if (action === APPROVED_ACTIONS.STOP_AUTOMATED_RECOVERY) {
    return { outcome: OUTCOMES.STOPPED, amountRecovered: 0, details: 'Automated recovery halted per stopping rules.' };
  }
  if (action === APPROVED_ACTIONS.ESCALATE_TO_FINANCE || action === APPROVED_ACTIONS.ESCALATE_TO_ACCOUNT_MANAGER) {
    return { outcome: OUTCOMES.ESCALATION_REQUIRED, amountRecovered: 0, details: 'Case escalated to human team.' };
  }

  if (roll < threshold * 0.55) {
    // Direct payment
    return { outcome: OUTCOMES.PAYMENT_RECEIVED, amountRecovered: invoice.amount, details: 'Customer made full payment.' };
  } else if (roll < threshold * 0.80) {
    // Promise to pay
    return { outcome: OUTCOMES.PROMISE_TO_PAY, amountRecovered: 0, details: 'Customer committed to a payment date.' };
  } else if (roll < threshold) {
    // Responded but no commitment
    return { outcome: OUTCOMES.CUSTOMER_RESPONDED, amountRecovered: 0, details: 'Customer acknowledged but no payment.' };
  } else {
    return { outcome: OUTCOMES.NO_RESPONSE, amountRecovered: 0, details: 'No response from customer.' };
  }
}

// ── Build simulated timestamps ────────────────────────────────────────────────

export function makeSimulatedDate(startDate, offsetDays, offsetHours = 0) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(d.getHours() + offsetHours);
  return d.toISOString();
}

// ── Execute a single action and record everything ────────────────────────────

export function executeAction({ invoiceId, action, decision, invoice, customer, simDay, simStart }) {
  const actualTimestamp    = new Date().toISOString();
  const simulatedTimestamp = makeSimulatedDate(simStart, simDay, 0);

  const attempts = getRecoveryAttempts(invoiceId);
  const attemptNumber = attempts.length + 1;

  // 1. Log: decision created
  logAudit(invoiceId,
    'RECOVERY_DECISION_CREATED',
    JSON.stringify({ diagnosis: decision.diagnosis, probability: decision.recoveryProbability }),
    `Diagnosis: ${decision.diagnosis}. Probability: ${(decision.recoveryProbability * 100).toFixed(0)}%. ERV: ₹${decision.expectedRecoveryValue.toFixed(0)}.`,
    'engine.decide',
    JSON.stringify({ action, priorityLevel: decision.priorityLevel }),
    `EXECUTE:${action}`,
    simulatedTimestamp
  );

  // 2. Simulate outcome
  const result = simulateOutcome(invoiceId, action, customer, invoice, attemptNumber);

  // 3. Channel based on action type
  const channel = action.includes('ESCALAT') ? 'internal'
    : action === APPROVED_ACTIONS.SEND_PAYMENT_LINK ? 'email+portal'
    : 'email';

  // 4. Build message text
  const messageMap = {
    SEND_FRIENDLY_REMINDER:      `Dear ${customer.contact_name}, Invoice ${invoice.invoice_number} for ₹${invoice.amount.toLocaleString('en-IN')} is overdue. Please arrange payment at your earliest convenience.`,
    SEND_PERSONALIZED_FOLLOWUP:  `Hi ${customer.contact_name}, following up on invoice ${invoice.invoice_number}. We understand businesses face cash flow challenges — please let us know how we can help resolve this.`,
    SEND_PAYMENT_LINK:           `Hi ${customer.contact_name}, here is a direct payment link for invoice ${invoice.invoice_number} (₹${invoice.amount.toLocaleString('en-IN')}). [SIMULATED LINK]`,
    RECORD_PROMISE_TO_PAY:       `Customer committed to paying ₹${invoice.amount.toLocaleString('en-IN')} — recording promise.`,
    FOLLOW_UP_ON_PROMISE:        `Following up on the payment promise for invoice ${invoice.invoice_number} that was due.`,
    ESCALATE_TO_FINANCE:         `Escalating ${invoice.invoice_number} (₹${invoice.amount.toLocaleString('en-IN')}) to Finance team due to: ${decision.stopReason || decision.diagnosis}.`,
    ESCALATE_TO_ACCOUNT_MANAGER: `Escalating ${invoice.invoice_number} to Account Manager for high-value intervention.`,
    STOP_AUTOMATED_RECOVERY:     `Stopping automated recovery for ${invoice.invoice_number}. Reason: ${decision.stopReason}.`
  };

  const message = messageMap[action] || `Executing ${action} for invoice ${invoice.invoice_number}.`;

  // 5. Record recovery attempt
  insertRecoveryAttempt({
    attempt_id:  uuidv4(),
    invoice_id:  invoiceId,
    timestamp:   simulatedTimestamp,
    channel,
    action,
    message,
    response:    result.details,
    outcome:     result.outcome
  });

  // 6. Log: action executed
  logAudit(invoiceId,
    'ACTION_EXECUTED',
    JSON.stringify({ action, channel, attemptNumber }),
    message,
    action,
    result.details,
    `OBSERVE:${result.outcome}`,
    simulatedTimestamp
  );

  // 7. Log: customer response (next sim day)
  const responseTimestamp = makeSimulatedDate(simStart, simDay, 2);
  logAudit(invoiceId,
    'CUSTOMER_RESPONDED',
    JSON.stringify({ outcome: result.outcome, details: result.details }),
    result.details,
    null,
    result.outcome,
    result.outcome === OUTCOMES.PAYMENT_RECEIVED ? 'MARK_RECOVERED'
      : result.outcome === OUTCOMES.PROMISE_TO_PAY ? 'RECORD_PROMISE_TO_PAY'
      : result.outcome === OUTCOMES.NO_RESPONSE ? 'RE_EVALUATE'
      : 'ESCALATE_OR_STOP',
    responseTimestamp
  );

  // 8. Handle Promise-to-Pay
  let promiseId = null;
  if (result.outcome === OUTCOMES.PROMISE_TO_PAY) {
    promiseId = uuidv4();
    const promisedDate = makeSimulatedDate(simStart, simDay + 5);
    const promiseTimestamp = makeSimulatedDate(simStart, simDay + 1);
    insertPromiseToPay({
      promise_id:      promiseId,
      invoice_id:      invoiceId,
      promised_amount: invoice.amount,
      promised_date:   promisedDate.split('T')[0],
      created_at:      promiseTimestamp,
      status:          'active'
    });
    logAudit(invoiceId,
      'PROMISE_TO_PAY_RECORDED',
      JSON.stringify({ promiseId, promisedDate: promisedDate.split('T')[0], amount: invoice.amount }),
      `Customer promised to pay ₹${invoice.amount.toLocaleString('en-IN')} by ${promisedDate.split('T')[0]}.`,
      'RECORD_PROMISE_TO_PAY',
      'Promise recorded.',
      'AWAIT_PROMISE_DATE',
      promiseTimestamp
    );
  }

  return {
    outcome:          result.outcome,
    amountRecovered:  result.amountRecovered,
    details:          result.details,
    promiseId,
    simulatedTimestamp,
    actualTimestamp,
    attemptNumber
  };
}

// ── Fulfil or break a promise ────────────────────────────────────────────────

export function resolvePromise(invoiceId, promiseId, invoice, simDay, simStart) {
  const promises = getPromisesByInvoice(invoiceId);
  const promise  = promises.find(p => p.promise_id === promiseId && p.status === 'active');
  if (!promise) return null;

  const checkDate = makeSimulatedDate(simStart, simDay);
  // Deterministic: 70% of promises are kept on demo
  const roll = seededRandom(invoiceId, simDay + 999);

  if (roll < 0.70) {
    // Fulfilled
    updatePromiseStatus(promiseId, 'fulfilled');
    updateInvoiceStatus(invoiceId, STATES.RECOVERED);
    logAudit(invoiceId, 'PAYMENT_RECEIVED',
      JSON.stringify({ amount: invoice.amount, promiseId }),
      `Payment of ₹${invoice.amount.toLocaleString('en-IN')} received — promise fulfilled.`,
      'MARK_RECOVERED',
      `₹${invoice.amount.toLocaleString('en-IN')} RECOVERED`,
      'WORKFLOW_STOPPED',
      checkDate
    );
    logAudit(invoiceId, 'WORKFLOW_STOPPED',
      JSON.stringify({ status: 'recovered', amount: invoice.amount }),
      `Recovery complete. ₹${invoice.amount.toLocaleString('en-IN')} recovered.`,
      null, null, null,
      makeSimulatedDate(simStart, simDay, 1)
    );
    return { fulfilled: true, amountRecovered: invoice.amount };
  } else {
    // Broken
    updatePromiseStatus(promiseId, 'broken');
    logAudit(invoiceId, 'PROMISE_BROKEN',
      JSON.stringify({ promiseId, dueDate: promise.promised_date }),
      `Payment promise broken — expected payment not received by ${promise.promised_date}.`,
      'CHECK_PROMISE_STATUS',
      'Promise date passed without payment.',
      'RE_EVALUATE',
      checkDate
    );
    return { fulfilled: false, amountRecovered: 0 };
  }
}
