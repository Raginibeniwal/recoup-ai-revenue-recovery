import { getInvoiceById, getCustomerById, getRecoveryAttempts, getPromisesByInvoice, getPaymentHistoryByCustomer } from '../db.js';

// ── Thresholds & Policies ───────────────────────────────────────────────────

const ERV_HIGH_PRIORITY_THRESHOLD = 100000; // ₹1L
const MAX_AUTOMATED_ATTEMPTS = 4;
const LOW_PROBABILITY_THRESHOLD = 0.20; // 20%
const EXTREME_OVERDUE_DAYS = 90;

const ACTIONS = {
  REMINDER: 'SEND_FRIENDLY_REMINDER',
  FOLLOWUP: 'SEND_PERSONALIZED_FOLLOWUP',
  PAYMENT_LINK: 'SEND_PAYMENT_LINK',
  RECORD_PROMISE: 'RECORD_PROMISE_TO_PAY',
  FOLLOW_UP_PROMISE: 'FOLLOW_UP_ON_PROMISE',
  ESC_FINANCE: 'ESCALATE_TO_FINANCE',
  ESC_AM: 'ESCALATE_TO_ACCOUNT_MANAGER',
  STOP: 'STOP_AUTOMATED_RECOVERY'
};

const DIAGNOSES = {
  RECENTLY_OVERDUE: 'RECENTLY_OVERDUE',
  RELIABLE_CUSTOMER: 'RELIABLE_CUSTOMER',
  CHRONIC_LATE_PAYER: 'CHRONIC_LATE_PAYER',
  HIGH_VALUE_ACCOUNT: 'HIGH_VALUE_ACCOUNT',
  PAYMENT_PROMISE_ACTIVE: 'PAYMENT_PROMISE_ACTIVE',
  PROMISE_BROKEN: 'PROMISE_BROKEN',
  DISPUTED_INVOICE: 'DISPUTED_INVOICE',
  REPEATED_CONTACT_NO_RESPONSE: 'REPEATED_CONTACT_NO_RESPONSE',
  SEVERELY_OVERDUE: 'SEVERELY_OVERDUE',
  LOW_RECOVERY_PROBABILITY: 'LOW_RECOVERY_PROBABILITY',
  ANOMALOUS_PAYMENT_BEHAVIOR: 'ANOMALOUS_PAYMENT_BEHAVIOR'
};

export const ACTION_LABELS = {
  SEND_FRIENDLY_REMINDER: 'Send friendly payment reminder',
  SEND_PERSONALIZED_FOLLOWUP: 'Send personalized follow-up',
  SEND_PAYMENT_LINK: 'Send instant payment link',
  RECORD_PROMISE_TO_PAY: 'Record promise to pay',
  FOLLOW_UP_ON_PROMISE: 'Follow up on payment promise',
  ESCALATE_TO_FINANCE: 'Escalate to Finance team',
  ESCALATE_TO_ACCOUNT_MANAGER: 'Escalate to Account Manager',
  STOP_AUTOMATED_RECOVERY: 'Stop automated recovery'
};

export const DIAGNOSIS_LABELS = {
  RECENTLY_OVERDUE: 'Recently overdue invoice',
  RELIABLE_CUSTOMER: 'Reliable customer with minor delay',
  CHRONIC_LATE_PAYER: 'Chronic late paying customer',
  HIGH_VALUE_ACCOUNT: 'High-value account exposure',
  PAYMENT_PROMISE_ACTIVE: 'Active promise to pay',
  PROMISE_BROKEN: 'Broken promise to pay',
  DISPUTED_INVOICE: 'Disputed invoice',
  REPEATED_CONTACT_NO_RESPONSE: 'Repeated contact with no response',
  SEVERELY_OVERDUE: 'Severely overdue debt (>90 days)',
  LOW_RECOVERY_PROBABILITY: 'Low recovery probability',
  ANOMALOUS_PAYMENT_BEHAVIOR: 'Anomalous payment delay'
};

function buildHumanReasons(context, diagnosis, probability, rules) {
  const { customer, invoice, attempts } = context;
  const reasons = [];

  if (customer.payment_reliability >= 0.8) {
    reasons.push('✓ Customer usually pays reliably');
  } else if (customer.payment_reliability < 0.5) {
    reasons.push('⚠️ Customer has history of payment delays');
  }

  if (invoice.days_overdue <= 15) {
    reasons.push(`✓ Invoice is only ${invoice.days_overdue} days overdue`);
  } else if (invoice.days_overdue > 60) {
    reasons.push(`⚠️ Invoice is severely overdue (${invoice.days_overdue} days)`);
  } else {
    reasons.push(`• Invoice is ${invoice.days_overdue} days past due`);
  }

  if (invoice.dispute_flag === 1) {
    reasons.push('⚠️ Customer has an active dispute on this invoice');
  } else {
    reasons.push('✓ No active billing dispute');
  }

  if (attempts.length === 0) {
    reasons.push('✓ No previous automated attempts');
  } else if (attempts.length >= MAX_AUTOMATED_ATTEMPTS) {
    reasons.push(`⚠️ Reached max automated contacts (${attempts.length} attempts)`);
  } else {
    reasons.push(`• ${attempts.length} previous reminder(s) sent`);
  }

  if (rules.requiresHuman) {
    reasons.push('👤 Human review required');
  } else if (rules.canAutomate) {
    reasons.push('🤖 Safe for automated recovery');
  }

  return reasons;
}

