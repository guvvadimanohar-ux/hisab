/**
 * Account Aggregator Service Orchestrator
 * Manages provider lifecycle, bank connections, and data synchronization.
 */

const SetuProvider = require('../providers/accountAggregator/SetuProvider.js');
const FinvuProvider = require('../providers/accountAggregator/FinvuProvider.js');
const MockAAProvider = require('../providers/accountAggregator/MockAAProvider.js');

/**
 * Normalizes provider-specific consent statuses into the canonical Hisab
 * lifecycle: PENDING | ACTIVE | EXPIRED | REVOKED | FAILED.
 */
function normalizeConsentStatus(rawStatus) {
  const s = String(rawStatus || '').toUpperCase();
  if (['ACTIVE', 'APPROVED', 'AUTHORIZED', 'GRANTED'].includes(s)) return 'ACTIVE';
  if (['PENDING', 'INITIATED', 'AWAITING_AUTH', 'PROCESSING'].includes(s)) return 'PENDING';
  if (['EXPIRED'].includes(s)) return 'EXPIRED';
  if (['REVOKED', 'DENIED', 'REJECTED'].includes(s)) return 'REVOKED';
  if (['FAILED', 'ERROR'].includes(s)) return 'FAILED';
  return 'PENDING';
}

class AccountAggregatorService {
  constructor(config = {}) {
    this.providerName = config.provider || process.env.AA_PROVIDER || 'setu';
    this.mockMode = config.mockMode ?? (String(process.env.AA_MOCK_MODE || 'false').toLowerCase() === 'true');

    // Instantiate appropriate provider
    if (this.mockMode) {
      this.provider = new MockAAProvider(config);
    } else if (this.providerName === 'setu') {
      this.provider = new SetuProvider(config);
    } else if (this.providerName === 'finvu') {
      this.provider = new FinvuProvider(config);
    } else {
      throw new Error(`Unsupported Account Aggregator provider: ${this.providerName}`);
    }
  }

  getSupportedBanks() {
    return MockAAProvider.getSupportedBanks();
  }

  isMockMode() {
    return this.provider instanceof MockAAProvider;
  }

  async initiateConsent(params) {
    const result = await this.provider.createConsent(params);
    return { ...result, status: normalizeConsentStatus(result.status) };
  }

  async getConsentStatus(consentId) {
    const result = await this.provider.getConsentStatus(consentId);
    return { ...result, status: normalizeConsentStatus(result.status) };
  }

  async fetchBankTransactions(consentId, dateRange) {
    const session = await this.provider.createDataSession(consentId, dateRange);
    return this.provider.fetchFinancialInformation(consentId, session.sessionId, dateRange);
  }

  async revokeConsent(consentId) {
    const result = await this.provider.revokeConsent(consentId);
    return { ...result, status: normalizeConsentStatus(result.status) };
  }

  verifyWebhookSignature(headers, rawBody) {
    return this.provider.verifyWebhookSignature(headers, rawBody);
  }
}

module.exports = AccountAggregatorService;
module.exports.normalizeConsentStatus = normalizeConsentStatus;
