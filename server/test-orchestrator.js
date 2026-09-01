import { initDb, getDb, insertCustomer, insertInvoice } from './src/db.js';
import { runRecovery } from './src/agent/orchestrator.js';

async function runTests() {
  await initDb();
  console.log('--- Phase 3 Orchestrator Tests ---');

  // Helper to setup case
  function setupCase(id, reliability, amount, overdue, dispute = 0) {
    insertCustomer({
      customer_id: 'cust-' + id,
      company_name: 'Test Co ' + id,
      industry: 'Software',
      contact_name: 'Contact ' + id,
      email: 'test@test.com',
      phone: '1234567890',
      customer_tier: 'SMB',
      total_revenue: 1000000,
      payment_reliability: reliability,
      average_payment_delay: 5,
      preferred_communication_channel: 'email',
      risk_level: 'Low'
    });
    insertInvoice({
      invoice_id: 'inv-' + id,
      customer_id: 'cust-' + id,
      invoice_number: 'INV-' + id,
      amount,
      currency: 'INR',
      issue_date: '2026-08-01',
      due_date: '2026-08-15',
      days_overdue: overdue,
      status: 'active',
      category: 'Software License',
      priority: 'High',
      dispute_flag: dispute,
      true_recovery_probability: reliability,
      batch_id: 'test-batch'
    });
  }

  // S1: Reliable (pays instantly or promises)
  setupCase('1-reliable', 0.99, 10000, 10);
  console.log('\nTesting S1/S4/S5: Reliable customer (will likely pay or promise)');
  let res1 = runRecovery('inv-1-reliable');
  console.log('Result:', { status: res1.status, iterations: res1.iterations, amount: res1.amountRecovered });
  
  // S2/S3/S6: Unreliable (ignores, needs retries, maybe breaks promise)
  setupCase('2-unreliable', 0.20, 20000, 25);
  console.log('\nTesting S2/S3/S6: Unreliable customer (ignores, retries, broken promises)');
  let res2 = runRecovery('inv-2-unreliable');
  console.log('Result:', { status: res2.status, iterations: res2.iterations, amount: res2.amountRecovered });
  
  // S7: Escalation (Dispute)
  setupCase('3-dispute', 0.90, 50000, 15, 1); // dispute = 1
  console.log('\nTesting S7: Disputed Invoice (Escalation)');
  let res3 = runRecovery('inv-3-dispute');
  console.log('Result:', { status: res3.status, iterations: res3.iterations });

  // S8: Stopping condition (extremely overdue)
  setupCase('4-severe', 0.10, 15000, 120); // 120 days overdue
  console.log('\nTesting S8: Severely Overdue (Stopping Condition)');
  let res4 = runRecovery('inv-4-severe');
  console.log('Result:', { status: res4.status, iterations: res4.iterations });

  console.log('\nTests complete. Review audit logs for detailed timelines.');
}

runTests().catch(console.error);
