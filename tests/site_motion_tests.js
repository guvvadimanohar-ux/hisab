const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('frontend/js/siteMotion.js', 'utf8');
function setup({reduced=false,missing=false,throws=false}={}) {
  const listeners={},timers=[],calls=[];
  const element={style:{opacity:''},getClientRects:()=>[{}]};
  const preference={matches:reduced,addEventListener:(name,fn)=>listeners.preference=fn};
  const document={readyState:'complete',body:{},hidden:false,querySelectorAll:()=>[element],addEventListener:(name,fn)=>listeners[name]=fn};
  const window={matchMedia:()=>preference,addEventListener:(name,fn)=>listeners[name]=fn};
  if(!missing)window.anime={animate(el,options){calls.push(options);el.style.opacity='0.35';if(throws)throw Error('animation unavailable');return{cancel(){}};}};
  vm.runInNewContext(code,{window,document,MutationObserver:class{observe(){}disconnect(){}},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){}});
  return{element,preference,listeners,timers,calls};
}
for(const options of [{reduced:true},{missing:true}]){const state=setup(options);assert.equal(state.calls.length,0);assert.equal(state.element.style.opacity,'');}
const failure=setup({throws:true});assert.equal(failure.element.style.opacity,'');
const normal=setup();assert.equal(normal.calls.length,1);normal.calls[0].onComplete();assert.equal(normal.element.style.opacity,'');
const watchdog=setup();watchdog.timers[0]();assert.equal(watchdog.element.style.opacity,'');
const changed=setup();changed.preference.matches=true;changed.listeners.preference();assert.equal(changed.element.style.opacity,'');
const leave=setup();leave.listeners.pagehide();assert.equal(leave.element.style.opacity,'');
console.log('PASS: animation failure recovery, absent library, reduced motion, completion, watchdog and page cleanup.');
