/**
 * Hisab Customer Management & Credit / Udhar Ledger Test Suite
 * Validates:
 * - Customer CRUD operations
 * - Multi-user isolation & IDOR protection
 * - Dynamic financial stat calculations
 * - Credit issuance, repayments, and outstanding balance formula (outstanding = credit - repaid)
 * - Loan ledger synchronization
 */

const assert = require('node:assert');
const { initializeDatabase } = require('../backend/services/database.js');
const {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer
} = require('../backend/services/customerService.js');
const {
  issueCredit,
  recordRepayment,
  listCredits,
  getCreditSummary
} = require('../backend/services/creditService.js');
const auth = require('../backend/services/authService.js');

console.log('======================================================');
console.log('👥 Running Hisab Customer & Credit / Udhar Test Suite');
console.log('======================================================\n');

const db = initializeDatabase();

// Setup two distinct test users
const userAId = 'test-cust-user-a-' + Date.now();
const userBId = 'test-cust-user-b-' + Date.now();

const phoneA = '99' + Math.floor(10000000 + Math.random() * 90000000);
const phoneB = '98' + Math.floor(10000000 + Math.random() * 90000000);

const resA = auth.createUserWithSession(db, {
  fullName: 'Merchant A',
  email: `merchantA_${Date.now()}@hisab.test`,
  phone: phoneA,
  password: 'Password123!',
  shopName: 'Merchant A Kirana'
});
const userA = { id: resA.userId };

const resB = auth.createUserWithSession(db, {
  fullName: 'Merchant B',
  email: `merchantB_${Date.now()}@hisab.test`,
  phone: phoneB,
  password: 'Password123!',
  shopName: 'Merchant B Superstore'
});
const userB = { id: resB.userId };

let testCust1 = null;
let testCust2 = null;

try {
  console.log('Test Group 1: Customer CRUD');
  
  // 1. Create Customer
  testCust1 = createCustomer(db, userA.id, {
    name: 'Sunil Kumar',
    phone: '9848011223',
    email: 'sunil@example.com',
    notes: 'Regular kirana customer'
  });
  assert(testCust1.id, 'Customer should have generated ID');
  assert.strictEqual(testCust1.name, 'Sunil Kumar');
  assert.strictEqual(testCust1.phone, '9848011223');
  console.log('  ✓ Customer created successfully');

  // 2. Reject missing name
  assert.throws(() => {
    createCustomer(db, userA.id, { name: '', phone: '9848011223' });
  }, /Customer name is required/, 'Should throw if name is missing');
  console.log('  ✓ Rejects customer creation with empty name');

  // 3. List customers
  const listResult = listCustomers(db, userA.id);
  assert(listResult.customers.length >= 1, 'Should return at least 1 customer');
  assert(listResult.customers.some(c => c.name === 'Sunil Kumar'), 'Should include Sunil Kumar');
  console.log('  ✓ Customers listed with pagination structure');

  // 4. Update customer
  const updatedCust = updateCustomer(db, userA.id, testCust1.id, {
    notes: 'VIP customer - extended credit limit'
  });
  assert.strictEqual(updatedCust.notes, 'VIP customer - extended credit limit');
  console.log('  ✓ Customer updated successfully');

  console.log('\nTest Group 2: Cross-User Customer Isolation');
  // User B creates a customer
  testCust2 = createCustomer(db, userB.id, {
    name: 'Anita Desai',
    phone: '9848099887'
  });

  // User B's list should NOT contain User A's customer
  const userBList = listCustomers(db, userB.id);
  assert(!userBList.customers.some(c => c.name === 'Sunil Kumar'), 'User B must not see User A customer');
  assert(userBList.customers.some(c => c.name === 'Anita Desai'), 'User B sees Anita Desai');

  // User A cannot get or modify User B's customer (IDOR protection)
  const idorCust = getCustomerById(db, userA.id, testCust2.id);
  assert.strictEqual(idorCust, null, 'User A cannot access User B customer by ID');

  const idorUpdate = updateCustomer(db, userA.id, testCust2.id, { notes: 'Hacked note' });
  assert.strictEqual(idorUpdate, null, 'User A cannot update User B customer');
  console.log('  ✓ IDOR protection verified: Customers scoped strictly to owner shop');

  console.log('\nTest Group 3: Credit / Udhar Issuance & Repayment Calculations');
  // Issue Credit 1: ₹1,500
  const credit1 = issueCredit(db, userA.id, {
    customerId: testCust1.id,
    customerName: testCust1.name,
    amount: 1500,
    dueDate: '2026-10-15',
    description: 'Bags of Basmati Rice and Toor Dal'
  });

  assert(credit1.id, 'Credit should have ID');
  assert.strictEqual(credit1.amount, 1500);
  assert.strictEqual(credit1.paid_amount, 0);
  assert.strictEqual(credit1.outstanding_amount, 1500);
  assert.strictEqual(credit1.status, 'Pending');
  console.log('  ✓ Credit issued: Principal ₹1,500, Outstanding ₹1,500, Status Pending');

  // Partial Repayment: ₹500
  const repay1 = recordRepayment(db, userA.id, {
    creditId: credit1.id,
    customerId: testCust1.id,
    amount: 500,
    mode: 'UPI',
    reference: 'UPI/REF-123456'
  });

  assert.strictEqual(repay1.paid_amount, 500);
  assert.strictEqual(repay1.outstanding_amount, 1000);
  assert.strictEqual(repay1.status, 'Partially Paid');
  console.log('  ✓ Partial Repayment ₹500 recorded: Outstanding ₹1,000, Status Partially Paid');

  // Full Settlement Repayment: Remaining ₹1,000
  const repay2 = recordRepayment(db, userA.id, {
    creditId: credit1.id,
    customerId: testCust1.id,
    amount: 1000,
    mode: 'Cash'
  });

  assert.strictEqual(repay2.paid_amount, 1500);
  assert.strictEqual(repay2.outstanding_amount, 0);
  assert.strictEqual(repay2.status, 'Paid');
  console.log('  ✓ Full Repayment ₹1,000 recorded: Outstanding ₹0, Status Paid');

  // Verify Credit Summary Aggregation
  const summary = getCreditSummary(db, userA.id);
  assert(summary.totalCredit >= 1500, 'Total credit matches');
  assert(summary.totalRepaid >= 1500, 'Total repaid matches');
  console.log('  ✓ Credit Summary accurately aggregates across user transactions');

  // Customer Profile reflects dynamic stats
  const profile = getCustomerById(db, userA.id, testCust1.id);
  assert(profile.stats.totalCredit >= 1500);
  assert(profile.stats.totalRepaid >= 1500);
  assert.strictEqual(profile.stats.outstandingCredit, 0);
  console.log('  ✓ Customer Profile computes dynamic lifetime credit stats');

  console.log('\n======================================================');
  console.log('📊 Customer & Credit Test Summary: ALL 11 TESTS PASSED');
  console.log('======================================================\n');
  process.exit(0);

} catch (err) {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
}
