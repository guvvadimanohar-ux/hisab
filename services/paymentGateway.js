/**
 * Payment Gateway Service Orchestrator
 * Manages provider lifecycle, order creation, payment verification, and webhooks.
 * Follows the same provider abstraction pattern as AccountAggregatorService.
 */

const MockPaymentProvider = require('../providers/paymentGateway/MockPaymentProvider.js');
const RazorpayProvider = require('../providers/paymentGateway/RazorpayProvider.js');
const CashfreeProvider = require('../providers/paymentGateway/CashfreeProvider.js');

/**
 * Normalizes provider-specific payment statuses into canonical Hisab
 * lifecycle: CREATED | AUTHORIZED | CAPTURED | FAILED | REFUNDED | CANCELLED | EXPIRED
 */
function normalizePaymentStatus(rawStatus) {
  const s = String(rawStatus || '').toLowerCase();
  if (['created', 'pending', 'initiated', 'awaiting_payment'].includes(s)) return 'CREATED';
  if (['authorized', 'auth'].includes(s)) return 'AUTHORIZED';
  if (['captured', 'paid', 'completed', 'success', 'settled'].includes(s)) return 'CAPTURED';
  if (['failed', 'failure', 'declined', 'error'].includes(s)) return 'FAILED';
  if (['refunded', 'refund'].includes(s)) return 'REFUNDED';
  if (['cancelled', 'canceled', 'voided'].includes(s)) return 'CANCELLED';
  if (['expired', 'timeout'].includes(s)) return 'EXPIRED';
  return 'CREATED';
}

class PaymentGatewayService {
  constructor(config = {}) {
    this.providerName = config.provider || process.env.PAYMENT_PROVIDER || 'mock';
    this.mockMode = config.mockMode ?? (process.env.PAYMENT_MOCK_MODE !== 'false');

    // Instantiate appropriate provider
    if (this.mockMode || this.providerName === 'mock') {
      this.provider = new MockPaymentProvider(config);
    } else if (this.providerName === 'razorpay') {
      this.provider = new RazorpayProvider(config);
    } else if (this.providerName === 'cashfree') {
      this.provider = new CashfreeProvider(config);
    } else {
      this.provider = new MockPaymentProvider(config);
    }
  }

  getProviderName() {
    return this.providerName;
  }

  isMockMode() {
    return this.provider instanceof MockPaymentProvider;
  }

  async getSupportedMethods() {
    return this.provider.getSupportedMethods();
  }

  /**
   * Create a payment order
   * @param {Object} params
   * @returns {Promise<Object>} Order details with checkout URL
   */
  async createOrder(params) {
    const result = await this.provider.createOrder(params);
    return { ...result, status: normalizePaymentStatus(result.status) };
  }

  /**
   * Verify payment (signature validation + status check)
   * @param {Object} params - { orderId, paymentId, signature }
   * @returns {Promise<Object>} Verified payment details
   */
  async verifyPayment(params) {
    const result = await this.provider.verifyPayment(params);
    return { ...result, status: normalizePaymentStatus(result.status) };
  }

  /**
   * Get order/payment status
   * @param {string} orderId
   * @returns {Promise<Object>} Current order status
   */
  async getOrderStatus(orderId) {
    const result = await this.provider.getOrderStatus(orderId);
    return { ...result, status: normalizePaymentStatus(result.status) };
  }

  /**
   * Initiate refund
   * @param {Object} params - { paymentId, amount, reason }
   * @returns {Promise<Object>} Refund details
   */
  async refund(params) {
    const result = await this.provider.refund(params);
    return { ...result, status: normalizePaymentStatus(result.status) };
  }

  /**
   * Verify webhook signature from provider
   * @param {Object} headers - Request headers
   * @param {string|Object} rawBody - Raw request body
   * @returns {boolean}
   */
  verifyWebhookSignature(headers, rawBody) {
    return this.provider.verifyWebhookSignature(headers, rawBody);
  }

  /**
   * Get provider instance for advanced usage
   */
  getProvider() {
    return this.provider;
  }
}

module.exports = PaymentGatewayService;
module.exports.normalizePaymentStatus = normalizePaymentStatus;