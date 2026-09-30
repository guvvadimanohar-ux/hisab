/**
 * Hisab Bank Transaction Normalizer & Deduplication Service
 * Maps heterogeneous raw bank statements from Account Aggregator into the
 * unified Hisab transaction schema with rigorous deduplication.
 */

const crypto = require('node:crypto');
const { isUpiTransaction, extractUpiDetails } = require('./upiDetector.js');
const { categorizeTransaction } = require('./categorization.js');

/**
 * Generates a stable deduplication signature for a bank transaction
 */
function generateDeduplicationFingerprint(provider, accountId, rawTxn) {
  // Primary: stable provider txn id if present
  if (rawTxn.txnId || rawTxn.providerTxnId || rawTxn.id) {
    const rawId = rawTxn.txnId || rawTxn.providerTxnId || rawTxn.id;
    return `${provider}#${accountId}#${rawId}`;
  }

  // Fallback: cryptographic hash of essential transaction invariant properties
  const dateStr = (rawTxn.date || '').slice(0, 10);
  const amountStr = Number(rawTxn.amount || 0).toFixed(2);
  const typeStr = (rawTxn.type || '').toUpperCase();
  const refStr = (rawTxn.reference || '').trim().toLowerCase();
  const narrationStr = (rawTxn.narration || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);

  const rawString = `${provider}|${accountId}|${dateStr}|${amountStr}|${typeStr}|${refStr}|${narrationStr}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

/**
 * Normalizes a list of raw bank transactions into Hisab transactions
 * @param {Array} rawTxns
 * @param {Object} context { provider, accountId, bankName, userId }
 * @param {Set} existingSignatures Set of already persisted signatures in SQLite
 * @returns {Object} { normalized: Array, duplicatesSkipped: number, upiCount: number }
 */
function normalizeBankTransactions(rawTxns = [], context = {}, existingSignatures = new Set()) {
  const normalized = [];
  let duplicatesSkipped = 0;
  let upiCount = 0;

  rawTxns.forEach((raw, index) => {
    const provider = context.provider || 'Setu';
    const accountId = context.accountId || 'ACC-DEFAULT';
    const dedupId = generateDeduplicationFingerprint(provider, accountId, raw);

    if (existingSignatures.has(dedupId)) {
      duplicatesSkipped++;
      return;
    }

    const rawType = String(raw.type || '').toUpperCase();
    const isFlowIn = rawType === 'CREDIT' || rawType === 'INFLOW' || rawType === 'DEPOSIT';
    const cashFlowType = isFlowIn ? 'INFLOW' : 'OUTFLOW';

    // Amount cleaning
    const amount = Math.abs(parseFloat(raw.amount || 0)) || 0;
    if (amount <= 0) return;

    // UPI Detection
    const isUpi = isUpiTransaction(raw);
    let mode = String(raw.mode || '').toUpperCase();
    let merchant = '';
    let category = '';

    if (isUpi) {
      mode = 'UPI';
      upiCount++;
      const upiDetails = extractUpiDetails(raw.narration);
      merchant = upiDetails.merchantName;
      category = upiDetails.suggestedCategory || categorizeTransaction({
        merchant,
        narration: raw.narration,
        flow: cashFlowType,
        amount
      });
    } else {
      mode = mode || (raw.narration?.toUpperCase().includes('NEFT') ? 'NEFT' : raw.narration?.toUpperCase().includes('IMPS') ? 'IMPS' : raw.narration?.toUpperCase().includes('ATM') ? 'ATM' : 'BANK_TRANSFER');
      merchant = extractBankPartyName(raw.narration) || context.bankName || 'Bank Counterparty';
      category = categorizeTransaction({
        merchant,
        narration: raw.narration,
        flow: cashFlowType,
        amount
      });
    }

    const dateStr = raw.date || new Date().toISOString().slice(0, 10);
    const date = dateStr.slice(0, 10);
    const time = dateStr.includes(' ') ? dateStr.split(' ')[1] : (dateStr.includes('T') ? dateStr.split('T')[1].slice(0, 8) : '12:00:00');

    let transactionType = 'PAYMENT';
    if (category === 'Loan & EMI' || raw.narration?.toUpperCase().includes('LOAN REPAY')) {
      transactionType = isFlowIn ? 'LOAN_REPAYMENT' : 'LOAN_GIVEN';
    } else if (category === 'Salary') {
      transactionType = 'RECEIPT';
    } else if (!isFlowIn) {
      transactionType = 'EXPENSE';
    }

    const txnRecord = {
      id: `TXN-BANK-${Date.now()}-${index + 1}`,
      dataset_id: `BANK-${accountId}`,
      bank_account_id: accountId,
      provider_transaction_id: dedupId,
      date,
      time,
      customer_id: `CUST-${merchant.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`,
      customer_name: merchant,
      description: raw.narration || `${mode} transaction via ${context.bankName}`,
      narration: raw.narration || '',
      merchant,
      amount,
      transaction_type: transactionType,
      cash_flow_type: cashFlowType,
      mode,
      payment_method: mode === 'UPI' ? 'UPI / QR' : (mode === 'NEFT' ? 'Bank NEFT' : mode === 'IMPS' ? 'Bank IMPS' : mode),
      category,
      subcategory: category,
      reference_number: raw.reference || raw.txnId || dedupId.slice(0, 16),
      loan_id: transactionType.startsWith('LOAN') ? `LN-${merchant.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-1` : null,
      status: 'Settled',
      balance: parseFloat(raw.balance || 0) || 0,
      source: 'BANK_AA',
      is_duplicate: 0,
      created_at: new Date().toISOString()
    };

    existingSignatures.add(dedupId);
    normalized.push(txnRecord);
  });

  return {
    normalized,
    duplicatesSkipped,
    upiCount
  };
}

function extractBankPartyName(narration = '') {
  if (!narration) return '';
  const parts = narration.split('/');
  if (parts.length >= 3) {
    const candidate = parts[2].trim();
    if (candidate.length > 2 && !/^[0-9]+$/.test(candidate)) {
      return candidate.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

module.exports = {
  generateDeduplicationFingerprint,
  normalizeBankTransactions
};
