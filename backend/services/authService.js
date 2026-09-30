/**
 * Hisab Authentication & Security Service
 * Zero-dependency session auth: PBKDF2 password hashing, HttpOnly session cookies,
 * in-memory rate limiting and same-origin CSRF protection.
 */

const crypto = require('node:crypto');

const SESSION_COOKIE = 'hisab_session_id';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PBKDF2_ITERATIONS = 120000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

// In-memory rate limiter buckets: { key: { count, resetAt } }
const rateBuckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * Fixed-window rate limiter.
 * @param {string} key unique bucket key (e.g. `ip:/api/bank/sync`)
 * @param {number} max max requests per window
 */
function rateLimit(key, max = 30) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  // Prevent unbounded growth
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (v.resetAt <= now) rateBuckets.delete(k);
    }
  }
  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000)
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return { salt, hash: hash.toString('hex') };
}

function verifyPassword(password, salt, expectedHash) {
  try {
    const { hash } = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a user and an initial auth session.
 * @returns {{ userId: string, token: string, setCookie: string }}
 */
function createUserWithSession(db, { shopName, fullName, phone, email, password }) {
  const id = `USR-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();
  // Store empty identifiers as NULL so SQLite UNIQUE treats them as "no value"
  const phoneVal = phone || null;
  const emailVal = email || null;

  db.prepare(`
    INSERT INTO users (id, shop_name, full_name, phone, email, password_hash, password_salt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, shopName, fullName || '', phoneVal, emailVal, hash, salt, now, now);

  const { token, setCookie } = createSession(db, id);
  return { userId: id, token, setCookie };
}

function createSession(db, userId) {
  const token = generateSessionToken();
  const now = new Date();
  db.prepare(`
    INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(`SES-${crypto.randomUUID().slice(0, 12).toUpperCase()}`, userId, hashToken(token), now.toISOString(), new Date(now.getTime() + SESSION_TTL_MS).toISOString());

  return {
    token,
    setCookie: `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
  };
}

function getUserById(db, userId) {
  const row = db.prepare('SELECT id, shop_name, full_name, phone, email, created_at FROM users WHERE id = ?').get(userId);
  if (!row) return null;
  return {
    id: row.id,
    shopName: row.shop_name,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    createdAt: row.created_at
  };
}

/**
 * Resolves the authenticated user from the session cookie.
 * @returns {Object|null} user object or null
 */
function getSessionUser(db, req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const row = db.prepare(`
    SELECT u.id, u.shop_name, u.full_name, u.phone, u.email, u.created_at
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND s.revoked_at IS NULL
  `).get(hashToken(token), new Date().toISOString());

  if (!row) return null;
  return {
    id: row.id,
    shopName: row.shop_name,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    createdAt: row.created_at
  };
}

function revokeSession(db, req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return;
  db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?')
    .run(new Date().toISOString(), hashToken(token));
}

/**
 * Same-origin check for state-changing requests (CSRF defence).
 * Allows requests with no Origin/Referer header (native/mobile clients, curl).
 */
function isSameOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  if (!origin && !referer) return true;

  const source = origin || referer;
  try {
    const srcHost = new URL(source).host;
    return srcHost === host;
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      acc[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
    return acc;
  }, {});
}

module.exports = {
  SESSION_COOKIE,
  rateLimit,
  hashPassword,
  verifyPassword,
  createUserWithSession,
  createSession,
  getUserById,
  getSessionUser,
  revokeSession,
  isSameOrigin,
  parseCookies
};
