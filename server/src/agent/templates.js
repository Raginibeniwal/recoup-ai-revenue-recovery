// ── Section 9: Message Templates with Slot Validation ────────────────────────

const TEMPLATES = {
  payment_reminder: {
    subject: 'Payment Reminder — {{plan_name}}',
    body: `Dear {{customer_name}},

This is a friendly reminder that your payment of ₹{{amount}} for {{plan_name}} was due on {{due_date}}.

Please make your payment at your earliest convenience to continue enjoying uninterrupted service.

Payment link: {{payment_link}}

Thank you for your continued patronage.

Best regards,
Recoup Recovery Team`
  },

  update_payment: {
    subject: 'Action Required: Update Your Payment Method',
    body: `Dear {{customer_name}},

We were unable to process your payment of ₹{{amount}} for {{plan_name}} due on {{due_date}}.

It appears your payment method may need to be updated. Please use the link below to update your payment details:

{{payment_link}}

If you have already updated your payment method, please disregard this message.

Best regards,
Recoup Recovery Team`
  },

  payment_link: {
    subject: 'Your Payment Link — ₹{{amount}}',
    body: `Dear {{customer_name}},

Please use the following secure link to complete your payment of ₹{{amount}} for {{plan_name}} (due: {{due_date}}):

{{payment_link}}

This link will expire in 7 days.

Best regards,
Recoup Recovery Team`
  },

  promise_to_pay: {
    subject: 'Payment Arrangement Confirmation',
    body: `Dear {{customer_name}},

Thank you for confirming your intent to settle the outstanding payment of ₹{{amount}} for {{plan_name}}.

We have noted your commitment and will follow up on the agreed date. Please ensure the payment is completed by {{due_date}}.

Best regards,
Recoup Recovery Team`
  }
};

const ALLOWED_SLOTS = new Set(['customer_name', 'amount', 'due_date', 'plan_name', 'payment_link']);

// ── Public API ───────────────────────────────────────────────────────────────

export function getTemplate(templateName) {
  return TEMPLATES[templateName] || TEMPLATES.payment_reminder;
}

/**
 * Fill a template with validated slots.
 * Throws if any slot name is not in the approved set.
 */
export function fillTemplate(templateName, slots) {
  const tmpl = getTemplate(templateName);

  for (const key of Object.keys(slots)) {
    if (!ALLOWED_SLOTS.has(key)) {
      throw new Error(`Disallowed template slot: "${key}"`);
    }
  }

  let subject = tmpl.subject;
  let body    = tmpl.body;

  for (const [key, value] of Object.entries(slots)) {
    const ph = `{{${key}}}`;
    subject = subject.replaceAll(ph, String(value));
    body    = body.replaceAll(ph, String(value));
  }

  return { subject, body };
}

/**
 * Section 9 guardrail: validate LLM output doesn't deviate from template rules.
 * The LLM may NOT promise discounts, make legal threats, or alter amounts.
 */
export function validateLLMOutput(text) {
  const violations = [];
  const t = typeof text === 'string' ? text : JSON.stringify(text);

  if (/waive|discount|free\b|complimentary|no.?charge/i.test(t))
    violations.push('Contains promise of waived fee or discount');
  if (/legal.?action|court|lawsuit|attorney|lawyer|sue\b/i.test(t))
    violations.push('Contains legal threat or statement');
  if (/revised.?amount|new.?amount|adjusted|reduced.?to/i.test(t))
    violations.push('Attempts to alter payment amount');

  return { valid: violations.length === 0, violations };
}

/**
 * Map an action enum to a template name.
 */
export function getTemplateForAction(action) {
  const map = {
    send_reminder:            'payment_reminder',
    send_update_payment_link: 'update_payment',
    generate_payment_link:    'payment_link',
    promise_to_pay_tracked:   'promise_to_pay'
  };
  return map[action] || 'payment_reminder';
}
