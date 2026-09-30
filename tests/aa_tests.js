/**
 * Hisab Automated UPI & Account Aggregator Test Suite
 * Validates UPI detection, merchant extraction, categorization,
 * deduplication logic, mock provider stream, and bank normalizer.
 */

const assert = require('node:assert');
const { isUpiTransaction, extractUpiDetails } = require('../backend/services/upiDetector.js');
const { categorizeTransaction } = require('../backend/services/categorization.js');
const { generateDeduplicationFingerprint, normalizeBankTransactions } = require('../backend/services/bankNormalizer.js');
const MockAAProvider = require('../backend/providers/accountAggregator/MockAAProvider.js');
const AccountAggregatorService = require('../backend/services/accountAggregator.js');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${testName}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${testName}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('🚀 Running Hisab UPI & Account Aggregator Test Suite');
  console.log('======================================================\n');

  // --- Suite 1: Multi-Signal UPI Detection ---
  console.log('Test Group 1: Multi-Signal UPI Detection & Extraction');

  runTest('Detects UPI via mode flag', () => {
    const raw = { mode: 'UPI', narration: 'Payment to vendor' };
    assert.strictEqual(isUpiTransaction(raw), true);
  });

  runTest('Detects UPI via narration pattern UPI/xxx', () => {
    const raw = { narration: 'UPI/6251892018/SWIGGY BANGALORE/swiggy@icici/Food order' };
    assert.strictEqual(isUpiTransaction(raw), true);
  });

  runTest('Detects UPI via VPA handle in narration', () => {
    const raw = { narration: 'Transfer to merchant.paytm@paytm ref 992123' };
    assert.strictEqual(isUpiTransaction(raw), true);
  });

  runTest('Rejects non-UPI NEFT / IMPS / ATM transactions', () => {
    const neft = { mode: 'NEFT', narration: 'NEFT-N12345-VENDOR' };
    const atm = { mode: 'ATM', narration: 'ATM CASH WITHDRAWAL KORAMANGALA' };
    assert.strictEqual(isUpiTransaction(neft), false);
    assert.strictEqual(isUpiTransaction(atm), false);
  });

  runTest('Extracts clean merchant name and VPA from complex UPI narration', () => {
    const narration = 'UPI/6251892018/SWIGGY BANGALORE/swiggy@icici/Food delivery order';
    const details = extractUpiDetails(narration);
    assert.strictEqual(details.isUpi, true);
    assert.strictEqual(details.merchantName, 'Swiggy');
    assert.strictEqual(details.vpa, 'swiggy@icici');
    assert.strictEqual(details.suggestedCategory, 'Food & Dining');
  });

  runTest('Extracts Blinkit Grocery merchant and suggests Groceries category', () => {
    const narration = 'UPI/8821940122/BLINKIT COMMERCE/blinkit@hdfcbank/Grocery restocking';
    const details = extractUpiDetails(narration);
    assert.strictEqual(details.merchantName, 'Blinkit');
    assert.strictEqual(details.suggestedCategory, 'Groceries');
  });

  // --- Suite 2: Financial Categorization Engine ---
  console.log('\nTest Group 2: Categorization Engine');

  runTest('Categorizes Food & Dining merchants correctly', () => {
    const cat = categorizeTransaction({ merchant: 'Zomato', narration: 'Zomato Order #8821', flow: 'OUTFLOW', amount: 450 });
    assert.strictEqual(cat, 'Food & Dining');
  });

  runTest('Categorizes Transportation & Fuel merchants correctly', () => {
    const cat = categorizeTransaction({ merchant: 'Uber India', narration: 'Uber trip Bangalore', flow: 'OUTFLOW', amount: 320 });
    assert.strictEqual(cat, 'Transport');
  });

  runTest('Categorizes Salary & Payroll inflow correctly', () => {
    const cat = categorizeTransaction({ merchant: 'Acme Corp', narration: 'SALARY CREDIT FOR AUGUST 2026', flow: 'INFLOW', amount: 85000 });
    assert.strictEqual(cat, 'Salary');
  });

  runTest('Categorizes Loan repayment correctly', () => {
    const cat = categorizeTransaction({ merchant: 'HDFC Home Loan', narration: 'LOAN REPAYMENT EMI DEBIT', flow: 'OUTFLOW', amount: 25000 });
    assert.strictEqual(cat, 'Loan & EMI');
  });

  // --- Suite 3: Deduplication & Invariant Fingerprints ---
  console.log('\nTest Group 3: Deduplication & Invariant Signatures');

  runTest('Generates consistent signature using provider transaction ID', () => {
    const raw = { txnId: 'TXN-AA-999', date: '2026-09-08', amount: 500, type: 'DEBIT' };
    const sig1 = generateDeduplicationFingerprint('HDFC', 'ACC-01', raw);
    const sig2 = generateDeduplicationFingerprint('HDFC', 'ACC-01', raw);
    assert.strictEqual(sig1, sig2);
    assert.strictEqual(sig1, 'HDFC#ACC-01#TXN-AA-999');
  });

  runTest('Generates consistent SHA-256 fallback hash when txnId is missing', () => {
    const raw = { date: '2026-09-08', amount: 500, type: 'DEBIT', reference: 'REF-123', narration: 'UPI Payment to Shop' };
    const hash1 = generateDeduplicationFingerprint('MockAA', 'ACC-02', raw);
    const hash2 = generateDeduplicationFingerprint('MockAA', 'ACC-02', raw);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64); // SHA-256 hex string
  });

  // --- Suite 4: Bank Normalizer & Duplicate Elimination ---
  console.log('\nTest Group 4: Bank Statement Normalizer');

  runTest('Normalizes raw transactions and skips duplicates upon second run', () => {
    const rawFeed = [
      {
        txnId: 'TXN-AA-101',
        date: '2026-09-08 10:00:00',
        amount: 250,
        type: 'DEBIT',
        mode: 'UPI',
        narration: 'UPI/12345/ZEPTO/zepto@hdfcbank/Quick commerce snacks',
        reference: 'REF101'
      },
      {
        txnId: 'TXN-AA-102',
        date: '2026-09-08 11:30:00',
        amount: 1500,
        type: 'CREDIT',
        mode: 'UPI',
        narration: 'UPI/12346/CUSTOMER AMIT/amit@paytm/Payment for shoes',
        reference: 'REF102'
      }
    ];

    const existingSignatures = new Set();
    const context = { provider: 'MockAA', accountId: 'ACC-TEST-1', bankName: 'HDFC Bank' };

    // First sync: both transactions should be imported
    const firstSync = normalizeBankTransactions(rawFeed, context, existingSignatures);
    assert.strictEqual(firstSync.normalized.length, 2);
    assert.strictEqual(firstSync.duplicatesSkipped, 0);
    assert.strictEqual(firstSync.upiCount, 2);
    assert.strictEqual(firstSync.normalized[0].mode, 'UPI');
    assert.strictEqual(firstSync.normalized[0].source, 'BANK_AA');
    assert.strictEqual(firstSync.normalized[0].cash_flow_type, 'OUTFLOW');
    assert.strictEqual(firstSync.normalized[1].cash_flow_type, 'INFLOW');

    // Second sync with existing signatures: both should be skipped
    const secondSync = normalizeBankTransactions(rawFeed, context, existingSignatures);
    assert.strictEqual(secondSync.normalized.length, 0);
    assert.strictEqual(secondSync.duplicatesSkipped, 2);
  });

  // --- Suite 5: MockAAProvider & AA Service Lifecycle ---
  console.log('\nTest Group 5: Account Aggregator Service & Mock Simulator');

  await runAsyncTest('AA Service retrieves supported banks list', async () => {
    const service = new AccountAggregatorService({ mockMode: true });
    const banks = service.getSupportedBanks();
    assert.ok(Array.isArray(banks));
    assert.ok(banks.length >= 5);
    const hdfc = banks.find(b => b.id === 'HDFC');
    assert.ok(hdfc);
    assert.strictEqual(hdfc.name, 'HDFC Bank');
  });

  await runAsyncTest('AA Service creates consent and fetches realistic transactions', async () => {
    const service = new AccountAggregatorService({ mockMode: true });
    const consent = await service.initiateConsent({ bankId: 'SBI', phoneNumber: '9876543210' });
    assert.ok(consent.consentId);
    assert.strictEqual(consent.status, 'ACTIVE');

    const fiData = await service.fetchBankTransactions(consent.consentId, {
      from: '2026-06-01',
      to: '2026-09-08'
    });

    assert.ok(Array.isArray(fiData.transactions));
    assert.ok(fiData.transactions.length >= 10);
    assert.strictEqual(fiData.metadata.isDemo, true);

    const upiTransactions = fiData.transactions.filter(t => t.mode === 'UPI');
    assert.ok(upiTransactions.length > 5, 'Should have multiple realistic UPI transactions');
  });

  // --- Suite 6: Webhook Signature Rejection ---
  console.log('\nTest Group 6: Webhook Signature Verification');

  runTest('SetuProvider rejects missing webhook signature', () => {
    const SetuProvider = require('../backend/providers/accountAggregator/SetuProvider.js');
    const setu = new SetuProvider({ webhookSecret: 'test_secret_key_123' });
    const result = setu.verifyWebhookSignature({}, '{"test":"data"}');
    assert.strictEqual(result, false, 'Should reject when no signature header present');
  });

  runTest('SetuProvider rejects invalid HMAC signature', () => {
    const SetuProvider = require('../backend/providers/accountAggregator/SetuProvider.js');
    const setu = new SetuProvider({ webhookSecret: 'test_secret_key_123' });
    const result = setu.verifyWebhookSignature(
      { 'x-setu-signature': 'totally_invalid_signature_hex_value_' + '0'.repeat(28) },
      '{"test":"data"}'
    );
    assert.strictEqual(result, false, 'Should reject incorrect HMAC signature');
  });

  runTest('MockAAProvider always accepts webhook signatures', () => {
    const mock = new MockAAProvider();
    assert.strictEqual(mock.verifyWebhookSignature({}, {}), true);
  });

  // --- Suite 7: Consent Lifecycle ---
  console.log('\nTest Group 7: Consent Revocation Lifecycle');

  await runAsyncTest('Consent can be revoked via MockAAProvider', async () => {
    const service = new AccountAggregatorService({ mockMode: true });
    const consent = await service.initiateConsent({ bankId: 'ICICI', phoneNumber: '9876543210' });
    assert.strictEqual(consent.status, 'ACTIVE');

    const revokeResult = await service.revokeConsent(consent.consentId);
    assert.strictEqual(revokeResult.status, 'REVOKED');
    assert.strictEqual(revokeResult.consentId, consent.consentId);
  });

  // --- Suite 8: Incremental Sync (Dedup on Second Run) ---
  console.log('\nTest Group 8: Incremental Sync & Deduplication');

  runTest('Incremental sync: third run with same data imports zero new records', () => {
    const rawFeed = [
      { txnId: 'TXN-INC-001', date: '2026-09-08', amount: 500, type: 'DEBIT', mode: 'UPI', narration: 'UPI/999/ZEPTO/zepto@hdfcbank/Snacks', reference: 'REF-INC-1' },
      { txnId: 'TXN-INC-002', date: '2026-09-07', amount: 1200, type: 'CREDIT', mode: 'NEFT', narration: 'NEFT/SALARY/CORP/Monthly salary', reference: 'REF-INC-2' }
    ];
    const existing = new Set();
    const ctx = { provider: 'MockAA', accountId: 'ACC-INC-TEST', bankName: 'SBI' };

    const run1 = normalizeBankTransactions(rawFeed, ctx, existing);
    assert.strictEqual(run1.normalized.length, 2);

    const run2 = normalizeBankTransactions(rawFeed, ctx, existing);
    assert.strictEqual(run2.normalized.length, 0);
    assert.strictEqual(run2.duplicatesSkipped, 2);

    const run3 = normalizeBankTransactions(rawFeed, ctx, existing);
    assert.strictEqual(run3.normalized.length, 0);
    assert.strictEqual(run3.duplicatesSkipped, 2);
  });

  // --- Suite 9: Income vs Expense Categorization ---
  console.log('\nTest Group 9: Income vs Expense Classification');

  runTest('Credit transaction categorized as Salary when narration matches', () => {
    const cat = categorizeTransaction({ merchant: 'Employer Corp', narration: 'SALARY CREDIT AUGUST', flow: 'INFLOW', amount: 85000 });
    assert.strictEqual(cat, 'Salary');
  });

  runTest('Credit transaction without salary keyword → Customer Receipts', () => {
    const cat = categorizeTransaction({ merchant: 'Random Person', narration: 'Transfer received', flow: 'INFLOW', amount: 5000 });
    assert.strictEqual(cat, 'Customer Receipts');
  });

  runTest('Debit transaction to Swiggy → Food & Dining', () => {
    const cat = categorizeTransaction({ merchant: 'Swiggy', narration: 'Swiggy order #1234', flow: 'OUTFLOW', amount: 350 });
    assert.strictEqual(cat, 'Food & Dining');
  });

  runTest('ATM cash withdrawal → Cash Withdrawal category', () => {
    const cat = categorizeTransaction({ merchant: 'ATM', narration: 'ATM CASH-WDL HDFC ATM DELHI', flow: 'OUTFLOW', amount: 5000 });
    assert.strictEqual(cat, 'Cash Withdrawal');
  });

  // --- Suite 10: Mock Data Demo Labeling ---
  console.log('\nTest Group 10: Mock Data Demo Labeling');

  await runAsyncTest('Mock transactions are tagged with isDemo and BANK_AA_MOCK source', async () => {
    const mock = new MockAAProvider();
    const consent = await mock.createConsent({ bankId: 'HDFC' });
    assert.strictEqual(consent.isDemo, true);

    const session = await mock.createDataSession(consent.consentId, { from: '2026-06-01', to: '2026-09-30' });
    const fiData = await mock.fetchFinancialInformation(consent.consentId, session.sessionId, { from: '2026-06-01', to: '2026-09-30' });
    assert.strictEqual(fiData.metadata.isDemo, true);
    assert.strictEqual(fiData.metadata.source, 'BANK_AA_MOCK');
  });

  console.log('\n======================================================');
  console.log(`📊 Test Summary: ${passedTests} / ${totalTests} Passed`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
