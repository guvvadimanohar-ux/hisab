const VERSION = '2026-10-05';
const TABLES = ['shop_tool_state','shop_access','cash_closings','payments','credits','transactions','customers','sync_jobs','payment_orders','bank_accounts','consents','datasets','shop_profiles','cleared_records','assistant_actions','privacy_consents','registration_consents'];
function initializePrivacy(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS privacy_consents (user_id TEXT PRIMARY KEY REFERENCES users(id), version TEXT NOT NULL, ai INTEGER NOT NULL DEFAULT 0, voice INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`);
}
function permissions(db, userId) {
  initializePrivacy(db);
  const row = db.prepare('SELECT version,ai,voice,updated_at FROM privacy_consents WHERE user_id=?').get(userId);
  return {version:VERSION,ai:row?.version===VERSION && !!row.ai,voice:row?.version===VERSION && !!row.voice,updatedAt:row?.updated_at || null};
}
function savePermissions(db, userId, {ai,voice}) {
  initializePrivacy(db);
  db.prepare('INSERT INTO privacy_consents VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,ai=excluded.ai,voice=excluded.voice,updated_at=excluded.updated_at').run(userId,VERSION,ai?1:0,voice?1:0,new Date().toISOString());
  return permissions(db,userId);
}
function ownedTables(db) {
  return TABLES.filter(table => db.prepare(`PRAGMA table_info(${table})`).all().some(col=>col.name==='user_id'));
}
function exportAccount(db,userId) {
  const profile = db.prepare('SELECT id,shop_name,full_name,phone,email,created_at,updated_at FROM users WHERE id=?').get(userId);
  const data={profile};
  for(const table of ownedTables(db)) data[table]=db.prepare(`SELECT * FROM ${table} WHERE user_id=?`).all(userId);
  data.shops=db.prepare('SELECT * FROM shops WHERE owner_id=?').all(userId);
  data.ai_conversations=db.prepare('SELECT * FROM ai_conversations WHERE user_id=?').all(userId);
  data.ai_messages=db.prepare('SELECT * FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id=?)').all(userId);
  return {exportedAt:new Date().toISOString(),data};
}
function eraseAccount(db,userId) {
  // External bank consent must be revoked through the existing disconnect flow first.
  if(db.prepare("SELECT id FROM bank_accounts WHERE user_id=? AND status='ACTIVE'").get(userId)) throw new Error('Disconnect your bank accounts before deleting your account.');
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id=?)').run(userId);
    db.prepare('DELETE FROM ai_conversations WHERE user_id=?').run(userId);
    for(const table of ownedTables(db)) db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(userId);
    db.prepare('DELETE FROM shops WHERE owner_id=?').run(userId);
    db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM users WHERE id=?').run(userId);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
module.exports={VERSION,permissions,savePermissions,exportAccount,eraseAccount};
