/**
 * Hisab Cashfree Payment Gateway Adapter
 * Implements Cashfree PG Orders API and webhook signature verification.
 */

const https = require('node:https');
const crypto = require('node:crypto');
const PaymentGatewayProvider = require('./PaymentGatewayProvider.js');

class CashfreeProvider extends PaymentGatewayProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'cashfree';
    this.appId = config.appId || process.env.CASHFREE_APP_ID || process.env.PAYMENT_GATEWAY_KEY || '';
    this.secretKey = config.secretKey || process.env.CASHFREE_SECRET_KEY || process.env.PAYMENT_GATEWAY_SECRET || '';
    this.apiVersion = config.apiVersion || '2023-08-01';
    this.environment = (config.environment || process.env.PAYMENT_ENVIRONMENT || 'sandbox').toLowerCase();
    this.host = this.environment === 'production' ? 'api.cashfree.com' : 'sandbox.cashfree.com';
  }

  isConfigured() {
    return Boolean(this.appId && this.secretKey);
  }

  async createOrder({ amount, currency = 'INR', receipt, notes = {}, customerId, customerPhone }) {
    if (!this.isConfigured()) {
      throw new Error('Cashfree credentials unconfigured. Set PAYMENT_GATEWAY_KEY and PAYMENT_GATEWAY_SECRET.');
    }

    const orderId = `order_cf_${Date.now()}`;
    const payload = JSON.stringify({
      order_id: orderId,
      order_amount: parseFloat(amount),
      order_currency: currency.toUpperCase(),
      customer_details: {
        customer_id: customerId || `cust_${Date.now()}`,
        customer_phone: customerPhone || '9999999999'
      },
      order_meta: {
        return_url: notes.returnUrl || 'http://localhost:8099/api/payments/callback?order_id={order_id}'
      },
      order_note: receipt || 'Hisab payment order'
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: this.host,
        path: '/pg/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.appId,
          'x-client-secret': this.secretKey,
          'x-api-version': this.apiVersion,
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
                orderId: data.order_id,
                gateway: 'cashfree',
                paymentSessionId: data.payment_session_id,
                amount: data.order_amount,
                currency: data.order_currency,
                status: data.order_status,
                isDemo: false
              });
            } else {
              reject(new Error(`Cashfree Order Error: ${data.message || body}`));
            }
          } catch (e) {
            reject(new Error(`Invalid Cashfree Response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async verifyPayment({ orderId }) {
    if (!this.isConfigured()) return false;
    try {
      const status = await this.getPaymentStatus(orderId);
      return status.status === 'PAID';
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(headers = {}, rawBody = '') {
    const signature = headers['x-webhook-signature'];
    const timestamp = headers['x-webhook-timestamp'];
    if (!signature || !timestamp || !this.secretKey || !rawBody) return false;

    try {
      const dataToSign = timestamp + rawBody;
      const expected = crypto.createHmac('sha256', this.secretKey)
        .update(dataToSign)
        .digest('base64');

      return signature === expected;
    } catch {
      return false;
    }
  }

  async getPaymentStatus(orderId) {
    if (!this.isConfigured()) throw new Error('Cashfree unconfigured');
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: this.host,
        path: `/pg/orders/${encodeURIComponent(orderId)}`,
        method: 'GET',
        headers: {
          'x-client-id': this.appId,
          'x-client-secret': this.secretKey,
          'x-api-version': this.apiVersion
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({
              orderId: data.order_id,
              status: data.order_status,
              amount: data.order_amount,
              currency: data.order_currency
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

module.exports = CashfreeProvider;
