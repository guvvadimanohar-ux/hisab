(() => {
  'use strict';
  const VERSION='2026-10-05', NOTICE_VERSION='2026-10-06';
  let state={ai:false,voice:false}, loaded=false;
  const api=async(path,options={})=>{const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Could not complete your request.');return body;};
  const status=text=>{const el=document.getElementById('privacyStatus');if(el)el.textContent=text;};
  const isOffline=()=>window.merchantApp?.isOfflineMode || location.protocol==='file:' || !navigator.onLine;
  async function load(){
    try{if(isOffline()){const saved=JSON.parse(localStorage.getItem('hisab_privacy_permissions')||'{}');state=saved.version===VERSION?saved:{ai:false,voice:false};}else {const result=await api('/api/privacy/permissions');if(!result.data)throw new Error('Permissions unavailable');state=result.data;}loaded=true;}
    catch{state={ai:false,voice:false};loaded=false;}
    render();
  }
  function render(){for(const purpose of ['ai','voice']){const box=document.getElementById('privacy'+purpose);if(box)box.checked=state[purpose];}}
  async function save(next){
    if(isOffline()){state={...next,version:VERSION};localStorage.setItem('hisab_privacy_permissions',JSON.stringify(state));}
    else state=(await api('/api/privacy/permissions',{method:'PUT',body:JSON.stringify(next)})).data;
    loaded=true;render();
    if(!state.voice){window.merchantApp?.recognition?.stop();window.merchantApp?.dailyRecognition?.stop();window.merchantApp?.receiptRecognition?.stop();window.voiceAssistant?.recognition?.stop();window.speechSynthesis?.cancel();}
  }
  function consentDialog(purpose){return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='privacy-dialog';dialog.setAttribute('aria-label','Optional processing consent');
    dialog.innerHTML=`<h2>${purpose==='voice'?'Enable voice and AI?':'Enable business AI?'}</h2><p>AI sends your question and relevant business context to the configured provider, which may process it outside India. Voice may also send audio to your browser’s speech provider. Commands can add ledger entries. You can withdraw permission in Settings.</p><p><a href="/privacy.html" target="_blank" rel="noopener">Read the privacy policy</a>. Manual entry remains available.</p><div class="privacy-actions"><button type="button" data-decline>Keep disabled</button><button type="button" data-allow>Enable ${purpose==='voice'?'voice and AI':'AI'}</button></div><p role="status" data-error></p>`;
    const previous=document.activeElement;document.body.append(dialog);dialog.showModal();
    const finish=value=>{dialog.close();dialog.remove();previous?.focus();resolve(value);};
    dialog.querySelector('[data-decline]').onclick=()=>finish(false);
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
    dialog.querySelector('[data-allow]').onclick=async()=>{try{await save({ai:true,voice:purpose==='voice'||state.voice});finish(true);}catch(error){dialog.querySelector('[data-error]').textContent=error.message;}};
  });}
  window.hisabPrivacy={async requirePermission(purpose){if(!loaded)await load();if(state[purpose]&&(purpose!=='voice'||state.ai))return true;return consentDialog(purpose);}};
  function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function storageNotice(force=false){
    if(document.getElementById('storageNotice')||(!force&&localStorage.getItem('hisab_storage_notice')===NOTICE_VERSION))return;
    const el=document.createElement('aside');el.id='storageNotice';el.className='privacy-notice storage-notice';el.setAttribute('aria-label','Essential storage notice');el.innerHTML='<strong>Your records, your choices</strong><p>Hisab uses essential sign-in cookies and device storage for your ledger and preferences. Optional Google Analytics measures visits on public website pages after your permission; it is excluded from the business dashboard. Advertising is disabled. Optional campaign attribution stores UTM tags on this device only. AI and voice are optional.</p><div class="privacy-actions"><a href="/cookies.html">Cookies and storage policy</a><button type="button" data-necessary>Necessary only</button><button type="button" data-campaign>Allow local campaign tags</button><button type="button" data-analytics>Allow analytics</button></div>';const choose=(allow,analytics=false)=>{window.hisabSiteFeatures?.campaignConsent(allow);window.hisabAnalytics?.consent(analytics);localStorage.setItem('hisab_storage_notice',NOTICE_VERSION);el.remove();};el.querySelector('[data-necessary]').onclick=()=>choose(false);el.querySelector('[data-campaign]').onclick=()=>choose(true);el.querySelector('[data-analytics]').onclick=()=>choose(false,true);document.body.append(el);
  }
  async function eraseDialog(){
    const dialog=document.createElement('dialog');dialog.className='privacy-dialog';dialog.setAttribute('aria-label','Confirm permanent account deletion');dialog.innerHTML='<form><h2>Permanently delete your account?</h2><p>This removes your active server records, undo copies and account. Export first. External-provider records and operator backups are separate. Disconnect bank accounts first.</p><label>Current password<input type="password" name="password" autocomplete="current-password" required></label><label>Type DELETE to confirm<input name="confirmation" required pattern="DELETE" autocomplete="off"></label><div class="privacy-actions"><button type="button" data-cancel>Keep my account</button><button class="privacy-delete" type="submit">Permanently delete account</button></div><p role="status" data-error></p></form>';
    const previous=document.activeElement;document.body.append(dialog);dialog.showModal();const close=()=>{dialog.close();dialog.remove();previous?.focus();};dialog.querySelector('[data-cancel]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=dialog.querySelector('[type=submit]');button.disabled=true;try{await api('/api/privacy/account',{method:'DELETE',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});for(const key of Object.keys(localStorage))if(key.startsWith('hisab')||key.startsWith('merchant'))localStorage.removeItem(key);location.href='/';}catch(error){dialog.querySelector('[data-error]').textContent=error.message;button.disabled=false;}};
  }
  function accessibility(){
    document.querySelectorAll('img:not([alt])').forEach(img=>img.alt=img.title||'Business image');
    document.querySelectorAll('button').forEach(button=>{if(!button.getAttribute('aria-label')&&(!button.textContent.trim()||/^[×✕✖]$/.test(button.textContent.trim()))){const title=button.title||(button.classList.contains('modal-close-btn')?'Close dialog':null);if(title)button.setAttribute('aria-label',title);}});
    document.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(input=>{
      if(input.labels?.length||input.getAttribute('aria-label')||input.getAttribute('aria-labelledby'))return;
      const group=input.closest('.form-group,.form-field,.filter-group');const label=group?.querySelector('label');
      if(label){if(!input.id)input.id='field-'+Math.random().toString(36).slice(2);label.htmlFor=input.id;}
      else if(input.placeholder||input.title)input.setAttribute('aria-label',input.title||input.placeholder);
    });
    document.querySelectorAll('.modal-overlay.open,.modal-backdrop.open').forEach(overlay=>{const card=overlay.querySelector('.modal-card,.modal-dialog')||overlay;if(!card.hasAttribute('role'))card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');const heading=card.querySelector('h2,h3,h4');if(heading){if(!heading.id)heading.id='dialog-title-'+Math.random().toString(36).slice(2);card.setAttribute('aria-labelledby',heading.id);}});
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-storage-settings]').forEach(button=>button.onclick=()=>storageNotice(true));storageNotice();
    const panel=document.getElementById('privacyControls');
    if(panel){load();document.getElementById('privacySave').onclick=async()=>{try{await save({ai:document.getElementById('privacyai').checked,voice:document.getElementById('privacyvoice').checked});status('Permissions saved. Withdrawal stops future optional requests.');}catch(error){status(error.message);}};
      document.getElementById('privacyExport').onclick=async()=>{try{const data=isOffline()?window.offlineHisabEngine?.data:await api('/api/privacy/export');if(!data)throw new Error('No records available.');download(data,'hisab-private-backup.json');status('Backup downloaded. Keep it secure: it includes personal and business data.');}catch(error){status(error.message);}};
      document.getElementById('privacyDelete').onclick=()=>{if(isOffline()){status('You are in offline mode. Export first, then clear this site’s storage in your browser settings. Server account deletion requires sign-in.');return;}eraseDialog();};
    }
    api('/api/privacy/operator').then(({data})=>{document.querySelectorAll('[data-operator-details]').forEach(el=>{if(!data.configured)return;el.replaceChildren();for(const text of [data.name,data.address,'Privacy and support: '+data.email]){const p=document.createElement('p');p.textContent=text;el.append(p);}});}).catch(()=>{});
    accessibility();new MutationObserver(accessibility).observe(document.body,{childList:true,subtree:true});
    let previous=null,lastModal=null,muted=[];
    const restoreBackground=()=>{for(const [el,value] of muted)el.inert=value;muted=[];};
    const hideBackground=modal=>{let child=modal;while(child.parentElement&&child.parentElement!==document.documentElement){for(const sibling of child.parentElement.children)if(sibling!==child){muted.push([sibling,sibling.inert]);sibling.inert=true;}child=child.parentElement;}};
    new MutationObserver(()=>{const current=document.querySelector('.modal-overlay.open,.modal-backdrop.open');if(current&&current!==lastModal){restoreBackground();previous=document.activeElement;lastModal=current;hideBackground(current);accessibility();current.querySelector('button,input,select,textarea,[tabindex="0"]')?.focus();}else if(!current&&lastModal){lastModal=null;restoreBackground();previous?.focus();}}).observe(document.body,{attributes:true,subtree:true,attributeFilter:['class']});
    document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]'))return;const modal=document.querySelector('.modal-overlay.open,.modal-backdrop.open');if(!modal)return;if(event.key==='Escape'){const close=modal.querySelector('.modal-close-btn');close?.click();}if(event.key==='Tab'){const controls=[...modal.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus();}}});
  });
})();
