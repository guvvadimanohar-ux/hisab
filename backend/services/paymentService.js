/**
 * Hisab Payment Gateway Orchestration Service
 * Connects gateway providers (Razorpay, Cashfree, Mock) to the database,
 * validates payment signatures, and automatically reconciles verified payments
 * into the Common Transaction Engine and Credit Ledgers.
 */

const crypto = require('node:crypto');
const MockPaymentProvider = require('../providers/payments/MockPaymentProvider.js');
const RazorpayProvider = require('../providers/payments/RazorpayProvider.js');
const CashfreeProvider = require('../providers/payments/CashfreeProvider.js');
const { getOrCreateShopForUser } = require('./database.js');
const { recordTransaction } = require('./transactionEngine.js');
const { recordRepayment } = require('./creditService.js');

class PaymentService {
  constructor(config = {}) {
    const gatewayName = (config.gateway || process.env.PAYMENT_GATEWAY || 'mock').toLowerCase();

    if (gatewayName === 'razorpay') {
      this.provider = new RazorpayProvider(config);
    } else if (gatewayName === 'cashfree') {
      this.provider = new CashfreeProvider(config);
    } else {
      this.provider = new MockPaymentProvider(config);
    }

    this.gatewayName = this.provider.name;
  }

  getProviderName() {
    return this.provider.name;
  }

  isMockMode() {
    return this.provider.isMockMode();
  }

  async createOrder(db, userId, { amount, currency = 'INR', customerId, customerName, purpose = 'Store Payment', creditId = null }) {
    const numAmount = Math.abs(parseFloat(amount || 0));
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Valid payment amount greater than 0 is required');
    }

    const shop = getOrCreateShopForUser(db, userId);
    const shopId = shop ? shop.id : `SHOP-${userId}`;

    // Get customer info if provided
    let cust = null;
    if (customerId) {
      cust = db.prepare('SELECT id, name, phone FROM customers WHERE id = ? AND user_id = ?').get(customerId, userId);
    }

    // Call Provider to create gateway order
    const gatewayResult = await this.provider.createOrder({
      amount: numAmount,
      currency,
      receipt: `RCPT-${Date.now().toString().slice(-6)}`,
      customerId: cust?.id || customerId,
      customerPhone: cust?.phone,
      notes: {
        userId,
        shopId,
        creditId: creditId || '',
        customerName: cust?.name || customerName || 'Store Customer',
        purpose
      }
    });

    const internalOrderId = `ORD-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO payment_orders (
        id, shop_id, user_id, customer_id, gateway,
        gateway_order_id, amount, currency, status, purpose,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      internalOrderId,
      shopId,
      userId,
      cust?.id || customerId || null,
      this.gatewayName,
      gatewayResult.orderId,
      numAmount,
      currency.toUpperCase(),
      'CREATED',
      purpose,
      now,
      now
    );

    return {
      orderId: internalOrderId,
      gatewayOrderId: gatewayResult.orderId,
      gateway: this.gatewayName,
      amount: numAmount,
      currency: currency.toUpperCase(),
      status: 'CREATED',
      keyId: gatewayResult.keyId || null,
      paymentSessionId: gatewayResult.paymentSessionId || null,
      checkoutUrl: gatewayResult.checkoutUrl || null,
      isDemo: this.provider.isMockMode()
    };
  }

  async verifyPayment(db, userId, { orderId, gatewayOrderId, paymentId, signature, gatewayPaymentId, gatewaySignature, razorpay_payment_id, razorpay_signature, creditId = null }) {
    // Locate the internal order
    let order = null;
    if (orderId) {
      order = db.prepare('SELECT * FROM payment_orders WHERE id = ? AND user_id = ?').get(orderId, userId);
    }
    if (!order && gatewayOrderId) {
      order = db.prepare('SELECT * FROM payment_orders WHERE gateway_order_id = ? AND user_id = ?').get(gatewayOrderId, userId);
    }

    if (!order) {
      throw new Error('Payment order not found');
    }

    if (order.status === 'PAID') {
      return { success: true, alreadyPaid: true, orderId: order.id, status: 'PAID' };
    }

    const effectivePaymentId = paymentId || gatewayPaymentId || razorpay_payment_id || `pay_mock_${Date.now()}`;
    const effectiveSignature = signature || gatewaySignature || razorpay_signature;

    // Verify signature with provider
    const isValid = await this.provider.verifyPayment({
      orderId: order.gateway_order_id || gatewayOrderId || order.id,
      paymentId: effectivePaymentId,
      signature: effectiveSignature
    });

    if (!isValid) {
      throw new Error('Payment signature verification failed. Untrusted payment confirmation.');
    }

    const now = new Date().toISOString();

    // Mark order as PAID
    db.prepare(`
      UPDATE payment_orders
      SET status = 'PAID', gateway_payment_id = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(effectivePaymentId || 'VERIFIED', now, order.id, userId);

