/**
 * Hisab Financial Analytics Backend Server
 * Native Node.js HTTP Server + Built-in node:sqlite Database
 * Serves web frontend assets & provides comprehensive REST APIs.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// .env loader (zero-dependency). Loads once at boot; real env vars win.
// ---------------------------------------------------------------------------
(function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch { /* .env optional */ }
})();

const { initializeDatabase } = require('./services/database.js');
const AccountAggregatorService = require('./services/accountAggregator.js');
const PaymentService = require('./services/paymentService.js');
const VoiceService = require('./services/voiceService.js');
const auth = require('./services/authService.js');
const AIAgentService = require('./services/aiAgent.js');
const { handleApiRequest } = require('./api/index.js');

const PORT = parseInt(process.env.PORT, 10) > 0 ? parseInt(process.env.PORT, 10) : 8099;
const IS_MOCK_MODE = String(process.env.AA_MOCK_MODE ?? 'true').toLowerCase() !== 'false';
const AA_ENVIRONMENT = (process.env.AA_ENVIRONMENT || 'sandbox').toLowerCase();
const PAYMENT_GATEWAY = process.env.PAYMENT_GATEWAY || 'mock';
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');

const db = initializeDatabase();
const aaService = new AccountAggregatorService();
const paymentService = new PaymentService({ gateway: PAYMENT_GATEWAY });
const aiService = new AIAgentService({ db });
const voiceService = new VoiceService();

// =============================================================================
// 1. HTTP Helpers & Security
// =============================================================================

function getClientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function parseBody(req, { raw = false } = {}) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Payload too large (Max 25MB)'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (raw) return resolve(body);
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, code, message, extraHeaders = {}) {
  return sendJson(res, statusCode, { success: false, error: { code, message } }, extraHeaders);
}

/**
 * Resolves authenticated user. In non-production testing, optionally provides
 * a demo context if allowDemo is requested.
 */
function requireAuth(req, res, { allowDemo = false } = {}) {
  const user = auth.getSessionUser(db, req);
  if (user) return user;

  // In test or non-production environment, allow demo fallback if explicitly enabled
  const isDevOrTest = process.env.NODE_ENV !== 'production';
  if (allowDemo && isDevOrTest) {
    return { id: 'demo-user', shopName: 'Demo Store', fullName: 'Demo User' };
  }

  sendError(res, 401, 'UNAUTHORIZED', 'Please sign in to continue.');
  return null;
}

function guardMutation(req, res, bucketKey, maxPerMinute) {
  if (process.env.NODE_ENV !== 'test' && !auth.isSameOrigin(req)) {
    sendError(res, 403, 'CSRF_CHECK_FAILED', 'Request origin could not be verified.');
    return false;
  }
  const rl = auth.rateLimit(`${getClientIp(req)}:${bucketKey}`, maxPerMinute);
  if (!rl.allowed) {
    sendError(res, 429, 'RATE_LIMITED', `Too many requests. Try again in ${rl.retryAfterSec}s.`, { 'Retry-After': String(rl.retryAfterSec) });
    return false;
  }
  return true;
}

function securityLog(event, details = {}) {
  console.log(`[SECURITY] ${new Date().toISOString()} ${event}`, JSON.stringify(details));
}

// Context passed into API router
const apiContext = {
  db,
  aaService,
  paymentService,
  voiceService,
  aiService,
  auth,
  AA_ENVIRONMENT,
  IS_MOCK_MODE,
  PAYMENT_GATEWAY,
  helpers: {
    sendJson,
    sendError,
    requireAuth,
    guardMutation,
    parseBody,
    getClientIp,
    securityLog
  }
};

// =============================================================================
// 2. HTTP Server & Routing
// =============================================================================

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  const pathname = parsedUrl.pathname;

  try {
    // ---------------------------------------------------------------------
    // API Dispatcher
    // ---------------------------------------------------------------------
    if (pathname.startsWith('/api')) {
      const handled = await handleApiRequest(req, res, parsedUrl, apiContext);
      if (handled) return;
    }

    // ---------------------------------------------------------------------
    // Static Frontend Serving
    // ---------------------------------------------------------------------
    const requestedFile = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    let filePath = path.resolve(FRONTEND_DIR, requestedFile);

    // Prevent directory traversal
    if (!filePath.startsWith(FRONTEND_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end(`404 Not Found: ${pathname}`);
      }

      const ext = path.extname(filePath).toLowerCase();
      const MIME_TYPES = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.csv': 'text/csv; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain; charset=utf-8'
      };
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  } catch (err) {
    console.error('[Hisab Server Error]', pathname, err);
    if (!res.headersSent) {
      sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
    }
  }
});

function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[Hisab Server] Running at http://localhost:${port}`);
      console.log(`[Hisab AA] provider=${aaService.providerName} mockMode=${aaService.isMockMode()} environment=${AA_ENVIRONMENT}`);
      if (AA_ENVIRONMENT === 'production' && aaService.isMockMode()) {
        console.warn('[Hisab AA] WARNING: AA_ENVIRONMENT=production but AA_MOCK_MODE is enabled. Data will be DEMO DATA.');
      }
      console.log(`[Hisab Payments] provider=${paymentService.getProviderName()} mockMode=${paymentService.isMockMode()}`);
      if (PAYMENT_GATEWAY !== 'mock' && paymentService.isMockMode()) {
        console.warn('[Hisab Payments] WARNING: PAYMENT_GATEWAY set to production but isMockMode is enabled. Payments will be DEMO DATA.');
      }
      resolve(server);
    });
  });
}

// Auto-start if run directly
if (require.main === module) {
  startServer(PORT);
}

module.exports = { server, startServer, db, aaService, paymentService, aiService, voiceService };
