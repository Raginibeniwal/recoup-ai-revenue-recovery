// ── Section 6: Recovery Probability & ERV — Heuristic Formula ────────────────

const BASE_PROBABILITY = {
  insufficient_funds: 0.75,
  expired_card:       0.65,
  bank_decline:       0.55,
  network_error:      0.85,
  unresponsive:       0.30,
  disputed:           0.05,
  other:              0.40
};

// Cost factor per action type (ratio, not absolute ₹)
const ACTION_COST_FACTORS = {
  retry_now:                0.001,
  retry_scheduled:          0.001,
  send_reminder:            0.005,
  send_update_payment_link: 0.008,
  generate_payment_link:    0.008,
  promise_to_pay_tracked:   0.010,
  escalate:                 0.020,
  stop:                     0.000
};

/**
 * Weighted scoring function — no ML, fully deterministic.
 *
 * base  = lookup by failure_reason_code
 * + 0.10 if tenure > 12 months
 * + 0.05 if prior_recovery_success_rate > 0.7
 * − 0.15 × prior_failures_count
 * − 0.20 if this is a repeat attempt (attemptNumber > 1)
 * clamped to [0.05, 0.95]
 */
export function calculateRecoveryProbability(caseData, attemptNumber = 1) {
  let p = BASE_PROBABILITY[caseData.failure_reason_code] ?? 0.40;

  if (caseData.customer_tenure_months > 12)          p += 0.10;
  if (caseData.prior_recovery_success_rate > 0.7)    p += 0.05;
  p -= 0.15 * caseData.prior_failures_count;
  if (attemptNumber > 1) p -= 0.20;                  // repeat-attempt penalty

  return Math.round(Math.max(0.05, Math.min(0.95, p)) * 1000) / 1000;
}

/**
 * ERV = amount × probability × (1 − cost_factor)
 */
export function calculateExpectedRecoveryValue(amount, probability, action) {
  const costFactor = ACTION_COST_FACTORS[action] ?? 0.005;
  return Math.round(amount * probability * (1 - costFactor) * 100) / 100;
}

export function getCostFactor(action) {
  return ACTION_COST_FACTORS[action] ?? 0.005;
}
