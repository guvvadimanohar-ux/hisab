/**
 * Financial & UPI Analytics API Routes
 * Computes dashboard KPIs, cash-flow trends, spending breakdowns, and UPI merchant analytics.
 */

const { queryTransactions } = require('../services/database.js');
const analyticsEngine = require('../services/analyticsEngine.js');
const {
  calculateDashboardKPIs,
  calculateCashFlowTrends,
  calculateCustomerAnalytics,
  calculateLoanAnalytics,
  generateFinancialInsights
} = require('../services/analytics.js');

async function handleAnalyticsRoutes(req, res, pathname, searchParams, context) {
  const { db, helpers } = context;
  const { sendJson, requireAuth } = helpers;

  // GET /api/analytics/:dimension
  const analyticsDimension = pathname.match(/^\/api\/analytics\/(summary|spending|income|cashflow|categories|merchants|upi)$/);
  if (analyticsDimension && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const dimension = analyticsDimension[1];

    const filter = {
      dataset_id: searchParams.get('dataset_id') || undefined,
      date_start: searchParams.get('date_start') || undefined,
      date_end: searchParams.get('date_end') || undefined,
      category: searchParams.get('category') || undefined,
      mode: dimension === 'upi' ? 'UPI' : (searchParams.get('mode') || undefined),
      source: searchParams.get('source') || undefined,
      bank_account_id: searchParams.get('bank_account_id') || undefined,
      search: searchParams.get('search') || undefined,
      min_amount: searchParams.get('min_amount') || undefined,
      max_amount: searchParams.get('max_amount') || undefined
    };
    const txns = queryTransactions(db, user.id, filter);
    const payload = analyticsEngine.buildAnalyticsPayload(txns, { dimension });

    if (dimension === 'spending') {
      sendJson(res, 200, { success: true, data: { summary: payload.summary, topSpendingCategory: payload.topSpendingCategory, categories: payload.categories, monthly: payload.monthly } });
      return true;
    }
    if (dimension === 'income') {
      const incomeTxns = txns.filter(t => t.cash_flow_type === 'INFLOW');
      const byCategory = analyticsEngine.getCategoryBreakdown(incomeTxns);
      sendJson(res, 200, { success: true, data: { summary: payload.summary, incomeCategories: byCategory, monthly: payload.monthly } });
      return true;
    }
    if (dimension === 'cashflow') {
      sendJson(res, 200, { success: true, data: { summary: payload.summary, monthly: payload.monthly } });
      return true;
    }
    if (dimension === 'categories') {
      sendJson(res, 200, { success: true, data: { categories: payload.categories, topSpendingCategory: payload.topSpendingCategory } });
      return true;
    }
    if (dimension === 'merchants') {
      sendJson(res, 200, { success: true, data: payload.merchants });
      return true;
    }
    // dimension === 'upi'
    sendJson(res, 200, {
      success: true,
      data: {
        ...payload.upi,
        topMerchants: payload.merchants.topBySpend.map(m => ({ name: m.name, totalAmount: m.totalPaid, count: m.count })),
        topCategories: payload.categories.slice(0, 8),
        recentUpiTransactions: txns.slice(0, 10)
      }
    });
    return true;
  }

  // GET /api/analytics/upi -> Comprehensive UPI Analytics Engine
  if (pathname === '/api/analytics/upi' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const upiTxns = queryTransactions(db, user.id, { mode: 'UPI' });
    const payload = analyticsEngine.getUPISummary(upiTxns);

    const merchantMap = new Map();
    const categoryMap = new Map();

    for (const t of upiTxns) {
      if (t.cash_flow_type !== 'OUTFLOW') continue;
      const mKey = t.merchant || t.customer_name || 'Other';
      const m = merchantMap.get(mKey) || { name: mKey, totalAmount: 0, count: 0, category: t.category };
      m.totalAmount += Number(t.amount || 0);
      m.count += 1;
      merchantMap.set(mKey, m);

      const cKey = t.category || 'Other';
      const c = categoryMap.get(cKey) || { category: cKey, totalAmount: 0, count: 0 };
      c.totalAmount += Number(t.amount || 0);
      c.count += 1;
      categoryMap.set(cKey, c);
    }

    sendJson(res, 200, {
      success: true,
      data: {
        ...payload,
        topMerchants: Array.from(merchantMap.values()).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10),
        topCategories: Array.from(categoryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 8),
        recentUpiTransactions: upiTxns.slice(0, 10)
      }
    });
    return true;
  }

  // GET /api/dashboard -> Primary KPIs, trends, customer leaders, and AI insights
  if (pathname === '/api/dashboard' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;

    const filter = {
      dataset_id: searchParams.get('dataset_id') || undefined,
      date_start: searchParams.get('date_start') || undefined,
      date_end: searchParams.get('date_end') || undefined,
      customer: searchParams.get('customer') || undefined,
      flow: searchParams.get('flow') || undefined,
      type: searchParams.get('type') || undefined,
      category: searchParams.get('category') || undefined,
      payment_method: searchParams.get('payment_method') || undefined,
      mode: searchParams.get('mode') || undefined,
      source: searchParams.get('source') || undefined,
      search: searchParams.get('search') || undefined,
      min_amount: searchParams.get('min_amount') || undefined,
      max_amount: searchParams.get('max_amount') || undefined,
      merchant: searchParams.get('merchant') || undefined
    };

    const transactions = queryTransactions(db, user.id, filter);
    const kpis = calculateDashboardKPIs(transactions);
    const cashflow = calculateCashFlowTrends(transactions, searchParams.get('granularity') || 'monthly');
    const customers = calculateCustomerAnalytics(transactions);
    const loans = calculateLoanAnalytics(transactions);
    const insights = generateFinancialInsights(kpis, cashflow, customers, loans);

    sendJson(res, 200, {
      success: true,
      data: {
        kpis,
        cashflow,
        topCustomers: customers.topPayingCustomers.slice(0, 5),
        mostFrequentCustomers: customers.mostFrequentCustomers.slice(0, 5),
        repeatedCustomers: customers.repeatedCustomers.slice(0, 5),
        loansSummary: {
          totalLoansGiven: loans.totalLoansGiven,
          totalRepaid: loans.totalRepaid,
          totalOutstanding: loans.totalOutstanding,
          hasLoanData: loans.hasLoanData,
          activeCount: loans.loans.filter(l => l.status === 'ACTIVE').length
        },
        insights,
        transactionCount: transactions.length
      }
    });
    return true;
  }

  // GET /api/cash-flow -> Granular Cash Flow Aggregations
  if (pathname === '/api/cash-flow' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const granularity = searchParams.get('granularity') || 'monthly';
    const transactions = queryTransactions(db, user.id, {
      dataset_id: searchParams.get('dataset_id') || undefined,
      date_start: searchParams.get('date_start') || undefined,
      date_end: searchParams.get('date_end') || undefined
    });
    const trends = calculateCashFlowTrends(transactions, granularity);
    sendJson(res, 200, { success: true, data: trends });
    return true;
  }

  return false;
}

module.exports = { handleAnalyticsRoutes };
