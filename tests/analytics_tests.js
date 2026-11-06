const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('frontend/js/analytics.js','utf8');
function setup(path='/',permission='no',measurementId='G-TEST12345'){
 const data=new Map([['hisab_analytics_consent',permission]]),scripts=[],callbacks={};let calls=0,reloads=0;
 const location={pathname:path,protocol:'https:',origin:'https://hisab.example',hostname:'hisab.example',search:'?email=private@example.com',reload(){reloads++;}};
 const document={cookie:'',head:{append(el){scripts.push(el);}},createElement(){return{remove(){}};},querySelectorAll(){return[];},getElementById(){return null;},addEventListener(name,fn){callbacks[name]=fn;}};
 const window={addEventListener(name,fn){callbacks[name]=fn;}};
 vm.runInNewContext(code,{window,document,location,localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},fetch:async()=>{calls++;return{json:async()=>({data:{measurementId}})}}});
 return{window,scripts,callbacks,calls:()=>calls,reloads:()=>reloads};
}
(async()=>{
 const denied=setup();denied.callbacks.DOMContentLoaded();assert.equal(denied.calls(),0);assert.equal(denied.scripts.length,0);
 const business=setup('/app','yes');business.callbacks.DOMContentLoaded();assert.equal(business.calls(),0);
 const good=setup();good.window.hisabAnalytics.consent(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(good.scripts.length,1);assert.match(good.scripts[0].src,/googletagmanager/);
 const commands=good.window.dataLayer.map(args=>Array.from(args));const view=commands.find(row=>row[0]==='event');assert.equal(view[2].page_location,'https://hisab.example/');assert.equal(view[2].page_referrer,'');assert.ok(!JSON.stringify(commands).includes('private@example'));
 good.window.hisabAnalytics.consent(false);assert.equal(good.window['ga-disable-G-TEST12345'],true);assert.equal(good.reloads(),1);
 const invalid=setup('/','yes','not-a-measurement-id');invalid.callbacks.DOMContentLoaded();await new Promise(resolve=>setImmediate(resolve));assert.equal(invalid.scripts.length,0);
 console.log('PASS: GA blocked before consent/on dashboard, sanitized pageviews, invalid ID rejection and withdrawal.');
})().catch(error=>{console.error(error);process.exit(1);});
