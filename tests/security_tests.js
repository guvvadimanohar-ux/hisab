/**
 * Hisab Security & Multi-User Isolation Test Suite
 * Validates: user registration/login, session auth, cross-user data isolation,
 * webhook signature verification, idempotency and consent lifecycle gates.
 */

const assert = require('node:assert');

const { initializeDatabase, queryTransactions } = require('../backend/services/database.js');
const auth = require('../backend/services/authService.js');
const AccountAggregatorService = require('../backend/services/accountAggregator.js');
const { normalizeConsentStatus } = require('../backend/services/accountAggregator.js');
const { normalizeBankTransactions } = require('../backend/services/bankNormalizer.js');

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

async function ita(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\n======================================================');
console.log('🔐 Running Hisab Security & Isolation Test Suite');
console.log('======================================================\n');

// Build an isolated in-memory database
const db = initializeDatabase(':memory:');

// --- Suite 1: Password hashing & verification ---
console.log('Test Group 1: Password Hashing');
it('PBKDF2 hash is salted and deterministic for same salt', () => {
  const { salt, hash } = auth.hashPassword('s3cret-pass');
  assert.ok(salt && hash);
  assert.strictEqual(auth.verifyPassword('s3cret-pass', salt, hash), true);
  assert.strictEqual(auth.verifyPassword('wrong-pass', salt, hash), false);
});

it('Two users with same password get different salts/hashes', () => {
  const a = auth.hashPassword('same-password');
  const b = auth.hashPassword('same-password');
  assert.notStrictEqual(a.salt, b.salt);
  assert.notStrictEqual(a.hash, b.hash);
});

// --- Suite 2: User creation & session lifecycle ---
console.log('\nTest Group 2: Users & Sessions');

const userA = auth.createUserWithSession(db, { shopName: 'Store A', phone: '9000000001', password: 'pass-a-123' });
const userB = auth.createUserWithSession(db, { shopName: 'Store B', phone: '9000000002', password: 'pass-b-123' });

it('Creates two distinct users with hashed passwords', () => {
  const rows = db.prepare('SELECT * FROM users').all();
  assert.strictEqual(rows.length, 2);
  for (const row of rows) {
    assert.ok(row.password_hash !== 'pass-a-123');
    assert.ok(row.password_hash.length >= 64);
  }
});

it('Issues HttpOnly session cookies', () => {
  assert.ok(userA.setCookie.includes('HttpOnly'));
  assert.ok(userA.setCookie.includes('SameSite=Lax'));
});

function fakeReqWithCookie(token) {
  return { headers: { cookie: `hisab_session_id=${token}` } };
}

it('Resolves the correct user from a valid session token', () => {
  const resolved = auth.getSessionUser(db, fakeReqWithCookie(userA.token));
  assert.strictEqual(resolved.id, userA.userId);
  assert.strictEqual(resolved.shopName, 'Store A');
});

it('Rejects a garbage/forged session token', () => {
  assert.strictEqual(auth.getSessionUser(db, fakeReqWithCookie('deadbeef')), null);
});

it('Rejects a revoked session token', () => {
  auth.revokeSession(db, fakeReqWithCookie(userA.token));
  assert.strictEqual(auth.getSessionUser(db, fakeReqWithCookie(userA.token)), null);
  // issue a fresh token for later suites
  const fresh = auth.createSession(db, userA.userId);
  userA.token = fresh.token;
});

// --- Suite 3: Cross-user data isolation (IDOR prevention) ---
console.log('\nTest Group 3: Cross-User Data Isolation');

// Seed transactions for both users (dataset rows first to satisfy FK)
function seedTxn(userId, id, amount, flow, date) {
  const datasetId = `DS-${userId}`;
  db.prepare(`
    INSERT OR IGNORE INTO datasets (id, user_id, name, uploaded_at, row_count, status)
    VALUES (?, ?, 'Test Dataset', ?, 0, 'Active')
  `).run(datasetId, userId, new Date().toISOString());
  db.prepare(`
    INSERT INTO transactions (id, user_id, dataset_id, date, customer_name, amount, transaction_type, cash_flow_type, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CSV', ?)
  `).run(id, userId, datasetId, date, 'Party', amount, 'PAYMENT', flow, new Date().toISOString());
}

seedTxn(userA.userId, 'TXN-A1', 100, 'INFLOW', '2026-09-01');
seedTxn(userA.userId, 'TXN-A2', 250, 'OUTFLOW', '2026-09-02');
seedTxn(userB.userId, 'TXN-B1', 9999, 'INFLOW', '2026-09-03');

it('queryTransactions only returns the scoped user rows', () => {
  const rowsA = queryTransactions(db, userA.userId, {});
  const rowsB = queryTransactions(db, userB.userId, {});
  assert.strictEqual(rowsA.length, 2);
  assert.strictEqual(rowsB.length, 1);
  assert.ok(rowsA.every(r => r.user_id === userA.userId));
  assert.ok(rowsB.every(r => r.user_id === userB.userId));
  assert.strictEqual(rowsB[0].id, 'TXN-B1');
});

it('User A cannot query User B dataset by id', () => {
  const rowsA = queryTransactions(db, userA.userId, { dataset_id: `DS-${userB.userId}` });
  assert.strictEqual(rowsA.length, 0);
});

it('Amount-range filter works within the user scope', () => {
  const rows = queryTransactions(db, userA.userId, { min_amount: 200 });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].id, 'TXN-A2');
});

