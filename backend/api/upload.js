/**
 * CSV Upload, Audit & Statement Ingestion API Routes
 * Handles file parsing, column auto-detection, pre-import data audits, and SQLite ingestion.
 */

const {
  detectColumnMappings,
  parseCsvString,
  normalizeTransactions
} = require('../services/analytics.js');

async function handleUploadRoutes(req, res, pathname, searchParams, context) {
  const { db, helpers } = context;
  const { sendJson, sendError, requireAuth, guardMutation, parseBody, securityLog } = helpers;

  // POST /api/upload -> Validate CSV, extract headers, auto-detect mappings & preview
  if (pathname === '/api/upload' && req.method === 'POST') {
    if (!guardMutation(req, res, 'csv', 20)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const body = await parseBody(req);
    const csvText = body.csvText || body.raw;
    if (!csvText) {
      sendError(res, 400, 'EMPTY_CSV', 'No CSV content provided in request.');
      return true;
    }

    const { headers, rows } = parseCsvString(csvText);
    if (headers.length === 0) {
      sendError(res, 400, 'INVALID_CSV', 'CSV file contains no readable columns.');
      return true;
    }

    const detectedMapping = detectColumnMappings(headers);
    const previewRows = rows.slice(0, 5);

    sendJson(res, 200, {
      success: true,
      data: { headers, detectedMapping, totalRows: rows.length, previewRows },
      message: 'CSV structure analyzed and column mappings suggested.'
    });
    return true;
  }

  // POST /api/audit -> Dry-run normalization for pre-import data quality report
  if (pathname === '/api/audit' && req.method === 'POST') {
    if (!guardMutation(req, res, 'csv', 20)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const body = await parseBody(req);
    const { csvText, mapping, datasetName = 'Merchant Statement' } = body;
    if (!csvText || !mapping) {
      sendError(res, 400, 'MISSING_FIELDS', 'Both csvText and mapping are required for audit.');
      return true;
    }

    const { rows } = parseCsvString(csvText);
    if (rows.length === 0) {
      sendError(res, 400, 'EMPTY_ROWS', 'No transaction rows found in CSV.');
      return true;
    }

    const { normalized, qualityReport } = normalizeTransactions(rows, mapping, 'PREVIEW', datasetName);
    sendJson(res, 200, {
      success: true,
      data: { qualityReport, sampleCount: normalized.length, previewTransactions: normalized.slice(0, 5) }
    });
    return true;
  }

  // POST /api/import -> Accepts user-confirmed mappings, normalizes, writes to SQLite
  if (pathname === '/api/import' && req.method === 'POST') {
    if (!guardMutation(req, res, 'csv', 10)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const body = await parseBody(req);
    const { csvText, mapping, datasetName = 'Imported Statement' } = body;
    if (!csvText || !mapping) {
      sendError(res, 400, 'MISSING_FIELDS', 'Both csvText and mapping are required for import.');
      return true;
    }

    const { rows } = parseCsvString(csvText);
    if (rows.length === 0) {
      sendError(res, 400, 'EMPTY_ROWS', 'No transaction rows found in CSV.');
      return true;
    }

    const datasetId = `DS-${Date.now()}`;
    const { normalized, qualityReport } = normalizeTransactions(rows, mapping, datasetId, datasetName);
    if (normalized.length === 0) {
      sendJson(res, 400, {
        success: false,
        error: { code: 'ZERO_VALID_ROWS', message: 'Could not normalize any valid transactions from the mapped columns.' },
        qualityReport
      });
      return true;
    }

    let totalInflow = 0;
    let totalOutflow = 0;
    let minDate = normalized[0].date;
    let maxDate = normalized[0].date;

    normalized.forEach(t => {
      if (t.cash_flow_type === 'INFLOW') totalInflow += t.amount;
      else totalOutflow += t.amount;
      if (t.date < minDate) minDate = t.date;
      if (t.date > maxDate) maxDate = t.date;
    });

    db.prepare(`
      INSERT INTO datasets (id, user_id, name, uploaded_at, row_count, date_start, date_end, total_inflow, total_outflow, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(datasetId, user.id, datasetName, new Date().toISOString(), normalized.length, minDate, maxDate, totalInflow, totalOutflow, 'Active');

    const insertTxn = db.prepare(`
      INSERT INTO transactions (
        id, user_id, dataset_id, date, time, customer_id, customer_name,
        description, amount, transaction_type, cash_flow_type,
        payment_method, category, reference_number, loan_id,
        status, balance, is_duplicate, created_at,
        mode, source, merchant, narration
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of normalized) {
      const isUpi = (t.payment_method || '').toUpperCase().includes('UPI') || (t.description || '').toUpperCase().includes('UPI');
      insertTxn.run(
        t.id, user.id, t.dataset_id, t.date, t.time, t.customer_id, t.customer_name,
        t.description, t.amount, t.transaction_type, t.cash_flow_type,
        t.payment_method, t.category, t.reference_number, t.loan_id,
        t.status, t.balance, t.is_duplicate ? 1 : 0, t.created_at,
        isUpi ? 'UPI' : 'OTHER', 'CSV', t.customer_name, t.description
      );
    }

    securityLog('CSV_IMPORTED', { userId: user.id, datasetId, rows: normalized.length });

    sendJson(res, 200, {
      success: true,
      data: {
        datasetId,
        datasetName,
        qualityReport,
        insertedCount: normalized.length,
        totalInflow,
        totalOutflow,
        dateRange: `${minDate} to ${maxDate}`
      },
      message: `Successfully imported ${normalized.length} transactions into Hisab.`
    });
    return true;
  }

  return false;
}

module.exports = { handleUploadRoutes };
