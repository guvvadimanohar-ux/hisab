/**
 * RazorpayProvider - Official Razorpay Payment Gateway Integration
 * Documentation: https://razorpay.com/docs/payments/
 * Supports: UPI, Cards, NetBanking, Wallets, EMI, PayLater
 */

const PaymentGatewayProvider = require('./PaymentGatewayProvider.js');
const crypto = require('node:crypto');

class RazorpayProvider extends PaymentGatewayProvider {
  constructor(config = {}) {
    super({ ...config, providerName: 'Razorpay' });
    this.keyId = config.keyId || process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = config.keySecret || process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = config.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '';
    this.baseUrl = config.baseUrl || 'https://api.razorpay.com/v1';
  }

  /**
   * Check if valid credentials are configured
   */
  hasValidCredentials() {
    return Boolean(this.keyId && this.keySecret &&
      !this.keyId.includes('your_') &&
      !this.keySecret.includes('your_'));
  }

  /**
   * Generate Basic Auth header for Razorpay API
   */
  getAuthHeader() {
    const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Supported payment methods
   */
  async getSupportedMethods() {
    return [
      { id: 'upi', name: 'UPI (Google Pay, PhonePe, Paytm, BHIM, etc.)', type: 'upi', enabled: true },
      { id: 'upi_qr', name: 'UPI QR Code', type: 'upi', enabled: true },
      { id: 'upi_intent', name: 'UPI Intent (App-to-App)', type: 'upi', enabled: true },
      { id: 'card', name: 'Credit/Debit Card (Visa, Mastercard, RuPay, Amex, Diners)', type: 'card', enabled: true },
      { id: 'netbanking', name: 'Net Banking (50+ Banks)', type: 'netbanking', enabled: true },
      { id: 'wallet', name: 'Wallets (Paytm, Amazon Pay, PhonePe, Mobikwik, Freecharge)', type: 'wallet', enabled: true },
      { id: 'emi', name: 'Card EMI / Cardless EMI', type: 'emi', enabled: true },
      { id: 'paylater', name: 'Pay Later (Simpl, LazyPay, ZestMoney)', type: 'paylater', enabled: true }
    ];
  }

  /**
   * Create Razorpay Order
   * POST /orders
   */
  async createOrder(params = {}) {
    if (!this.hasValidCredentials()) {
      throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }

    const amount = parseInt(params.amount, 10);
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount: must be positive integer in paise');
    }

    const payload = {
      amount,
      currency: params.currency || 'INR',
      receipt: params.receipt || `rcpt_${Date.now()}`,
      partial_payment: false,
      notes: {
        customer_name: params.customer?.name || '',
        customer_email: params.customer?.email || '',
        customer_phone: params.customer?.phone || '',
        ...params.notes
      }
    };

    const response = await this.request('POST', '/orders', payload);

    return {
      orderId: response.id,
      amount: response.amount,
      currency: response.currency,
      status: this.normalizeStatus(response.status),
      receipt: response.receipt,
      createdAt: new Date(response.created_at * 1000).toISOString(),
      expiresAt: new Date((response.created_at + 15 * 60) * 1000).toISOString(), // 15 min default
      checkoutUrl: `https://checkout.razorpay.com/v1/checkout.js?order_id=${response.id}&key=${this.keyId}`,
      isDemo: false
    };
  }

  /**
   * Verify Razorpay Payment Signature
   * Validates: razorpay_order_id, razorpay_payment_id, razorpay_signature
   */
  async verifyPayment(params = {}) {
    if (!this.hasValidCredentials()) {
      throw new Error('Razorpay credentials not configured.');
    }

    const { orderId, paymentId, signature } = params;
    if (!orderId || !paymentId || !signature) {
      return { verified: false, error: 'Missing required parameters' };
    }

    // Verify signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      return { verified: false, error: 'Invalid signature' };
    }

    // Fetch payment details to confirm
    const payment = await this.request('GET', `/payments/${paymentId}`);

    return {
      verified: true,
      paymentId: payment.id,
      orderId: payment.order_id,
      status: this.normalizeStatus(payment.status),
      method: payment.method,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: new Date(payment.created_at * 1000).toISOString(),
      bankRef: payment.acquirer_data?.bank_transaction_id || payment.id,
      fee: payment.fee,
      tax: payment.tax,
      isDemo: false
    };
  }

  /**
   * Get Order Status from Razorpay
   * GET /orders/{order_id}
   */
  async getOrderStatus(orderId) {
    if (!this.hasValidCredentials()) {
      throw new Error('Razorpay credentials not configured.');
    }

    const order = await this.request('GET', `/orders/${orderId}`);

    // Get payments for this order
    const payments = await this.request('GET', `/orders/${orderId}/payments`);
    const capturedPayment = payments.items.find(p => p.status === 'captured');

    return {
      orderId: order.id,
      status: this.normalizeStatus(order.status),
      amount: order.amount,
      currency: order.currency,
      paidAmount: capturedPayment?.amount || 0,
      method: capturedPayment?.method || null,
      paidAt: capturedPayment ? new Date(capturedPayment.created_at * 1000).toISOString() : null,
      createdAt: new Date(order.created_at * 1000).toISOString(),
      attempts: order.attempts,
      isDemo: false
    };
  }

  /**
   * Fetch Payment Details
   * GET /payments/{payment_id}
   */
  async getPayment(paymentId) {
    if (!this.hasValidCredentials()) {
      throw new Error('Razorpay credentials not configured.');
    }
    return this.request('GET', `/payments/${paymentId}`);
  }

  /**
   * Initiate Refund
   * POST /payments/{payment_id}/refund
   */
  async refund(params = {}) {
    if (!this.hasValidCredentials()) {
      throw new Error('Razorpay credentials not configured.');
    }

    const { paymentId, amount, reason } = params;
    const payload = {};
    if (amount) payload.amount = amount;
    if (reason) payload.notes = { reason };

    const refund = await this.request('POST', `/payments/${paymentId}/refund`, payload);

    return {
      refundId: refund.id,
      paymentId,
      amount: refund.amount,
      currency: refund.currency,
      status: this.normalizeStatus(refund.status),
      reason: refund.notes?.reason || reason,
      processedAt: new Date(refund.created_at * 1000).toISOString(),
      isDemo: false
    };
  }

  /**
   * Verify Webhook Signature
   * Razorpay sends: X-Razorpay-Signature header with HMAC-SHA256(payload, webhook_secret)
   */
  verifyWebhookSignature(headers, rawBody) {
    const signature = headers['x-razorpay-signature'];
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
   * Generic HTTP request to Razorpay API
   */
  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const options = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    };

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const error = data.error || { description: 'Unknown error' };
      throw new Error(`Razorpay API Error (${response.status}): ${error.description} (${error.code})`);
    }

    return data;
  }
}

module.exports = RazorpayProvider;