it('Search filter matches merchant/narration within the user scope', () => {
  const rows = queryTransactions(db, userB.userId, { search: 'Party' });
  assert.strictEqual(rows.length, 1);
});

// --- Suite 4: Rate limiting ---
console.log('\nTest Group 4: Rate Limiting');

it('Rate limiter blocks after max requests in window', () => {
  const key = `test-${Date.now()}`;
  let blocked = false;
  for (let i = 0; i < 6; i++) {
    const result = auth.rateLimit(key, 5);
    if (!result.allowed) blocked = true;
  }
  assert.strictEqual(blocked, true);
});

it('Different keys have independent buckets', () => {
  const first = auth.rateLimit(`iso-a-${Date.now()}`, 1);
  const second = auth.rateLimit(`iso-b-${Date.now()}`, 1);
  assert.strictEqual(first.allowed, true);
  assert.strictEqual(second.allowed, true);
});

// --- Suite 5: Consent lifecycle normalization ---
console.log('\nTest Group 5: Consent Lifecycle');

it('Maps provider statuses to canonical lifecycle values', () => {
  assert.strictEqual(normalizeConsentStatus('APPROVED'), 'ACTIVE');
  assert.strictEqual(normalizeConsentStatus('ACTIVE'), 'ACTIVE');
  assert.strictEqual(normalizeConsentStatus('INITIATED'), 'PENDING');
  assert.strictEqual(normalizeConsentStatus('PENDING'), 'PENDING');
  assert.strictEqual(normalizeConsentStatus('EXPIRED'), 'EXPIRED');
  assert.strictEqual(normalizeConsentStatus('DENIED'), 'REVOKED');
  assert.strictEqual(normalizeConsentStatus('REVOKED'), 'REVOKED');
  assert.strictEqual(normalizeConsentStatus('FAILED'), 'FAILED');
  assert.strictEqual(normalizeConsentStatus(''), 'PENDING');
});

// --- Suite 6: Webhook signature verification ---
console.log('\nTest Group 6: Webhook Security');

const crypto = require('node:crypto');
const WEBHOOK_SECRET = 'test-webhook-secret';
process.env.AA_WEBHOOK_SECRET = WEBHOOK_SECRET;

const setu = new (require('../backend/providers/accountAggregator/SetuProvider.js'))({ webhookSecret: WEBHOOK_SECRET });
const payload = JSON.stringify({ id: 'evt-100', type: 'CONSENT_STATUS_UPDATE', consentId: 'c-123', status: 'APPROVED' });

it('Accepts a correctly signed webhook payload', () => {
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  assert.strictEqual(setu.verifyWebhookSignature({ 'x-setu-signature': sig }, payload), true);
});

