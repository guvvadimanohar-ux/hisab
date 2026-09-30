/**
 * Hisab Mock Payment Gateway Provider
 * Offline simulator for Payment Gateway orders, checkout, signature verification, and webhooks.
 * Clearly badges all records as DEMO/MOCK so they cannot be mistaken for real payments.
 */

const crypto = require('node:crypto');
const PaymentGatewayProvider = require('./PaymentGatewayProvider.js');

class MockPaymentProvider extends PaymentGatewayProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'mock';
    this.secretKey = config.secretKey || process.env.PAYMENT_GATEWAY_SECRET || 'mock_payment_secret_key_123';
    this.keyId = config.keyId || process.env.PAYMENT_GATEWAY_KEY || 'rzp_test_mock_hisab_key';
    this.webhookSecret = config.webhookSecret || null;
  }

  isMockMode() {
    return true;
  }

  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    const numAmount = parseFloat(amount || 0);
    const orderId = `order_mock_${Date.now().toString().slice(-6)}_${crypto.randomBytes(3).toString('hex')}`;
    const amountInPaise = Math.round(numAmount * 100);

    return {
      orderId,
      gateway: 'mock',
      amount: numAmount,
      amountInPaise,
      currency: currency.toUpperCase(),
      receipt: receipt || `rec_${Date.now()}`,
      status: 'CREATED',
      keyId: this.keyId,
      checkoutUrl: `https://mock-checkout.hisab.local/pay/${orderId}`,
      isDemo: true,
      notes: { ...notes, isDemo: 'true' }
    };
  }

  async verifyPayment({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId) return false;

    // In mock mode, support standard mock token or deterministic HMAC
    if (signature && signature.startsWith('mock_sig_')) return true;

    // Check SHA-256 HMAC of orderId|paymentId
    if (signature) {
      const expected = crypto.createHmac('sha256', this.secretKey)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return true;
      }
    }

    // Default mock verification accepts when signature is present
    return Boolean(signature);
  }

  verifyWebhookSignature(headers = {}, rawBody = '') {
    if (!rawBody) return false;
    const headerSig = headers['x-mock-signature'] || headers['x-razorpay-signature'] || headers['x-webhook-signature'];
    if (!headerSig) {
      // In offline mock mode, accept if explicitly marked as mock test header
      return headers['x-mock-mode'] === 'true';
    }

    try {
      const secret = this.webhookSecret || process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || 'mock_webhook_secret_key';
      const expected = crypto.createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      const sigBuf = Buffer.from(headerSig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  async getPaymentStatus(orderId) {
    return {
      orderId,
      status: 'PAID',
      amount: 100,
      currency: 'INR',
      isDemo: true
    };
  }
}

module.exports = MockPaymentProvider;
