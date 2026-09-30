/**
 * PaymentGatewayProvider - Abstract Base Class
 * Defines the interface for all payment gateway integrations.
 * Providers must implement: createOrder, verifyPayment, getOrderStatus, refund, getSupportedMethods, verifyWebhookSignature
 */

class PaymentGatewayProvider {
  constructor(config = {}) {
    this.config = config;
    this.providerName = config.providerName || 'BaseProvider';
  }

  /**
   * Create a payment order
   * @param {Object} params
   * @param {number} params.amount - Amount in paise (smallest currency unit)
   * @param {string} params.currency - Currency code (default: 'INR')
   * @param {string} params.receipt - Merchant's receipt/order ID
   * @param {Object} params.customer - { name, email, phone }
   * @param {string} params.callbackUrl - Post-payment redirect URL
   * @param {Object} params.notes - Additional metadata
   * @returns {Promise<Object>} { orderId, amount, currency, status, checkoutUrl, expiresAt }
   */
  async createOrder(params) {
    throw new Error('createOrder() must be implemented by provider');
  }

  /**
   * Verify payment signature/callback
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.paymentId
   * @param {string} params.signature
   * @returns {Promise<Object>} { verified: boolean, paymentId, orderId, status, method }
   */
  async verifyPayment(params) {
    throw new Error('verifyPayment() must be implemented by provider');
  }

  /**
   * Get order/payment status
   * @param {string} orderId
   * @returns {Promise<Object>} { orderId, status, amount, paidAmount, method, paidAt }
   */
  async getOrderStatus(orderId) {
    throw new Error('getOrderStatus() must be implemented by provider');
  }

  /**
   * Initiate refund
   * @param {Object} params
   * @param {string} params.paymentId
   * @param {number} params.amount - Amount in paise (partial refund support)
   * @param {string} params.reason
   * @returns {Promise<Object>} { refundId, status, amount }
   */
  async refund(params) {
    throw new Error('refund() must be implemented by provider');
  }

  /**
   * Get supported payment methods
   * @returns {Promise<Array>} Array of { id, name, type, enabled }
   */
  async getSupportedMethods() {
    throw new Error('getSupportedMethods() must be implemented by provider');
  }

  /**
   * Verify webhook signature (HMAC-SHA256 typically)
   * @param {Object} headers - Request headers
   * @param {string|Object} rawBody - Raw request body
   * @returns {boolean}
   */
  verifyWebhookSignature(headers, rawBody) {
    throw new Error('verifyWebhookSignature() must be implemented by provider');
  }

  /**
   * Normalize provider-specific status to canonical Hisab status
   * Canonical: CREATED | AUTHORIZED | CAPTURED | FAILED | REFUNDED | CANCELLED | EXPIRED
   */
  normalizeStatus(providerStatus) {
    const statusMap = {
      created: 'CREATED',
      authorized: 'AUTHORIZED',
      captured: 'CAPTURED',
      paid: 'CAPTURED',
      completed: 'CAPTURED',
      success: 'CAPTURED',
      failed: 'FAILED',
      failure: 'FAILED',
      refunded: 'REFUNDED',
      refund: 'REFUNDED',
      cancelled: 'CANCELLED',
      canceled: 'CANCELLED',
      expired: 'EXPIRED',
      pending: 'CREATED'
    };
    return statusMap[String(providerStatus).toLowerCase()] || 'CREATED';
  }
}

module.exports = PaymentGatewayProvider;