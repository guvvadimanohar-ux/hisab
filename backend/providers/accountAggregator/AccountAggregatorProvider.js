/**
 * AccountAggregatorProvider (Base Abstract Interface)
 * Declares the standard lifecycle methods for Indian Account Aggregator integrations.
 */

class AccountAggregatorProvider {
  constructor(config = {}) {
    this.config = config;
    this.providerName = 'GenericAA';
  }

  /**
   * Initiates a consent request for the user with specified accounts & time range
   * @param {Object} params { userId, bankId, accountTypes, dateRange, purpose }
   * @returns {Promise<Object>} { consentId, consentUrl, status, expiresAt }
   */
  async createConsent(params) {
    throw new Error('createConsent() must be implemented by provider');
  }

  /**
   * Queries the current status of a consent request
   * @param {string} consentId
   * @returns {Promise<Object>} { consentId, status, approvedAt, expiresAt }
   */
  async getConsentStatus(consentId) {
    throw new Error('getConsentStatus() must be implemented by provider');
  }

  /**
   * Creates a Financial Information (FI) data session after consent is granted
   * @param {string} consentId
   * @param {Object} dateRange { from, to }
   * @returns {Promise<Object>} { sessionId, status }
   */
  async createDataSession(consentId, dateRange) {
    throw new Error('createDataSession() must be implemented by provider');
  }

  /**
   * Fetches the authorized financial transaction records for an active session
   * @param {string} consentId
   * @param {string} sessionId
   * @returns {Promise<Object>} { accounts: Array<{ accountId, maskedAccNo, bankName, transactions: Array }> }
   */
  async fetchFinancialInformation(consentId, sessionId) {
    throw new Error('fetchFinancialInformation() must be implemented by provider');
  }

  /**
   * Revokes an existing consent request
   * @param {string} consentId
   * @returns {Promise<Object>} { consentId, status: 'REVOKED' }
   */
  async revokeConsent(consentId) {
    throw new Error('revokeConsent() must be implemented by provider');
  }

  /**
   * Verifies an incoming webhook notification signature
   * @param {Object} headers
   * @param {string|Object} payload
   * @returns {boolean}
   */
  verifyWebhookSignature(headers, payload) {
    throw new Error('verifyWebhookSignature() must be implemented by provider');
  }
}

module.exports = AccountAggregatorProvider;
