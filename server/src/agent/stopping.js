// ── Section 8: Stopping Rules (deterministic gate) ───────────────────────────

const MAX_ATTEMPTS           = 3;
const MAX_COMMUNICATIONS     = 3;
const MIN_ERV_THRESHOLD      = 50;       // ₹50
const MAX_COST_RATIO         = 0.15;     // 15 % of amount
const AUTO_APPROVAL_THRESHOLD = 100000;  // ₹1,00,000

const COMMUNICATION_ACTIONS = new Set([
  'send_reminder', 'send_update_payment_link', 'generate_payment_link'
]);

/**
 * Evaluate all stop / escalate rules BEFORE every action.
 * Returns { should_stop, should_escalate, rule_triggered }.
 */
export function checkStoppingRules(caseData, attempts, probability, erv, attemptNumber) {
  // ── ESCALATE checks (evaluated first — escalation trumps stop) ───────────

  // Dispute flag → stop AND escalate immediately
  if (caseData.dispute_flag) {
    return {
      should_stop: true,
      should_escalate: true,
      rule_triggered: 'escalated + stopped: dispute_flag is true — no further automated contact'
    };
  }

  // Amount exceeds auto-approval threshold
  if (caseData.amount > AUTO_APPROVAL_THRESHOLD) {
    return {
      should_stop: false,
      should_escalate: true,
      rule_triggered: `escalated: amount ₹${fmt(caseData.amount)} exceeds auto-approval threshold ₹${fmt(AUTO_APPROVAL_THRESHOLD)}`
    };
  }

  // Suspicious activity
  if (caseData.suspicious_activity_flag) {
    return {
      should_stop: false,
      should_escalate: true,
      rule_triggered: 'escalated: suspicious_activity_flag is true'
    };
  }

  // B2B invoice with broken promise-to-pay
  if (caseData.case_type === 'b2b_invoice') {
    const brokenPromise = attempts.some(
      a => a.action_taken === 'promise_to_pay_tracked' && a.outcome === 'failure'
    );
    if (brokenPromise) {
      return {
        should_stop: false,
        should_escalate: true,
        rule_triggered: 'escalated: B2B invoice — promise_to_pay was broken'
      };
    }
  }

  // ── STOP checks ──────────────────────────────────────────────────────────

  // Max retries
  if (attemptNumber > MAX_ATTEMPTS) {
    return {
      should_stop: true,
      should_escalate: false,
      rule_triggered: `stopped: attempt_count ${attemptNumber} > ${MAX_ATTEMPTS} (max retries)`
    };
  }

  // Max communications
  const commCount = attempts.filter(a => COMMUNICATION_ACTIONS.has(a.action_taken)).length;
  if (commCount >= MAX_COMMUNICATIONS) {
    return {
      should_stop: true,
      should_escalate: false,
      rule_triggered: `stopped: communication_count ${commCount} >= ${MAX_COMMUNICATIONS} (max messages)`
    };
  }

  // Customer opted out
  if (caseData.opted_out) {
    return {
      should_stop: true,
      should_escalate: false,
      rule_triggered: 'stopped: customer has opted out of communications'
    };
  }

  // ERV below minimum pursuit threshold
  if (erv < MIN_ERV_THRESHOLD) {
    return {
      should_stop: true,
      should_escalate: false,
      rule_triggered: `stopped: ERV ₹${erv.toFixed(2)} < minimum pursuit threshold ₹${MIN_ERV_THRESHOLD}`
    };
  }

  // Cost-to-recover ratio too high
  const totalCostRatio = attempts.length * 0.008;  // rough avg cost per prior attempt
  if (totalCostRatio > MAX_COST_RATIO) {
    return {
      should_stop: true,
      should_escalate: false,
      rule_triggered: `stopped: cumulative cost ratio ${(totalCostRatio * 100).toFixed(1)}% > ${MAX_COST_RATIO * 100}% threshold`
    };
  }

  // ── No rule triggered ────────────────────────────────────────────────────
  return { should_stop: false, should_escalate: false, rule_triggered: null };
}

function fmt(n) {
  return n.toLocaleString('en-IN');
}
