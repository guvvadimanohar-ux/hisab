/**
 * Hisab Database Seed Script
 * Generates realistic Kirana Store seed data:
 * Shop, Customers, Credit / Udhar records, Repayments, Multi-source Transactions, and Bank Connection.
 */

const { initializeDatabase, getOrCreateShopForUser } = require('../services/database.js');
const auth = require('../services/authService.js');
const { recordTransaction } = require('../services/transactionEngine.js');
const { issueCredit, recordRepayment } = require('../services/creditService.js');

function seedDatabase() {
  console.log('--> Seeding Hisab Database with realistic Kirana data...');
  const db = initializeDatabase();

  // 1. Create or resolve Primary Merchant User
  let user = db.prepare("SELECT * FROM users WHERE phone = '9876543210'").get();
  if (!user) {
    const { userId } = auth.createUserWithSession(db, {
      shopName: 'Garg Kirana & General Store',
      fullName: 'Ramesh Garg',
      phone: '9876543210',
      email: 'ramesh.garg@store.hisab.in',
      password: 'password123'
    });
    user = auth.getUserById(db, userId);
    console.log(`    Created user: ${user.fullName} (${user.shopName})`);
  } else {
    console.log(`    Found user: ${user.shop_name}`);
  }

  const userId = user.id;
  const shop = getOrCreateShopForUser(db, userId, 'Garg Kirana & General Store');

  // 2. Seed Customers
  const customerList = [
    { name: 'Sharma Ji', phone: '9811223344', email: 'sharma@example.com', notes: 'Daily milk and bread customer' },
    { name: 'Sunita Verma', phone: '9822334455', email: 'sunita@verma.in', notes: 'Monthly ration buyer' },
    { name: 'Amit Patel', phone: '9833445566', email: 'amit@patel.com', notes: 'Regular snacks and pulses' },
    { name: 'Vikram Singh', phone: '9844556677', email: 'vikram@singh.in', notes: 'Wholesale grains buyer' },
    { name: 'Priya Reddy', phone: '9855667788', email: 'priya@reddy.org', notes: 'Telugu speaking customer' },
    { name: 'Rajesh Kumar', phone: '9866778899', email: 'rajesh@kumar.co', notes: 'Oil and ghee purchaser' },
    { name: 'Ananya Gupta', phone: '9877889900', email: 'ananya@gupta.com', notes: 'Cosmetics and pantry items' },
    { name: 'Suresh Reddy', phone: '9888990011', email: 'suresh@reddy.in', notes: 'Hyderabadi spice regular' }
  ];

  const customerMap = new Map();
  for (const c of customerList) {
    let existing = db.prepare('SELECT id, name FROM customers WHERE user_id = ? AND phone = ?').get(userId, c.phone);
    if (!existing) {
      const custId = `CUST-${Date.now().toString().slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO customers (id, shop_id, user_id, name, phone, email, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(custId, shop.id, userId, c.name, c.phone, c.email, c.notes, now, now);
      existing = { id: custId, name: c.name };
    }
    customerMap.set(c.name, existing);
  }
  console.log(`    Seeded ${customerMap.size} customer profiles.`);

  // 3. Seed Credits & Repayments (Udhar ledger)
  const existingCredits = db.prepare('SELECT COUNT(*) as count FROM credits WHERE user_id = ?').get(userId);
  if (existingCredits.count === 0) {
    const sharma = customerMap.get('Sharma Ji');
    const sunita = customerMap.get('Sunita Verma');
    const amit = customerMap.get('Amit Patel');
    const priya = customerMap.get('Priya Reddy');

    if (sharma) {
      issueCredit(db, userId, {
        customerId: sharma.id,
        amount: 2500,
        dueDate: '2026-10-15',
        description: 'Rice & Oil monthly udhar'
      });
      // Partial repayment
      recordRepayment(db, userId, {
        customerId: sharma.id,
        amount: 1000,
        mode: 'UPI',
        reference: 'UPI/9811223344/repay',
        notes: 'GPay payment from Sharma ji'
      });
    }

    if (sunita) {
      issueCredit(db, userId, {
        customerId: sunita.id,
        amount: 4200,
        dueDate: '2026-09-01', // Overdue
        description: 'Monthly kirana bag'
      });
    }

    if (amit) {
      issueCredit(db, userId, {
        customerId: amit.id,
        amount: 1800,
        dueDate: '2026-10-20',
        description: 'Atta 20kg pack'
      });
      // Full repayment
      recordRepayment(db, userId, {
        customerId: amit.id,
        amount: 1800,
        mode: 'CASH',
        notes: 'Full settlement in cash'
      });
    }

    if (priya) {
      issueCredit(db, userId, {
        customerId: priya.id,
        amount: 3200,
        dueDate: '2026-10-25',
        description: 'Dry fruits & ghee'
      });
    }

    console.log('    Seeded customer credit and repayment records.');
  }

  // 4. Seed Multi-mode Transactions (Manual sales, Wholesaler expenses, UPI payments)
  const existingTxns = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?').get(userId);
  if (existingTxns.count < 15) {
    const sampleTxns = [
      { customerName: 'Direct Cash Customer', amount: 840, cashFlowType: 'INFLOW', transactionType: 'Sales', mode: 'CASH', category: 'Groceries', description: 'Counter sale - Atta and pulses' },
      { customerName: 'Swiggy Instamart Order', amount: 450, cashFlowType: 'INFLOW', transactionType: 'Sales', mode: 'UPI', narration: 'UPI/3829102910/SwiggyInstamart', category: 'Groceries' },
      { customerName: 'Priya Reddy', amount: 1250, cashFlowType: 'INFLOW', transactionType: 'Sales', mode: 'UPI', narration: 'UPI/9855667788@okhdfcbank/PriyaReddy', category: 'Dairy' },
      { customerName: 'Blinkit Delivery', amount: 620, cashFlowType: 'INFLOW', transactionType: 'Sales', mode: 'UPI', narration: 'UPI/Blinkit/GroceryStore', category: 'Groceries' },
      { customerName: 'Delhi Wholesale Grains', amount: 8500, cashFlowType: 'OUTFLOW', transactionType: 'Expense', mode: 'NET_BANKING', category: 'Supplier Payments', description: 'Restock 500kg Wheat bags' },
      { customerName: 'Amul Dairy Distributor', amount: 3400, cashFlowType: 'OUTFLOW', transactionType: 'Expense', mode: 'UPI', narration: 'UPI/AmulDistributor@icici/MilkBatch', category: 'Dairy' },
      { customerName: 'Tata Power / Electricity', amount: 1650, cashFlowType: 'OUTFLOW', transactionType: 'Expense', mode: 'UPI', narration: 'UPI/TPDDL/ShopMeter', category: 'Bills & Utilities' },
      { customerName: 'Rajesh Kumar', amount: 980, cashFlowType: 'INFLOW', transactionType: 'Sales', mode: 'UPI', narration: 'UPI/rajesh@paytm/GheeBottle', category: 'Groceries' },
      { customerName: 'Direct Cash Customer', amount: 320, cashFlowType: 'INFLOW', transactionType: 'Sales', mode: 'CASH', category: 'Groceries', description: 'Spices and biscuits' },
      { customerName: 'Indian Oil Petrol', amount: 400, cashFlowType: 'OUTFLOW', transactionType: 'Expense', mode: 'UPI', narration: 'UPI/IOCLPetrolPump@okhdfcbank/Fuel', category: 'Fuel' }
    ];

    for (const t of sampleTxns) {
      recordTransaction(db, userId, t);
    }
    console.log(`    Seeded ${sampleTxns.length} realistic kirana transactions.`);
  }

  // 5. Seed Bank Account & Consent (HDFC Bank Account Aggregator connection)
  const existingBank = db.prepare('SELECT id FROM bank_accounts WHERE user_id = ?').get(userId);
  if (!existingBank) {
    const accId = `ACC-HDFC-8821`;
    const consentId = `CONSENT-HDFC-9921`;
    const now = new Date().toISOString();
    const expiry = new Date(Date.now() + 180 * 86400000).toISOString();

    db.prepare(`
      INSERT INTO consents (id, shop_id, user_id, provider, consent_handle, phone_number, bank_id, status, purpose, data_range_start, data_range_end, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(consentId, shop.id, userId, 'mock', consentId, user.phone, 'HDFC', 'ACTIVE', 'Financial Analytics', '2026-01-01', '2026-09-26', expiry, now, now);

    db.prepare(`
      INSERT INTO bank_accounts (id, shop_id, user_id, consent_id, bank_name, account_number_masked, account_type, ifsc_prefix, provider, status, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(accId, shop.id, userId, consentId, 'HDFC Bank', '••8821', 'SAVINGS', 'HDFC', 'mock', 'ACTIVE', now, now);

    console.log('    Seeded connected bank account: HDFC Bank (••8821).');
  }

  console.log('✅ Seed completed successfully! Test shop is ready for instant use.');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
