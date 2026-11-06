const crypto=require('node:crypto');
const C=require('../../frontend/js/shopToolsCore');
const {recordTransaction}=require('./transactionEngine');
const {issueCredit}=require('./creditService');
const {getOrCreateShopForUser}=require('./database');
function initialize(db){db.exec(`CREATE TABLE IF NOT EXISTS shop_tool_state(user_id TEXT PRIMARY KEY,data TEXT NOT NULL);CREATE TABLE IF NOT EXISTS shop_access(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,subject TEXT NOT NULL,name TEXT NOT NULL,expires_at TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`);}
function load(db,id){initialize(db);const row=db.prepare('SELECT data FROM shop_tool_state WHERE user_id=?').get(id);return row?{...C.empty(),...JSON.parse(row.data)}:C.empty();}
function save(db,id,state){db.prepare('INSERT INTO shop_tool_state VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(state));}
function records(db,id){return {customers:db.prepare('SELECT id,name,phone FROM customers WHERE user_id=?').all(id),credits:db.prepare('SELECT * FROM credits WHERE user_id=?').all(id),transactions:db.prepare('SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC,created_at DESC').all(id)};}
function apply(db,id,op,fields,requestId,staffName){
 initialize(db);if(!/^[\w-]{8,100}$/.test(requestId||''))throw Error('A request identifier is required.');
 const hash=crypto.createHash('sha256').update(JSON.stringify({op,fields})).digest('hex');
 db.exec('BEGIN IMMEDIATE');
 try{
  const state=load(db,id),previous=state.requests.find(r=>r.id===requestId);
  if(previous){if(previous.hash!==hash)throw Error('Request identifier was reused with different details.');db.exec('COMMIT');return previous.result;}
  const env={...records(db,id),id:()=>crypto.randomUUID(),staffName,usedTransactions:db.prepare('SELECT transaction_id FROM payments WHERE user_id=? AND transaction_id IS NOT NULL').all(id).map(p=>p.transaction_id)};
  env.post=entry=>entry.mode==='UDHAAR'?issueCredit(db,id,{customerId:entry.customerId,amount:entry.amount,description:entry.description,overrideLimit:true}):recordTransaction(db,id,{...entry,referenceNumber:entry.reference,date:C.day(),category:op==='billPayment'?'Supplier Payments':op==='sale'||op==='fulfill'?'Item Sales':undefined});
  env.correct=draft=>{
   const tx=env.transactions.find(t=>t.id===draft.transactionId);if(!tx)throw Error('Transaction not found.');
   if(state.matches.some(m=>m.transactionId===tx.id)||env.usedTransactions.includes(tx.id)||tx.loan_id||tx.source!=='MANUAL')throw Error('Linked credit and imported transactions cannot be corrected in this inbox.');
   const delta=C.round(draft.amount-tx.amount);
   db.prepare('UPDATE transactions SET amount=?,description=?,updated_at=? WHERE id=? AND user_id=?').run(draft.amount,draft.reason,new Date().toISOString(),tx.id,id);
   const column=tx.cash_flow_type==='INFLOW'?'total_inflow':'total_outflow';db.prepare(`UPDATE datasets SET ${column}=${column}+? WHERE id=? AND user_id=?`).run(delta,tx.dataset_id,id);
   state.audit.unshift({id:crypto.randomUUID(),operation:'Correction evidence',transactionId:tx.id,before:tx.amount,after:draft.amount,reason:draft.reason,createdAt:new Date().toISOString()});
  };
  env.allocate=(tx,customer,amount)=>{
   let left=Math.round(amount*100);const credits=env.credits.filter(c=>c.customer_id===customer.id&&c.outstanding_amount>0).sort((a,b)=>a.issued_at.localeCompare(b.issued_at));
   const shop=getOrCreateShopForUser(db,id),now=new Date().toISOString();
   for(const credit of credits){if(!left)break;const applied=Math.min(left,Math.round(credit.outstanding_amount*100))/100;
    const paid=C.round(credit.paid_amount+applied),outstanding=C.round(credit.outstanding_amount-applied);
    db.prepare('UPDATE credits SET paid_amount=?,outstanding_amount=?,status=?,updated_at=? WHERE id=? AND user_id=?').run(paid,outstanding,outstanding?'Partially Paid':'Paid',now,credit.id,id);
    db.prepare('INSERT INTO payments(id,shop_id,user_id,customer_id,credit_id,transaction_id,amount,payment_date,mode,reference,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),shop.id,id,customer.id,credit.id,tx.id,applied,tx.date,tx.payment_method||tx.mode,tx.reference_number||null,'Matched existing receipt; no new transaction',now,now);
    left-=Math.round(applied*100);
   }
   db.prepare('UPDATE transactions SET customer_id=?,customer_name=?,updated_at=? WHERE id=? AND user_id=?').run(customer.id,customer.name,now,tx.id,id);
  };
  const result=C.apply(state,op,fields,env);state.requests.push({id:requestId,hash,result});save(db,id,state);db.exec('COMMIT');return result;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
function view(db,id){const state=load(db,id),r=records(db,id);return {state,...r,actions:C.actions(state,r.credits),suggestions:C.matchSuggestions(state,r.credits,r.transactions.filter(t=>!db.prepare('SELECT id FROM payments WHERE user_id=? AND transaction_id=?').get(id,t.id)),r.customers),access:db.prepare('SELECT id,kind,subject,name,expires_at,revoked FROM shop_access WHERE user_id=?').all(id)};}
function createAccess(db,id,{kind,subject,name,days=7}){initialize(db);if(!['Customer','Staff'].includes(kind))throw Error('Invalid link type.');days=C.number(days,1);if(days>30)throw Error('Links may last at most 30 days.');if(kind==='Customer'&&!records(db,id).customers.some(c=>c.id===subject))throw Error('Customer not found.');if(kind==='Staff'){if(subject&&subject!=='staff'){const tx=records(db,id).transactions.find(t=>t.id===subject&&t.source==='MANUAL'&&!t.loan_id);if(!tx)throw Error('Choose a manual transaction for assigned correction.');}else subject='staff';}const token=crypto.randomBytes(32).toString('base64url'),key=crypto.randomUUID(),expiry=new Date(Date.now()+days*86400000).toISOString();db.prepare('INSERT INTO shop_access VALUES(?,?,?,?,?,?,?,?,?)').run(key,id,crypto.createHash('sha256').update(token).digest('hex'),kind,subject,C.text(name),expiry,0,new Date().toISOString());return {id:key,token,kind,expiresAt:expiry};}
function access(db,token){initialize(db);if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))return null;return db.prepare('SELECT * FROM shop_access WHERE token_hash=? AND revoked=0 AND expires_at>?').get(crypto.createHash('sha256').update(token).digest('hex'),new Date().toISOString());}
function accessView(db,a){const state=load(db,a.user_id),r=records(db,a.user_id);
 if(a.kind==='Staff'){const tx=r.transactions.find(t=>t.id===a.subject);return {kind:a.kind,name:a.name,expiresAt:a.expires_at,assignedTransaction:tx?{id:tx.id,amount:tx.amount,description:tx.description,mode:tx.payment_method}:null};}
 const customer=r.customers.find(c=>c.id===a.subject);if(!customer)throw Error('Customer no longer available.');
 return {kind:'Customer',name:customer.name,expiresAt:a.expires_at,outstanding:C.balance(r.credits,customer.id),credits:r.credits.filter(c=>c.customer_id===customer.id).map(c=>({id:c.id,date:c.issued_at,description:c.description,amount:c.amount,outstanding:c.outstanding_amount})),transactions:r.transactions.filter(t=>t.customer_id===customer.id).map(t=>({id:t.id,date:t.date,amount:t.amount,description:t.description,flow:t.cash_flow_type})),products:state.products.filter(p=>p.stock>0&&(!p.expiry||p.expiry>=C.day())).map(p=>({id:p.id,name:p.name,unit:p.unit,price:p.price,stock:p.stock})),orders:state.orders.filter(o=>o.customerId===customer.id),lastBasket:state.sales.find(s=>s.customerId===customer.id&&!s.returned)?.items||[],confirmations:state.audit.filter(e=>e.customerId===customer.id&&['Customer confirmation','Customer dispute'].includes(e.operation)).slice(0,10)};
}
function respond(db,a,{action,fields,requestId}){
 if(!/^[\w-]{8,100}$/.test(requestId||''))throw Error('Invalid request identifier.');
 if(a.kind==='Staff'){if(action!=='approvalSubmit'||!['Expense','Correction'].includes(fields.kind)||fields.kind==='Correction'&&(a.subject==='staff'||fields.transactionId!==a.subject))throw Error('Staff may submit expenses or correct only an explicitly assigned entry.');return apply(db,a.user_id,action,fields,`staff-${a.id}-${requestId}`,a.name);}
 if(action==='order')return apply(db,a.user_id,'order',{...fields,customerId:a.subject},`portal-${a.id}-${requestId}`);
 if(!['confirm','dispute'].includes(action))throw Error('Invalid customer action.');
 initialize(db);db.exec('BEGIN IMMEDIATE');try{
  const state=load(db,a.user_id),r=records(db,a.user_id),current=C.balance(r.credits,a.subject);
  if(state.audit.some(e=>e.requestId===requestId&&e.accessId===a.id)){db.exec('COMMIT');return {saved:true};}
  if(C.number(fields.balance)!==current)throw Error('Balance changed. Refresh before confirming.');
  if(action==='dispute'&&fields.transactionId&&!r.transactions.some(t=>t.id===fields.transactionId&&t.customer_id===a.subject))throw Error('Entry not found.');
  state.audit.unshift({id:crypto.randomUUID(),operation:action==='confirm'?'Customer confirmation':'Customer dispute',customerId:a.subject,balance:current,transactionId:fields.transactionId||'',note:action==='dispute'?C.text(fields.note,1000):'',requestId,accessId:a.id,createdAt:new Date().toISOString()});save(db,a.user_id,state);db.exec('COMMIT');return {saved:true};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
module.exports={initialize,load,save,records,apply,view,createAccess,access,accessView,respond};
