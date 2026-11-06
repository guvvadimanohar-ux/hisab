/** Authenticated HTTP integration checks on an isolated in-memory server. */
const assert=require('node:assert/strict');
process.env.HISAB_DB_PATH=':memory:';
process.env.AI_PROVIDER='local';
process.env.AA_MOCK_MODE='true';
process.env.PAYMENT_GATEWAY='mock';
const {server,startServer,db,aiService}=require('../backend/server');
const auth=require('../backend/services/authService');
const {recordTransaction}=require('../backend/services/transactionEngine');
const one=auth.createUserWithSession(db,{shopName:'Test One',fullName:'Owner',phone:'9000010001',password:'testpass'});
const two=auth.createUserWithSession(db,{shopName:'Test Two',fullName:'Owner',phone:'9000010002',password:'testpass'});
for(const [userId,amount] of [[one.userId,500],[two.userId,9999]])recordTransaction(db,userId,{customerName:'Test Customer',amount,mode:'UPI',cashFlowType:'INFLOW',transactionType:'Sale',description:'Test sale',source:'MANUAL'});
aiService.checkHealth=async()=>({database:'connected',provider:'test',ollama:false});
aiService.queryOllama=async(_path,_method,body)=>{
 if(body.format)return {response:JSON.stringify({action: /DROP TABLE|cricket/.test(body.prompt)?'refuse':'read'})};
 throw new Error('Use deterministic language fallback in integration tests');
};
let passed=0;
(async()=>{
 await startServer(0);const base=`http://localhost:${server.address().port}`;
 const request=async(path,method='GET',data,token=one.token)=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(token?{Cookie:`hisab_session_id=${token}`}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:res.status,body:await res.json()};};
 const test=async(name,fn)=>{await fn();passed++;console.log('PASS: '+name);};
 try{
  await test('Health response',async()=>{assert.equal((await request('/api/ai/health')).status,200)});
  await test('Unauthenticated requests denied',async()=>{assert.equal((await request('/api/ai/chat','POST',{query:'What are my sales?'},null)).status,401)});
  await test('AI disabled until consent',async()=>{assert.equal((await request('/api/ai/chat','POST',{query:'What are my sales?'})).body.error.code,'CONSENT_REQUIRED')});
  await test('Enable optional AI without voice',async()=>{const r=await request('/api/privacy/permissions','PUT',{ai:true,voice:false});assert.equal(r.status,200);assert.equal(r.body.data.voice,false)});
  await test('Empty queries rejected',async()=>{assert.equal((await request('/api/ai/chat','POST',{query:' '})).body.error.code,'EMPTY_QUERY')});
  await test('Merchant-scoped totals',async()=>{const r=await request('/api/ai/chat','POST',{query:'What are my total sales?'});assert.equal(r.status,200);assert.equal(r.body.data.sales,500)});
  for(const [query,language,script] of [['sales entha','te-IN',/[\u0C00-\u0C7F]/],['मेरी बिक्री कितनी है?','hi-IN',/[\u0900-\u097F]/]])await test('Multilingual '+language,async()=>{const r=await request('/api/ai/chat','POST',{query,languageHint:'en-IN'});assert.equal(r.status,200);assert.equal(r.body.language,language);assert.match(r.body.answer,script)});
  await test('Voice separately gated',async()=>{assert.equal((await request('/api/voice/query','POST',{query:'What are my sales?'})).body.error.code,'CONSENT_REQUIRED')});
  await test('Voice query returns transcript, AI answer and playable speech',async()=>{
   const permission=await request('/api/privacy/permissions','PUT',{ai:true,voice:true});assert.equal(permission.status,200);
   const r=await request('/api/voice/query','POST',{query:'What are my total sales?',languageHint:'en-IN'});
   assert.equal(r.status,200);assert.equal(r.body.success,true);assert.equal(r.body.transcript,'What are my total sales?');
   assert.ok(r.body.answer);assert.equal(r.body.audio.mimeType,'audio/wav');assert.match(r.body.audio.dataUrl,/^data:audio\/wav;base64,/);
  });
  await test('Malicious request cannot modify records',async()=>{const r=await request('/api/ai/chat','POST',{query:"'; DROP TABLE transactions; --"});assert.equal(r.body.intent,'business_only');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n,2)});
  await test('Consent withdrawal blocks future queries',async()=>{await request('/api/privacy/permissions','PUT',{ai:false,voice:false});assert.equal((await request('/api/ai/chat','POST',{query:'What are my sales?'})).status,403)});
  console.log(`${passed} HTTP AI/privacy tests passed.`);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
