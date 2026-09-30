/**
 * Automated Unit Tests for Hisab Financial Analytics Engine
 * Tests Section 24 Requirements:
 * - Inflow: 1000 + 2000 + 500 = 3500
 * - Outflow: 500 + 1000 = 1500
 * - Net: 3500 - 1500 = 2000
 * - Repeated customer: Customer A (3 txns) vs Customer B (1 txn)
 * - Loan: Loan 50,000, Repayment 20,000 -> Outstanding 30,000
 * - Missing values, duplicates, currency formatting, date normalization
 */

const assert = require('node:assert');
const {
  cleanNumber,
  cleanDate,
  detectColumnMappings,
  normalizeTransactions,
  calculateDashboardKPIs,
  calculateCashFlowTrends,
  calculateCustomerAnalytics,
  calculateLoanAnalytics,
  generateFinancialInsights
} = require('../backend/services/analytics.js');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n--- Running Hisab Financial Calculation Tests ---\n');

// 1. Basic Inflow, Outflow, and Net Tests
it('Calculates Inflow correctly (1000 + 2000 + 500 = 3500)', () => {
  const txns = [
    { amount: 1000, cash_flow_type: 'INFLOW', customer_name: 'A' },
    { amount: 2000, cash_flow_type: 'INFLOW', customer_name: 'B' },
    { amount: 500, cash_flow_type: 'INFLOW', customer_name: 'C' }
  ];
  const kpi = calculateDashboardKPIs(txns);
  assert.strictEqual(kpi.totalInflow, 3500);
});

it('Calculates Outflow correctly (500 + 1000 = 1500)', () => {
  const txns = [
    { amount: 500, cash_flow_type: 'OUTFLOW', customer_name: 'A' },
    { amount: 1000, cash_flow_type: 'OUTFLOW', customer_name: 'B' }
  ];
  const kpi = calculateDashboardKPIs(txns);
  assert.strictEqual(kpi.totalOutflow, 1500);
});

it('Calculates Net correctly (3500 - 1500 = 2000)', () => {
  const txns = [
    { amount: 1000, cash_flow_type: 'INFLOW', customer_name: 'A' },
    { amount: 2000, cash_flow_type: 'INFLOW', customer_name: 'B' },
    { amount: 500, cash_flow_type: 'INFLOW', customer_name: 'C' },
    { amount: 500, cash_flow_type: 'OUTFLOW', customer_name: 'D' },
    { amount: 1000, cash_flow_type: 'OUTFLOW', customer_name: 'E' }
  ];
  const kpi = calculateDashboardKPIs(txns);
  assert.strictEqual(kpi.totalInflow, 3500);
  assert.strictEqual(kpi.totalOutflow, 1500);
  assert.strictEqual(kpi.netCashFlow, 2000);
});

// 2. Repeated Customer Detection
it('Correctly identifies repeated customer (Customer A = 3, Customer B = 1)', () => {
  const txns = [
    { amount: 100, cash_flow_type: 'INFLOW', customer_name: 'Customer A', customer_id: 'C1', date: '2026-09-01', payment_method: 'UPI' },
    { amount: 200, cash_flow_type: 'INFLOW', customer_name: 'Customer A', customer_id: 'C1', date: '2026-09-02', payment_method: 'UPI' },
    { amount: 300, cash_flow_type: 'INFLOW', customer_name: 'Customer A', customer_id: 'C1', date: '2026-09-03', payment_method: 'Card' },
    { amount: 500, cash_flow_type: 'INFLOW', customer_name: 'Customer B', customer_id: 'C2', date: '2026-09-01', payment_method: 'UPI' }
  ];
  const custAnalytics = calculateCustomerAnalytics(txns);
  assert.strictEqual(custAnalytics.repeatedCustomers.length, 1);
  assert.strictEqual(custAnalytics.repeatedCustomers[0].name, 'Customer A');
  assert.strictEqual(custAnalytics.repeatedCustomers[0].totalTransactions, 3);
  assert.strictEqual(custAnalytics.repeatedCustomers[0].totalInflow, 600);
});

