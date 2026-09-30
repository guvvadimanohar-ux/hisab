/**
 * Master Test Runner for Hisab
 * Executes all unit, security, financial, and AI voice test suites.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const suites = [
  { name: 'UPI & Account Aggregator Suite', file: 'aa_tests.js' },
  { name: 'Financial Calculation Engine Suite', file: 'financial_tests.js' },
  { name: 'Security, Multi-User Isolation & Auth Suite', file: 'security_tests.js' },
  { name: 'Customer & Credit Ledger Suite', file: 'customer_credit_tests.js' },
  { name: 'Payment Gateway & Reconciliation Suite', file: 'payment_gateway_tests.js' },
  { name: 'Voice Engine & Multilingual Speech Suite', file: 'voice_tests.js' },
  { name: 'Multilingual Voice & AI Assistant Suite', file: 'ai_voice_tests.js' }
];

console.log('====================================================');
console.log('🧪 RUNNING ALL HISAB TEST SUITES');
console.log('====================================================\n');

let allPassed = true;

for (const suite of suites) {
  console.log(`\n▶ Running: ${suite.name} (${suite.file})`);
  const result = spawnSync('node', [path.join(__dirname, suite.file)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });

  if (result.status !== 0) {
    allPassed = false;
    console.error(`❌ ${suite.name} FAILED with exit code ${result.status}`);
  }
}

console.log('\n====================================================');
if (allPassed) {
  console.log('🎉 ALL SUITES PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('💥 SOME TEST SUITES FAILED.');
  process.exit(1);
}
