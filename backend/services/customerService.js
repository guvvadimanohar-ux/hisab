/**
 * Hisab Customer Management Service
 * Provides customer CRUD, dynamic balance calculations, transaction history, and credit summaries.
 */

const crypto = require('node:crypto');
const { getOrCreateShopForUser } = require('./database.js');

function listCustomers(db, userId, { search, page = 1, limit = 50 } = {}) {
  const shop = getOrCreateShopForUser(db, userId);
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  let query = `
    SELECT 
      c.id, c.name, c.phone, c.email, c.notes, c.created_at,
      COALESCE((SELECT SUM(amount) FROM transactions t WHERE (t.customer_id = c.id OR LOWER(t.customer_name) = LOWER(c.name)) AND t.user_id = c.user_id AND t.cash_flow_type = 'INFLOW'), 0) AS total_inflow,
      COALESCE((SELECT SUM(amount) FROM transactions t WHERE (t.customer_id = c.id OR LOWER(t.customer_name) = LOWER(c.name)) AND t.user_id = c.user_id AND t.cash_flow_type = 'OUTFLOW'), 0) AS total_outflow,
      COALESCE((SELECT COUNT(*) FROM transactions t WHERE (t.customer_id = c.id OR LOWER(t.customer_name) = LOWER(c.name)) AND t.user_id = c.user_id), 0) AS transaction_count,
      COALESCE((SELECT SUM(amount) FROM credits cr WHERE cr.customer_id = c.id AND cr.user_id = c.user_id), 0) AS total_credit,
      COALESCE((SELECT SUM(paid_amount) FROM credits cr WHERE cr.customer_id = c.id AND cr.user_id = c.user_id), 0) AS total_repaid,
      COALESCE((SELECT SUM(outstanding_amount) FROM credits cr WHERE cr.customer_id = c.id AND cr.user_id = c.user_id AND cr.status != 'Paid'), 0) AS outstanding_credit,
      (SELECT MAX(date) FROM transactions t WHERE (t.customer_id = c.id OR LOWER(t.customer_name) = LOWER(c.name)) AND t.user_id = c.user_id) AS last_activity_date
    FROM customers c
    WHERE c.user_id = ?
  `;
  const params = [userId];

  if (search) {
    query += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY total_inflow DESC, c.name ASC';

  const allRows = db.prepare(query).all(...params);
  const total = allRows.length;
  const paginated = allRows.slice(offset, offset + parseInt(limit, 10));

  return {
    customers: paginated,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    totalPages: Math.ceil(total / parseInt(limit, 10))
  };
}

function getCustomerById(db, userId, customerId) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(customerId, userId);
  if (!customer) return null;

  // Transactions
  const transactions = db.prepare(`
    SELECT * FROM transactions 
    WHERE (customer_id = ? OR LOWER(customer_name) = LOWER(?)) AND user_id = ?
    ORDER BY date DESC, time DESC, id DESC
    LIMIT 100
  `).all(customer.id, customer.name, userId);

  // Credits
  const credits = db.prepare(`
    SELECT * FROM credits 
    WHERE customer_id = ? AND user_id = ?
    ORDER BY issued_at DESC
  `).all(customer.id, userId);

  // Payments / Repayments
  const payments = db.prepare(`
    SELECT * FROM payments
    WHERE customer_id = ? AND user_id = ?
    ORDER BY payment_date DESC
  `).all(customer.id, userId);

  const totalInflow = transactions.filter(t => t.cash_flow_type === 'INFLOW').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOutflow = transactions.filter(t => t.cash_flow_type === 'OUTFLOW').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalCredit = credits.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalRepaid = credits.reduce((sum, c) => sum + Number(c.paid_amount || 0), 0);
  const outstandingCredit = Math.max(0, totalCredit - totalRepaid);

  return {
    ...customer,
    stats: {
      totalInflow,
      totalOutflow,
      netVolume: totalInflow - totalOutflow,
      totalCredit,
      totalRepaid,
      outstandingCredit,
      transactionCount: transactions.length,
      lastActivityDate: transactions[0]?.date || customer.created_at.slice(0, 10)
    },
    transactions,
    credits,
    payments
  };
}

function createCustomer(db, userId, { name, phone, email, notes }) {
  if (!name || !String(name).trim()) {
    throw new Error('Customer name is required');
  }
  const cleanName = String(name).trim();
  const cleanPhone = phone ? String(phone).trim() : null;

  if (cleanPhone) {
    const dup = db.prepare('SELECT id, name FROM customers WHERE user_id = ? AND phone = ?').get(userId, cleanPhone);
    if (dup) {
      throw new Error(`Customer with phone ${cleanPhone} already exists (${dup.name})`);
    }
  }

  const shop = getOrCreateShopForUser(db, userId);
  const shopId = shop ? shop.id : `SHOP-${userId}`;
  const customerId = `CUST-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex')}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO customers (id, shop_id, user_id, name, phone, email, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customerId, shopId, userId, cleanName, cleanPhone, email ? String(email).trim().toLowerCase() : null, notes || '', now, now);

  return db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
}

function updateCustomer(db, userId, customerId, { name, phone, email, notes }) {
  const existing = db.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(customerId, userId);
  if (!existing) return null;

  const cleanName = name ? String(name).trim() : existing.name;
  const cleanPhone = phone !== undefined ? (phone ? String(phone).trim() : null) : existing.phone;
  const cleanEmail = email !== undefined ? (email ? String(email).trim().toLowerCase() : null) : existing.email;
  const cleanNotes = notes !== undefined ? String(notes).trim() : existing.notes;

  if (cleanPhone && cleanPhone !== existing.phone) {
    const dup = db.prepare('SELECT id FROM customers WHERE user_id = ? AND phone = ? AND id != ?').get(userId, cleanPhone, customerId);
    if (dup) throw new Error(`Another customer with phone ${cleanPhone} already exists`);
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE customers
    SET name = ?, phone = ?, email = ?, notes = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(cleanName, cleanPhone, cleanEmail, cleanNotes, now, customerId, userId);

  return db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
}

function deleteCustomer(db, userId, customerId) {
  const existing = db.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(customerId, userId);
  if (!existing) return false;

  db.prepare('DELETE FROM customers WHERE id = ? AND user_id = ?').run(customerId, userId);
  return true;
}

module.exports = {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
