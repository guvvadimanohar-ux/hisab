/**
 * Authentication & Session API Routes
 * Handles user registration, login, logout, and current session introspection.
 */

async function handleAuthRoutes(req, res, pathname, searchParams, context) {
  const { db, auth, helpers } = context;
  const { sendJson, sendError, guardMutation, parseBody, getClientIp, securityLog } = helpers;

  // Store profile is scoped to the authenticated merchant.
  if (pathname === '/api/auth/profile' && ['GET', 'PUT'].includes(req.method)) {
    if (req.method === 'PUT' && !guardMutation(req, res, 'profile', 30)) return true;
    const user = auth.getSessionUser(db, req);
    if (!user) { sendError(res, 401, 'UNAUTHORIZED', 'Please sign in to edit your shop.'); return true; }
    db.exec('CREATE TABLE IF NOT EXISTS shop_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), details TEXT NOT NULL)');
    if (req.method === 'GET') {
      const row = db.prepare('SELECT details FROM shop_profiles WHERE user_id = ?').get(user.id);
      sendJson(res, 200, { success: true, data: { ...user, ...(row ? JSON.parse(row.details) : {}) } });
      return true;
    }
    const body = await parseBody(req);
    const profile = {};
    for (const key of ['shopName', 'fullName', 'shopPhone', 'shopEmail', 'shopAddress', 'shopCity', 'shopState', 'shopPincode', 'shopType', 'shopGst', 'shopHours']) profile[key] = String(body[key] || '').trim().slice(0, 250);
    if (!profile.shopName || !profile.fullName) { sendError(res, 400, 'MISSING_FIELDS', 'Shop name and owner name are required.'); return true; }
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE users SET shop_name = ?, full_name = ?, updated_at = ? WHERE id = ?').run(profile.shopName, profile.fullName, new Date().toISOString(), user.id);
      db.prepare('INSERT INTO shop_profiles (user_id, details) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET details = excluded.details').run(user.id, JSON.stringify(profile));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    sendJson(res, 200, { success: true, data: { ...user, ...profile } });
    return true;
  }

  // POST /api/auth/register
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    if (!guardMutation(req, res, 'auth', 10)) return true;
    const body = await parseBody(req);
    if (body.privacyConsent !== true || body.adultConfirmation !== true) {
      sendError(res, 400, 'CONSENT_REQUIRED', 'Please read the privacy notice, agree to the terms and confirm you are 18 or older.'); return true;
    }
    const shopName = String(body.shopName || '').trim();
    const password = String(body.password || '');

    if (!shopName || !password) {
      sendError(res, 400, 'MISSING_FIELDS', 'Shop name and password are required.');
      return true;
    }
    if (password.length < 6) {
      sendError(res, 400, 'WEAK_PASSWORD', 'Password must be at least 6 characters.');
      return true;
    }

    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!phone && !email) {
      sendError(res, 400, 'MISSING_FIELDS', 'A phone number or email is required.');
      return true;
    }

    // Uniqueness checks
    const dupPhone = phone ? db.prepare('SELECT id FROM users WHERE phone = ?').get(phone) : null;
    const dupEmail = email ? db.prepare('SELECT id FROM users WHERE email = ?').get(email) : null;
    if (dupPhone || dupEmail) {
      sendError(res, 409, 'ACCOUNT_EXISTS', 'An account with this phone/email already exists. Please sign in.');
      return true;
    }

    const { userId, setCookie } = auth.createUserWithSession(db, {
      shopName,
      fullName: String(body.fullName || '').trim(),
      phone,
      email,
      password
    });
    require('../services/privacyService').savePermissions(db, userId, {ai:false,voice:false});
    db.exec('CREATE TABLE IF NOT EXISTS registration_consents (user_id TEXT PRIMARY KEY REFERENCES users(id), version TEXT NOT NULL, accepted_at TEXT NOT NULL)');
    db.prepare('INSERT INTO registration_consents VALUES (?,?,?)').run(userId,require('../services/privacyService').VERSION,new Date().toISOString());
    securityLog('USER_REGISTERED', { userId });
    sendJson(res, 201, {
      success: true,
      data: { user: auth.getUserById(db, userId) },
      message: `Welcome to Hisab, ${shopName}! Your secure workspace is ready.`
    }, { 'Set-Cookie': setCookie });
    return true;
  }

  // POST /api/auth/login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    if (!guardMutation(req, res, 'auth', 10)) return true;
    const body = await parseBody(req);
    const identifier = String(body.identifier || body.phone || body.email || '').trim();
    const password = String(body.password || '');
    if (!identifier || !password) {
      sendError(res, 400, 'MISSING_FIELDS', 'Please enter your phone/email and password.');
      return true;
    }

    const row = db.prepare('SELECT * FROM users WHERE phone = ? OR email = ?').get(identifier, identifier.toLowerCase());
    if (!row || !auth.verifyPassword(password, row.password_salt, row.password_hash)) {
      securityLog('LOGIN_FAILED', { ip: getClientIp(req), identifierHint: identifier.slice(0, 3) + '***' });
      sendError(res, 401, 'INVALID_CREDENTIALS', 'Incorrect phone/email or password.');
      return true;
    }

    const { setCookie } = auth.createSession(db, row.id);
    securityLog('LOGIN_SUCCESS', { userId: row.id });
    sendJson(res, 200, {
      success: true,
      data: { user: auth.getUserById(db, row.id) },
      message: `Welcome back, ${row.shop_name}!`
    }, { 'Set-Cookie': setCookie });
    return true;
  }

  // POST /api/auth/logout
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    auth.revokeSession(db, req);
    sendJson(res, 200, { success: true, message: 'Workspace locked. You have been signed out.' }, { 'Set-Cookie': 'hisab_session_id=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0' });
    return true;
  }

  // GET /api/auth/me
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = auth.getSessionUser(db, req);
    if (!user) {
      sendError(res, 401, 'UNAUTHORIZED', 'No active session.');
      return true;
    }
    sendJson(res, 200, { success: true, data: { user } });
    return true;
  }

  return false;
}

module.exports = { handleAuthRoutes };
