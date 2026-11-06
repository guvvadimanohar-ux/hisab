const daily = require('../../frontend/js/dailyWorkflow');
function initialize(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS cash_closings (user_id TEXT NOT NULL, date TEXT NOT NULL, opening REAL NOT NULL, received REAL NOT NULL, paid REAL NOT NULL, expected REAL NOT NULL, counted REAL NOT NULL, difference REAL NOT NULL, note TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,date))`);
}
async function handleDailyRoutes(req,res,pathname,params,context) {
  if (!['/api/daily/actions','/api/daily/closing'].includes(pathname)) return false;
  const {db,helpers:h} = context;
  if (!['GET','POST'].includes(req.method) || (pathname.endsWith('actions') && req.method !== 'GET')) return false;
  if (req.method === 'POST' && !h.guardMutation(req,res,'cash-closing',20)) return true;
  const user = h.requireAuth(req,res); if (!user) return true;
  initialize(db);
  try {
    const body = req.method === 'POST' ? await h.parseBody(req) : {};
    const date = body.date || params.get('date') || daily.day();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date || date > daily.day()) throw Error('Choose a valid date up to today.');
    const transactions = db.prepare('SELECT * FROM transactions WHERE user_id=?').all(user.id);
    if (pathname.endsWith('actions')) {
      const credits=db.prepare('SELECT cr.*,c.name AS customer_name FROM credits cr LEFT JOIN customers c ON c.id=cr.customer_id AND c.user_id=cr.user_id WHERE cr.user_id=?').all(user.id);
      const tools=require('../services/shopTools');
      const toolActions=require('../../frontend/js/shopToolsCore').actions(tools.load(db,user.id),credits,date);
      h.sendJson(res,200,{success:true,data:{date,items:[...daily.actions(credits,transactions,date),...toolActions]}}); return true;
    }
    const saved=db.prepare('SELECT * FROM cash_closings WHERE user_id=? AND date=?').get(user.id,date);
    const opening=body.opening ?? params.get('opening') ?? saved?.opening ?? 0;
    const summary=daily.cashSummary(transactions,date,opening);
    if (req.method === 'GET') { h.sendJson(res,200,{success:true,data:{date,opening:Number(opening),...summary,saved:saved||null}}); return true; }
    const counted=daily.money(body.counted)/100;
    const difference=(daily.money(counted)-Math.round(summary.expected*100))/100;
    const note=String(body.note||'').trim();
    if(note.length>1000) throw Error('Keep the closing note under 1,000 characters.');
    if(difference!==0 && !note) throw Error('Add a note explaining the cash difference.');
    db.prepare('INSERT INTO cash_closings VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET opening=excluded.opening,received=excluded.received,paid=excluded.paid,expected=excluded.expected,counted=excluded.counted,difference=excluded.difference,note=excluded.note,updated_at=excluded.updated_at').run(user.id,date,Number(opening),summary.received,summary.paid,summary.expected,counted,difference,note,new Date().toISOString());
    h.sendJson(res,200,{success:true,data:{date,...summary,counted,difference}});
  } catch(e) {h.sendError(res,400,'DAILY_WORKFLOW_FAILED',e.message);}
  return true;
}
module.exports={handleDailyRoutes,initialize};