// ── Core Engine Methods ─────────────────────────────────────────────────────

export function decide(invoiceId) {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) throw new Error('Invoice not found');
  
  const customer = getCustomerById(invoice.customer_id);
  const attempts = getRecoveryAttempts(invoiceId);
  const promises = getPromisesByInvoice(invoiceId);
  const history = getPaymentHistoryByCustomer(invoice.customer_id);

  const context = { invoice, customer, attempts, promises, history };
  const factors = [];

  // 1. Diagnose
  const diagnosis = diagnoseInvoice(context, factors);

  // 2. Recovery Probability & ERV
  const recoveryProbability = calculateProbability(context, diagnosis, factors);
  const expectedRecoveryValue = invoice.amount * recoveryProbability;

  // 3. Evaluate Rules
  const rules = evaluateStoppingRules(context, diagnosis, recoveryProbability, factors);

  // 4. Priority
  const { priorityScore, priorityLevel } = calculatePriority(context, expectedRecoveryValue, factors);

  // 5. Select Action
  const recommendedAction = selectAction(diagnosis, rules);
  const humanReasons = buildHumanReasons(context, diagnosis, recoveryProbability, rules);

  return {
    invoiceId,
    diagnosis,
    diagnosisLabel: DIAGNOSIS_LABELS[diagnosis] || diagnosis,
    recoveryProbability: Number(recoveryProbability.toFixed(2)),
    expectedRecoveryValue: Number(expectedRecoveryValue.toFixed(2)),
    priorityScore: Number(priorityScore.toFixed(2)),
    priorityLevel,
    recommendedAction,
    actionLabel: ACTION_LABELS[recommendedAction] || recommendedAction,
    canAutomate: rules.canAutomate,
    requiresHuman: rules.requiresHuman,
    stopReason: rules.stopReason,
    humanReasons,
    decisionFactors: factors
  };
}

function diagnoseInvoice(context, factors) {
  const { invoice, customer, attempts, promises } = context;
  
  // 1. Check Promises
  const activePromise = promises.find(p => p.status === 'active');
  if (activePromise) {
    const isPastDue = new Date(activePromise.promised_date) < new Date();
    if (isPastDue) {
      factors.push(`Promise to pay was broken on ${activePromise.promised_date}.`);
      return DIAGNOSES.PROMISE_BROKEN;
    }
    factors.push(`Customer has an active promise to pay on ${activePromise.promised_date}.`);
    return DIAGNOSES.PAYMENT_PROMISE_ACTIVE;
  }

  // 2. Check Disputes
  if (invoice.dispute_flag === 1) {
    factors.push("Invoice is marked as disputed by the customer.");
    return DIAGNOSES.DISPUTED_INVOICE;
  }

  // 3. Repeated Attempts
  if (attempts.length >= MAX_AUTOMATED_ATTEMPTS) {
    factors.push(`Reached maximum automated attempts (${attempts.length}).`);
    return DIAGNOSES.REPEATED_CONTACT_NO_RESPONSE;
  }

  // 4. Age & Probability Flags
  if (invoice.days_overdue >= EXTREME_OVERDUE_DAYS) {
    factors.push(`Invoice is severely overdue (${invoice.days_overdue} days).`);
    return DIAGNOSES.SEVERELY_OVERDUE;
  }

  if (invoice.amount >= 250000 || customer.customer_tier === 'Enterprise') {
    factors.push(`High value account (${customer.customer_tier} / ₹${invoice.amount}).`);
    return DIAGNOSES.HIGH_VALUE_ACCOUNT;
  }

  // 5. Behavior Anomalies
  if (customer.payment_reliability >= 0.85 && invoice.days_overdue > customer.average_payment_delay + 10) {
    factors.push(`Invoice age (${invoice.days_overdue} days) is highly anomalous compared to typical delay (${customer.average_payment_delay} days).`);
    return DIAGNOSES.ANOMALOUS_PAYMENT_BEHAVIOR;
  }

  if (customer.payment_reliability < 0.50 && invoice.days_overdue > 15) {
    factors.push("Customer is a chronic late payer.");
    return DIAGNOSES.CHRONIC_LATE_PAYER;
  }

  if (invoice.days_overdue <= 15) {
    factors.push(`Invoice is recently overdue (${invoice.days_overdue} days).`);
    return customer.payment_reliability >= 0.70 ? DIAGNOSES.RELIABLE_CUSTOMER : DIAGNOSES.RECENTLY_OVERDUE;
  }

  return DIAGNOSES.RECENTLY_OVERDUE;
}

