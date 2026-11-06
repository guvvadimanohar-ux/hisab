/* Shared UI language, navigation, assistant dialog and bank consent controls. */
(() => {
  'use strict';
  const normalize = value => value.replace(/\s+/g, ' ').trim();
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const originalTitle = document.title;
  let language = 'en';
  try { language = localStorage.getItem('hisab-language') || 'en'; } catch {}
  if (!['en','hi','te'].includes(language)) language = 'en';
  const t = value => {
    const key = normalize(value);
    const exact = window.HISAB_TRANSLATIONS?.[key]?.[language];
    if (exact || language === 'en') return exact || value;
    for (const [pattern,hi,te] of window.HISAB_TRANSLATION_PATTERNS || []) {
      const match = key.match(pattern);
      if (match) return (language === 'hi' ? hi : te).replace(/\$(\d+)/g, (_, n) => match[Number(n)] || '');
    }
    return value;
  };
  const excluded = 'script,style,textarea,[translate="no"],.chat-bubble.user,#sidebarShopName,#sidebarShopOwner';
  function translatePage() {
    observer.disconnect();
    document.documentElement.lang = language;
    document.title = t(originalTitle);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest(excluded)) continue;
      let saved = originals.get(node);
      if (!saved || node.nodeValue !== saved.last) saved = { source: node.nodeValue };
      const key = normalize(saved.source);
      saved.last = key ? saved.source.replace(key, () => t(key)) : saved.source;
      if (node.nodeValue !== saved.last) node.nodeValue = saved.last;
      originals.set(node, saved);
    }
    document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el => {
      const saved = attributes.get(el) || {};
      for (const key of ['placeholder','aria-label','title']) {
        if (!el.hasAttribute(key)) continue;
        const value = el.getAttribute(key);
        if (!saved[key] || value !== saved[key].last) saved[key] = { source: value };
        saved[key].last = t(saved[key].source);
        el.setAttribute(key, saved[key].last);
      }
      attributes.set(el, saved);
    });
    document.querySelectorAll('[data-language-picker]').forEach(select => { select.value = language; });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder','aria-label','title'] });
  }
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; translatePage(); });
  });
  window.hisabI18n = { t, get language() { return language; }, setLanguage(value) {
    if (!['en','hi','te'].includes(value)) return;
    language = value;
    try { localStorage.setItem('hisab-language', value); } catch {}
    translatePage();
    document.dispatchEvent(new CustomEvent('hisab-language-change', { detail: value }));
  }};
  function picker() {
    const label = document.createElement('label');
    label.className = 'language-control';
    label.innerHTML = '<span>Language</span><select data-language-picker aria-label="Website language"><option value="en" translate="no">English</option><option value="hi" translate="no">हिन्दी</option><option value="te" translate="no">తెలుగు</option></select>';
    label.querySelector('select').addEventListener('change', event => window.hisabI18n.setLanguage(event.target.value));
    return label;
  }
  async function api(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(response.status === 401 ? 'Sign in to connect your bank account.' : data.error?.message || 'Could not complete the request. Please try again.');
    return data;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const app = window.merchantApp;
    if (!app) {
      document.querySelector('.nav-right-cluster')?.prepend(picker());
      translatePage();
      return;
    }
    document.getElementById('shopProfileButton')?.addEventListener('click', () => {
      app.navigateTo('settings');
      const profile = document.getElementById('settingsShopName');
      profile.scrollIntoView({ block: 'center', behavior: 'smooth' });
      profile.focus({ preventScroll: true });
    });
    const toolbar = document.createElement('div');
    toolbar.className = 'top-bar-actions';
    toolbar.append(picker());
    const refresh = document.createElement('button');
    refresh.className = 'btn-secondary';
    refresh.textContent = 'Refresh overview';
    refresh.addEventListener('click', async () => { refresh.disabled = true; try { await app.fetchDashboard(); } finally { refresh.disabled = false; } });
    toolbar.append(refresh);
    const clear = document.createElement('button');
    clear.className = 'btn-secondary';
    clear.textContent = 'Clear overview';
    const overviewMessage = document.createElement('p');
    overviewMessage.id = 'overviewFeedback';
    overviewMessage.setAttribute('role', 'status');
    document.getElementById('view-dashboard').prepend(overviewMessage);
    clear.addEventListener('click', () => {
      app.overviewCleared = true;
      app.dashboardData = null;
      document.getElementById('dashboardStatsContent').style.display = 'none';
      document.getElementById('dashboardEmptyState').style.display = 'none';
      overviewMessage.textContent = 'Overview cleared. Your ledger records are saved. Select Refresh overview to show them again.';
    });
    const fetchDashboard = app.fetchDashboard.bind(app);
    app.fetchDashboard = async () => { app.overviewCleared = false; overviewMessage.textContent = ''; await fetchDashboard(); };
    toolbar.append(clear);
    toolbar.classList.add('overview-toolbar');
    document.getElementById('view-dashboard').prepend(toolbar);
    const quick = document.querySelector('.mobile-quick-actions-bar');
    quick.classList.add('dashboard-actions');
    document.getElementById('view-dashboard').prepend(quick);
    // Bulk clearing keeps a persistent backup and an Undo control in the same section.
    const recordControls = {};
    for (const resource of ['transactions', 'customers']) {
      const view = document.getElementById('view-' + resource);
      const controls = document.createElement('div');
      controls.className = 'record-clear-controls';
      const clearRecords = document.createElement('button');
      clearRecords.className = 'btn-danger';
      clearRecords.type = 'button';
      clearRecords.textContent = resource === 'customers' ? 'Clear all customers' : 'Clear transactions';
      const undo = document.createElement('button');
      undo.className = 'btn-secondary'; undo.type = 'button'; undo.textContent = 'Undo clear'; undo.hidden = true;
      const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      controls.append(clearRecords, undo, status); view.prepend(controls);
      const key = 'hisab-cleared-' + resource + '-v1';
      const refreshRecords = async () => {
        await (resource === 'customers' ? app.fetchCustomers() : app.fetchTransactions());
        await app.fetchDashboard();
        if (resource === 'customers') await app.fetchUdhaar();
      };
      const updateUndo = async () => {
        try {
          const canUndo = app.isOfflineMode ? !!localStorage.getItem(key) : (await api('/api/records/' + resource + '/backup')).data.canUndo;
          undo.hidden = !canUndo; clearRecords.disabled = canUndo;
        } catch (error) { status.textContent = error.message; }
      };
      const operate = async action => {
        clearRecords.disabled = true; undo.disabled = true;
        try {
          if (app.isOfflineMode) {
            const engine = window.offlineHisabEngine;
            const next = structuredClone(engine.data);
            if (action === 'clear') {
              if (localStorage.getItem(key)) throw new Error('Undo the previous clear before clearing again.');
              if (!next[resource].length) { status.textContent = 'No records to clear.'; return; }
              const backup = { [resource]: next[resource] };
              if (resource === 'customers') {
                const ids = new Set(next.customers.map(c => c.id));
                backup.credits = next.credits.filter(c => ids.has(c.customerId));
                next.credits = next.credits.filter(c => !ids.has(c.customerId));
              }
              localStorage.setItem(key, JSON.stringify(backup));
              next[resource] = [];
            } else {
              const backup = JSON.parse(localStorage.getItem(key) || 'null');
              if (!backup) throw new Error('There are no cleared records to restore.');
              for (const table of Object.keys(backup)) {
                if (backup[table].some(row => next[table].some(existing => existing.id === row.id))) throw new Error('A record with the same ID exists. Your backup is kept.');
                next[table].push(...backup[table]);
              }
            }
            localStorage.setItem(engine.STORAGE_KEY, JSON.stringify(next));
            engine.data = next;
            if (action === 'restore') localStorage.removeItem(key);
          } else {
            const result = await api('/api/records/' + resource + '/' + action, { method: 'POST' });
            if (action === 'clear' && result.data.count === 0) { status.textContent = 'No records to clear.'; return; }
          }
          status.textContent = action === 'clear' ? 'Records cleared. Select Undo clear to restore them, even after reopening the app.' : 'Cleared records restored.';
          await refreshRecords();
        } catch (error) { status.textContent = error.message; }
        finally { undo.disabled = false; clearRecords.disabled = false; await updateUndo(); }
      };
      const confirmation = document.createElement('dialog');
      confirmation.className = 'clear-records-dialog';
      confirmation.setAttribute('aria-label', clearRecords.textContent);
      const title = document.createElement('h3'); title.textContent = clearRecords.textContent + '?';
      const explanation = document.createElement('p');
      explanation.textContent = resource === 'customers' ? 'This clears all customers and their linked udhaar entries. Transactions stay saved. You can undo this clear.' : 'This clears ALL transactions, including records outside the current filters. Customers and udhaar stay saved. You can undo this clear.';
      const cancel = document.createElement('button'); cancel.className = 'btn-secondary'; cancel.textContent = 'Cancel'; cancel.type = 'button';
      const confirmClear = document.createElement('button'); confirmClear.className = 'btn-danger'; confirmClear.textContent = 'Confirm clear'; confirmClear.type = 'button';
      confirmation.append(title, explanation, cancel, confirmClear); document.body.append(confirmation);
      cancel.addEventListener('click', () => confirmation.close());
      confirmClear.addEventListener('click', () => { confirmation.close(); operate('clear'); });
      clearRecords.addEventListener('click', () => { confirmation.showModal(); cancel.focus(); });
      undo.addEventListener('click', () => operate('restore'));
      recordControls[resource] = updateUndo;
    }
    const profileFields = { ShopName: 'shopName', OwnerName: 'fullName', ShopPhone: 'shopPhone', ShopEmail: 'shopEmail', ShopAddress: 'shopAddress', ShopCity: 'shopCity', ShopState: 'shopState', ShopPincode: 'shopPincode', ShopType: 'shopType', ShopGst: 'shopGst', ShopHours: 'shopHours' };
    function populateProfile() {
      for (const [id, key] of Object.entries(profileFields)) document.getElementById('settings' + id).value = app.currentUser?.[key] || '';
    }
    const originalUpdateUserUI = app.updateUserUI.bind(app);
    app.updateUserUI = () => { originalUpdateUserUI(); populateProfile(); };
    async function loadProfile() {
      if (!app.isOfflineMode) {
        try { const result = await api('/api/auth/profile'); app.currentUser = result.data; app.updateUserUI(); }
        catch (error) { document.getElementById('shopProfileFeedback').textContent = error.message; }
      } else populateProfile();
    }
    document.getElementById('saveShopProfileBtn').addEventListener('click', async event => {
      const button = event.currentTarget;
      const feedback = document.getElementById('shopProfileFeedback');
      const profile = {};
      for (const [id, key] of Object.entries(profileFields)) profile[key] = document.getElementById('settings' + id).value.trim();
      if (!profile.shopName || !profile.fullName) { feedback.textContent = 'Enter a shop name and owner name.'; return; }
      const email = document.getElementById('settingsShopEmail');
      if (!email.checkValidity()) { email.reportValidity(); return; }
      button.disabled = true;
      try {
        if (app.isOfflineMode) {
          const engine = window.offlineHisabEngine;
          const user = { ...engine.data.user, ...profile };
          localStorage.setItem(engine.STORAGE_KEY, JSON.stringify({ ...engine.data, user }));
          engine.data.user = user;
          app.currentUser = user;
        } else {
          const result = await api('/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
          app.currentUser = result.data;
        }
        app.updateUserUI(); feedback.textContent = 'Shop details saved.';
      } catch (error) { feedback.textContent = error.message; }
      finally { button.disabled = false; }
    });
    const mode = document.createElement('p');
    mode.className = 'trust-mode';
    const updateMode = () => { mode.textContent = app.isOfflineMode ? 'Offline mode: records are saved in this browser.' : 'Signed-in mode: records are saved on your store server.'; };
    document.querySelector('#view-settings .paper-panel').append(mode);
    const dialog = document.createElement('dialog');
    dialog.className = 'hisab-chat-dialog';
    dialog.id = 'hisabAssistantDialog';
    dialog.setAttribute('aria-label', 'Ask Hisab AI');
    dialog.innerHTML = '<button class="chat-close" type="button" aria-label="Close assistant">×</button><p class="chat-mode"></p>';
    dialog.append(document.querySelector('.assistant-workspace'));
    document.body.append(dialog);
    const launcher = document.createElement('button');
    launcher.className = 'ask-hisab-launcher';
    launcher.textContent = 'Ask Hisab AI';
    launcher.setAttribute('aria-haspopup','dialog');
    launcher.setAttribute('aria-controls',dialog.id);
    document.body.append(launcher);
    let previousFocus;
    window.openHisabAssistant = () => {
      previousFocus = document.activeElement;
      dialog.querySelector('.chat-mode').textContent = app.isOfflineMode ? 'Offline assistant · business ledger questions only' : 'Business assistant · checking LLM connection…';
      if (!app.isOfflineMode) api('/api/ai/health').then(result => {
        dialog.querySelector('.chat-mode').textContent = result.data.connected && result.data.model ? (result.data.provider === 'groq' ? 'Groq connected · business questions and ledger commands' : 'Local LLM connected · business questions and ledger commands') : (result.data.provider === 'groq' ? 'Groq not connected · configure the server API key' : 'Local LLM unavailable · exact loan / repayment commands and ledger queries still work');
      }).catch(() => { dialog.querySelector('.chat-mode').textContent = 'Business assistant · server connection unavailable'; });
      if (!dialog.open) dialog.showModal();
      document.getElementById('assistantTextInput').focus();
    };
    window.closeHisabAssistant = () => { if (dialog.open) dialog.close(); };
    launcher.addEventListener('click', window.openHisabAssistant);
    dialog.querySelector('.chat-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => { previousFocus?.focus(); if (location.hash === '#assistant') history.replaceState(null,'','#'+(app.currentView === 'assistant' ? 'dashboard' : app.currentView)); });
    // Preserve canonical query text for the local parser when a prompt is translated.
    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.dataset.query = chip.textContent.trim().replace(/^"|"$/g, '');
      chip.addEventListener('click', event => {
        event.stopImmediatePropagation();
        document.getElementById('assistantTextInput').value = chip.dataset.query;
        app.sendAssistantQuery();
      }, true);
    });
    const feedback = message => { document.getElementById('bankFeedback').textContent = message; };
    const accounts = document.getElementById('bankAccountsList');
    const requestButton = document.getElementById('bankSyncBtn');
    app.fetchConnections = async () => {
      requestButton.disabled = true;
      try {
        const result = await api('/api/bank/banks');
        if (result.data.isMock) {
          document.getElementById('aaConnectionStatusBadge').textContent = 'Bank connection unavailable';
          document.getElementById('bankSetupFields').hidden = true;
          accounts.replaceChildren();
          feedback('Real bank connections are not configured yet. You can upload a statement instead.');
          return;
        }
        document.getElementById('aaConnectionStatusBadge').textContent = 'Live provider';
        const select = document.getElementById('bankChoice');
        const selected = select.value;
        select.replaceChildren(...result.data.banks.map(bank => new Option(bank.name, bank.id)));
        if ([...select.options].some(option => option.value === selected)) select.value = selected;
        select.disabled = false;
        requestButton.disabled = !select.value;
        const resultAccounts = await api('/api/bank/accounts');
        accounts.replaceChildren();
        const list = (resultAccounts.data || []).filter(account => !/mock|demo|sandbox/i.test(account.provider || '') && account.consent_id);
        if (!list.length) accounts.textContent = 'No bank accounts connected.';
        for (const account of list) {
          const row = document.createElement('div'); row.className = 'bank-account';
          const name = document.createElement('div'); name.textContent = `${account.bank_name} · ${account.account_number_masked}`;
          const status = document.createElement('small'); status.textContent = account.status; name.append(status); row.append(name);
          if (account.status === 'ACTIVE') {
            const sync = document.createElement('button'); sync.className = 'btn-secondary'; sync.textContent = 'Sync statements';
            sync.addEventListener('click', async () => {
              sync.disabled = true;
              try { await api('/api/bank/sync', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:account.id}) }); feedback('Statements synced. Overview updated.'); await app.fetchDashboard(); }
              catch(error) { feedback(error.message); } finally { sync.disabled = false; }
            }); row.append(sync);
          }
          accounts.append(row);
        }
      } catch(error) {
        document.getElementById('aaConnectionStatusBadge').textContent = 'Connection unavailable';
        feedback(error.message);
        if (error.message === 'Sign in to connect your bank account.') {
          const link = document.createElement('a'); link.href = '/'; link.className = 'btn-secondary'; link.textContent = 'Login or Register';
          document.getElementById('bankFeedback').append(document.createElement('br'),link);
        }
      }
    };
    document.getElementById('requestBankSetupBtn').addEventListener('click', () => { document.getElementById('bankSetupFields').hidden = false; app.fetchConnections(); });
    app.initiateBankSync = async () => {
      if (document.getElementById('bankSetupFields').hidden) return;
      const bankId = document.getElementById('bankChoice').value;
      const phoneNumber = document.getElementById('bankPhone').value.replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'');
      if (!bankId || !/^[6-9]\d{9}$/.test(phoneNumber)) { feedback('Select a bank and enter a valid 10-digit mobile number.'); return; }
      if (!document.getElementById('bankConsentCheck').checked) { feedback('Please review and accept the consent request.'); return; }
      requestButton.disabled = true;
      try {
        const result = await api('/api/bank/connect', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bankId,phoneNumber})});
        feedback(result.data?.isDemo ? 'Sandbox consent created. This connection uses test data.' : 'Consent requested. Approve it with your provider, then refresh accounts.');
        const consent = result.data?.consentUrl;
        if (consent) {
          const url = new URL(consent, location.origin);
          if (url.protocol === 'https:' || url.origin === location.origin) {
            const link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Review bank consent'; link.className = 'btn-secondary'; document.getElementById('bankFeedback').append(document.createElement('br'),link);
          }
        }
        await app.fetchConnections();
      } catch(error) { feedback(error.message); }
      finally { requestButton.disabled = false; }
    };
    document.getElementById('refreshBankAccountsBtn').addEventListener('click', () => app.fetchConnections());
    const loadView = app.loadViewData.bind(app);
    app.loadViewData = view => { updateMode(); app.updateUserUI(); loadView(view); if (view === 'settings') loadProfile(); if (recordControls[view]) recordControls[view](); };
    updateMode();
    if (recordControls[app.currentView]) recordControls[app.currentView]();
    translatePage();
  });
})();
