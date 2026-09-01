// ── LLM integration (Claude) with rule-based fallback ────────────────────────
// Section 5: LLM is used ONLY for intervention selection, message copy
// generation, and re-diagnosis reasoning.  Everything else is deterministic.

import Anthropic from '@anthropic-ai/sdk';
import { fillTemplate, validateLLMOutput, getTemplateForAction } from './templates.js';

let client = null;

function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// ── Rule-based fallback strategy matrix ──────────────────────────────────────

const FALLBACK_ACTIONS = {
  retry_eligible: { 1: 'retry_now',                2: 'retry_scheduled',          3: 'send_reminder' },
  card_update:    { 1: 'send_update_payment_link',  2: 'send_reminder',           3: 'generate_payment_link' },
  negotiation:    { 1: 'send_reminder',             2: 'generate_payment_link',    3: 'promise_to_pay_tracked' },
  engagement:     { 1: 'send_reminder',             2: 'send_update_payment_link', 3: 'escalate' },
  dispute:        { 1: 'stop' },
  general:        { 1: 'send_reminder',             2: 'retry_scheduled',          3: 'escalate' }
};

const FALLBACK_REASONING = {
  retry_now:
    'Immediate retry is the most effective first action for retry-eligible failures. The payment failure appears temporary and an automatic retry has the highest probability of success with minimal cost.',
  retry_scheduled:
    'Scheduling a retry allows the customer time to resolve the underlying issue (e.g. replenish funds). Appropriate after an immediate retry has already failed.',
  send_reminder:
    'A payment reminder nudges the customer and is a low-cost, low-friction intervention that works well across strategy categories.',
  send_update_payment_link:
    'The payment method appears to need updating (e.g. expired card). Sending a direct update link removes friction and increases recovery probability.',
  generate_payment_link:
    'Generating a fresh payment link gives the customer a convenient one-click way to settle the outstanding amount.',
  promise_to_pay_tracked:
    'For negotiation cases, a tracked promise-to-pay creates accountability and a scheduled follow-up trigger.',
  escalate:
    'Automated recovery options exhausted or the case requires human judgment. Routing to a human agent for review.',
  stop:
    'Case meets stopping criteria. No further automated action is warranted.'
};

function fallbackSelect(diagnosis, attemptNumber, allowedActions) {
  const matrix = FALLBACK_ACTIONS[diagnosis.category] || FALLBACK_ACTIONS.general;
  const maxKey = Math.min(attemptNumber, Object.keys(matrix).length);
  let action = matrix[maxKey] || allowedActions[0];

  // Ensure the action is in the allowed set
  if (!allowedActions.includes(action)) action = allowedActions[0];

  return {
    action,
    reasoning: FALLBACK_REASONING[action] ||
      `Selected ${action} based on ${diagnosis.category} strategy (attempt ${attemptNumber}).`
  };
}

// ── Public: select intervention ──────────────────────────────────────────────

export async function selectIntervention(caseData, diagnosis, attempts, allowedActions, options = {}) {
  const attemptNumber = attempts.length + 1;

  // Try LLM if enabled and available
  if (options.useLLM) {
    const anthropic = getClient();
    if (anthropic) {
      try {
        const prompt = buildSelectionPrompt(caseData, diagnosis, attempts, allowedActions);
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
          system: `You are a revenue recovery agent. Given case details, select the optimal intervention from the allowed actions and explain your reasoning concisely. Respond ONLY with valid JSON: {"action":"<action_name>","reasoning":"<2-3 sentence explanation>"}`
        });

        const text = response.content[0].text.trim();
        // Extract JSON (handle markdown code fences)
        const jsonStr = text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(jsonStr);

        if (parsed.action && allowedActions.includes(parsed.action)) {
          return { action: parsed.action, reasoning: parsed.reasoning || '' };
        }
      } catch (err) {
        console.warn('LLM intervention selection failed, using fallback:', err.message);
      }
    }
  }

  return fallbackSelect(diagnosis, attemptNumber, allowedActions);
}

// ── Public: generate message copy ────────────────────────────────────────────

export async function generateMessageCopy(action, caseData, options = {}) {
  const templateName = getTemplateForAction(action);
  const slots = {
    customer_name: caseData.customer_name,
    amount:        caseData.amount.toLocaleString('en-IN'),
    due_date:      caseData.due_date || 'N/A',
    plan_name:     caseData.plan_name || 'Your Plan',
    payment_link:  `https://pay.recoup.ai/${caseData.case_id.slice(0, 8)}`
  };

  const filled = fillTemplate(templateName, slots);

  // If LLM enabled, let it soften tone (structure stays fixed)
  if (options.useLLM) {
    const anthropic = getClient();
    if (anthropic) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Adjust the tone of this payment recovery message to be more empathetic and professional. Do NOT change the structure, amounts, dates, or links. Only adjust word choice within each paragraph.\n\nOriginal:\n${filled.body}`
          }]
        });
        const adjusted = res.content[0].text.trim();
        const check = validateLLMOutput(adjusted);
        if (check.valid) {
          return { subject: filled.subject, body: adjusted, template: templateName, llmAdjusted: true };
        }
      } catch (err) {
        console.warn('LLM message generation failed:', err.message);
      }
    }
  }

  return { ...filled, template: templateName, llmAdjusted: false };
}

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildSelectionPrompt(caseData, diagnosis, attempts, allowedActions) {
  const hist = attempts.length > 0
    ? attempts.map(a => `  Attempt ${a.attempt_number}: ${a.action_taken} → ${a.outcome}`).join('\n')
    : '  (no prior attempts)';

  return `Case Details:
- Customer: ${caseData.customer_name} (tenure: ${caseData.customer_tenure_months} months)
- Amount: ₹${caseData.amount.toLocaleString('en-IN')}
- Type: ${caseData.case_type}
- Failure Reason: ${caseData.failure_reason_code}
- Prior Failures: ${caseData.prior_failures_count}
- Prior Recovery Rate: ${(caseData.prior_recovery_success_rate * 100).toFixed(0)}%

Diagnosis: ${diagnosis.category} strategy — ${diagnosis.strategy_description}

Prior Attempts:
${hist}

Allowed Actions: ${allowedActions.join(', ')}

Select the optimal action and explain your reasoning in 2–3 sentences.
Respond with JSON only: {"action":"<action>","reasoning":"<explanation>"}`;
}