    // Resolve Customer
    const customer = order.customer_id
      ? db.prepare('SELECT id, name FROM customers WHERE id = ? AND user_id = ?').get(order.customer_id, userId)
      : null;

    // Ingest into Common Transaction Engine
    const txnResult = recordTransaction(db, userId, {
      customerId: customer?.id || order.customer_id,
      customerName: customer?.name || 'Gateway Customer',
      amount: order.amount,
      cashFlowType: 'INFLOW',
      transactionType: 'Customer Payment',
      source: 'PAYMENT_GATEWAY',
      mode: 'UPI', // Gateway default
      paymentMethod: `${this.gatewayName.toUpperCase()} Payment Gateway`,
      category: 'Customer Receipts',
      description: `Payment Gateway (${this.gatewayName.toUpperCase()}): ${order.purpose || 'Store Checkout'} [Ref: ${paymentId || order.id}]`,
      referenceNumber: paymentId || order.gateway_order_id,
      externalTransactionId: paymentId || order.gateway_order_id
    });

    // If linked to a credit / udhar, reconcile repayment
    let repaymentResult = null;
    const effectiveCreditId = creditId || order.credit_id;
    if (effectiveCreditId) {
      try {
        repaymentResult = recordRepayment(db, userId, {
          creditId: effectiveCreditId,
          amount: order.amount,
          mode: 'GATEWAY',
          reference: effectivePaymentId,
          notes: `Reconciled via ${this.gatewayName} Order ${order.id}`
        });
      } catch (e) {
        console.warn('[Payment Service] Credit reconciliation warning:', e.message);
      }
    }

    return {
      success: true,
      verified: true,
      orderId: order.id,
      orderStatus: 'PAID',
      status: 'PAID',
      gatewayOrderId: order.gateway_order_id,
      transactionId: txnResult.id,
      amount: order.amount,
      creditReconciled: Boolean(repaymentResult),
      repaymentResult
    };
  }

  async handleWebhook(db, headersOrOptions, rawBodyOrNull) {
    let headers = headersOrOptions || {};
    let rawBody = rawBodyOrNull;

    if (headersOrOptions && typeof headersOrOptions === 'object' && headersOrOptions.payload !== undefined) {
      rawBody = typeof headersOrOptions.payload === 'string' ? headersOrOptions.payload : JSON.stringify(headersOrOptions.payload);
      headers = { ...headersOrOptions.headers };
      if (headersOrOptions.signature) {
        headers['x-razorpay-signature'] = headersOrOptions.signature;
        headers['x-webhook-signature'] = headersOrOptions.signature;
      }
    }

    const isValid = this.provider.verifyWebhookSignature(headers, rawBody);
    if (!isValid) {
      throw new Error('Invalid payment webhook signature');
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { success: false, code: 400, error: 'INVALID_PAYLOAD' };
    }

    const eventId = String(payload.id || payload.event_id || crypto.createHash('sha256').update(rawBody).digest('hex'));

    // Idempotency
    const seen = db.prepare('SELECT processed_at FROM webhook_events WHERE id = ?').get(eventId);
    if (seen && seen.processed_at) {
      return { success: true, processed: false, duplicate: true };
    }
    if (!seen) {
      db.prepare('INSERT INTO webhook_events (id, provider, event_type, received_at, payload) VALUES (?, ?, ?, ?, ?)')
        .run(eventId, this.gatewayName, payload.event || payload.type || 'PAYMENT', new Date().toISOString(), rawBody.slice(0, 4000));
    }

    // Reconcile payment based on gateway event format
    // E.g. Razorpay: payment.captured or order.paid
    const gatewayOrderId = payload.payload?.payment?.entity?.order_id || payload.data?.order?.order_id || payload.orderId;
    const paymentId = payload.payload?.payment?.entity?.id || payload.data?.payment?.cf_payment_id || payload.paymentId;

    if (gatewayOrderId) {
      const order = db.prepare('SELECT * FROM payment_orders WHERE gateway_order_id = ?').get(gatewayOrderId);
      if (order && order.status !== 'PAID') {
        const now = new Date().toISOString();
        db.prepare('UPDATE payment_orders SET status = ?, gateway_payment_id = ?, updated_at = ? WHERE id = ?')
          .run('PAID', paymentId || 'WEBHOOK', now, order.id);

        recordTransaction(db, order.user_id, {
          customerId: order.customer_id,
          amount: order.amount,
          cashFlowType: 'INFLOW',
          transactionType: 'Customer Payment',
          source: 'PAYMENT_GATEWAY',
          mode: 'UPI',
          paymentMethod: `${this.gatewayName.toUpperCase()} Gateway Webhook`,
          description: `Payment captured: ${order.purpose || 'Store Checkout'}`,
          referenceNumber: paymentId || gatewayOrderId,
          externalTransactionId: paymentId || gatewayOrderId
        });
      }
    }

    db.prepare('UPDATE webhook_events SET processed_at = ? WHERE id = ?').run(new Date().toISOString(), eventId);
    return { success: true, processed: true };
  }
}

module.exports = PaymentService;
