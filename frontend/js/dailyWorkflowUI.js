/* Daily workflow uses the selected ledger only; network failures never switch ledgers. */
(() => {
  const $ = id => document.getElementById(id), D = window.HisabDaily;
  const currency = n => Number(n).toLocaleString('en-IN',{style:'currency',currency:'INR'});
  let recognition, sequence=0, summary;
  async function request(path, body) {
    const response = await fetch(path, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : undefined);
    const result=await response.json(); if(!response.ok || !result.success) throw Error(result.error?.message || 'Could not load shop records.'); return result.data;
  }
  function ledger() { return window.merchantApp?.isOfflineMode ? window.offlineHisabEngine : null; }
  async function refresh() {
    const ticket=++sequence;
    try {
      const offline=ledger();
      const data=offline ? {date:D.day(),items:[...D.actions(offline.data.credits,offline.data.transactions,D.day()),...(window.HisabTools?window.HisabTools.actions({...window.HisabTools.empty(),...(offline.data.shopTools||{})},offline.data.credits):[])]} : await request('/api/daily/actions');
      if(ticket!==sequence) return;
      $('dailyLedgerLabel').textContent=offline?'Offline ledger · records on this device':'Store ledger';
      const list=$('dailyActions'); list.replaceChildren();
      for(const item of data.items) {
        const button=document.createElement('button'); button.className='daily-action';button.type='button';
        button.textContent=['supplier','promise','expiry'].includes(item.kind)?`${item.kind==='supplier'?'Supplier payment':item.kind==='promise'?'Payment promise':'Expiring stock'} · ${item.name} · ${currency(item.amount)} · ${item.date}`:item.kind==='due'?`${item.overdue?'Overdue':'Due today'} · ${item.name} · ${currency(item.amount)} · ${item.date}`:`Review ${item.count} uncategorized or flagged transaction${item.count===1?'':'s'}`;
        button.onclick=()=>['supplier','promise','expiry'].includes(item.kind)?window.openShopTools(item.kind):window.merchantApp.navigateTo(item.kind==='due'?'udhaar':'transactions'); list.append(button);
      }
      if(!data.items.length) list.textContent='No recorded customer dues or transactions needing review today.';
      $('dailyStatus').textContent='Customer dues, payment promises, supplier bills and expiring stock from your records.';
    } catch(e) {$('dailyActions').textContent='Could not load today’s actions.';$('dailyStatus').textContent=e.message;}
  }
  async function draft() {
    try {
      const entry=D.parseEntry($('entryText').value);
      if(entry.type==='credit') {
        const offline=ledger();
        const result=offline?{customers:offline.data.customers}:await request('/api/customers?limit=200');
        window.merchantApp.customers=result.customers||[];
        window.closeHisabAssistant?.();
        window.merchantApp.openGiveUdhaarModal();
        const select=$('giveUdhaarCustomerId');
        const matches=[...select.options].filter(o=>window.merchantApp.customers.find(c=>c.id===o.value)?.name.toLowerCase()===entry.party.toLowerCase());
        select.value=matches.length===1?matches[0].value:'';
        $('giveUdhaarAmount').value=entry.amount;$('giveUdhaarDesc').value=entry.description;
      } else {
        window.closeHisabAssistant?.();
        window.merchantApp.openManualTxnModal(entry.flow);
        $('manualTxnAmount').value=entry.amount;$('manualTxnParty').value=entry.party;
        $('manualTxnDesc').value=entry.description;$('manualTxnMode').value=entry.mode;
      }
      $('entryStatus').textContent='Draft ready. Check the customer, amount, entry type and payment mode before saving.';
    } catch(e) {$('entryStatus').textContent=e.message;}
  }
  async function listen() {
    if(recognition) {recognition.stop();return;}
    const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Speech) {$('entryStatus').textContent='Voice input is unavailable in this browser. Type your entry below.';return;}
    if(!await window.hisabPrivacy.requirePermission('voice')) return;
    recognition=new Speech();window.merchantApp.dailyRecognition=recognition;recognition.lang=$('entryLanguage').value;recognition.interimResults=false;
    $('entryMic').textContent='Stop listening';$('entryStatus').textContent='Listening…';
    recognition.onresult=e=>{$('entryText').value=e.results[0][0].transcript;$('entryStatus').textContent='Transcript ready. Choose Review entry to create a draft.';};
    recognition.onerror=e=>{$('entryStatus').textContent=`Voice input could not finish (${e.error}). You can type your entry.`;};
    recognition.onend=()=>{window.merchantApp.dailyRecognition=null;recognition=null;$('entryMic').textContent='Speak entry';};
    try {recognition.start();} catch(e) {recognition=null;$('entryMic').textContent='Speak entry';$('entryStatus').textContent=e.message;}
  }
  async function previewClosing() {
    const date=$('closingDate').value, opening=$('closingOpening').value;
    const offline=ledger();
    summary=offline?{...D.cashSummary(offline.data.transactions,date,opening),saved:offline.data.cashClosings?.find(c=>c.date===date)}:await request(`/api/daily/closing?date=${encodeURIComponent(date)}&opening=${encodeURIComponent(opening)}`);
    $('closingSummary').textContent=`Cash received ${currency(summary.received)} − cash paid ${currency(summary.paid)} + opening cash ${currency(opening)} = expected ${currency(summary.expected)}.`;
    const counted=$('closingCounted').value;
    $('closingDifference').textContent=counted===''?'Enter counted cash to see the difference.':`Difference: ${currency((D.money(counted)-Math.round(summary.expected*100))/100)}`;
    return summary;
  }
  async function openClosing() {
    try {
      $('closingDate').value=D.day();$('closingDate').max=D.day();
      const offline=ledger();
      const data=offline?{saved:offline.data.cashClosings?.find(c=>c.date===D.day())}:await request('/api/daily/closing');
      $('closingOpening').value=data.saved?.opening??0;$('closingCounted').value=data.saved?.counted??'';$('closingNote').value=data.saved?.note??'';
      $('closingStatus').textContent=data.saved?'Saved closing loaded. Saving again updates this date.':'';
      window.merchantApp.openModal('cashClosingModal');await previewClosing();
    }catch(e){$('dailyStatus').textContent=e.message;}
  }
  async function saveClosing(e) {
    e.preventDefault();const button=$('saveClosing');button.disabled=true;
    try {
      const data={date:$('closingDate').value,opening:$('closingOpening').value,counted:$('closingCounted').value,note:$('closingNote').value.trim()};
      const offline=ledger();
      if(offline) {
        if(!data.date || data.date>D.day()) throw Error('Choose a date up to today.');
        const s=await previewClosing();
        data.opening=D.money(data.opening)/100;data.counted=D.money(data.counted)/100;
        const difference=(D.money(data.counted)-Math.round(s.expected*100))/100;
        if(difference!==0&&!data.note) throw Error('Add a note explaining the cash difference.');
        const records=offline.data.cashClosings||[];
        const updated=[...records.filter(c=>c.date!==data.date),{...data,...s,saved:undefined,difference,updatedAt:new Date().toISOString()}];
        // Persist before changing in-memory records so storage failures remain visible.
        localStorage.setItem(offline.STORAGE_KEY,JSON.stringify({...offline.data,cashClosings:updated}));offline.data.cashClosings=updated;
      } else await request('/api/daily/closing',data);
      $('closingStatus').textContent='Cash closing saved.';await previewClosing();refresh();
    }catch(error){$('closingStatus').textContent=error.message;}finally{button.disabled=false;}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('dailyRefresh').onclick=refresh;$('entryReview').onclick=draft;$('entryMic').onclick=listen;
    $('openClosing').onclick=openClosing;$('cashClosingForm').onsubmit=saveClosing;
    $('closingDate').addEventListener('change',async()=>{
      try {
        const date=$('closingDate').value, offline=ledger();
        const data=offline?{saved:offline.data.cashClosings?.find(c=>c.date===date)}:await request(`/api/daily/closing?date=${encodeURIComponent(date)}`);
        $('closingOpening').value=data.saved?.opening??0;$('closingCounted').value=data.saved?.counted??'';$('closingNote').value=data.saved?.note??'';
        $('closingStatus').textContent=data.saved?'Saved closing loaded. Saving again updates this date.':'';
        await previewClosing();
      }catch(e){$('closingStatus').textContent=e.message;}
    });
    for(const id of ['closingOpening','closingCounted']) $(id).addEventListener('change',()=>previewClosing().catch(e=>{$('closingStatus').textContent=e.message;}));
    // Dashboard renders after authentication and every successful record change.
    const app=window.merchantApp, render=app.renderDashboard;
    app.renderDashboard=function(...args){const result=render.apply(this,args);refresh();return result;};
    if(app.dashboardData) refresh();
  });
})();
