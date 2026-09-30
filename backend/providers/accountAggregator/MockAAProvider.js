/**
 * MockAAProvider - Development & Sandbox Simulation Layer
 * Simulates official Indian Account Aggregator consent flows and streams realistic
 * test bank statements (UPI, NEFT, IMPS, ATM, Card, Salary).
 * All records are strictly tagged as 'DEMO DATA' / 'BANK_AA_MOCK'.
 */

const AccountAggregatorProvider = require('./AccountAggregatorProvider.js');

class MockAAProvider extends AccountAggregatorProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = 'MockAA';
    this.consents = new Map();
    this.sessions = new Map();
  }

  /**
   * Supported Indian Banks in Mock Simulation
   */
  static getSupportedBanks() {
    return [
      { id: 'HDFC', name: 'HDFC Bank', fipId: 'FIP-HDFC-01', logo: '🏛️' },
      { id: 'SBI', name: 'State Bank of India', fipId: 'FIP-SBI-01', logo: '🔵' },
      { id: 'ICICI', name: 'ICICI Bank', fipId: 'FIP-ICICI-01', logo: '🟠' },
      { id: 'AXIS', name: 'Axis Bank', fipId: 'FIP-AXIS-01', logo: '🟣' },
      { id: 'KOTAK', name: 'Kotak Mahindra Bank', fipId: 'FIP-KOTAK-01', logo: '🔴' },
      { id: 'PNB', name: 'Punjab National Bank', fipId: 'FIP-PNB-01', logo: '🟡' },
      { id: 'BOB', name: 'Bank of Baroda', fipId: 'FIP-BOB-01', logo: '🟤' }
    ];
  }

  /**
   * Simulates consent initiation
   */
  async createConsent(params = {}) {
    const consentId = `mock-consent-${Date.now()}`;
    const bankId = (params.bankId || 'HDFC').toUpperCase();
    const bank = MockAAProvider.getSupportedBanks().find(b => b.id === bankId) || MockAAProvider.getSupportedBanks()[0];

    const consentRecord = {
      consentId,
      userId: params.userId || 'default_merchant',
      bankId: bank.id,
      bankName: bank.name,
      maskedAccount: `••4821`,
      accountType: 'SAVINGS',
      status: 'ACTIVE',
      purpose: params.purpose || 'Bank Statement Import & UPI Analytics for Khatabook',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 180 * 86400000).toISOString()
    };

    this.consents.set(consentId, consentRecord);

    return {
      consentId,
      consentUrl: `http://localhost:8099/index.html?mock_consent_id=${consentId}`,
      status: 'ACTIVE',
      bankName: bank.name,
      maskedAccount: `••4821`,
      expiresAt: consentRecord.expiresAt,
      isDemo: true
    };
  }

  /**
   * Get consent status
   */
  async getConsentStatus(consentId) {
    const consent = this.consents.get(consentId);
    if (!consent) {
      return { consentId, status: 'FAILED', message: 'Consent record not found' };
    }
    return {
      consentId,
      status: consent.status,
      approvedAt: consent.createdAt,
      expiresAt: consent.expiresAt
    };
  }

  /**
   * Create FI Data Session
   */
  async createDataSession(consentId, dateRange = {}) {
    const sessionId = `mock-session-${Date.now()}`;
    this.sessions.set(sessionId, {
      consentId,
      dateRange,
      createdAt: new Date().toISOString()
    });
    return { sessionId, status: 'READY' };
  }

  /**
   * Generate realistic mock banking & UPI records
   */
  async fetchFinancialInformation(consentId, sessionId, dateRange = {}) {
    const consent = this.consents.get(consentId) || {
      bankName: 'HDFC Bank',
      maskedAccount: '••4821',
      accountType: 'SAVINGS'
    };

    const fromDate = dateRange.from ? new Date(dateRange.from) : new Date(Date.now() - 90 * 86400000);
    const toDate = dateRange.to ? new Date(dateRange.to) : new Date();

    const rawBankTransactions = [
      {
        txnId: 'TXN-AA-001',
        date: '2026-09-08 19:42:15',
        amount: 385.00,
        type: 'DEBIT',
        mode: 'UPI',
        narration: 'UPI/6251892018/SWIGGY BANGALORE/swiggy@icici/Food delivery order',
        reference: 'UPI6251892018',
        balance: 142850.50
      },
      {
        txnId: 'TXN-AA-002',
        date: '2026-09-08 16:15:00',
        amount: 14500.00,
        type: 'CREDIT',
        mode: 'UPI',
        narration: 'UPI/9812401822/RAMESH GARG/ramesh@oksbi/Kirana goods monthly payment',
        reference: 'UPI9812401822',
        balance: 143235.50
      },
      {
        txnId: 'TXN-AA-003',
        date: '2026-09-08 12:30:10',
        amount: 1240.00,
        type: 'DEBIT',
        mode: 'UPI',
        narration: 'UPI/8821940122/BLINKIT COMMERCE/blinkit@hdfcbank/Grocery restocking',
        reference: 'UPI8821940122',
        balance: 128735.50
      },
      {
        txnId: 'TXN-AA-004',
        date: '2026-09-07 18:20:00',
        amount: 2850.00,
        type: 'DEBIT',
        mode: 'UPI',
        narration: 'UPI/7710294819/AMAZON PAY INDIA/amazon@apl/Packaging tape and cardboard supplies',
        reference: 'UPI7710294819',
        balance: 129975.50
      },
      {
        txnId: 'TXN-AA-005',
        date: '2026-09-07 14:10:45',
        amount: 28900.00,
        type: 'CREDIT',
        mode: 'NEFT',
        narration: 'NEFT/HDFC902811/SHARMA ENTERPRISES/Commercial wholesale invoice settlement',
        reference: 'NEFTHDFC902811',
        balance: 132825.50
      },
      {
        txnId: 'TXN-AA-006',
        date: '2026-09-06 20:45:00',
        amount: 450.00,
        type: 'DEBIT',
        mode: 'UPI',
        narration: 'UPI/3310294819/UBER RIDES/uber@icici/Transport to wholesale mandi',
        reference: 'UPI3310294819',
        balance: 103925.50
      },
      {
        txnId: 'TXN-AA-007',
        date: '2026-09-06 17:30:12',
        amount: 8200.00,
        type: 'CREDIT',
        mode: 'UPI',
        narration: 'UPI/5519204822/ANITA VERMA/anita@ybl/Provisions settlement',
        reference: 'UPI5519204822',
        balance: 104375.50
      },
      {
        txnId: 'TXN-AA-008',
        date: '2026-09-05 15:20:00',
        amount: 9800.00,
        type: 'DEBIT',
        mode: 'IMPS',
        narration: 'IMPS/6619284011/BSES YAMUNA POWER/Store electricity utility bill',
        reference: 'IMPS6619284011',
        balance: 96175.50
      },
      {
        txnId: 'TXN-AA-009',
        date: '2026-09-05 11:15:00',
        amount: 5000.00,
        type: 'DEBIT',
        mode: 'ATM',
        narration: 'ATM/CASH-WDL/HDFC-ATM-DELHI/Branch ATM Cash withdrawal',
        reference: 'ATMWDL9021',
        balance: 105975.50
      },
      {
        txnId: 'TXN-AA-010',
        date: '2026-09-04 19:10:00',
        amount: 6700.00,
        type: 'CREDIT',
        mode: 'UPI',
        narration: 'UPI/4410294811/KAVITA SINGH/kavita@okhdfcbank/Organic grocery order',
        reference: 'UPI4410294811',
        balance: 110975.50
      },
      {
        txnId: 'TXN-AA-011',
        date: '2026-09-04 13:40:00',
        amount: 649.00,
        type: 'DEBIT',
        mode: 'UPI',
        narration: 'UPI/1129304928/NETFLIX ENTERTAINMENT/netflix@citibank/Monthly entertainment sub',
        reference: 'UPI1129304928',
        balance: 104275.50
      },
      {
        txnId: 'TXN-AA-012',
        date: '2026-09-03 16:50:00',
        amount: 15000.00,
        type: 'CREDIT',
        mode: 'UPI',
        narration: 'UPI/8819204812/DEEPAK ELECTRIC WORKS/deepak@okaxis/Working Capital Loan Repayment 01',
        reference: 'UPI8819204812',
        balance: 104924.50
      },
      {
        txnId: 'TXN-AA-013',
        date: '2026-09-02 18:15:00',
        amount: 1850.00,
        type: 'DEBIT',
        mode: 'UPI',
        narration: 'UPI/2210294811/INDIAN OIL PETROL/iocl@sbi/Delivery van petrol refuel',
        reference: 'UPI2210294811',
        balance: 89924.50
      },
      {
        txnId: 'TXN-AA-014',
        date: '2026-09-01 10:00:00',
        amount: 55000.00,
        type: 'CREDIT',
        mode: 'NEFT',
        narration: 'NEFT/SALARY-CREDIT/GARG KIRANA CORP/Monthly merchant proprietor drawing',
        reference: 'NEFTSAL9021',
        balance: 91774.50
      },
      {
        txnId: 'TXN-AA-015',
        date: '2026-08-30 14:20:00',
        amount: 699.00,
        type: 'DEBIT',
        mode: 'UPI',
        narration: 'UPI/9920194821/AIRTEL BROADBAND/airtel@airtelpayments/Store fiber optic wifi bill',
        reference: 'UPI9920194821',
        balance: 36774.50
      },
      {
        txnId: 'TXN-AA-016',
        date: '2026-08-28 17:10:00',
        amount: 9200.00,
        type: 'CREDIT',
        mode: 'UPI',
        narration: 'UPI/7720194811/VIKRAM PATEL/vikram@paytm/Retail flour and ghee delivery',
        reference: 'UPI7720194811',
        balance: 37473.50
      }
    ];

    // Filter within dateRange
    const filteredTxns = rawBankTransactions.filter(t => {
      const txnDate = new Date(t.date);
      return txnDate >= fromDate && txnDate <= toDate;
    });

    return {
      status: 'COMPLETED',
      transactions: filteredTxns,
      account: {
        accountId: `ACC-${consent.bankId || 'HDFC'}-4821`,
        maskedAccountNumber: `•••• 4821`,
        bankName: consent.bankName || 'HDFC Bank',
        accountType: consent.accountType || 'SAVINGS',
        currency: 'INR',
        balance: filteredTxns[0]?.balance || 142850.50,
        asOfDate: new Date().toISOString(),
        transactions: filteredTxns
      },
      metadata: {
        source: 'BANK_AA_MOCK',
        isDemo: true,
        recordCount: filteredTxns.length,
        retrievedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Revoke consent
   */
  async revokeConsent(consentId) {
    const consent = this.consents.get(consentId);
    if (consent) {
      consent.status = 'REVOKED';
      consent.revokedAt = new Date().toISOString();
      this.consents.set(consentId, consent);
    }
    return { consentId, status: 'REVOKED' };
  }

  verifyWebhookSignature(headers, payload) {
    return true; // Mock webhook always verifies
  }
}

module.exports = MockAAProvider;
