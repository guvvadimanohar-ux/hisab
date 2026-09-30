/**
 * Master API Router Dispatcher
 * Dispatches `/api/*` endpoints to modular domain handlers.
 */

const { handleHealthRoutes } = require('./health.js');
const { handleAuthRoutes } = require('./auth.js');
const { handleCustomerRoutes } = require('./customers.js');
const { handleCreditRoutes } = require('./credit.js');
const { handleTransactionRoutes } = require('./transactions.js');
const { handleAnalyticsRoutes } = require('./analytics.js');
const { handlePaymentRoutes } = require('./payments.js');
const { handleBankRoutes } = require('./bank.js');
const { handleUploadRoutes } = require('./upload.js');
const { handleAiRoutes } = require('./ai.js');
const { handleVoiceRoutes } = require('./voice.js');

async function handleApiRequest(req, res, parsedUrl, context) {
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  if (!pathname.startsWith('/api')) {
    return false;
  }

  // 1. Health check routes
  if (await handleHealthRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 2. Auth routes
  if (await handleAuthRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 3. Customer management routes
  if (await handleCustomerRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 4. Credit / Uddera / Loan routes
  if (await handleCreditRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 5. Payment Gateway routes
  if (await handlePaymentRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 6. Voice Assistant routes (STT, query, TTS)
  if (await handleVoiceRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 7. AI query routes
  if (await handleAiRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 8. Account Aggregator & Bank routes
  if (await handleBankRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 9. Analytics routes (KPIs, Cash Flow, Spending, UPI)
  if (await handleAnalyticsRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 10. Transactions, Loans & Datasets
  if (await handleTransactionRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // 11. Statement upload & CSV Ingestion routes
  if (await handleUploadRoutes(req, res, pathname, searchParams, context)) {
    return true;
  }

  // Unhandled /api route
  context.helpers.sendError(res, 404, 'ENDPOINT_NOT_FOUND', `API endpoint not found: ${req.method} ${pathname}`);
  return true;
}

module.exports = { handleApiRequest };
