/**
 * CashfreeProvider - Official Cashfree Payment Gateway Integration
 * Documentation: https://docs.cashfree.com/docs/payments
 * Supports: UPI, Cards, NetBanking, Wallets, EMI, PayLater
 */

const PaymentGatewayProvider = require('./PaymentGatewayProvider.js');
const crypto = require('node:crypto');

class CashfreeProvider extends PaymentGatewayProvider {
  constructor(config = {}) {
    super({ ...config, providerName: 'Cashfree' });
    this.clientId = config.clientId || process.env.CASHFREE_CLIENT_ID || '';
    this.clientSecret = config.clientSecret || process.env.CASHFREE_CLIENT_SECRET || '';
    this.webhookSecret = config.webhookSecret || process.env.CASHFREE_WEBHOOK_SECRET || '';
    this.environment = config.environment || process.env.CASHFREE_ENVIRONMENT || 'sandbox';
    this.baseUrl = this.environment === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
    this.apiVersion = config.apiVersion || '2023-08-01';
  }

  /**
   * Check if valid credentials are configured
   */
  hasValidCredentials() {
    return Boolean(this.clientId && this.clientSecret &&
      !this.clientId.includes('your_') &&
      !this.clientSecret.includes('your_'));
  }

  /**
   * Generate headers for Cashfree API
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-client-id': this.clientId,
      'x-client-secret': this.clientSecret,
      'x-api-version': this.apiVersion
    };
  }

  /**
   * Supported payment methods
   */
  async getSupportedMethods() {
    return [
      { id: 'upi', name: 'UPI (Google Pay, PhonePe, Paytm, BHIM, etc.)', type: 'upi', enabled: true },
      { id: 'upi_collect', name: 'UPI Collect (VPA entry)', type: 'upi', enabled: true },
      { id: 'upi_intent', name: 'UPI Intent (App-to-App)', type: 'upi', enabled: true },
      { id: 'card', name: 'Credit/Debit Card (Visa, Mastercard, RuPay, Amex)', type: 'card', enabled: true },
      { id: 'netbanking', name: 'Net Banking (50+ Banks)', type: 'netbanking', enabled: true },
      { id: 'wallet', name: 'Wallets (Paytm, Amazon Pay, PhonePe, Mobikwik)', type: 'wallet', enabled: true },
      { id: 'emi', name: 'Card EMI / Cardless EMI', type: 'emi', enabled: true },
      { id: 'paylater', name: 'Pay Later (Simpl, LazyPay, ZestMoney, Axio)', type: 'paylater', enabled: true }
    ];
  }

  /**
   * Create Cashfree Order
   * POST /orders
   */
  async createOrder(params = {}) {
    if (!this.hasValidCredentials()) {
      throw new Error('Cashfree credentials not configured. Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET.');
    }

    const amount = parseInt(params.amount, 10);
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount: must be positive integer in paise');
    }

