import { getDb, getInvoicesByBatch, updateBatchBaselineResults } from './db.js';

// ── Outcome simulation for the agent loop ────────────────────────────────────

/**
 * Simulate the outcome of an intervention attempt.
 * Uses the hidden true_recovery_probability with per-attempt decay.
 * Demo cases have forced outcomes to guarantee Section 13 scenarios.
 */
export function simulateOutcome(caseData, attemptNumber) {
  // Normal stochastic outcome with per-attempt decay (diminishing returns)
  const decayFactor = Math.pow(0.85, attemptNumber - 1);
  const effectiveProb = caseData.true_recovery_probability * decayFactor;
  return Math.random() < effectiveProb ? 'success' : 'failure';
}

// ── Baseline strategy simulator ──────────────────────────────────────────────

/**
 * Naive baseline: send 1 generic reminder, then retry once after 7 days.
 * No scoring, no stopping rules, no adaptation.
 * Uses the same hidden true_recovery_probability for fair comparison.
 */
export function runBaselineSimulation(batchId) {
  const cases = getInvoicesByBatch(batchId);
  let recoveredAmount = 0;
  let recoveredCount = 0;

  for (const c of cases) {
    // Attempt 1 — generic reminder
    if (Math.random() < c.true_recovery_probability) {
      recoveredAmount += c.amount;
      recoveredCount++;
      continue;
    }

    // Attempt 2 — single retry (slightly decayed probability)
    const retryProb = c.true_recovery_probability * 0.85;
    if (Math.random() < retryProb) {
      recoveredAmount += c.amount;
      recoveredCount++;
    }
    // No third attempt, no strategy change, no escalation
  }

  // Persist results
  updateBatchBaselineResults(batchId, recoveredAmount, recoveredCount);

  return { recoveredAmount, recoveredCount, totalCases: cases.length };
}
