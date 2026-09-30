/**
 * Authentication & Session API Routes
 * Handles user registration, login, logout, and current session introspection.
 */

async function handleAuthRoutes(req, res, pathname, searchParams, context) {
  const { db, auth, helpers } = context;
  const { sendJson, sendError, guardMutation, parseBody, getClientIp, securityLog } = helpers;

  // POST /api/auth/register
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    if (!guardMutation(req, res, 'auth', 10)) return true;
    const body = await parseBody(req);
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
    sendJson(res, 200, { success: true, message: 'Workspace locked. You have been signed out.' });
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
