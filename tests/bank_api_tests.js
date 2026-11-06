/** End-to-end checks for authenticated mock Account Aggregator bank flows. */
const assert = require('node:assert/strict');

process.env.HISAB_DB_PATH = ':memory:';
process.env.AA_MOCK_MODE = 'true';
process.env.PAYMENT_GATEWAY = 'mock';

const { server, startServer, db } = require('../backend/server');
const auth = require('../backend/services/authService');
const owner = auth.createUserWithSession(db, { shopName: 'Bank Test', fullName: 'Owner', phone: '9000010101', password: 'testpass' });
const other = auth.createUserWithSession(db, { shopName: 'Other Test', fullName: 'Owner', phone: '9000010102', password: 'testpass' });

(async () => {
  let passed = 0;
  await startServer(0);
  const base = `http://localhost:${server.address().port}`;
  const request = async (path, method = 'GET', data, token = owner.token) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: base,
        ...(token ? { Cookie: `hisab_session_id=${token}` } : {})
      },
      ...(data ? { body: JSON.stringify(data) } : {})
    });
    return { status: response.status, body: await response.json() };
  };
  const test = async (name, fn) => { await fn(); passed++; console.log(`PASS: ${name}`); };

  try {
    await test('Supported banks are available in mock mode', async () => {
      const result = await request('/api/bank/banks');
      assert.equal(result.status, 200);
      assert.equal(result.body.data.isMock, true);
      assert.ok(result.body.data.banks.some(bank => bank.id === 'HDFC'));
    });

    let accountId;
    await test('Consent creates an active demo account', async () => {
      const result = await request('/api/bank/connect', 'POST', { bankId: 'HDFC', phoneNumber: '9876543210' });
      assert.equal(result.status, 200);
      assert.equal(result.body.data.status, 'ACTIVE');
      assert.equal(result.body.data.isDemo, true);
      accountId = result.body.data.accountId;
      assert.ok(accountId);
    });

    await test('Connected accounts stay private to their owner', async () => {
      const own = await request('/api/bank/accounts');
      const otherUser = await request('/api/bank/accounts', 'GET', undefined, other.token);
      assert.equal(own.body.data.length, 1);
      assert.equal(own.body.data[0].id, accountId);
      assert.equal(otherUser.body.data.length, 0);
    });

    await test('Sync imports demo transactions and repeated sync remains idempotent', async () => {
      const first = await request('/api/bank/sync', 'POST', { accountId });
      assert.equal(first.status, 200);
      assert.ok(first.body.data.insertedCount >= 10);
      const before = db.prepare('SELECT COUNT(*) AS count FROM transactions WHERE bank_account_id = ?').get(accountId).count;
      const second = await request('/api/bank/sync', 'POST', { accountId });
      const after = db.prepare('SELECT COUNT(*) AS count FROM transactions WHERE bank_account_id = ?').get(accountId).count;
      assert.equal(second.status, 200);
      assert.equal(second.body.data.insertedCount, 0);
      assert.equal(after, before);
    });

    console.log(`${passed} bank API integration checks passed.`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
  server.close();
});
