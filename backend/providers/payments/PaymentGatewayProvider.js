/**
 * Hisab Payment Gateway Provider Base Interface
 * Defines the contract that all payment gateways (Razorpay, Cashfree, Mock) must implement.
 */

class PaymentGatewayProvider {
  constructor(config = {}) {
    this.name = 'base';
    this.config = config;
  }

  /**
   * Creates an order with the gateway
   * @param {Object} orderData { amount, currency, receipt, customerId, notes }
   * @returns {Promise<Object>} { orderId, amount, currency, status, clientPayload }
   */
  async createOrder(orderData) {
    throw new Error('createOrder() must be implemented by payment gateway provider');
  }

  /**
   * Verifies client-submitted payment signature/confirmation
   * @param {Object} paymentData { orderId, paymentId, signature }
   * @returns {Promise<boolean>}
   */
  async verifyPayment(paymentData) {
    throw new Error('verifyPayment() must be implemented by payment gateway provider');
  }

  /**
   * Verifies webhook signature sent by the gateway
   * @param {Object} headers HTTP request headers
   * @param {string} rawBody Raw string body of the webhook
   * @returns {boolean}
   */
  verifyWebhookSignature(headers, rawBody) {
    throw new Error('verifyWebhookSignature() must be implemented by payment gateway provider');
  }

  /**
   * Fetches the current authoritative status of an order or payment
   * @param {string} orderId
   * @returns {Promise<Object>}
   */
  async getPaymentStatus(orderId) {
    throw new Error('getPaymentStatus() must be implemented by payment gateway provider');
  }

  isMockMode() {
    return false;
  }
}

module.exports = PaymentGatewayProvider;
