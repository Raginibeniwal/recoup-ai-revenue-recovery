import { v4 as uuidv4 } from 'uuid';
import { getDb, insertBatchRun, insertCustomer, insertInvoice, insertPaymentHistory } from './db.js';

// ── B2B Name Pools ───────────────────────────────────────────────────────────

const COMPANY_PREFIXES = ['Acme', 'Global', 'Tech', 'Nexus', 'Apex', 'Vertex', 'Nova', 'Pinnacle', 'Synergy', 'Quantum', 'Zenith', 'Prime'];
const COMPANY_SUFFIXES = ['Corp', 'Inc', 'Solutions', 'Systems', 'Technologies', 'Group', 'Enterprises', 'Partners', 'Logistics', 'Holdings'];
const INDUSTRIES = ['Manufacturing', 'Software', 'Logistics', 'Retail', 'Healthcare', 'Construction', 'Consulting', 'Wholesale', 'Telecommunications'];
const CONTACT_FIRST = ['Rahul', 'Priya', 'Amit', 'Neha', 'Sanjay', 'Kavya', 'Vikram', 'Sneha', 'Arjun', 'Anjali'];
const CONTACT_LAST = ['Sharma', 'Patel', 'Gupta', 'Singh', 'Verma', 'Kumar', 'Joshi', 'Reddy', 'Mehta', 'Nair'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return min + Math.random() * (max - min); }

function generateCompanyName() {
  return `${pick(COMPANY_PREFIXES)} ${pick(COMPANY_SUFFIXES)}`;
}

function generateContactName() {
  return `${pick(CONTACT_FIRST)} ${pick(CONTACT_LAST)}`;
}

function pastDate(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toISOString().split('T')[0];
}

// ── Generate B2B Entity ──────────────────────────────────────────────────────

function createCustomer(override = {}) {
  const reliability = override.payment_reliability ?? rand(0.3, 0.95);
  const delay = override.average_payment_delay ?? Math.floor(rand(-5, 45));
  
  return {
    customer_id: uuidv4(),
    company_name: override.company_name ?? generateCompanyName(),
    industry: pick(INDUSTRIES),
    contact_name: generateContactName(),
    email: `accounts@${generateCompanyName().replace(/\s+/g, '').toLowerCase()}.com`,
    phone: `+91 ${Math.floor(rand(9000000000, 9999999999))}`,
    customer_tier: override.customer_tier ?? pick(['Enterprise', 'Mid-Market', 'SMB', 'SMB']),
    total_revenue: override.total_revenue ?? Math.floor(rand(500000, 10000000)),
    payment_reliability: reliability,
    average_payment_delay: delay,
    preferred_communication_channel: pick(['email', 'email', 'phone']),
    risk_level: override.risk_level ?? (reliability > 0.8 ? 'Low' : reliability > 0.5 ? 'Medium' : 'High'),
    ...override
  };
}

function createInvoice(customerId, batchId, override = {}) {
  const daysOverdue = override.days_overdue ?? Math.floor(rand(1, 90));
  const issueDate = pastDate(daysOverdue + 30);
  const dueDate = pastDate(daysOverdue);
  
  return {
    invoice_id: uuidv4(),
    customer_id: customerId,
    invoice_number: `INV-${Math.floor(rand(10000, 99999))}`,
    amount: override.amount ?? Math.floor(rand(5000, 500000)),
    currency: 'INR',
    issue_date: issueDate,
    due_date: dueDate,
    days_overdue: daysOverdue,
    status: 'active',
    category: override.category ?? pick(['Software License', 'Consulting Services', 'Hardware Procurement', 'Monthly Retainer']),
    priority: override.priority ?? pick(['Normal', 'High', 'Urgent']),
    dispute_flag: override.dispute_flag ?? (Math.random() < 0.05 ? 1 : 0),
    true_recovery_probability: override.true_recovery_probability ?? rand(0.1, 0.9),
    batch_id: batchId,
    ...override
  };
}

function createPaymentHistory(customerId, count) {
  const history = [];
  for (let i = 0; i < count; i++) {
    const delay = Math.floor(rand(-5, 40));
    history.push({
      payment_id: uuidv4(),
      customer_id: customerId,
      invoice_id: `INV-PAST-${Math.floor(rand(1000, 9999))}`,
      amount: Math.floor(rand(5000, 100000)),
      payment_date: pastDate(Math.floor(rand(30, 365))),
      status: 'Paid',
      delay_days: delay,
      method: pick(['Bank Transfer', 'Credit Card', 'Cheque'])
    });
  }
  return history;
}

// ── Specific Case Types (Phase 1 Requirement) ───────────────────────────────

