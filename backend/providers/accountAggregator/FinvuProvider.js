/**
 * FinvuProvider - Alternative Account Aggregator Integration Layer
 * Architecture-ready implementation for Finvu AA
 */

const AccountAggregatorProvider = require('./AccountAggregatorProvider.js');

class FinvuProvider extends AccountAggregatorProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = 'Finvu';
    this.clientId = config.clientId || process.env.FINVU_CLIENT_ID || '';
    this.clientSecret = config.clientSecret || process.env.FINVU_CLIENT_SECRET || '';
    this.baseUrl = config.baseUrl || 'https://finvu.in/api/v1';
  }

  hasValidCredentials() {
    return Boolean(this.clientId && this.clientSecret && !this.clientId.includes('your_'));
  }

  async createConsent(params) {
    if (!this.hasValidCredentials()) {
      throw new Error('Finvu credentials are not configured. Configure credentials or enable AA_MOCK_MODE=true.');
    }
    throw new Error('Finvu integration ready for credentials. Onboard via Finvu portal.');
  }

  async getConsentStatus(consentId) {
    throw new Error('Finvu integration ready for credentials.');
  }

  async createDataSession(consentId, dateRange) {
    throw new Error('Finvu integration ready for credentials.');
  }

  async fetchFinancialInformation(consentId, sessionId) {
    throw new Error('Finvu integration ready for credentials.');
  }

  async revokeConsent(consentId) {
    throw new Error('Finvu integration ready for credentials.');
  }

  verifyWebhookSignature(headers, payload) {
    return false;
  }
}

module.exports = FinvuProvider;
