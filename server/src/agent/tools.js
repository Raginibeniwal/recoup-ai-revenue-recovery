// ── Agent context-retrieval tools ────────────────────────────────────────────
// Each tool is a distinct function call so the audit trail is genuine.
// These tools operate on the caseData shape created by toCaseData() in loop.js.

import { getRecoveryAttempts } from '../db.js';

/**
 * Step 2 tool: retrieve customer profile from the case record.
 */
export function getCustomerProfile(caseData) {
  return {
    customer_id:              caseData.customer_id,
    customer_name:            caseData.customer_name,
    tenure_months:            caseData.customer_tenure_months || 0,
    plan_name:                caseData.plan_name || caseData.failure_reason_code,
    case_type:                caseData.case_type || 'b2b_invoice',
    opted_out:                Boolean(caseData.opted_out),
    dispute_flag:             Boolean(caseData.dispute_flag),
    suspicious_activity_flag: Boolean(caseData.suspicious_activity_flag)
  };
}

/**
 * Step 2 tool: retrieve payment/attempt history for a case.
 */
export function getPaymentHistory(caseId) {
  return getRecoveryAttempts(caseId);
}

/**
 * Step 2 tool: retrieve failure reason details.
 */
export function getFailureReason(caseData) {
  return {
    failure_reason_code:         caseData.failure_reason_code,
    amount:                      caseData.amount,
    currency:                    caseData.currency || 'INR',
    due_date:                    caseData.due_date,
    prior_failures_count:        caseData.prior_failures_count || 0,
    prior_recovery_success_rate: caseData.prior_recovery_success_rate || 0.5
  };
}
