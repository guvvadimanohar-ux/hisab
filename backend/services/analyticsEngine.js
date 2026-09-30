/**
 * Hisab Analytics Engine (AI-Ready Data Layer)
 * Structured, parameterised aggregates over transactions scoped to a single user.
 * The AI assistant should consume these functions instead of raw database access.
 */

/**
 * Cash-flow summary (money in / out / net) for an array of transaction rows.
 */
function getSummary(txns) {
  let totalIn = 0;
  let totalOut = 0;
  for (const t of txns) {
    const amt = Number(t.amount || 0);
    if (t.cash_flow_type === 'INFLOW') totalIn += amt;
    else totalOut += amt;
  }
  return {
    totalMoneyIn: Math.round(totalIn * 100) / 100,
    totalMoneyOut: Math.round(totalOut * 100) / 100,
    netCashFlow: Math.round((totalIn - totalOut) * 100) / 100,
    transactionCount: txns.length
  };
}

/**
 * UPI-specific aggregates: spend, receipts, averages, extremes.
 */
function getUPISummary(txns) {
  const upi = txns.filter(t => String(t.mode || '').toUpperCase() === 'UPI' || String(t.payment_method || '').toUpperCase().includes('UPI'));
  const outflows = upi.filter(t => t.cash_flow_type === 'OUTFLOW');
  const inflows = upi.filter(t => t.cash_flow_type === 'INFLOW');

  const sum = arr => arr.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalSpend = sum(outflows);
  const totalReceived = sum(inflows);

  let highestPayment = null;
  for (const t of outflows) {
    if (!highestPayment || Number(t.amount) > Number(highestPayment.amount)) {
      highestPayment = { amount: Number(t.amount), merchant: t.merchant || t.customer_name, date: t.date };
    }
  }
  let highestReceipt = null;
  for (const t of inflows) {
    if (!highestReceipt || Number(t.amount) > Number(highestReceipt.amount)) {
      highestReceipt = { amount: Number(t.amount), party: t.customer_name, date: t.date };
    }
  }

  return {
    totalTransactions: upi.length,
    totalSpend: Math.round(totalSpend * 100) / 100,
    totalReceived: Math.round(totalReceived * 100) / 100,
    netFlow: Math.round((totalReceived - totalSpend) * 100) / 100,
    paymentCount: outflows.length,
    receiptCount: inflows.length,
    averagePayment: outflows.length ? Math.round((totalSpend / outflows.length) * 100) / 100 : 0,
    averageReceipt: inflows.length ? Math.round((totalReceived / inflows.length) * 100) / 100 : 0,
    highestPayment: highestPayment || { amount: 0, merchant: 'None', date: null },
    highestReceipt: highestReceipt || { amount: 0, party: 'None', date: null }
  };
}

/**
 * Aggregates by category (spend-focused).
 */
function getCategoryBreakdown(txns) {
  const map = new Map();
  for (const t of txns) {
    const key = t.category || 'Other';
    const rec = map.get(key) || { category: key, totalAmount: 0, count: 0 };
    rec.totalAmount += Number(t.amount || 0);
    rec.count += 1;
    map.set(key, rec);
  }
  return Array.from(map.values())
    .map(r => ({ ...r, totalAmount: Math.round(r.totalAmount * 100) / 100 }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Aggregates by merchant / counterparty.
 */
function getMerchantBreakdown(txns) {
  const map = new Map();
  for (const t of txns) {
    const key = t.merchant || t.customer_name || 'Unknown';
    const isInflow = t.cash_flow_type === 'INFLOW';
    const rec = map.get(key) || { name: key, totalPaid: 0, totalReceived: 0, count: 0, category: t.category || 'Other' };
    if (isInflow) rec.totalReceived += Number(t.amount || 0);
    else rec.totalPaid += Number(t.amount || 0);
    rec.count += 1;
    map.set(key, rec);
  }
  return Array.from(map.values())
    .map(r => ({
      ...r,
      totalPaid: Math.round(r.totalPaid * 100) / 100,
      totalReceived: Math.round(r.totalReceived * 100) / 100
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid || b.count - a.count);
}

/**
 * Monthly cash-flow trend (YYYY-MM buckets).
 */
function getMonthlyTrend(txns) {
  const map = new Map();
  for (const t of txns) {
    const month = String(t.date || '').slice(0, 7);
    if (!month) continue;
    const rec = map.get(month) || { month, moneyIn: 0, moneyOut: 0, count: 0 };
    if (t.cash_flow_type === 'INFLOW') rec.moneyIn += Number(t.amount || 0);
    else rec.moneyOut += Number(t.amount || 0);
    rec.count += 1;
    map.set(month, rec);
  }
  return Array.from(map.values())
    .map(r => ({
      ...r,
      moneyIn: Math.round(r.moneyIn * 100) / 100,
      moneyOut: Math.round(r.moneyOut * 100) / 100,
      net: Math.round((r.moneyIn - r.moneyOut) * 100) / 100
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Top-level dashboard payload builder used by /api/analytics/* routes.
 */
function buildAnalyticsPayload(txns, { dimension } = {}) {
  const summary = getSummary(txns);
  const categories = getCategoryBreakdown(txns);
  const merchants = getMerchantBreakdown(txns);
  const monthly = getMonthlyTrend(txns);

  const payload = {
    summary,
    topSpendingCategory: categories[0] || null,
    categories,
    merchants: {
      topBySpend: merchants.slice(0, 10),
      mostFrequent: [...merchants].sort((a, b) => b.count - a.count).slice(0, 10)
    },
    monthly,
    generatedAt: new Date().toISOString()
  };

  if (dimension === 'upi') {
    payload.upi = getUPISummary(txns);
  }
  return payload;
}

module.exports = {
  getSummary,
  getUPISummary,
  getCategoryBreakdown,
  getMerchantBreakdown,
  getMonthlyTrend,
  buildAnalyticsPayload
};
