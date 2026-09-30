/**
 * Credit, Uddera & Loan Management REST API Controller
 * Enforces server-side financial calculations: outstanding = credit - repayments.
 */

const {
  issueCredit,
  recordRepayment,
  listCredits,
  getCreditSummary
} = require('../services/creditService.js');

async function handleCreditRoutes(req, res, pathname, searchParams, context) {
  const { db, helpers } = context;
  const { sendJson, sendError, requireAuth, guardMutation, parseBody } = helpers;

  // GET /api/credit/summary
  if (pathname === '/api/credit/summary' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const summary = getCreditSummary(db, user.id);
    sendJson(res, 200, { success: true, data: summary });
    return true;
  }

  // GET /api/credit/customer/:customerId
  if (pathname.startsWith('/api/credit/customer/') && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const customerId = decodeURIComponent(pathname.replace('/api/credit/customer/', ''));
    const credits = listCredits(db, user.id, { customerId });
    sendJson(res, 200, { success: true, data: credits });
    return true;
  }

  // GET /api/credit (list)
  if (pathname === '/api/credit' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;

    const customerId = searchParams.get('customerId') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 50;

    const result = listCredits(db, user.id, { customerId, status, page, limit });
    sendJson(res, 200, { success: true, data: result });
    return true;
  }

  // POST /api/credit (issue credit)
  if (pathname === '/api/credit' && req.method === 'POST') {
    if (!guardMutation(req, res, 'credit', 20)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    try {
      const body = await parseBody(req);
      const credit = issueCredit(db, user.id, body);
      sendJson(res, 201, {
        success: true,
        data: credit,
        message: `Credit of ₹${credit.amount.toLocaleString('en-IN')} issued to ${credit.customerName}.`
      });
    } catch (err) {
      sendError(res, 400, 'CREDIT_ISSUANCE_FAILED', err.message);
    }
    return true;
  }

  // POST /api/credit/repay (record repayment)
  if ((pathname === '/api/credit/repay' || pathname === '/api/credit/repayment') && req.method === 'POST') {
    if (!guardMutation(req, res, 'credit', 20)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    try {
      const body = await parseBody(req);
      const result = recordRepayment(db, user.id, body);
      sendJson(res, 200, {
        success: true,
        data: result,
        message: `Repayment of ₹${result.amountRepaid.toLocaleString('en-IN')} recorded successfully.`
      });
    } catch (err) {
      sendError(res, 400, 'REPAYMENT_FAILED', err.message);
    }
    return true;
  }

  return false;
}

module.exports = { handleCreditRoutes };
