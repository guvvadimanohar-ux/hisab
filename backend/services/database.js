/**
 * Hisab Database Bootstrap
 * Centralizes SQLite schema creation, migrations and shared query helpers.
 * Zero-dependency: uses node:sqlite (Node 22+).
 */

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.HISAB_DB_PATH || path.join(__dirname, '..', '..', 'hisab_financial.db');

function initializeDatabase(dbPath = DB_PATH) {
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      row_count INTEGER DEFAULT 0,
      date_start TEXT,
      date_end TEXT,
      total_inflow REAL DEFAULT 0,
      total_outflow REAL DEFAULT 0,
      status TEXT DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      transaction_type TEXT NOT NULL,
      cash_flow_type TEXT NOT NULL,
      payment_method TEXT,
      category TEXT,
      reference_number TEXT,
      loan_id TEXT,
      status TEXT DEFAULT 'Settled',
      balance REAL DEFAULT 0,
      is_duplicate INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      consent_id TEXT,
      bank_name TEXT NOT NULL,
      account_number_masked TEXT NOT NULL,
      account_type TEXT DEFAULT 'SAVINGS',
      ifsc_prefix TEXT,
      provider TEXT DEFAULT 'mock',
      status TEXT DEFAULT 'ACTIVE',
      last_synced_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      provider TEXT NOT NULL,
      consent_handle TEXT,
      phone_number TEXT,
      bank_id TEXT,
      status TEXT NOT NULL,
      consent_url TEXT,
      data_range_start TEXT,
      data_range_end TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      shop_name TEXT NOT NULL,
      full_name TEXT,
      phone TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      event_type TEXT,
      received_at TEXT NOT NULL,
      processed_at TEXT,
      payload TEXT
    );

    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS credits (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      outstanding_amount REAL NOT NULL,
      status TEXT DEFAULT 'Pending',
      issued_at TEXT NOT NULL,
      due_date TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      customer_id TEXT,
      credit_id TEXT,
      transaction_id TEXT,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      mode TEXT DEFAULT 'CASH',
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_jobs (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      bank_account_id TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      records_fetched INTEGER DEFAULT 0,
      records_inserted INTEGER DEFAULT 0,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      customer_id TEXT,
      credit_id TEXT,
      gateway TEXT NOT NULL,
      gateway_order_id TEXT,
      gateway_payment_id TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      status TEXT DEFAULT 'CREATED',
      purpose TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON auth_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_id ON webhook_events(id);
  `);

  // Lightweight column migrations for upgrades from older schemas
  const ensureColumn = (table, column, type) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(column)) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
      } catch (e) {
        console.warn(`[Hisab DB] Warning adding ${table}.${column}:`, e.message);
      }
    }
  };

  // user and shop scoping columns
  ensureColumn('datasets', 'user_id', 'TEXT');
  ensureColumn('datasets', 'shop_id', 'TEXT');
  ensureColumn('bank_accounts', 'user_id', 'TEXT');
  ensureColumn('bank_accounts', 'shop_id', 'TEXT');
  ensureColumn('consents', 'user_id', 'TEXT');
  ensureColumn('consents', 'shop_id', 'TEXT');
  ensureColumn('consents', 'purpose', 'TEXT');
  ensureColumn('consents', 'expires_at', 'TEXT');

  const txnCols = db.prepare("PRAGMA table_info(transactions)").all().map(c => c.name);

  const txnColumnsToAdd = [
    { name: 'user_id', type: 'TEXT' },
    { name: 'shop_id', type: 'TEXT' },
    { name: 'bank_account_id', type: 'TEXT'},
    { name: 'provider_transaction_id', type: 'TEXT' },
    { name: 'mode', type: 'TEXT' },
    { name: 'narration', type: 'TEXT' },
    { name: 'merchant', type: 'TEXT' },
    { name: 'source', type: "TEXT DEFAULT 'CSV'" },
    { name: 'subcategory', type: 'TEXT' },
    { name: 'time', type: 'TEXT' },
    { name: 'customer_id', type: 'TEXT' },
    { name: 'description', type: 'TEXT' },
    { name: 'payment_method', type: 'TEXT' },
    { name: 'category', type: 'TEXT' },
    { name: 'reference_number', type: 'TEXT' },
    { name: 'loan_id', type: 'TEXT' },
    { name: 'status', type: "TEXT DEFAULT 'Settled'" },
    { name: 'balance', type: 'REAL DEFAULT 0' },
    { name: 'is_duplicate', type: 'INTEGER DEFAULT 0' },
    { name: 'payer', type: 'TEXT' },
    { name: 'payee', type: 'TEXT' },
    { name: 'upi_id', type: 'TEXT' },
    { name: 'is_upi', type: 'INTEGER DEFAULT 0' },
    { name: 'raw_data', type: 'TEXT' },
    { name: 'updated_at', type: 'TEXT' }
  ];
  for (const col of txnColumnsToAdd) {
    if (!txnCols.includes(col.name)) {
      try {
        db.exec(`ALTER TABLE transactions ADD COLUMN ${col.name} ${col.type};`);
      } catch (e) {
        console.warn(`[Hisab DB] Warning adding column ${col.name}:`, e.message);
      }
    }
  }

  const orderCols = db.prepare("PRAGMA table_info(payment_orders)").all().map(c => c.name);
  if (!orderCols.includes('credit_id')) {
    try {
      db.exec("ALTER TABLE payment_orders ADD COLUMN credit_id TEXT;");
    } catch (e) {
      console.warn('[Hisab DB] Warning adding credit_id to payment_orders:', e.message);
    }
  }

  // All indexes are created AFTER migrations so every referenced column exists,
  // regardless of whether the database was fresh or is upgrading from an old schema.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_txn_dataset ON transactions(dataset_id);
    CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_txn_customer ON transactions(customer_name);
    CREATE INDEX IF NOT EXISTS idx_txn_flow ON transactions(cash_flow_type);
    CREATE INDEX IF NOT EXISTS idx_txn_type ON transactions(transaction_type);
    CREATE INDEX IF NOT EXISTS idx_txn_loan ON transactions(loan_id);
    CREATE INDEX IF NOT EXISTS idx_txn_bank ON transactions(bank_account_id);
    CREATE INDEX IF NOT EXISTS idx_txn_mode ON transactions(mode);
    CREATE INDEX IF NOT EXISTS idx_txn_source ON transactions(source);
    CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_txn_shop ON transactions(shop_id);
    CREATE INDEX IF NOT EXISTS idx_ds_user ON datasets(user_id);
    CREATE INDEX IF NOT EXISTS idx_bank_user ON bank_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_consents_user ON consents(user_id);
    CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
    CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
    CREATE INDEX IF NOT EXISTS idx_credits_user ON credits(user_id);
    CREATE INDEX IF NOT EXISTS idx_credits_customer ON credits(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_credit ON payments(credit_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON payment_orders(user_id);
  `);

  return db;
}

