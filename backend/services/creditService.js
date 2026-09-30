/**
 * Hisab Credit, Uddera & Repayment Service
 * Manages customer credit issuance, repayment reconciliation, and server-side balance math.
 * Enforces: outstanding = credit - repayments (never trusts client-calculated balances).
 */

const crypto = require('node:crypto');
const { getOrCreateShopForUser } = require('./database.js');
const { recordTransaction } = require('./transactionEngine.js');

function issueCredit(db, userId, { customerId, customerName, amount, dueDate, description, issuedAt }) {
  const shop = getOrCreateShopForUser(db, userId);
  const shopId = shop ? shop.id : `SHOP-${userId}`;

  const numAmount = Math.abs(parseFloat(amount || 0));
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Valid credit amount greater than 0 is required');
  }

  // Resolve customer
  let cust = null;
  if (customerId) {
    cust = db.prepare('SELECT id, name FROM customers WHERE id = ? AND user_id = ?').get(customerId, userId);
  }
  if (!cust && customerName) {
    const cleanName = String(customerName).trim();
    cust = db.prepare('SELECT id, name FROM customers WHERE user_id = ? AND LOWER(name) = LOWER(?)').get(userId, cleanName);
    if (!cust) {
      const newCustId = `CUST-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex')}`;
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO customers (id, shop_id, user_id, name, phone, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newCustId, shopId, userId, cleanName, '', 'Created during credit issuance', nowIso, nowIso);
      cust = { id: newCustId, name: cleanName };
    }
  }

  if (!cust) throw new Error('Customer is required for issuing credit');

  const creditId = `CRD-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex')}`;
  const now = new Date().toISOString();
  const issueDate = issuedAt ? String(issuedAt).slice(0, 10) : now.slice(0, 10);

  db.prepare(`
    INSERT INTO credits (
      id, shop_id, user_id, customer_id, amount, paid_amount,
      outstanding_amount, status, issued_at, due_date, description,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    creditId,
    shopId,
    userId,
    cust.id,
    numAmount,
    0,
    numAmount,
    'Pending',
    issueDate,
    dueDate ? String(dueDate).slice(0, 10) : null,
    description || `Udhar / Credit to ${cust.name}`,
    now,
    now
  );

  // Record outbound credit transaction in Common Transaction Engine
  const txnResult = recordTransaction(db, userId, {
    customerId: cust.id,
    customerName: cust.name,
    amount: numAmount,
    cashFlowType: 'OUTFLOW',
    transactionType: 'Credit Given',
    source: 'MANUAL',
    mode: 'CASH',
    category: 'Customer Credit',
    description: `Credit issued: ${description || cust.name}`,
    loanId: creditId,
    date: issueDate
  });

  return {
    id: creditId,
    creditId,
    customerId: cust.id,
    customerName: cust.name,
    amount: numAmount,
    paid_amount: 0,
    outstanding_amount: numAmount,
    outstandingAmount: numAmount,
    status: 'Pending',
    transactionId: txnResult.id
  };
}

function recordRepayment(db, userId, { creditId, customerId, amount, mode = 'CASH', reference, notes, paymentDate }) {
  const shop = getOrCreateShopForUser(db, userId);
  const shopId = shop ? shop.id : `SHOP-${userId}`;

  const numAmount = Math.abs(parseFloat(amount || 0));
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Valid repayment amount greater than 0 is required');
  }

  let targetCustomer = null;
  let creditsToRepay = [];

  if (creditId) {
    const singleCredit = db.prepare('SELECT * FROM credits WHERE id = ? AND user_id = ?').get(creditId, userId);
    if (!singleCredit) throw new Error('Credit record not found');
    creditsToRepay.push(singleCredit);
    targetCustomer = db.prepare('SELECT id, name FROM customers WHERE id = ? AND user_id = ?').get(singleCredit.customer_id, userId);
  } else if (customerId) {
    targetCustomer = db.prepare('SELECT id, name FROM customers WHERE id = ? AND user_id = ?').get(customerId, userId);
    if (!targetCustomer) throw new Error('Customer not found');
    creditsToRepay = db.prepare(`
      SELECT * FROM credits 
      WHERE customer_id = ? AND user_id = ? AND status != 'Paid'
      ORDER BY issued_at ASC
    `).all(customerId, userId);
  } else {
    throw new Error('Either creditId or customerId is required to record a repayment');
  }

  let remainingToApply = numAmount;
  const now = new Date().toISOString();
  const payDate = paymentDate ? String(paymentDate).slice(0, 10) : now.slice(0, 10);
  const paymentId = `PAY-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex')}`;

  // Record inbound repayment in Common Transaction Engine
  const txnResult = recordTransaction(db, userId, {
    customerId: targetCustomer ? targetCustomer.id : null,
    customerName: targetCustomer ? targetCustomer.name : 'Customer',
    amount: numAmount,
    cashFlowType: 'INFLOW',
    transactionType: 'Repayment Received',
    source: 'MANUAL',
    mode: mode.toUpperCase(),
    category: 'Loan Repayment',
    description: `Repayment from ${targetCustomer?.name || 'Customer'}: ₹${numAmount.toLocaleString('en-IN')}`,
    loanId: creditId || null,
    referenceNumber: reference || null,
    date: payDate
  });

  let lastUpdatedCredit = null;

  // Apply repayment against credits
  for (const cr of creditsToRepay) {
    if (remainingToApply <= 0) break;
    const unpaidOnThisCredit = Number(cr.outstanding_amount || 0);
    const payingOnThis = Math.min(unpaidOnThisCredit, remainingToApply);

    const updatedPaid = Number(cr.paid_amount || 0) + payingOnThis;
    const updatedOutstanding = Math.max(0, Number(cr.amount || 0) - updatedPaid);
    const updatedStatus = updatedOutstanding <= 0 ? 'Paid' : 'Partially Paid';

    db.prepare(`
      UPDATE credits
      SET paid_amount = ?, outstanding_amount = ?, status = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(updatedPaid, updatedOutstanding, updatedStatus, now, cr.id, userId);

    lastUpdatedCredit = {
      id: cr.id,
      paid_amount: updatedPaid,
      outstanding_amount: updatedOutstanding,
      status: updatedStatus
    };

    remainingToApply -= payingOnThis;
  }

  // Insert payment record
  db.prepare(`
    INSERT INTO payments (
      id, shop_id, user_id, customer_id, credit_id, transaction_id,
      amount, payment_date, mode, reference, notes, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    paymentId,
    shopId,
    userId,
    targetCustomer ? targetCustomer.id : null,
    creditId || null,
    txnResult.id,
    numAmount,
    payDate,
    mode.toUpperCase(),
    reference || null,
    notes || 'Repayment recorded',
    now,
    now
  );

  // Calculate current customer outstanding balance
  let customerRemainingOutstanding = 0;
  if (targetCustomer) {
    const sumRow = db.prepare(`
      SELECT SUM(outstanding_amount) as total
      FROM credits
      WHERE customer_id = ? AND user_id = ? AND status != 'Paid'
    `).get(targetCustomer.id, userId);
    customerRemainingOutstanding = sumRow ? Number(sumRow.total || 0) : 0;
  }

  return {
    success: true,
    paymentId,
    transactionId: txnResult.id,
    customerName: targetCustomer?.name,
    amountRepaid: numAmount,
    customerRemainingOutstanding,
    paid_amount: lastUpdatedCredit ? lastUpdatedCredit.paid_amount : numAmount,
    outstanding_amount: lastUpdatedCredit ? lastUpdatedCredit.outstanding_amount : customerRemainingOutstanding,
    status: lastUpdatedCredit ? lastUpdatedCredit.status : 'Paid'
  };
}

function listCredits(db, userId, { customerId, status, page = 1, limit = 50 } = {}) {
  let query = `
    SELECT 
      cr.*, c.name as customer_name, c.phone as customer_phone
    FROM credits cr
    LEFT JOIN customers c ON c.id = cr.customer_id
    WHERE cr.user_id = ?
  `;
  const params = [userId];

  if (customerId) {
    query += ' AND cr.customer_id = ?';
    params.push(customerId);
  }
  if (status && status !== 'all') {
    query += ' AND cr.status = ?';
    params.push(status);
  }

  query += ' ORDER BY cr.issued_at DESC, cr.id DESC';

  const allRows = db.prepare(query).all(...params);
  const nowYmd = new Date().toISOString().slice(0, 10);

  // Update dynamic overdue status if passed due date
  const processed = allRows.map(row => {
    let currentStatus = row.status;
    if (currentStatus !== 'Paid' && row.due_date && row.due_date < nowYmd) {
      currentStatus = 'Overdue';
    }
    return {
      ...row,
      status: currentStatus,
      isOverdue: currentStatus === 'Overdue'
    };
  });

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const paginated = processed.slice(offset, offset + parseInt(limit, 10));

  return {
    credits: paginated,
    total: processed.length,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    totalPages: Math.ceil(processed.length / parseInt(limit, 10))
  };
}

function getCreditSummary(db, userId) {
  const credits = db.prepare('SELECT * FROM credits WHERE user_id = ?').all(userId);
  const totalGiven = credits.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalRepaid = credits.reduce((sum, c) => sum + Number(c.paid_amount || 0), 0);
  const totalOutstanding = Math.max(0, totalGiven - totalRepaid);
  const nowYmd = new Date().toISOString().slice(0, 10);

  const activeCount = credits.filter(c => c.status !== 'Paid').length;
  const overdueCount = credits.filter(c => c.status !== 'Paid' && c.due_date && c.due_date < nowYmd).length;

  return {
    totalCredit: totalGiven,
    totalLoansGiven: totalGiven,
    totalRepaid,
    totalOutstanding,
    activeCount,
    overdueCount,
    hasLoanData: credits.length > 0
  };
}

module.exports = {
  issueCredit,
  recordRepayment,
  listCredits,
  getCreditSummary
};
