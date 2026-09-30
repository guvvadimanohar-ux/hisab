/**
 * Hisab Razorpay Payment Gateway Adapter
 * Implements real Razorpay Orders API and HMAC-SHA256 signature verification.
 */

const https = require('node:https');
const crypto = require('node:crypto');
const PaymentGatewayProvider = require('./PaymentGatewayProvider.js');

class RazorpayProvider extends PaymentGatewayProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'razorpay';
    this.keyId = config.keyId || process.env.RAZORPAY_KEY_ID || process.env.PAYMENT_GATEWAY_KEY || '';
    this.keySecret = config.keySecret || process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_GATEWAY_SECRET || '';
    this.webhookSecret = config.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || '';
  }

  isConfigured() {
    return Boolean(this.keyId && this.keySecret);
  }

  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    if (!this.isConfigured()) {
      throw new Error('Razorpay credentials unconfigured. Set PAYMENT_GATEWAY_KEY and PAYMENT_GATEWAY_SECRET.');
    }

    const amountInPaise = Math.round(parseFloat(amount) * 100);
    const payload = JSON.stringify({
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt: receipt || `rec_${Date.now()}`,
      notes
    });

    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const req = https.request({
        hostname: 'api.razorpay.com',
        path: '/v1/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                orderId: data.id,
                gateway: 'razorpay',
                amount: data.amount / 100,
                amountInPaise: data.amount,
                currency: data.currency,
                receipt: data.receipt,
                status: data.status,
                keyId: this.keyId,
                isDemo: false
              });
            } else {
              reject(new Error(`Razorpay Order Error: ${data.error?.description || body}`));
            }
          } catch (e) {
            reject(new Error(`Invalid Razorpay Response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async verifyPayment({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId || !signature) return false;
    if (!this.keySecret) return false;

    try {
      const expected = crypto.createHmac('sha256', this.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(headers = {}, rawBody = '') {
    const signature = headers['x-razorpay-signature'];
    if (!signature || !this.webhookSecret || !rawBody) return false;

    try {
      const expected = crypto.createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  async getPaymentStatus(orderId) {
    if (!this.isConfigured()) throw new Error('Razorpay unconfigured');
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const req = https.request({
        hostname: 'api.razorpay.com',
        path: `/v1/orders/${encodeURIComponent(orderId)}`,
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({
              orderId: data.id,
              status: data.status,
              amount: data.amount / 100,
              currency: data.currency
            });
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = RazorpayProvider;