/**
 * Filter transactions with per-user authorization enforced.
 * userId is mandatory — never call without an authenticated user.
 */
function queryTransactions(db, userId, filter = {}) {
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [userId];

  if (filter.dataset_id) {
    sql += ' AND dataset_id = ?';
    params.push(filter.dataset_id);
  }
  if (filter.date_start) {
    sql += ' AND date >= ?';
    params.push(filter.date_start);
  }
  if (filter.date_end) {
    sql += ' AND date <= ?';
    params.push(filter.date_end);
  }
  if (filter.customer) {
    sql += ' AND customer_name LIKE ?';
    params.push(`%${filter.customer}%`);
  }
  if (filter.flow && filter.flow !== 'all') {
    sql += ' AND cash_flow_type = ?';
    params.push(filter.flow.toUpperCase());
  }
  if (filter.type && filter.type !== 'all') {
    sql += ' AND transaction_type = ?';
    params.push(filter.type);
  }
  if (filter.category && filter.category !== 'all') {
    sql += ' AND category LIKE ?';
    params.push(`%${filter.category}%`);
  }
  if (filter.payment_method && filter.payment_method !== 'all') {
    sql += ' AND payment_method LIKE ?';
    params.push(`%${filter.payment_method}%`);
  }
  if (filter.mode && filter.mode !== 'all') {
    const m = filter.mode.toUpperCase();
    if (m === 'UPI') {
      sql += " AND (mode = 'UPI' OR payment_method LIKE '%UPI%')";
    } else {
      sql += ' AND (mode = ? OR payment_method LIKE ?)';
      params.push(m, `%${m}%`);
    }
  }
  if (filter.source && filter.source !== 'all') {
    sql += ' AND source = ?';
    params.push(filter.source.toUpperCase());
  }
  if (filter.bank_account_id) {
    sql += ' AND bank_account_id = ?';
    params.push(filter.bank_account_id);
  }
  if (filter.merchant) {
    sql += ' AND (merchant LIKE ? OR customer_name LIKE ?)';
    const term = `%${filter.merchant}%`;
    params.push(term, term);
  }
  if (filter.min_amount) {
    sql += ' AND amount >= ?';
    params.push(parseFloat(filter.min_amount));
  }
  if (filter.max_amount) {
    sql += ' AND amount <= ?';
    params.push(parseFloat(filter.max_amount));
  }
  if (filter.search) {
    sql += ' AND (customer_name LIKE ? OR description LIKE ? OR reference_number LIKE ? OR merchant LIKE ? OR narration LIKE ?)';
    const term = `%${filter.search}%`;
    params.push(term, term, term, term, term);
  }

  sql += ' ORDER BY date DESC, id DESC';

  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function getOrCreateShopForUser(db, userId, fallbackName = null) {
  if (!userId) return null;
  let shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(userId);
  if (!shop) {
    const user = db.prepare('SELECT shop_name, phone FROM users WHERE id = ?').get(userId);
    const shopName = fallbackName || (user ? user.shop_name : 'My Kirana Store');
    const shopId = `SHOP-${userId}`;
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO shops (id, owner_id, name, address, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(shopId, userId, shopName, 'Main Market Road', user?.phone || '', now, now);
      shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId);
    } catch {
      shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(userId);
    }
  }
  return shop;
}

module.exports = { initializeDatabase, queryTransactions, getOrCreateShopForUser, DB_PATH };

