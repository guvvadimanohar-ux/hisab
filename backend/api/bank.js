/**
 * Account Aggregator (AA) & Bank Integration API Routes
 * Handles bank connections, consent flows, webhooks, transaction sync, and disconnection.
 */

const crypto = require('node:crypto');
const { normalizeBankTransactions } = require('../services/bankNormalizer.js');
const { normalizeConsentStatus } = require('../services/accountAggregator.js');

async function handleBankRoutes(req, res, pathname, searchParams, context) {
  const { db, aaService, AA_ENVIRONMENT, helpers } = context;
  const { sendJson, sendError, requireAuth, guardMutation, parseBody, getClientIp, securityLog } = helpers;

  // GET /api/bank/banks -> Supported Indian banks for Account Aggregator
  if (pathname === '/api/bank/banks' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    sendJson(res, 200, {
      success: true,
      data: {
        banks: aaService.getSupportedBanks(),
        provider: aaService.providerName,
        isMock: aaService.isMockMode(),
        environment: AA_ENVIRONMENT
      }
    });
    return true;
  }

  // POST /api/bank/connect -> Initiate AA Consent and register Bank Account
  if (pathname === '/api/bank/connect' && req.method === 'POST') {
    if (!guardMutation(req, res, 'bank', 15)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const body = await parseBody(req);
    const bankId = (body.bankId || 'HDFC').toUpperCase();
    const phoneNumber = body.phoneNumber || user.phone || '';
    const customerVpa = body.customerVpa || '';

    const consentResult = await aaService.initiateConsent({
      bankId,
      phoneNumber,
      customerVpa,
      userId: user.id,
      purpose: 'Bank Statement Import & UPI Analytics for Hisab'
    });

    const nowIso = new Date().toISOString();
    const effectiveProvider = aaService.isMockMode() ? 'mock' : aaService.providerName;

    // Store Consent (scoped to user)
    db.prepare(`
      INSERT INTO consents (id, user_id, provider, consent_handle, phone_number, bank_id, status, consent_url, data_range_start, data_range_end, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      consentResult.consentId,
      user.id,
      effectiveProvider,
      consentResult.consentId,
      phoneNumber,
      bankId,
      consentResult.status || 'PENDING',
      consentResult.consentUrl || '',
      new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
      new Date().toISOString().slice(0, 10),
      nowIso,
      nowIso
    );

    const accountId = `ACC-${bankId}-${Date.now().toString().slice(-4)}-${crypto.randomBytes(2).toString('hex')}`;

    const isApproved = consentResult.status === 'ACTIVE';
    if (isApproved) {
      db.prepare(`
        INSERT INTO bank_accounts (id, user_id, consent_id, bank_name, account_number_masked, account_type, ifsc_prefix, provider, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        accountId,
        user.id,
        consentResult.consentId,
        consentResult.bankName || `${bankId} Bank`,
        consentResult.maskedAccount || '••4821',
        'SAVINGS',
        bankId,
        effectiveProvider,
        'ACTIVE',
        nowIso
      );
    }

    securityLog('BANK_CONNECT_INITIATED', { userId: user.id, bankId, consentStatus: consentResult.status, mock: aaService.isMockMode() });

    sendJson(res, 200, {
      success: true,
      data: {
        accountId: isApproved ? accountId : null,
        consentId: consentResult.consentId,
        bankName: consentResult.bankName,
        maskedAccount: consentResult.maskedAccount,
        status: consentResult.status,
        consentUrl: consentResult.consentUrl,
        isDemo: consentResult.isDemo ?? aaService.isMockMode()
      },
      message: isApproved
        ? 'Bank connection established via Account Aggregator.'
        : 'Consent request created. Approve it in your AA app to complete the connection.'
    });
    return true;
  }

  // GET /api/bank/callback -> Provider consent redirect landing
  if (pathname === '/api/bank/callback' && req.method === 'GET') {
    const consentId = searchParams.get('consentId');
    const status = searchParams.get('status');
    if (!consentId) {
      sendError(res, 400, 'MISSING_STATE', 'Callback is missing consent identification.');
      return true;
    }
    const consent = db.prepare('SELECT * FROM consents WHERE id = ?').get(consentId);
    if (!consent) {
      securityLog('CALLBACK_UNKNOWN_CONSENT', { consentId: consentId.slice(0, 12) + '***' });
      sendError(res, 404, 'UNKNOWN_CONSENT', 'No matching consent request found.');
      return true;
    }

    let newStatus = 'PENDING';
    if (status) {
      newStatus = normalizeConsentStatus(status);
    } else if (!aaService.isMockMode()) {
      try {
        const remote = await aaService.getConsentStatus(consentId);
        newStatus = remote.status || 'PENDING';
      } catch { newStatus = 'PENDING'; }
    }

    db.prepare('UPDATE consents SET status = ?, updated_at = ? WHERE id = ?')
      .run(newStatus, new Date().toISOString(), consentId);
    securityLog('CONSENT_CALLBACK', { consentId: consentId.slice(0, 12) + '***', status: newStatus });

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hisab - Consent ${newStatus}</title></head>
<body style="font-family:system-ui;padding:2rem;text-align:center">
<h2>Bank consent ${newStatus}</h2>
<p>You can now return to your Hisab dashboard.</p>
<a href="/" style="color:#137333">Go to Hisab →</a>
</body></html>`);
    return true;
  }

  // GET /api/bank/accounts -> List connected bank accounts with stats
  if (pathname === '/api/bank/accounts' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const accounts = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM transactions t WHERE t.bank_account_id = b.id) AS transaction_count,
        (SELECT COUNT(*) FROM transactions t WHERE t.bank_account_id = b.id AND t.mode = 'UPI') AS upi_count
      FROM bank_accounts b
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).all(user.id);
    sendJson(res, 200, { success: true, data: accounts });
    return true;
  }

  // GET /api/bank/accounts/:id -> Single account detail
  if (pathname.startsWith('/api/bank/accounts/') && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const accId = decodeURIComponent(pathname.replace('/api/bank/accounts/', ''));
    const acc = db.prepare('SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?').get(accId, user.id);
    if (!acc) {
      sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Bank account not found.');
      return true;
    }
    const consent = db.prepare('SELECT status, expires_at, created_at FROM consents WHERE id = ?').get(acc.consent_id) || null;
    sendJson(res, 200, { success: true, data: { ...acc, consent } });
    return true;
  }

  // GET /api/bank/consents -> List consents
  if (pathname === '/api/bank/consents' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;
    const consents = db.prepare('SELECT id, provider, bank_id, status, created_at, updated_at, data_range_start, data_range_end FROM consents WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
    sendJson(res, 200, { success: true, data: consents });
    return true;
  }

  // POST /api/bank/sync -> Incremental sync of bank transactions via AA
  if (pathname === '/api/bank/sync' && req.method === 'POST') {
    if (!guardMutation(req, res, 'bank', 15)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const body = await parseBody(req);
    const accountId = body.accountId;

    let accountsToSync = [];
    if (accountId) {
      const acc = db.prepare('SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?').get(accountId, user.id);
      if (!acc) {
        sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Bank account not found.');
        return true;
      }
      accountsToSync.push(acc);
    } else {
      accountsToSync = db.prepare("SELECT * FROM bank_accounts WHERE status = 'ACTIVE' AND user_id = ?").all(user.id);
    }

    if (accountsToSync.length === 0) {
      sendError(res, 400, 'NO_ACTIVE_ACCOUNTS', 'No active bank accounts found to sync. Connect a bank account first.');
      return true;
    }

    // Consent lifecycle gate
    for (const account of accountsToSync) {
      const consent = db.prepare('SELECT * FROM consents WHERE id = ?').get(account.consent_id);
      if (!consent) {
        sendError(res, 409, 'CONSENT_MISSING', 'Bank connection failed. Consent record missing - please reconnect.');
        return true;
      }
      if (consent.expires_at && new Date(consent.expires_at) < new Date() && consent.status === 'ACTIVE') {
        db.prepare('UPDATE consents SET status = ?, updated_at = ? WHERE id = ?').run('EXPIRED', new Date().toISOString(), consent.id);
      }
      const fresh = db.prepare('SELECT status FROM consents WHERE id = ?').get(consent.id);
      if (fresh.status !== 'ACTIVE') {
        const friendly = {
          PENDING: 'Consent is awaiting your approval in the AA app. Approve it, then sync again.',
          EXPIRED: 'Your consent needs to be renewed. Please reconnect the bank account.',
          REVOKED: 'Consent was revoked. Please reconnect the bank account to resume imports.',
          FAILED: 'Bank connection failed. Please try connecting again.'
        }[fresh.status] || 'Consent is not active. Please reconnect the bank account.';
        sendError(res, 409, `CONSENT_${fresh.status}`, friendly);
        return true;
      }
    }

    let totalInserted = 0;
    let totalDuplicates = 0;
    let totalUpi = 0;

    for (const account of accountsToSync) {
      const daysBack = parseInt(process.env.INITIAL_TRANSACTION_DAYS || '90', 10);
      const fromDate = account.last_synced_at
        ? new Date(account.last_synced_at).toISOString().slice(0, 10)
        : new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
      const toDate = new Date().toISOString().slice(0, 10);

      const fiData = await aaService.fetchBankTransactions(account.consent_id, { from: fromDate, to: toDate });

      const existingTxns = db.prepare('SELECT provider_transaction_id FROM transactions WHERE bank_account_id = ?').all(account.id);
      const existingSignatures = new Set(existingTxns.map(r => r.provider_transaction_id).filter(Boolean));

      const { normalized, duplicatesSkipped, upiCount } = normalizeBankTransactions(
        fiData.transactions || [],
        { provider: account.provider, accountId: account.id, bankName: account.bank_name },
        existingSignatures
      );

      if (normalized.length > 0) {
        const datasetId = `BANK-${account.id}`;
        const datasetName = `${account.bank_name} (${account.account_number_masked})${aaService.isMockMode() ? ' [DEMO DATA]' : ''}`;

        const existingDataset = db.prepare('SELECT id, row_count, total_inflow, total_outflow FROM datasets WHERE id = ?').get(datasetId);
        let newInflow = 0;
        let newOutflow = 0;
        let minDate = normalized[0].date;
        let maxDate = normalized[0].date;

        normalized.forEach(t => {
          if (t.cash_flow_type === 'INFLOW') newInflow += t.amount;
          else newOutflow += t.amount;
          if (t.date < minDate) minDate = t.date;
          if (t.date > maxDate) maxDate = t.date;
        });

        if (!existingDataset) {
          db.prepare(`
            INSERT INTO datasets (id, user_id, name, uploaded_at, row_count, date_start, date_end, total_inflow, total_outflow, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(datasetId, user.id, datasetName, new Date().toISOString(), normalized.length, minDate, maxDate, newInflow, newOutflow, 'Active');
        } else {
          db.prepare(`
            UPDATE datasets
            SET row_count = row_count + ?, total_inflow = total_inflow + ?, total_outflow = total_outflow + ?, uploaded_at = ?
            WHERE id = ?
          `).run(normalized.length, newInflow, newOutflow, new Date().toISOString(), datasetId);
        }

        const insertTxn = db.prepare(`
          INSERT INTO transactions (
            id, user_id, dataset_id, bank_account_id, provider_transaction_id,
            date, time, customer_id, customer_name, description, narration,
            merchant, amount, transaction_type, cash_flow_type, mode,
            payment_method, category, subcategory, reference_number,
            loan_id, status, balance, source, is_duplicate, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const t of normalized) {
          insertTxn.run(
            t.id, user.id, t.dataset_id, t.bank_account_id, t.provider_transaction_id,
            t.date, t.time, t.customer_id, t.customer_name, t.description, t.narration,
            t.merchant, t.amount, t.transaction_type, t.cash_flow_type, t.mode,
            t.payment_method, t.category, t.subcategory, t.reference_number,
            t.loan_id, t.status, t.balance, t.source, t.is_duplicate, t.created_at
          );
        }
      }

      db.prepare('UPDATE bank_accounts SET last_synced_at = ? WHERE id = ?').run(new Date().toISOString(), account.id);

      totalInserted += normalized.length;
      totalDuplicates += duplicatesSkipped;
      totalUpi += upiCount;
    }

    const msg = totalInserted > 0
      ? `Sync completed: ${totalInserted} new transactions imported (${totalUpi} UPI detected), ${totalDuplicates} duplicates skipped.`
      : "You're up to date. No new transactions found.";

    sendJson(res, 200, {
      success: true,
      data: {
        syncedAccounts: accountsToSync.length,
        insertedCount: totalInserted,
        duplicatesSkipped: totalDuplicates,
        upiCount: totalUpi
      },
      message: msg
    });
    return true;
  }

  // DELETE /api/bank/accounts/:id -> Disconnect + revoke consent
  if (pathname.startsWith('/api/bank/accounts/') && req.method === 'DELETE') {
    if (!guardMutation(req, res, 'bank', 15)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const accId = decodeURIComponent(pathname.replace('/api/bank/accounts/', ''));
    const acc = db.prepare('SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?').get(accId, user.id);
    if (!acc) {
      sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Bank account not found.');
      return true;
    }

    if (acc.consent_id) {
      try {
        await aaService.revokeConsent(acc.consent_id);
      } catch (e) {
        securityLog('CONSENT_REVOKE_FAILED', { consentId: acc.consent_id.slice(0, 12) + '***', error: e.message });
        sendError(res, 502, 'CONSENT_REVOKE_FAILED', 'The provider could not confirm consent withdrawal. Your connection was kept; retry or revoke consent directly with the provider.');
        return true;
      }
      db.prepare('UPDATE consents SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run('REVOKED', new Date().toISOString(), acc.consent_id, user.id);
    }

    db.prepare('DELETE FROM transactions WHERE bank_account_id = ?').run(accId);
    db.prepare('DELETE FROM datasets WHERE id = ?').run(`BANK-${accId}`);
    db.prepare('DELETE FROM bank_accounts WHERE id = ? AND user_id = ?').run(accId, user.id);

    securityLog('BANK_DISCONNECTED', { userId: user.id, accountId: accId });
    sendJson(res, 200, { success: true, message: `Bank account disconnected, consent revoked and synced transactions purged.` });
    return true;
  }

  // POST /api/bank/webhook -> AA Webhook Receiver
  if (pathname === '/api/bank/webhook' && req.method === 'POST') {
    const rawBody = await parseBody(req, { raw: true });
    const isValid = aaService.verifyWebhookSignature(req.headers, rawBody);
    if (!isValid) {
      securityLog('WEBHOOK_REJECTED', { ip: getClientIp(req), reason: 'invalid_signature' });
      sendError(res, 401, 'INVALID_SIGNATURE', 'Webhook signature verification failed.');
      return true;
    }
    if (aaService.isMockMode()) {
      securityLog('WEBHOOK_ACCEPTED_MOCK_MODE', { ip: getClientIp(req), note: 'signature bypass active because AA_MOCK_MODE=true' });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      sendError(res, 400, 'INVALID_PAYLOAD', 'Webhook payload is not valid JSON.');
      return true;
    }

    const eventId = String(event.id || event.eventId || crypto.createHash('sha256').update(rawBody).digest('hex'));
    const seen = db.prepare('SELECT processed_at FROM webhook_events WHERE id = ?').get(eventId);
    if (seen && seen.processed_at) {
      sendJson(res, 200, { success: true, processed: false, duplicate: true });
      return true;
    }
    if (!seen) {
      db.prepare('INSERT INTO webhook_events (id, provider, event_type, received_at, payload) VALUES (?, ?, ?, ?, ?)')
        .run(eventId, aaService.providerName, event.type || 'UNKNOWN', new Date().toISOString(), rawBody.slice(0, 4000));
    }

    if (event.type === 'CONSENT_STATUS_UPDATE' && event.consentId) {
      const status = normalizeConsentStatus(event.status);
      db.prepare('UPDATE consents SET status = ?, updated_at = ? WHERE id = ?')
        .run(status, new Date().toISOString(), event.consentId);
      securityLog('WEBHOOK_CONSENT_UPDATE', { consentId: event.consentId.slice(0, 12) + '***', status });
    }

    db.prepare('UPDATE webhook_events SET processed_at = ? WHERE id = ?').run(new Date().toISOString(), eventId);
    sendJson(res, 200, { success: true, processed: true });
    return true;
  }

  return false;
}

module.exports = { handleBankRoutes };
