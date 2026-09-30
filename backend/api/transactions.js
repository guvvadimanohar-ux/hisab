/**
 * Transactions, Customers, Loans & Datasets API Routes
 * Handles querying, pagination, filtering, customer statements, loan summaries, and CSV exports.
 */

const { queryTransactions } = require('../services/database.js');
const { calculateCustomerAnalytics, calculateLoanAnalytics } = require('../services/analytics.js');
const { recordTransaction } = require('../services/transactionEngine.js');

async function handleTransactionRoutes(req, res, pathname, searchParams, context) {
  const { db, helpers } = context;
  const { sendJson, sendError, requireAuth, guardMutation } = helpers;

  // GET /api/customers -> Full Customer Analytics Directory
  if (pathname === '/api/customers' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const transactions = queryTransactions(db, user.id, {
      dataset_id: searchParams.get('dataset_id') || undefined,
      customer: searchParams.get('search') || undefined
    });
    const analytics = calculateCustomerAnalytics(transactions);
    sendJson(res, 200, { success: true, data: analytics });
    return true;
  }

  // GET /api/customers/:name -> Customer Lifetime Detail & Statement
  if (pathname.startsWith('/api/customers/') && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const customerName = decodeURIComponent(pathname.replace('/api/customers/', ''));
    const transactions = queryTransactions(db, user.id, { customer: customerName });
    const analytics = calculateCustomerAnalytics(transactions);
    const customerRecord = analytics.allCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase()) || {
      name: customerName,
      totalTransactions: 0,
      totalInflow: 0,
      totalOutflow: 0,
      netContribution: 0,
      transactions: []
    };
    sendJson(res, 200, { success: true, data: customerRecord });
    return true;
  }

  // GET /api/loans -> Loan Statements and Portfolio Overview
  if (pathname === '/api/loans' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const transactions = queryTransactions(db, user.id, {
      dataset_id: searchParams.get('dataset_id') || undefined
    });
    const loans = calculateLoanAnalytics(transactions);

    // Merge in credits table records
    const dbCredits = db.prepare(`
      SELECT cr.*, c.name as customer_name
      FROM credits cr
      LEFT JOIN customers c ON c.id = cr.customer_id
      WHERE cr.user_id = ?
    `).all(user.id);

    if (dbCredits.length > 0) {
      loans.hasLoanData = true;
      for (const cr of dbCredits) {
        if (!loans.loans.some(l => l.loan_id === cr.id)) {
          loans.loans.push({
            loan_id: cr.id,
            customer_name: cr.customer_name || 'Customer',
            sanction_date: cr.issued_at,
            principal: cr.amount,
            repaid: cr.paid_amount,
            outstanding: cr.outstanding_amount,
            status: cr.status === 'Paid' ? 'SETTLED' : 'ACTIVE',
            last_payment_date: cr.updated_at ? cr.updated_at.slice(0, 10) : cr.issued_at,
            transactions: []
          });
          loans.totalLoansGiven += cr.amount;
          loans.totalRepaid += cr.paid_amount;
          loans.totalOutstanding += cr.outstanding_amount;
        }
      }
    }

    sendJson(res, 200, { success: true, data: loans });
    return true;
  }

  // GET /api/transactions/upi -> UPI-only transaction feed (scoped)
  if (pathname === '/api/transactions/upi' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = (page - 1) * limit;

    const filter = {
      mode: 'UPI',
      date_start: searchParams.get('date_start') || undefined,
      date_end: searchParams.get('date_end') || undefined,
      min_amount: searchParams.get('min_amount') || undefined,
      max_amount: searchParams.get('max_amount') || undefined,
      search: searchParams.get('search') || undefined,
      bank_account_id: searchParams.get('bank_account_id') || undefined
    };
    const all = queryTransactions(db, user.id, filter);
    sendJson(res, 200, {
      success: true,
      data: { transactions: all.slice(offset, offset + limit), total: all.length, page, limit, totalPages: Math.ceil(all.length / limit) }
    });
    return true;
  }

  // GET /api/transactions -> Transaction Explorer (Paginated, Searchable, Sorted)
  if (pathname === '/api/transactions' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = (page - 1) * limit;

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

    const all = queryTransactions(db, user.id, filter);
    sendJson(res, 200, {
      success: true,
      data: {
        transactions: all.slice(offset, offset + limit),
        total: all.length,
        page,
        limit,
        totalPages: Math.ceil(all.length / limit)
      }
    });
    return true;
  }

  // POST /api/transactions -> Record manual transaction via Common Transaction Engine
  if (pathname === '/api/transactions' && req.method === 'POST') {
    if (!guardMutation(req, res, 'transactions', 30)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    try {
      const body = await parseBody(req);
      const result = recordTransaction(db, user.id, body);
      sendJson(res, 201, {
        success: true,
        data: result,
        message: 'Transaction recorded successfully.'
      });
    } catch (err) {
      sendError(res, 400, 'TRANSACTION_CREATION_FAILED', err.message);
    }
    return true;
  }

  // GET /api/transactions/:id -> Single transaction detail
  if (pathname.startsWith('/api/transactions/') && !pathname.includes('/upi') && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const txnId = decodeURIComponent(pathname.replace('/api/transactions/', ''));
    const txn = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(txnId, user.id);
    if (!txn) {
      sendError(res, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found.');
      return true;
    }
    sendJson(res, 200, { success: true, data: txn });
    return true;
  }

  // PUT /api/transactions/:id -> Update transaction
  if (pathname.startsWith('/api/transactions/') && !pathname.includes('/upi') && req.method === 'PUT') {
    if (!guardMutation(req, res, 'transactions', 20)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const txnId = decodeURIComponent(pathname.replace('/api/transactions/', ''));
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(txnId, user.id);
    if (!existing) {
      sendError(res, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found.');
      return true;
    }

    try {
      const body = await parseBody(req);
      const customerName = body.customerName || body.customer_name || existing.customer_name;
      const description = body.description || existing.description;
      const category = body.category || existing.category;
      const amount = body.amount !== undefined ? Math.abs(parseFloat(body.amount)) : existing.amount;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE transactions
        SET customer_name = ?, description = ?, category = ?, amount = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(customerName, description, category, amount, now, txnId, user.id);

      const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txnId);
      sendJson(res, 200, { success: true, data: updated, message: 'Transaction updated successfully.' });
    } catch (err) {
      sendError(res, 400, 'TRANSACTION_UPDATE_FAILED', err.message);
    }
    return true;
  }

  // DELETE /api/transactions/:id -> Delete transaction
  if (pathname.startsWith('/api/transactions/') && !pathname.includes('/upi') && req.method === 'DELETE') {
    if (!guardMutation(req, res, 'transactions', 15)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const txnId = decodeURIComponent(pathname.replace('/api/transactions/', ''));
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(txnId, user.id);
    if (!existing) {
      sendError(res, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found.');
      return true;
    }

    db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(txnId, user.id);
    sendJson(res, 200, { success: true, message: 'Transaction deleted successfully.' });
    return true;
  }

  // GET /api/datasets -> List of user's datasets
  if (pathname === '/api/datasets' && req.method === 'GET') {
    const user = requireAuth(req, res, { allowDemo: true });
    if (!user) return true;
    const datasets = db.prepare('SELECT id, name, uploaded_at, row_count, date_start, date_end, total_inflow, total_outflow, status FROM datasets WHERE user_id = ? OR user_id IS NULL ORDER BY uploaded_at DESC').all(user.id);
    sendJson(res, 200, { success: true, data: datasets });
    return true;
  }

  // DELETE /api/datasets/:id -> Safe Delete (scoped)
  if (pathname.startsWith('/api/datasets/') && req.method === 'DELETE') {
    if (!guardMutation(req, res, 'csv', 15)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;
    const datasetId = decodeURIComponent(pathname.replace('/api/datasets/', ''));
    const ds = db.prepare('SELECT id FROM datasets WHERE id = ? AND (user_id = ? OR user_id IS NULL)').get(datasetId, user.id);
    if (!ds) {
      sendError(res, 404, 'DATASET_NOT_FOUND', 'Dataset not found.');
      return true;
    }
    db.prepare('DELETE FROM transactions WHERE dataset_id = ?').run(datasetId);
    db.prepare('DELETE FROM datasets WHERE id = ?').run(datasetId);
    sendJson(res, 200, { success: true, message: `Dataset ${datasetId} removed successfully.` });
    return true;
  }

  // GET /api/export -> Export CSV (scoped)
  if (pathname === '/api/export' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const filter = {
      dataset_id: searchParams.get('dataset_id') || undefined,
      date_start: searchParams.get('date_start') || undefined,
      date_end: searchParams.get('date_end') || undefined,
      customer: searchParams.get('customer') || undefined,
      flow: searchParams.get('flow') || undefined,
      mode: searchParams.get('mode') || undefined,
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined
    };
    const transactions = queryTransactions(db, user.id, filter);
    const esc = v => String(v ?? '').replace(/"/g, '""');
    let csv = 'Date,Time,Transaction_ID,Customer,Description,Amount,Flow,Type,Payment_Method,Category,Reference,Status\n';
    transactions.forEach(t => {
      csv += `"${esc(t.date)}","${esc(t.time)}","${esc(t.id)}","${esc(t.customer_name)}","${esc(t.description)}",${Number(t.amount || 0)},"${t.cash_flow_type}","${t.transaction_type}","${esc(t.payment_method)}","${esc(t.category)}","${esc(t.reference_number)}","${t.status}"\n`;
    });

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="hisab_export_${new Date().toISOString().slice(0, 10)}.csv"`
    });
    res.end(csv);
    return true;
  }

  return false;
}

module.exports = { handleTransactionRoutes };