// 3. Loan Outstanding Calculation
it('Calculates Loan Outstanding: Loan = 50,000, Repayment = 20,000 -> Outstanding = 30,000', () => {
  const txns = [
    {
      loan_id: 'LN-1001',
      customer_name: 'Rahul',
      date: '2026-01-01',
      amount: 50000,
      transaction_type: 'LOAN_GIVEN',
      cash_flow_type: 'OUTFLOW',
      reference_number: 'DISB-01'
    },
    {
      loan_id: 'LN-1001',
      customer_name: 'Rahul',
      date: '2026-02-15',
      amount: 10000,
      transaction_type: 'LOAN_REPAYMENT',
      cash_flow_type: 'INFLOW',
      reference_number: 'REPAY-01'
    },
    {
      loan_id: 'LN-1001',
      customer_name: 'Rahul',
      date: '2026-03-15',
      amount: 10000,
      transaction_type: 'LOAN_REPAYMENT',
      cash_flow_type: 'INFLOW',
      reference_number: 'REPAY-02'
    }
  ];
  const loanAnalytics = calculateLoanAnalytics(txns);
  assert.strictEqual(loanAnalytics.loans.length, 1);
  assert.strictEqual(loanAnalytics.loans[0].originalAmount, 50000);
  assert.strictEqual(loanAnalytics.loans[0].totalRepaid, 20000);
  assert.strictEqual(loanAnalytics.loans[0].outstandingAmount, 30000);
  assert.strictEqual(loanAnalytics.loans[0].status, 'PARTIALLY_PAID');
});

// 4. Data Cleaning & Normalization Tests
it('Cleans numbers with commas, currency symbols, and whitespace', () => {
  assert.strictEqual(cleanNumber('₹1,86,750.00'), 186750);
  assert.strictEqual(cleanNumber(' 45,200.50 '), 45200.5);
  assert.strictEqual(cleanNumber(''), null);
  assert.strictEqual(cleanNumber('N/A'), null);
});

it('Normalizes diverse date formats (DD/MM/YYYY, ISO, DD-MM-YYYY)', () => {
  assert.strictEqual(cleanDate('15/08/2026'), '2026-08-15');
  assert.strictEqual(cleanDate('2026-09-08T18:40:00Z'), '2026-09-08');
  assert.strictEqual(cleanDate('05-04-2026'), '2026-04-05');
});

it('Detects column mappings dynamically from messy headers', () => {
  const headers = ['Txn Date', 'Party Name', 'Withdrawal (Dr)', 'Deposit (Cr)', 'Payment Mode', 'Narration'];
  const mapping = detectColumnMappings(headers);
  assert.strictEqual(mapping.date, 'Txn Date');
  assert.strictEqual(mapping.customer_name, 'Party Name');
  assert.strictEqual(mapping.debit, 'Withdrawal (Dr)');
  assert.strictEqual(mapping.credit, 'Deposit (Cr)');
  assert.strictEqual(mapping.payment_method, 'Payment Mode');
  assert.strictEqual(mapping.description, 'Narration');
});

it('Handles duplicate rows and missing values gracefully', () => {
  const rawRows = [
    { Date: '2026-09-01', Customer: 'Ramesh', Amount: '1500', Type: 'Credit', Ref: 'REF-1' },
    { Date: '2026-09-01', Customer: 'Ramesh', Amount: '1500', Type: 'Credit', Ref: 'REF-1' }, // Exact duplicate
    { Date: '2026-09-02', Customer: '', Amount: '2000', Type: 'Credit', Ref: 'REF-2' }, // Missing customer
    { Date: '2026-09-03', Customer: 'Suresh', Amount: 'invalid', Type: 'Credit', Ref: 'REF-3' } // Invalid amount
  ];
  const mapping = {
    date: 'Date',
    customer_name: 'Customer',
    amount: 'Amount',
    transaction_type: 'Type',
    reference_number: 'Ref'
  };
  const { normalized, qualityReport } = normalizeTransactions(rawRows, mapping);
  assert.strictEqual(qualityReport.total_rows, 4);
  assert.strictEqual(qualityReport.valid_rows, 3);
  assert.strictEqual(qualityReport.invalid_rows, 1);
  assert.strictEqual(qualityReport.duplicate_rows, 1);
  assert.strictEqual(qualityReport.missing_customer_count, 1);
  assert.strictEqual(normalized.length, 3);
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
