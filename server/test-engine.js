import { initDb, getLatestBatch, getInvoicesByBatch, getCustomerById } from './src/db.js';
import { generateBatch } from './src/generator.js';
import { decide } from './src/agent/engine.js';

async function runTests() {
  console.log('Initializing database...');
  await initDb();

  console.log('Generating test batch...');
  generateBatch(20);

  const batch = getLatestBatch();
  const invoices = getInvoicesByBatch(batch.batch_id);

  console.log('\n=============================================');
  console.log('       PHASE 2: DECISION ENGINE TESTS');
  console.log('=============================================\n');

  let passed = 0;
  let total = 0;

  for (const inv of invoices) {
    const cust = getCustomerById(inv.customer_id);
    // Only test our specific hardcoded edge cases from generator.js
    if (!cust.company_name.match(/Stark|Wayne|LexCorp|Oscorp|Queen|Umbrella|Cyberdyne|Aperture/)) continue;
    
    total++;
    const decision = decide(inv.invoice_id);
    
    console.log(`\n--- Test Case ${total}: ${cust.company_name} ---`);
    console.log(`Invoice: ₹${inv.amount}, Overdue: ${inv.days_overdue} days, Dispute: ${inv.dispute_flag}`);
    console.log(`Diagnosis: ${decision.diagnosis}`);
    console.log(`Probability: ${(decision.recoveryProbability * 100).toFixed(0)}%`);
    console.log(`Expected Value: ₹${decision.expectedRecoveryValue}`);
    console.log(`Priority: ${decision.priorityLevel} (${decision.priorityScore})`);
    console.log(`Action: ${decision.recommendedAction}`);
    console.log(`Can Automate: ${decision.canAutomate}`);
    console.log(`Stop Reason: ${decision.stopReason || 'None'}`);
    console.log('Factors:');
    decision.decisionFactors.forEach(f => console.log(`  - ${f}`));

    // Basic assertions
    if (cust.company_name === 'Stark Manufacturing' && inv.amount === 25000) {
      if (decision.diagnosis === 'RELIABLE_CUSTOMER' || decision.diagnosis === 'RECENTLY_OVERDUE' || decision.diagnosis === 'HIGH_VALUE_ACCOUNT') passed++;
      else console.log('❌ UNEXPECTED DIAGNOSIS FOR THIS EDGE CASE');
    }
    else if (cust.company_name === 'Wayne Logistics' && inv.amount === 45000) {
      if (decision.diagnosis === 'CHRONIC_LATE_PAYER') passed++;
      else console.log('❌ UNEXPECTED DIAGNOSIS FOR THIS EDGE CASE');
    }
    else if (cust.company_name === 'LexCorp Enterprise' && inv.amount === 4500000) {
      if (decision.diagnosis === 'HIGH_VALUE_ACCOUNT') passed++;
      else console.log('❌ UNEXPECTED DIAGNOSIS FOR THIS EDGE CASE');
    }
    else if (cust.company_name === 'Oscorp Science' && inv.amount === 120000 && inv.dispute_flag === 1) {
      if (decision.diagnosis === 'DISPUTED_INVOICE') passed++;
      else console.log('❌ UNEXPECTED DIAGNOSIS FOR THIS EDGE CASE');
    }
    else if (cust.company_name === 'Queen Consolidated' && inv.amount === 85000) {
      if (decision.diagnosis === 'RECENTLY_OVERDUE') passed++;
      else console.log('❌ UNEXPECTED DIAGNOSIS FOR THIS EDGE CASE');
    }
    else if (cust.company_name === 'Umbrella Corp' && inv.amount === 210000 && inv.days_overdue === 85) {
      if (decision.diagnosis === 'CHRONIC_LATE_PAYER' || decision.diagnosis === 'LOW_RECOVERY_PROBABILITY') passed++;
      else console.log('❌ UNEXPECTED DIAGNOSIS FOR THIS EDGE CASE');
    }
    else if (cust.company_name === 'Cyberdyne Systems' && inv.amount === 15000 && inv.days_overdue === 120) {
      if (decision.diagnosis === 'SEVERELY_OVERDUE') passed++;
      else console.log('❌ UNEXPECTED DIAGNOSIS FOR THIS EDGE CASE');
    }
    else if (cust.company_name === 'Aperture Science' && inv.amount === 300000) {
      if (decision.diagnosis === 'ANOMALOUS_PAYMENT_BEHAVIOR' || decision.diagnosis === 'HIGH_VALUE_ACCOUNT') passed++;
      else console.log('❌ UNEXPECTED DIAGNOSIS FOR THIS EDGE CASE');
    }
    else {
      // It's a randomly generated invoice for this customer, ignore it in the final count
      total--;
    }
  }

  console.log('\n=============================================');
  console.log(`TEST RESULTS: ${passed}/${total} edge cases passed diagnosis checks.`);
  console.log('=============================================\n');
  
  if (passed === total) {
    console.log('✅ All Phase 2 Decision Engine tests passed successfully!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}

runTests().catch(console.error);
