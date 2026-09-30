/**
 * MockPaymentProvider - Development & Testing Simulation Layer
 * Simulates payment gateway flows with realistic UPI, Card, NetBanking, Wallet options.
 * All records are strictly tagged as 'DEMO DATA' / 'MOCK_PAYMENT'.
 */

const PaymentGatewayProvider = require('./PaymentGatewayProvider.js');
const crypto = require('node:crypto');

class MockPaymentProvider extends PaymentGatewayProvider {
  constructor(config = {}) {
    super({ ...config, providerName: 'MockPayment' });
    this.orders = new Map();
    this.payments = new Map();
    this.refunds = new Map();
    this.webhookSecret = config.webhookSecret || 'mock_webhook_secret_dev_only';
  }

  /**
   * Supported payment methods in mock simulation
   */
  async getSupportedMethods() {
    return [
      { id: 'upi', name: 'UPI (Google Pay, PhonePe, Paytm, BHIM)', type: 'upi', enabled: true },
      { id: 'upi_qr', name: 'UPI QR Code', type: 'upi', enabled: true },
      { id: 'upi_intent', name: 'UPI Intent (App-to-App)', type: 'upi', enabled: true },
      { id: 'card', name: 'Credit/Debit Card (Visa, Mastercard, RuPay)', type: 'card', enabled: true },
      { id: 'netbanking', name: 'Net Banking (50+ Banks)', type: 'netbanking', enabled: true },
      { id: 'wallet', name: 'Wallets (Paytm, Amazon Pay, PhonePe)', type: 'wallet', enabled: true },
      { id: 'emi', name: 'Cardless EMI', type: 'emi', enabled: true },
      { id: 'paylater', name: 'Pay Later (Simpl, LazyPay)', type: 'paylater', enabled: true }
    ];
  }

  /**
   * Create a mock payment order
   */
  async createOrder(params = {}) {
    const amount = parseInt(params.amount, 10);
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount: must be positive integer in paise');
    }

    const orderId = `order_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const receipt = params.receipt || `RCPT-${Date.now()}`;
    const currency = params.currency || 'INR';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    const order = {
      orderId,
      receipt,
      amount,
      currency,
      status: 'CREATED',
      customer: params.customer || {},
      notes: params.notes || {},
      method: params.method || 'upi',
      createdAt: new Date().toISOString(),
      expiresAt,
      isDemo: true,
      checkoutUrl: `${params.callbackUrl || 'http://localhost:8099/payment/success'}?mock_order_id=${orderId}&demo=true`
    };

    this.orders.set(orderId, order);
    return order;
  }

  /**
   * Verify mock payment - simulates successful payment for demo
   */
  async verifyPayment(params = {}) {
    const { orderId, paymentId, signature } = params;

    const order = this.orders.get(orderId);
    if (!order) {
      return { verified: false, error: 'Order not found' };
    }

    // In mock mode, any signature starting with "mock_" is valid
    const isValidSignature = !signature || String(signature).startsWith('mock_');

    if (!isValidSignature) {
      return { verified: false, error: 'Invalid signature' };
    }

    const paymentIdFinal = paymentId || `pay_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const payment = {
      paymentId: paymentIdFinal,
      orderId,
      amount: order.amount,
      currency: order.currency,
      status: 'CAPTURED',
      method: order.method,
      methodDetail: this.getMethodDetail(order.method),
      paidAt: new Date().toISOString(),
      isDemo: true,
      bankRef: `MOCK${Date.now().toString().slice(-10)}`
    };

    this.payments.set(paymentIdFinal, payment);
    order.status = 'CAPTURED';
    order.paymentId = paymentIdFinal;
    order.paidAt = payment.paidAt;

    return {
      verified: true,
      paymentId: paymentIdFinal,
      orderId,
      status: 'CAPTURED',
      method: order.method,
      amount: order.amount,
      currency: order.currency
    };
  }

  getMethodDetail(method) {
    const details = {
      upi: 'UPI / QR Code',
      upi_qr: 'UPI QR Code',
      upi_intent: 'UPI Intent',
      card: 'Visa Debit ending in 4242',
      netbanking: 'HDFC NetBanking',
      wallet: 'Paytm Wallet',
      emi: 'HDFC Cardless EMI',
      paylater: 'Simpl Pay Later'
    };
    return details[method] || method;
  }

  /**
   * Get mock order status
   */
  async getOrderStatus(orderId) {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const payment = order.paymentId ? this.payments.get(order.paymentId) : null;

    return {
      orderId: order.orderId,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      paidAmount: payment ? payment.amount : 0,
      method: order.method,
      methodDetail: payment ? payment.methodDetail : null,
      paidAt: payment?.paidAt || null,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      isDemo: true
    };
  }

  /**
   * Mock refund
   */
  async refund(params = {}) {
    const { paymentId, amount, reason } = params;
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const refundId = `refund_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const refundAmount = amount || payment.amount;

    const refund = {
      refundId,
      paymentId,
      amount: refundAmount,
      currency: payment.currency,
      status: 'PROCESSED',
      reason: reason || 'Customer requested refund',
      processedAt: new Date().toISOString(),
      isDemo: true
    };

    this.refunds.set(refundId, refund);
    payment.status = 'REFUNDED';
    payment.refundId = refundId;

    return refund;
  }

  /**
   * Mock webhook signature verification (always passes in demo)
   */
  verifyWebhookSignature(headers, rawBody) {
    const signature = headers['x-mock-signature'] || headers['x-signature'];
    if (!signature) return true; // Lenient in mock mode

    const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(bodyStr).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Simulate webhook payload for testing
   */
  generateWebhookPayload(eventType, orderId) {
    const order = this.orders.get(orderId);
    if (!order) return null;

    return {
      id: `evt_mock_${Date.now()}`,
      type: eventType,
      createdAt: new Date().toISOString(),
      data: {
        order: {
          id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          receipt: order.receipt
        },
        payment: order.paymentId ? this.payments.get(order.paymentId) : null
      }
    };
  }
}

module.exports = MockPaymentProvider;