function calculateProbability(context, diagnosis, factors) {
  const { invoice, customer, attempts } = context;
  let prob = customer.payment_reliability;
  
  factors.push(`Base probability from customer reliability: ${(prob * 100).toFixed(0)}%.`);

  // Penalty for extreme age
  if (invoice.days_overdue > 30) {
    const penalty = Math.min((invoice.days_overdue - 30) * 0.005, 0.40);
    prob -= penalty;
    factors.push(`Reduced by ${(penalty * 100).toFixed(0)}% due to invoice age.`);
  }

  // Penalty for repeated ignoring
  if (attempts.length > 0) {
    const penalty = attempts.length * 0.08;
    prob -= penalty;
    factors.push(`Reduced by ${(penalty * 100).toFixed(0)}% due to ${attempts.length} failed attempts.`);
  }

  if (diagnosis === DIAGNOSES.DISPUTED_INVOICE) {
    prob = 0.10;
    factors.push("Forced to 10% due to active dispute.");
  } else if (diagnosis === DIAGNOSES.PROMISE_BROKEN) {
    prob *= 0.50; // Halved
    factors.push("Halved probability due to broken promise.");
  } else if (diagnosis === DIAGNOSES.PAYMENT_PROMISE_ACTIVE) {
    prob = 0.90;
    factors.push("Set to 90% due to active promise to pay.");
  }

  const finalProb = Math.max(0.01, Math.min(0.99, prob));
  
  if (finalProb < LOW_PROBABILITY_THRESHOLD) {
    factors.push("Warning: Recovery probability is critically low.");
  }

  return finalProb;
}

function evaluateStoppingRules(context, diagnosis, probability, factors) {
  const rules = { canAutomate: true, requiresHuman: false, stopReason: null };

  if (diagnosis === DIAGNOSES.DISPUTED_INVOICE) {
    rules.canAutomate = false;
    rules.requiresHuman = true;
    rules.stopReason = 'Dispute detected; requires manual investigation.';
    factors.push(rules.stopReason);
  } else if (diagnosis === DIAGNOSES.REPEATED_CONTACT_NO_RESPONSE) {
    rules.canAutomate = false;
    rules.requiresHuman = true;
    rules.stopReason = 'Maximum automated attempts reached without resolution.';
    factors.push(rules.stopReason);
  } else if (diagnosis === DIAGNOSES.SEVERELY_OVERDUE || probability < LOW_PROBABILITY_THRESHOLD) {
    rules.canAutomate = false;
    rules.requiresHuman = false;
    rules.stopReason = 'Probability too low / severely overdue. Halting automated collection.';
    factors.push(rules.stopReason);
  } else if (context.invoice.status === 'recovered') {
    rules.canAutomate = false;
    rules.requiresHuman = false;
    rules.stopReason = 'Invoice is already recovered.';
    factors.push(rules.stopReason);
  }

  return rules;
}

function calculatePriority(context, erv, factors) {
  const { invoice, customer } = context;
  
  let score = (erv / 100000) * 10; 
  
  if (invoice.days_overdue > 30) score += 5;
  if (customer.customer_tier === 'Enterprise') score += 10;
  
  let level = 'LOW';
  if (erv > ERV_HIGH_PRIORITY_THRESHOLD || score > 20) {
    level = 'HIGH';
    factors.push(`HIGH priority (ERV: ₹${erv.toFixed(0)}, Score: ${score.toFixed(1)}).`);
  } else if (erv > ERV_HIGH_PRIORITY_THRESHOLD * 0.4 || score > 10) {
    level = 'MEDIUM';
    factors.push(`MEDIUM priority (ERV: ₹${erv.toFixed(0)}, Score: ${score.toFixed(1)}).`);
  } else {
    factors.push(`LOW priority (ERV: ₹${erv.toFixed(0)}, Score: ${score.toFixed(1)}).`);
  }
  
  return { priorityScore: score, priorityLevel: level };
}

function selectAction(diagnosis, rules) {
  if (!rules.canAutomate) {
    if (rules.requiresHuman) {
      return diagnosis === DIAGNOSES.DISPUTED_INVOICE ? ACTIONS.ESC_FINANCE : ACTIONS.ESC_AM;
    }
    return ACTIONS.STOP;
  }

  switch (diagnosis) {
    case DIAGNOSES.RELIABLE_CUSTOMER:
    case DIAGNOSES.RECENTLY_OVERDUE:
      return ACTIONS.REMINDER;
    
    case DIAGNOSES.CHRONIC_LATE_PAYER:
    case DIAGNOSES.ANOMALOUS_PAYMENT_BEHAVIOR:
      return ACTIONS.FOLLOWUP;
      
    case DIAGNOSES.HIGH_VALUE_ACCOUNT:
      return ACTIONS.PAYMENT_LINK;
      
    case DIAGNOSES.PAYMENT_PROMISE_ACTIVE:
      return ACTIONS.RECORD_PROMISE;
      
    case DIAGNOSES.PROMISE_BROKEN:
      return ACTIONS.FOLLOW_UP_PROMISE;
      
    default:
      return ACTIONS.FOLLOWUP;
  }
}
