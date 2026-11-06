const crypto = require('node:crypto');

async function handleClearRecordsRoutes(req, res, pathname, _params, context) {
  const match = pathname.match(/^\/api\/records\/(transactions|customers)\/(clear|restore|backup)$/);
  if (!match) return false;
  const { db, helpers } = context;
  const { requireAuth, guardMutation, sendJson, sendError } = helpers;
  const [, resource, action] = match;
  if ((action === 'backup' && req.method !== 'GET') || (action !== 'backup' && req.method !== 'POST')) return false;
  if (action !== 'backup' && !guardMutation(req, res, 'clear-records', 15)) return true;
  const user = requireAuth(req, res);
  if (!user) return true;
  db.exec('CREATE TABLE IF NOT EXISTS cleared_records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, resource TEXT NOT NULL, records TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id, resource))');
  const saved = db.prepare('SELECT * FROM cleared_records WHERE user_id = ? AND resource = ?').get(user.id, resource);
  if (action === 'backup') {
    sendJson(res, 200, { success: true, data: { canUndo: !!saved } }); return true;
  }
  if (action === 'clear' && saved) {
    sendError(res, 409, 'UNDO_PENDING', 'Restore the previous cleared records before clearing again.'); return true;
  }
  if (action === 'restore' && !saved) {
    sendError(res, 404, 'NO_BACKUP', 'There are no cleared records to restore.'); return true;
  }
  db.exec('BEGIN');
  try {
    if (action === 'clear') {
      const records = { [resource]: db.prepare(`SELECT * FROM ${resource} WHERE user_id = ?`).all(user.id) };
      if (resource === 'customers') {
        records.credits = db.prepare('SELECT * FROM credits WHERE user_id = ? AND customer_id IN (SELECT id FROM customers WHERE user_id = ?)').all(user.id, user.id);
      }
      if (records[resource].length) {
        db.prepare('INSERT INTO cleared_records VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), user.id, resource, JSON.stringify(records), new Date().toISOString());
        if (resource === 'customers') db.prepare('DELETE FROM credits WHERE user_id = ? AND customer_id IN (SELECT id FROM customers WHERE user_id = ?)').run(user.id, user.id);
        db.prepare(`DELETE FROM ${resource} WHERE user_id = ?`).run(user.id);
      }
      db.exec('COMMIT');
      sendJson(res, 200, { success: true, data: { count: records[resource].length, canUndo: records[resource].length > 0 } });
    } else {
      const records = JSON.parse(saved.records);
      // Restore customers before their credit records; collisions roll back the whole restore.
      for (const table of resource === 'customers' ? ['customers', 'credits'] : ['transactions']) {
        for (const row of records[table] || []) {
          const columns = Object.keys(row);
          db.prepare(`INSERT INTO ${table} (${columns.map(c => '"' + c + '"').join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...columns.map(c => row[c]));
        }
      }
      db.prepare('DELETE FROM cleared_records WHERE id = ? AND user_id = ?').run(saved.id, user.id);
      db.exec('COMMIT');
      sendJson(res, 200, { success: true, data: { canUndo: false } });
    }
  } catch (error) {
    db.exec('ROLLBACK');
    sendError(res, 409, 'CLEAR_RESTORE_FAILED', 'Could not complete this action. Your records and backup were kept.');
  }
  return true;
}
module.exports = { handleClearRecordsRoutes };