    const orderId = params.receipt || `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const payload = {
      order_id: orderId,
      order_amount: amount / 100, // Cashfree expects rupees, not paise
      order_currency: params.currency || 'INR',
      customer_details: {
        customer_id: params.customer?.id || `cust_${Date.now()}`,
        customer_name: params.customer?.name || 'Customer',
        customer_email: params.customer?.email || '',
        customer_phone: params.customer?.phone || ''
      },
      order_meta: {
        return_url: params.callbackUrl || `http://localhost:8099/payment/success?order_id=${orderId}`,
        notify_url: params.webhookUrl || `http://localhost:8099/api/payments/webhook`
      },
      order_tags: params.notes || {}
    };

    const response = await this.request('POST', '/orders', payload);

    return {
      orderId: response.order_id,
      amount: Math.round(response.order_amount * 100), // Convert back to paise
      currency: response.order_currency,
      status: this.normalizeStatus(response.order_status),
      receipt: response.order_id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      checkoutUrl: response.payment_link || `${this.baseUrl.replace('/pg', '')}/checkout/${response.order_id}`,
      isDemo: this.environment === 'sandbox'
    };
  }

  /**
   * Verify Cashfree Payment
   * Validates webhook or fetches order status
   */
  async verifyPayment(params = {}) {
    if (!this.hasValidCredentials()) {
      throw new Error('Cashfree credentials not configured.');
    }

    const { orderId, paymentId, signature } = params;

    // If signature provided (from redirect), verify it
    if (signature) {
      return this.verifyRedirectSignature(params);
    }

    // Otherwise fetch order to get payment status
    const order = await this.getOrderStatus(orderId);
    const payment = order.payments?.[0];

    if (!payment) {
      return { verified: false, error: 'No payment found for order' };
    }

    return {
      verified: true,
      paymentId: payment.cf_payment_id || paymentId,
      orderId: order.orderId,
      status: this.normalizeStatus(payment.payment_status),
      method: payment.payment_method,
      amount: Math.round(payment.payment_amount * 100),
      currency: order.currency,
      paidAt: payment.payment_time ? new Date(payment.payment_time).toISOString() : new Date().toISOString(),
      bankRef: payment.bank_reference || payment.cf_payment_id,
      isDemo: this.environment === 'sandbox'
    };
  }

  /**
   * Verify redirect signature from Cashfree
   * Cashfree returns: order_id, payment_id, signature
   */
  verifyRedirectSignature(params) {
    const { orderId, paymentId, signature } = params;
    if (!orderId || !paymentId || !signature || !this.webhookSecret) {
      return { verified: false, error: 'Missing parameters for signature verification' };
    }

    // Cashfree signature: HMAC-SHA256(order_id + payment_id, webhook_secret)
    const message = `${orderId}${paymentId}`;
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(message).digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );

    if (!isValid) {
      return { verified: false, error: 'Invalid redirect signature' };
    }

    return {
      verified: true,
      paymentId,
      orderId,
      status: 'CAPTURED',
      isDemo: this.environment === 'sandbox'
    };
  }

  /**
   * Get Order Status from Cashfree
   * GET /orders/{order_id}
   */
  async getOrderStatus(orderId) {
    if (!this.hasValidCredentials()) {
      throw new Error('Cashfree credentials not configured.');
    }

    const response = await this.request('GET', `/orders/${orderId}`);

    return {
      orderId: response.order_id,
      status: this.normalizeStatus(response.order_status),
      amount: Math.round(response.order_amount * 100),
      currency: response.order_currency,
      paidAmount: Math.round((response.order_amount - (response.order_amount_due || 0)) * 100),
      method: response.payments?.[0]?.payment_method || null,
      paidAt: response.payments?.[0]?.payment_time ? new Date(response.payments[0].payment_time).toISOString() : null,
      createdAt: response.order_time ? new Date(response.order_time).toISOString() : new Date().toISOString(),
      payments: response.payments || [],
      isDemo: this.environment === 'sandbox'
    };
  }

  /**
   * Initiate Refund
   * POST /refunds
   */
  async refund(params = {}) {
    if (!this.hasValidCredentials()) {
      throw new Error('Cashfree credentials not configured.');
    }

    const { paymentId, amount, reason } = params;
    const refundId = `refund_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const payload = {
      refund_id: refundId,
      payment_id: paymentId,
      refund_amount: amount ? amount / 100 : undefined, // Cashfree expects rupees
      refund_note: reason
    };

    const response = await this.request('POST', '/refunds', payload);

    return {
      refundId: response.refund_id,
      paymentId,
      amount: Math.round(response.refund_amount * 100),
      currency: 'INR',
      status: this.normalizeStatus(response.refund_status),
      reason,
      processedAt: new Date(response.refund_time).toISOString(),
      isDemo: this.environment === 'sandbox'
    };
  }

  /**
   * Verify Webhook Signature
   * Cashfree sends: x-webhook-signature header with HMAC-SHA256(payload, webhook_secret)
   */
  verifyWebhookSignature(headers, rawBody) {
    const signature = headers['x-webhook-signature'];
    if (!signature || !this.webhookSecret) {
      return false;
    }

    const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(bodyStr).digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) return false;

    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Generic HTTP request to Cashfree API
   */
  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = this.getHeaders();

    const options = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    };

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const error = data.message || data.error || 'Unknown error';
      throw new Error(`Cashfree API Error (${response.status}): ${error}`);
    }

    return data;
  }
}

module.exports = CashfreeProvider;