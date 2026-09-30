/**
 * SetuProvider - Official Account Aggregator Integration Layer
 * Connects to Setu AA Bridge (Sandbox / Production)
 * Documentation: https://bridge.setu.co/docs/account-aggregator
 */

const crypto = require('node:crypto');
const AccountAggregatorProvider = require('./AccountAggregatorProvider.js');

class SetuProvider extends AccountAggregatorProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = 'Setu';
    this.clientId = config.clientId || process.env.AA_CLIENT_ID || '';
    this.clientSecret = config.clientSecret || process.env.AA_CLIENT_SECRET || '';
    this.productId = config.productId || process.env.AA_PRODUCT_ID || '';
    this.fiuId = config.fiuId || process.env.AA_FIU_ID || '';
    this.environment = config.environment || process.env.AA_ENVIRONMENT || 'sandbox';
    this.baseUrl = config.baseUrl || (this.environment === 'production' ? 'https://fiu.setu.co' : 'https://fiu-sandbox.setu.co');
    this.callbackUrl = config.callbackUrl || process.env.AA_CALLBACK_URL || 'http://localhost:8099/api/bank/callback';
    this.webhookSecret = config.webhookSecret || process.env.AA_WEBHOOK_SECRET || '';
  }

  /**
   * Helper: Generate authorization headers for Setu FIU API
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-client-id': this.clientId,
      'x-client-secret': this.clientSecret,
      'x-product-instance-id': this.productId
    };
  }

  /**
   * Check whether legitimate credentials are configured
   */
  hasValidCredentials() {
    return Boolean(this.clientId && this.clientSecret && !this.clientId.includes('your_'));
  }

  /**
   * Create consent request via Setu
   */
  async createConsent(params) {
    if (!this.hasValidCredentials()) {
      throw new Error('Setu credentials are not configured. Set AA_CLIENT_ID and AA_CLIENT_SECRET in .env or enable AA_MOCK_MODE=true.');
    }

    const payload = {
      Detail: {
        consentMode: 'STORE',
        fetchType: 'PERIODIC',
        consentTypes: ['TRANSACTIONS', 'PROFILE', 'SUMMARY'],
        fiTypes: ['DEPOSIT'],
        Purpose: {
          code: '101',
          refUri: 'https://api.rebit.org.in/aa/purpose/101.xml',
          text: params.purpose || 'Financial Statement Analysis & Expense Tracking for Khatabook',
          Category: { type: 'Personal Finance Management' }
        },
        FIDataRange: {
          from: params.dateRange?.from || new Date(Date.now() - 90 * 86400000).toISOString(),
          to: params.dateRange?.to || new Date().toISOString()
        },
        ConsentExpiry: new Date(Date.now() + 180 * 86400000).toISOString(),
        Frequency: { unit: 'DAY', value: 1 },
        DataFilter: [{ type: 'TRANSACTIONAMOUNT', operator: '>=', value: '0' }],
        DataLife: { unit: 'MONTH', value: 36 }
      },
      redirectUrl: this.callbackUrl
    };

    const res = await fetch(`${this.baseUrl}/consents`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Setu Consent Creation Failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      consentId: data.id || data.consentId,
      consentUrl: data.url || data.consentUrl,
      status: data.status || 'PENDING',
      expiresAt: data.ConsentExpiry || payload.Detail.ConsentExpiry
    };
  }

  /**
   * Fetch consent status
   */
  async getConsentStatus(consentId) {
    if (!this.hasValidCredentials()) {
      throw new Error('Setu credentials are not configured.');
    }

    const res = await fetch(`${this.baseUrl}/consents/${encodeURIComponent(consentId)}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Setu Consent Status Failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      consentId: data.id || consentId,
      status: data.status,
      approvedAt: data.approvedAt,
      expiresAt: data.expiresAt
    };
  }

  /**
   * Create FI Data Session
   */
  async createDataSession(consentId, dateRange = {}) {
    if (!this.hasValidCredentials()) {
      throw new Error('Setu credentials are not configured.');
    }

    const payload = {
      consentId: consentId,
      format: 'json',
      DataRange: {
        from: dateRange.from || new Date(Date.now() - 90 * 86400000).toISOString(),
        to: dateRange.to || new Date().toISOString()
      }
    };

    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Setu Session Creation Failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      sessionId: data.id || data.sessionId,
      status: data.status || 'PENDING'
    };
  }

  /**
   * Fetch authorized financial records
   */
  async fetchFinancialInformation(consentId, sessionId) {
    if (!this.hasValidCredentials()) {
      throw new Error('Setu credentials are not configured.');
    }

    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Setu Fetch FI Failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data;
  }

  /**
   * Revoke Consent
   */
  async revokeConsent(consentId) {
    if (!this.hasValidCredentials()) {
      throw new Error('Setu credentials are not configured.');
    }

    const res = await fetch(`${this.baseUrl}/consents/${encodeURIComponent(consentId)}/revoke`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Setu Revoke Consent Failed (${res.status}): ${errText}`);
    }

    return { consentId, status: 'REVOKED' };
  }

  /**
   * Verify HMAC-SHA256 Webhook Signature
   */
  verifyWebhookSignature(headers, rawBody) {
    const signature = headers['x-setu-signature'] || headers['x-signature'];
    if (!signature || !this.webhookSecret) {
      return false;
    }

    const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(bodyStr).digest('hex');
    // Length guard first: timingSafeEqual throws on mismatched lengths
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }
}

module.exports = SetuProvider;
