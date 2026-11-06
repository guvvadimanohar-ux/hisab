/**
 * Hisab Common Transaction Engine
 * Unified ingestion and normalization engine for Manual, CSV, Bank (AA), and Payment Gateway transactions.
 * Handles deduplication, multi-signal UPI detection, customer auto-linking, and atomic database persistence.
 */

const crypto = require('node:crypto');
const { isUpiTransaction, extractUpiDetails } = require('./upiDetector.js');
const { categorizeTransaction } = require('./categorization.js');
const { getOrCreateShopForUser } = require('./database.js');

/**
 * Generates an invariant deduplication fingerprint for transactions
 */
function generateTxnFingerprint(txn) {
  if (txn.externalTransactionId || txn.providerTransactionId) {
    return `${txn.source || 'UNKNOWN'}:${txn.externalTransactionId || txn.providerTransactionId}`;
  }
  const raw = [
    String(txn.date || '').slice(0, 10),
    Number(txn.amount || 0).toFixed(2),
    String(txn.cashFlowType || txn.cash_flow_type || 'INFLOW').toUpperCase(),
    String(txn.customerName || txn.customer_name || txn.merchant || '').toLowerCase().trim(),
    String(txn.referenceNumber || txn.reference_number || txn.reference || '').trim()
  ].join('|');
  return 'fp:' + crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Resolves or creates a Customer record for linking
 */
function resolveCustomer(db, userId, shopId, { customerId, customerName, phone, email }) {
  if (customerId) {
    const existing = db.prepare('SELECT id, name, phone FROM customers WHERE id = ? AND user_id = ?').get(customerId, userId);
    if (existing) return existing;
  }

  const cleanName = String(customerName || '').trim();
  if (!cleanName || cleanName === 'Unknown' || cleanName.toLowerCase() === 'general customer') {
    return null;
  }

  let match = null;
  if (phone) {
    match = db.prepare('SELECT id, name, phone FROM customers WHERE user_id = ? AND phone = ?').get(userId, phone);
  }
  if (!match) {
    match = db.prepare('SELECT id, name, phone FROM customers WHERE user_id = ? AND LOWER(name) = LOWER(?)').get(userId, cleanName);
  }

  if (match) return match;

  // Auto-create customer record
  const newId = `CUST-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex')}`;
  const now = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO customers (id, shop_id, user_id, name, phone, email, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(newId, shopId, userId, cleanName, phone || '', email || '', 'Auto-created from transaction', now, now);
    return { id: newId, name: cleanName, phone: phone || '' };
  } catch {
    return db.prepare('SELECT id, name, phone FROM customers WHERE user_id = ? AND LOWER(name) = LOWER(?)').get(userId, cleanName);
  }
}

/**
 * Ingests a single transaction through the common engine
 */
function recordTransaction(db, userId, txnData) {
  if (!userId) throw new Error('userId is mandatory');
  const shop = getOrCreateShopForUser(db, userId);
  const shopId = shop ? shop.id : `SHOP-${userId}`;

  const amount = Math.abs(parseFloat(txnData.amount || 0));
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Valid transaction amount greater than 0 is required');
  }

  // Determine Cash Flow Type & Transaction Type
  let cashFlowType = txnData.cashFlowType || txnData.cash_flow_type || ({IN:'INFLOW',OUT:'OUTFLOW',INFLOW:'INFLOW',OUTFLOW:'OUTFLOW'}[txnData.flow]);
  let txnType = txnData.transactionType || txnData.transaction_type || txnData.type || 'Income';

  if (!cashFlowType) {
    const lowerType = String(txnType).toLowerCase();
    if (lowerType.includes('expense') || lowerType.includes('debit') || lowerType.includes('supplier')) {
      cashFlowType = 'OUTFLOW';
    } else {
      cashFlowType = 'INFLOW';
    }
  }
  cashFlowType = cashFlowType.toUpperCase() === 'OUTFLOW' ? 'OUTFLOW' : 'INFLOW';

  const date = txnData.date ? String(txnData.date).slice(0, 10) : require('../../frontend/js/dailyWorkflow').day();
  const time = txnData.time || new Date().toTimeString().slice(0, 8);
  const source = (txnData.source || 'MANUAL').toUpperCase();

  // Multi-signal UPI detection
  const isUpi = isUpiTransaction({
    mode: txnData.mode || txnData.paymentMode || txnData.payment_method,
    narration: txnData.narration || txnData.description,
    reference: txnData.referenceNumber || txnData.reference_number || txnData.reference
  });

  const upiDetails = isUpi ? extractUpiDetails(txnData.narration || txnData.description || '') : null;
  const upiId = txnData.upiId || txnData.upi_id || (upiDetails ? upiDetails.vpa : null);
  const detectedMerchant = upiDetails && upiDetails.cleanName ? upiDetails.cleanName : (txnData.merchant || null);

  // Categorization
  let category = txnData.category;
  if (!category || category === 'Other' || category === 'Uncategorized') {
    const autoCat = categorizeTransaction({
      merchant: detectedMerchant || txnData.customerName || txnData.customer_name,
      narration: txnData.narration || txnData.description,
      cashFlowType,
      amount
    });
    category = autoCat.category;
  }

  // Customer resolution
  const customer = resolveCustomer(db, userId, shopId, {
    customerId: txnData.customerId || txnData.customer_id,
    customerName: txnData.customerName || txnData.customer_name || detectedMerchant || 'Direct Cash Customer',
    phone: txnData.phone || txnData.customerPhone,
    email: txnData.email
  });

  const customerId = customer ? customer.id : null;
  const customerName = customer ? customer.name : (txnData.customerName || txnData.customer_name || detectedMerchant || 'Direct Cash Customer');

  // External IDs and Deduplication
  const externalId = txnData.externalTransactionId || txnData.external_transaction_id || txnData.providerTransactionId || txnData.provider_transaction_id || null;
  const fingerprint = generateTxnFingerprint({
    source,
    externalTransactionId: externalId,
    date,
    amount,
    cashFlowType,
    customerName,
    referenceNumber: txnData.referenceNumber || txnData.reference_number || txnData.reference
  });

  // Check duplicate
  if (externalId) {
    const existing = db.prepare('SELECT id FROM transactions WHERE user_id = ? AND provider_transaction_id = ?').get(userId, externalId);
    if (existing) {
      return { skipped: true, reason: 'DUPLICATE_EXTERNAL_ID', id: existing.id };
    }
  }

  const txnId = txnData.id || `TXN-${Date.now().toString().slice(-8)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  let datasetId = txnData.datasetId || txnData.dataset_id;

  if (!datasetId) {
    datasetId = `DS-APP-${userId}`;
    const dsExists = db.prepare('SELECT id FROM datasets WHERE id = ?').get(datasetId);
    if (!dsExists) {
      db.prepare(`
        INSERT INTO datasets (id, shop_id, user_id, name, uploaded_at, row_count, total_inflow, total_outflow, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(datasetId, shopId, userId, 'Manual & Gateway Ledger', new Date().toISOString(), 0, 0, 0, 'Active');
    }
  }

  const now = new Date().toISOString();
  const paymentMethod = txnData.paymentMethod || txnData.payment_method || (isUpi ? 'UPI' : (txnData.mode || 'CASH'));

  db.prepare(`
    INSERT INTO transactions (
      id, shop_id, user_id, dataset_id, bank_account_id, provider_transaction_id,
      date, time, customer_id, customer_name, description, narration,
      merchant, amount, transaction_type, cash_flow_type, mode,
      payment_method, category, subcategory, reference_number,
      loan_id, status, balance, is_duplicate, payer, payee, upi_id, is_upi,
      raw_data, created_at, updated_at, source
    )
    VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `).run(
    txnId,
    shopId,
    userId,
    datasetId,
    txnData.bankAccountId || txnData.bank_account_id || null,
    externalId || fingerprint,
    date,
    time,
    customerId,
    customerName,
    txnData.description || `${txnType} - ${customerName}`,
    txnData.narration || txnData.description || '',
    detectedMerchant || customerName,
    amount,
    txnType,
    cashFlowType,
    isUpi ? 'UPI' : (txnData.mode || 'CASH').toUpperCase(),
    paymentMethod,
    category || 'General',
    txnData.subcategory || null,
    txnData.referenceNumber || txnData.reference_number || txnData.reference || null,
    txnData.loanId || txnData.loan_id || null,
    txnData.status || 'Settled',
    Number(txnData.balance || 0),
    0,
    txnData.payer || (cashFlowType === 'INFLOW' ? customerName : shop.name),
    txnData.payee || (cashFlowType === 'INFLOW' ? shop.name : customerName),
    upiId,
    isUpi ? 1 : 0,
    txnData.rawData ? JSON.stringify(txnData.rawData) : null,
    now,
    now,
    source
  );

  // Increment dataset counters
  try {
    const inflowDelta = cashFlowType === 'INFLOW' ? amount : 0;
    const outflowDelta = cashFlowType === 'OUTFLOW' ? amount : 0;
    db.prepare(`
      UPDATE datasets
      SET row_count = row_count + 1,
          total_inflow = total_inflow + ?,
          total_outflow = total_outflow + ?,
          uploaded_at = ?
      WHERE id = ?
    `).run(inflowDelta, outflowDelta, now, datasetId);
  } catch (e) {
    console.warn('[Transaction Engine] Dataset counter update warning:', e.message);
  }

  return {
    success: true,
    id: txnId,
    customerId,
    customerName,
    amount,
    cashFlowType,
    isUpi,
    upiId,
    category
  };
}

/**
 * Batch transaction recorder executed inside a single DB transaction
 */
function recordBatchTransactions(db, userId, transactions = [], options = {}) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { total: 0, inserted: 0, duplicatesSkipped: 0, upiCount: 0, totalInflow: 0, totalOutflow: 0 };
  }

  let inserted = 0;
  let duplicatesSkipped = 0;
  let upiCount = 0;
  let totalInflow = 0;
  let totalOutflow = 0;

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const item of transactions) {
      try {
        const res = recordTransaction(db, userId, { ...item, ...options });
        if (res.skipped) {
          duplicatesSkipped++;
        } else {
          inserted++;
          if (res.isUpi) upiCount++;
          if (res.cashFlowType === 'INFLOW') totalInflow += res.amount;
          else totalOutflow += res.amount;
        }
      } catch (err) {
        console.warn('[Transaction Engine Batch Item Error]', err.message);
      }
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return {
    total: transactions.length,
    inserted,
    duplicatesSkipped,
    upiCount,
    totalInflow,
    totalOutflow
  };
}

module.exports = {
  recordTransaction,
  recordBatchTransactions,
  generateTxnFingerprint,
  resolveCustomer
};