function createSpecialCases(batchId) {
  const customers = [];
  const invoices = [];
  const histories = [];

  // CASE 1: Recently overdue, Reliable customer
  const c1 = createCustomer({ company_name: 'Stark Manufacturing', payment_reliability: 0.95, average_payment_delay: 2, risk_level: 'Low' });
  customers.push(c1);
  invoices.push(createInvoice(c1.customer_id, batchId, { days_overdue: 5, amount: 25000, priority: 'Normal', true_recovery_probability: 0.95 }));
  histories.push(...createPaymentHistory(c1.customer_id, 3).map(h => ({ ...h, delay_days: 1 })));

  // CASE 2: Repeated late payments
  const c2 = createCustomer({ company_name: 'Wayne Logistics', payment_reliability: 0.40, average_payment_delay: 35, risk_level: 'High' });
  customers.push(c2);
  invoices.push(createInvoice(c2.customer_id, batchId, { days_overdue: 28, amount: 45000, priority: 'Normal', true_recovery_probability: 0.45 }));
  histories.push(...createPaymentHistory(c2.customer_id, 4).map(h => ({ ...h, delay_days: 35 })));

  // CASE 3: Large invoice, High-value customer
  const c3 = createCustomer({ company_name: 'LexCorp Enterprise', customer_tier: 'Enterprise', payment_reliability: 0.85, risk_level: 'Low' });
  customers.push(c3);
  invoices.push(createInvoice(c3.customer_id, batchId, { days_overdue: 12, amount: 4500000, priority: 'Urgent', true_recovery_probability: 0.88 }));
  histories.push(...createPaymentHistory(c3.customer_id, 5));

  // CASE 4: Customer has disputed invoice
  const c4 = createCustomer({ company_name: 'Oscorp Science', payment_reliability: 0.70 });
  customers.push(c4);
  invoices.push(createInvoice(c4.customer_id, batchId, { days_overdue: 45, dispute_flag: 1, amount: 120000, true_recovery_probability: 0.10 }));
  histories.push(...createPaymentHistory(c4.customer_id, 2));

  // CASE 5: Promise to pay (will be handled by the simulator/agent loop later, setting it up as normal here but highly recoverable)
  const c5 = createCustomer({ company_name: 'Queen Consolidated', payment_reliability: 0.60 });
  customers.push(c5);
  invoices.push(createInvoice(c5.customer_id, batchId, { days_overdue: 15, amount: 85000, true_recovery_probability: 0.80 }));
  histories.push(...createPaymentHistory(c5.customer_id, 3));

  // CASE 6: Multiple reminders ignored (represented by high days overdue + low probability)
  const c6 = createCustomer({ company_name: 'Umbrella Corp', payment_reliability: 0.20, risk_level: 'High' });
  customers.push(c6);
  invoices.push(createInvoice(c6.customer_id, batchId, { days_overdue: 85, amount: 210000, true_recovery_probability: 0.15 }));
  histories.push(...createPaymentHistory(c6.customer_id, 2).map(h => ({ ...h, delay_days: 60 })));

  // CASE 7: Very old invoice, Low recovery
  const c7 = createCustomer({ company_name: 'Cyberdyne Systems', payment_reliability: 0.10, risk_level: 'High' });
  customers.push(c7);
  invoices.push(createInvoice(c7.customer_id, batchId, { days_overdue: 120, amount: 15000, true_recovery_probability: 0.05 }));
  histories.push(...createPaymentHistory(c7.customer_id, 1).map(h => ({ ...h, delay_days: 100 })));

  // CASE 8: Customer normally pays immediately, sudden anomaly
  const c8 = createCustomer({ company_name: 'Aperture Science', payment_reliability: 0.99, average_payment_delay: -2, risk_level: 'Low' });
  customers.push(c8);
  invoices.push(createInvoice(c8.customer_id, batchId, { days_overdue: 10, amount: 300000, true_recovery_probability: 0.90 }));
  histories.push(...createPaymentHistory(c8.customer_id, 5).map(h => ({ ...h, delay_days: -2 })));

  return { customers, invoices, histories };
}

// ── Public: Generate full batch ──────────────────────────────────────────────

export function generateBatch(invoiceCount = 400) {
  const db = getDb();
  const batchId = uuidv4();
  const now = new Date().toISOString();
  
  const allCustomers = [];
  const allInvoices = [];
  const allHistories = [];

  // Generate 8 specific demo cases
  const special = createSpecialCases(batchId);
  allCustomers.push(...special.customers);
  allInvoices.push(...special.invoices);
  allHistories.push(...special.histories);

  // Generate the rest
  const numCustomers = Math.floor(invoiceCount * 0.6); // About 1.5 invoices per customer
  for (let i = 0; i < numCustomers; i++) {
    const c = createCustomer();
    allCustomers.push(c);
    allHistories.push(...createPaymentHistory(c.customer_id, Math.floor(rand(1, 6))));
  }

  for (let i = 0; i < invoiceCount - 8; i++) {
    const c = pick(allCustomers);
    allInvoices.push(createInvoice(c.customer_id, batchId));
  }

  const totalAtRisk = allInvoices.reduce((s, i) => s + i.amount, 0);

  // Insert to DB
  insertBatchRun(batchId, now, allInvoices.length, totalAtRisk);

  db.run('BEGIN TRANSACTION');
  try {
    for (const c of allCustomers) insertCustomer(c);
    for (const i of allInvoices) insertInvoice(i);
    for (const h of allHistories) insertPaymentHistory(h);
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }

  return { batchId, totalCases: allInvoices.length, totalAtRisk };
}