it('Rejects a forged/tampered signature', () => {
  const sig = crypto.createHmac('sha256', 'attacker-secret').update(payload).digest('hex');
  assert.strictEqual(setu.verifyWebhookSignature({ 'x-setu-signature': sig }, payload), false);
});

it('Rejects tampered payload with valid-length signature', () => {
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  const tampered = payload.replace('APPROVED', 'REVOKED ');
  assert.strictEqual(setu.verifyWebhookSignature({ 'x-setu-signature': sig }, tampered), false);
});

it('Rejects wrong-length signature without throwing (timingSafeEqual guard)', () => {
  assert.strictEqual(setu.verifyWebhookSignature({ 'x-setu-signature': 'short' }, payload), false);
  assert.strictEqual(setu.verifyWebhookSignature({ 'x-setu-signature': '' }, payload), false);
});

it('Rejects when webhook secret is unconfigured', () => {
  const savedSecret = process.env.AA_WEBHOOK_SECRET;
  delete process.env.AA_WEBHOOK_SECRET;
  try {
    const noSecret = new (require('../backend/providers/accountAggregator/SetuProvider.js'))({ webhookSecret: '' });
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
    assert.strictEqual(noSecret.verifyWebhookSignature({ 'x-setu-signature': sig }, payload), false);
  } finally {
    process.env.AA_WEBHOOK_SECRET = savedSecret;
  }
});

// --- Suite 7: Sync deduplication (webhook/sync idempotency at data layer) ---
console.log('\nTest Group 7: Sync Deduplication');

const rawFeed = [
  { txnId: 'TXN-AA-777', date: '2026-09-10 10:00:00', amount: 700, type: 'DEBIT', mode: 'UPI', narration: 'UPI/1/SWIGGY/swiggy@icici/Lunch' },
  { txnId: 'TXN-AA-778', date: '2026-09-10 11:00:00', amount: 300, type: 'CREDIT', mode: 'NEFT', narration: 'NEFT/CUSTOMER/Payment' }
];

it('Same data imported twice produces zero new rows (dedupe via signatures)', () => {
  const context = { provider: 'MockAA', accountId: 'ACC-SEC-1', bankName: 'HDFC Bank' };
  const first = normalizeBankTransactions(rawFeed, context, new Set());
  assert.strictEqual(first.normalized.length, 2);
  const sigs = new Set(first.normalized.map(t => t.provider_transaction_id));
  const second = normalizeBankTransactions(rawFeed, context, sigs);
  assert.strictEqual(second.normalized.length, 0);
  assert.strictEqual(second.duplicatesSkipped, 2);
});

// --- Suite 8: Mock AA service end-to-end consent + fetch ---
console.log('\nTest Group 8: Mock AA Lifecycle');

async function main() {
  await ita('Mock consent is created ACTIVE and fetches transactions', async () => {
    const svc = new AccountAggregatorService({ mockMode: true });
    const consent = await svc.initiateConsent({ bankId: 'ICICI', phoneNumber: '9876543210', userId: 'USR-TEST' });
    assert.strictEqual(consent.status, 'ACTIVE');
    const fi = await svc.fetchBankTransactions(consent.consentId, { from: '2026-08-01', to: '2026-09-30' });
    assert.ok(fi.transactions.length > 0);
  });

  await ita('Revoke flips consent status to REVOKED', async () => {
    const svc = new AccountAggregatorService({ mockMode: true });
    const consent = await svc.initiateConsent({ bankId: 'SBI', phoneNumber: '9876543210' });
    const revoked = await svc.revokeConsent(consent.consentId);
    assert.strictEqual(revoked.status, 'REVOKED');
    const after = await svc.getConsentStatus(consent.consentId);
    assert.strictEqual(after.status, 'REVOKED');
  });

  console.log('\n======================================================');
  console.log(`📊 Security Test Summary: ${passed} / ${total} Passed`);
  console.log('======================================================\n');

  if (passed !== total) process.exit(1);
}

main().catch(err => {
  console.error('Fatal security test error:', err);
  process.exit(1);
});
