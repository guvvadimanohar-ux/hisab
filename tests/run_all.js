/**
 * Master Test Runner for Hisab
 * Executes all unit, security, financial, and AI voice test suites.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const suites = [
  { name: 'Shop Tools Suite', file: 'shop_tools_tests.js' },
  { name: 'Merchant Session Recognition Suite', file: 'merchant_session_tests.js' },
  { name: 'Daily Shop Workflow Suite', file: 'daily_workflow_tests.js' },
  { name: 'Analytics Consent Suite', file: 'analytics_tests.js' },
  { name: 'Dashboard Chart Data Suite', file: 'chart_data_tests.js' },
  { name: 'Presentation Motion Suite', file: 'site_motion_tests.js' },
  { name: 'Site Features Suite', file: 'site_features_tests.js' },
  { name: 'Privacy & Consent Suite', file: 'privacy_tests.js' },
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
