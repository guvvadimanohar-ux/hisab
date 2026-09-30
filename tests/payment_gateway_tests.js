/**
 * Hisab Payment Gateway Orchestration Test Suite
 * Validates:
 * - Provider abstraction (Mock, Razorpay, Cashfree)
 * - Order creation with receipt, notes, and currency
 * - Payment signature verification
 * - Automatic reconciliation into transactions ledger
 * - Credit settlement upon verified payment
 * - Webhook processing with HMAC-SHA256 signature verification & idempotency
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const { initializeDatabase } = require('../backend/services/database.js');
const PaymentService = require('../backend/services/paymentService.js');
const MockPaymentProvider = require('../backend/providers/payments/MockPaymentProvider.js');
const RazorpayProvider = require('../backend/providers/payments/RazorpayProvider.js');
const CashfreeProvider = require('../backend/providers/payments/CashfreeProvider.js');
const { createCustomer } = require('../backend/services/customerService.js');
const { issueCredit } = require('../backend/services/creditService.js');
const auth = require('../backend/services/authService.js');

console.log('======================================================');
console.log('💳 Running Hisab Payment Gateway & Reconciliation Test Suite');
console.log('======================================================\n');

const db = initializeDatabase();

const testUserRes = auth.createUserWithSession(db, {
  fullName: 'Payment Test Merchant',
  email: `payment_${Date.now()}@hisab.test`,
  phone: '97' + Math.floor(10000000 + Math.random() * 90000000),
  password: 'Password123!',
  shopName: 'Digital Kirana'
});
const userId = testUserRes.userId;

async function runTests() {
  try {
    console.log('Test Group 1: Provider Abstraction & Adapters');
  const mockP = new MockPaymentProvider();
  assert.strictEqual(mockP.name, 'mock');
  assert.strictEqual(mockP.isMockMode(), true);
  console.log('  ✓ MockPaymentProvider initialized in mock mode');

  const rzpP = new RazorpayProvider({ keyId: 'rzp_test_123', keySecret: 'rzp_sec_456' });
  assert.strictEqual(rzpP.name, 'razorpay');
  assert.strictEqual(rzpP.isMockMode(), false);
  console.log('  ✓ RazorpayProvider initialized with credentials');

  const cfP = new CashfreeProvider({ appId: 'cf_app_123', secretKey: 'cf_sec_456' });
  assert.strictEqual(cfP.name, 'cashfree');
  assert.strictEqual(cfP.isMockMode(), false);
  console.log('  ✓ CashfreeProvider initialized with credentials');

  console.log('\nTest Group 2: Payment Service Order Creation');
  const paymentService = new PaymentService({ gateway: 'mock' });
  const testCustomer = createCustomer(db, userId, {
    name: 'Rohit Verma',
    phone: '9822011223'
  });

  const orderResult = await paymentService.createOrder(db, userId, {
    amount: 1250,
    currency: 'INR',
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    purpose: 'Weekly Groceries'
  });

  assert(orderResult.orderId, 'Order must have orderId');
  assert.strictEqual(orderResult.amount, 1250);
  assert.strictEqual(orderResult.currency, 'INR');
  assert.strictEqual(orderResult.status.toUpperCase(), 'CREATED');
  console.log('  ✓ Payment Order created: ₹1,250 created state recorded in payment_orders table');

  // Verify order in database
  const orderRow = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderResult.orderId);
  assert(orderRow, 'Order record must persist in database');
  assert.strictEqual(orderRow.user_id, userId);
  assert.strictEqual(orderRow.customer_id, testCustomer.id);
  console.log('  ✓ Order persisted with user/customer relational binding');

  console.log('\nTest Group 3: Payment Verification & Auto-Reconciliation');
  // Issue a credit to test customer to verify credit reconciliation
  const creditToSettle = issueCredit(db, userId, {
    customerId: testCustomer.id,
    amount: 1250,
    description: 'Groceries Udhar'
  });
  assert.strictEqual(creditToSettle.outstandingAmount, 1250);

  // Link payment order to this credit
  db.prepare('UPDATE payment_orders SET credit_id = ? WHERE id = ?').run(creditToSettle.id, orderResult.orderId);

  // Verify payment
  const verifyResult = await paymentService.verifyPayment(db, userId, {
    orderId: orderResult.orderId,
    gatewayPaymentId: 'mock_pay_' + Date.now(),
    gatewaySignature: 'mock_sig_valid'
  });

  assert.strictEqual(verifyResult.verified, true);
  assert.strictEqual(verifyResult.orderStatus.toUpperCase(), 'PAID');
  assert(verifyResult.transactionId, 'Must generate transaction in transaction engine');
  assert(verifyResult.creditReconciled, 'Must reconcile credit ledger');
  console.log('  ✓ Payment verified successfully');
  console.log('  ✓ Transaction recorded in Common Transaction Engine (Inflow Jama)');

  // Verify credit is now marked Paid
  const settledCredit = db.prepare('SELECT * FROM credits WHERE id = ?').get(creditToSettle.id);
  assert.strictEqual(settledCredit.status, 'Paid');
  assert.strictEqual(settledCredit.outstanding_amount, 0);
  console.log('  ✓ Linked credit ledger auto-reconciled to Outstanding ₹0 (Paid)');

  console.log('\nTest Group 4: Webhook HMAC Verification & Idempotency');
  const webhookSecret = 'test_webhook_secret_key_123';
  process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET = webhookSecret;

  const newOrder = await paymentService.createOrder(db, userId, {
    amount: 750,
    customerId: testCustomer.id,
    purpose: 'Instant UPI Settlement'
  });

  const webhookPayload = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_wh_' + Date.now(),
          order_id: newOrder.orderId,
          amount: 75000,
          currency: 'INR',
          status: 'captured',
          method: 'upi',
          vpa: 'rohit@okhdfcbank'
        }
      }
    }
  });

  const validHmac = crypto.createHmac('sha256', webhookSecret).update(webhookPayload).digest('hex');

  // 1. Valid webhook processing
  const whResult = await paymentService.handleWebhook(db, {
    payload: webhookPayload,
    signature: validHmac,
    headers: {}
  });
  assert.strictEqual(whResult.processed, true);
  console.log('  ✓ Webhook accepted with valid HMAC-SHA256 signature');

  // 2. Tampered signature rejection
  const tamperedHmac = (validHmac[0] === '0' ? '1' : '0') + validHmac.slice(1);
  await assert.rejects(async () => {
    await paymentService.handleWebhook(db, {
      payload: webhookPayload,
      signature: tamperedHmac,
      headers: {}
    });
  }, /Invalid payment webhook signature/, 'Must reject tampered HMAC signature');
  console.log('  ✓ Tampered webhook signature rejected');

  // 3. Idempotent replay: sending same webhook again should not duplicate
  const replayResult = await paymentService.handleWebhook(db, {
    payload: webhookPayload,
    signature: validHmac,
    headers: {}
  });
  assert.strictEqual(replayResult.duplicate, true);
  console.log('  ✓ Idempotency verified: Duplicate webhook silently acknowledged without double-crediting');

  console.log('\n======================================================');
  console.log('📊 Payment Gateway Test Summary: ALL 10 TESTS PASSED');
  console.log('======================================================\n');
  process.exit(0);

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTests();

