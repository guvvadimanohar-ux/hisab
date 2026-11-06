/**
 * Hisab AI - Kirana Merchant Application Controller
 * Handles SPA navigation, real data fetching, deterministic calculations,
 * CSV ingestion, Udhaar ledger, Customer intelligence, Bank sync, and AI Assistant.
 */

class HisabMerchantApp {
  constructor() {
    this.currentUser = null;
    this.currentView = 'dashboard';
    this.dashboardData = null;
    this.transactions = [];
    this.customers = [];
    this.credits = [];
    this.creditSummary = null;
    this.pendingCsv = null;
    this.isRecordingVoice = false;

    this.init();
  }

  async init() {
    this.setupNavigation();
    this.setupModals();
    this.setupCSVUpload();
    this.setupAssistant();
    this.setupSettings();

    // Check user session
    await this.checkAuth();

    // Load initial view from hash or default to dashboard
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigateTo(hash);
  }

  // =========================================================================
  // 1. Authentication & Session
  // =========================================================================
  async checkAuth() {
    const isStandaloneEnv = window.location.protocol === 'file:' ||
                            window.location.hostname === 'appassets.androidplatform.net' ||
                            window.IS_STANDALONE ||
                            window.AndroidBridge !== undefined ||
                            !navigator.onLine;

    if (isStandaloneEnv) {
      this.activateOfflineMode();
      return;
    }

    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      const user = data.data?.user;
      if (res.ok && data.success && user?.id) {
        this.isOfflineMode = false;
        this.currentUser = user;
        this.updateUserUI();
      } else {
        // A locally cached profile does not prove the server session is valid.
        this.activateOfflineMode();
      }
    } catch (err) {
      console.warn('Network unavailable, running in 100% Offline Standalone Mode:', err);
      this.activateOfflineMode();
    }
  }

  activateOfflineMode() {
    this.isOfflineMode = true;
    this.hideAuthModal();
    if (window.offlineHisabEngine) {
      this.currentUser = window.offlineHisabEngine.getProfile().user;
    } else {
      this.currentUser = { fullName: 'Kirana Store Owner', shopName: 'Shri Ganesh Kirana & General Stores' };
    }
    this.updateUserUI();
  }

  updateUserUI() {
    if (!this.currentUser) return;
    const shopName = this.currentUser.shopName || this.currentUser.shop_name || 'My Kirana Store';
    const ownerName = this.currentUser.fullName || this.currentUser.full_name || 'Shop Owner';

    const elShop = document.getElementById('sidebarShopName');
    if (elShop) elShop.textContent = shopName;

    const elOwner = document.getElementById('sidebarShopOwner');
    if (elOwner) elOwner.textContent = ownerName;

    const elAvatar = document.getElementById('sidebarShopAvatar');
    if (elAvatar) elAvatar.textContent = shopName.charAt(0).toUpperCase();

    const elTopShop = document.getElementById('topBarShopName');
    if (elTopShop) elTopShop.textContent = shopName;
  }

  showAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('open');
  }

  hideAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('open');
  }

  // =========================================================================
  // 2. Navigation & View Routing
  // =========================================================================
  setupNavigation() {
    // Desktop Nav Items
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const view = btn.getAttribute('data-view');
        this.navigateTo(view);
      });
    });

    // Mobile Bottom Nav Items
    document.querySelectorAll('.mobile-nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const view = btn.getAttribute('data-view');
        this.navigateTo(view);
      });
    });

    // Mobile Hamburger
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('appSidebar');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Hash change handler
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigateTo(hash, false);
    });
  }

  navigateTo(viewName, updateHash = true) {
    if (viewName === 'assistant' && window.openHisabAssistant) {
      window.openHisabAssistant();
      if (this.currentView === 'assistant' || !document.querySelector('.app-view.active')) this.navigateTo('dashboard');
      else if (this.currentView === 'dashboard' && !this.dashboardData) this.fetchDashboard();
      return;
    }
    this.currentView = viewName;
    if (updateHash) window.location.hash = viewName;

    // Update active state in nav bars
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      if (item.getAttribute('data-view') === viewName) item.classList.add('active');
      else item.classList.remove('active');
    });

    document.querySelectorAll('.mobile-nav-item[data-view]').forEach(item => {
      if (item.getAttribute('data-view') === viewName) item.classList.add('active');
      else item.classList.remove('active');
    });

    // Close mobile sidebar
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Show active view
    document.querySelectorAll('.app-view').forEach(viewEl => {
      if (viewEl.id === `view-${viewName}`) viewEl.classList.add('active');
      else viewEl.classList.remove('active');
    });

    // Update page title
    const titleEl = document.getElementById('pageTitleText');
    const subEl = document.getElementById('pageTitleSub');

    const titles = {
      dashboard: { title: 'Your shop at a glance', sub: 'A clear picture of your recorded money and customers' },
      transactions: { title: 'Your money book', sub: 'Every sale and expense, easy to find' },
      customers: { title: 'Your customers', sub: 'People who shop with you, and what they owe' },
      udhaar: { title: 'Udhaar & repayments', sub: 'See who owes you and record money collected' },
      connections: { title: 'Connected Accounts', sub: 'Bank Account Aggregator, UPI, and Payment Gateway' },
      assistant: { title: 'Ask Hisab AI', sub: 'Voice & text assistant answering queries from your real ledger' },
      tools: { title: 'Business Tools', sub: 'Supplier bills, collections, stock, customer orders and owner reviews' },
      settings: { title: 'Shop settings', sub: 'Your shop details, language and privacy choices' }
    };

    if (titleEl && titles[viewName]) titleEl.textContent = titles[viewName].title;
    if (subEl && titles[viewName]) subEl.textContent = titles[viewName].sub;

    // Start each screen at its heading and main actions.
    window.scrollTo?.({ top: 0, behavior: 'instant' });

    // Load view data
    this.loadViewData(viewName);
  }

  loadViewData(viewName) {
    switch (viewName) {
      case 'dashboard':
        this.fetchDashboard();
        break;
      case 'transactions':
        this.fetchTransactions();
        break;
      case 'customers':
        this.fetchCustomers();
        break;
      case 'udhaar':
        this.fetchUdhaar();
        break;
      case 'connections':
        this.fetchConnections();
        break;
      default:
        break;
    }
  }

  // =========================================================================
  // 3. Dashboard View Controller
  // =========================================================================
  async fetchDashboard() {
    if (this.isOfflineMode && window.offlineHisabEngine) {
      const json = window.offlineHisabEngine.getDashboardMetrics();
      this.dashboardData = json.data;
      this.renderDashboard();
      return;
    }

    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();

      if (json.success && json.data) {
        this.dashboardData = json.data;
        this.renderDashboard();
      }
    } catch (err) {
      console.error('fetchDashboard error, switching to offline data:', err);
      if (window.offlineHisabEngine) {
        this.isOfflineMode = true;
        const json = window.offlineHisabEngine.getDashboardMetrics();
        this.dashboardData = json.data;
        this.renderDashboard();
      }
    }
  }

  renderDashboard() {
    const data = this.dashboardData;
    if (!data) return;

    const txnCount = data.transactionCount || 0;
    const emptyState = document.getElementById('dashboardEmptyState');
    const statsContainer = document.getElementById('dashboardStatsContent');

    // Zero-Data State Rule from PRD:
    // If no real transactions exist, show the empty state explainer without fake numbers.
    if (txnCount === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (statsContainer) statsContainer.style.display = 'none';
      return;
    } else {
      if (emptyState) emptyState.style.display = 'none';
      if (statsContainer) statsContainer.style.display = 'block';
    }

    const kpis = data.kpis || {};
    const loans = data.loansSummary || {};

    // 1. KPI Cards
    const elInflow = document.getElementById('kpiTotalInflow');
    if (elInflow) elInflow.textContent = this.formatCurrency(kpis.totalInflow || 0);

    const elOutflow = document.getElementById('kpiTotalOutflow');
    if (elOutflow) elOutflow.textContent = this.formatCurrency(kpis.totalOutflow || 0);

    const elNet = document.getElementById('kpiNetCash');
    if (elNet) {
      elNet.textContent = this.formatCurrency(kpis.netCashFlow || 0);
      elNet.className = `kpi-value ${(kpis.netCashFlow || 0) >= 0 ? 'inflow' : 'outflow'}`;
    }

    const elUdhaar = document.getElementById('kpiOutstandingUdhaar');
    if (elUdhaar) elUdhaar.textContent = this.formatCurrency(loans.totalOutstanding || 0);

    const elTxns = document.getElementById('kpiTotalTxns');
    if (elTxns) elTxns.textContent = (kpis.transactionCount || 0).toLocaleString('en-IN');

    const elActiveCust = document.getElementById('kpiActiveCustomers');
    if (elActiveCust) elActiveCust.textContent = (kpis.activeCustomers || 0).toLocaleString('en-IN');

    const elAvgSpend = document.getElementById('kpiAvgSpend');
    if (elAvgSpend) elAvgSpend.textContent = this.formatCurrency(kpis.averageCustomerSpend || 0);

    const elRepeatRate = document.getElementById('kpiRepeatRate');
    if (elRepeatRate) elRepeatRate.textContent = `${(kpis.repeatCustomerRate || 0).toFixed(1)}%`;

    // 2. Render Visual Cash Flow Balance Scale
    this.renderVisualBalanceMeter(kpis);

    // 3. Render Real Cash Flow Trend Chart (Monthly Pillars)
    this.renderCashflowChart(data.cashflow || []);

    // 4. Render Visual Expense Split (Where Did Money Go?)
    this.renderVisualExpenseSplit(data.expenseCategories || [], kpis.totalOutflow || 0);

    // 5. Render Top Customers List
    this.renderTopCustomers(data.topCustomers || []);

    // 6. Products / Inventory Reinvestment Check (PRD Rule: never fabricate product data)
    this.renderProductAvailability(data);
  }

  // 1. Visual Cash Flow Balance Scale
  renderVisualBalanceMeter(kpis) {
    const container = document.getElementById('visualBalanceMeterContainer');
    if (!container) return;

    const inflow = Math.round(kpis.totalInflow || 0);
    const outflow = Math.round(kpis.totalOutflow || 0);
    const net = inflow - outflow;
    const turnover = inflow + outflow;

    if (turnover === 0) {
      container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--ink-muted);">No transaction records yet</div>';
      return;
    }

    const inPct = Math.max(Math.min(Math.round((inflow / turnover) * 1000) / 10, 100), 0);
    const outPct = Math.max(Math.min(Math.round((outflow / turnover) * 1000) / 10, 100), 0);

    const isDeficit = net < 0;
    const isSurplus = net > 0;

    let verdictIcon = '⚖️';
    let verdictTitle = 'Balanced Cash Flow (Break-Even)';
    let verdictSub = 'Money received and money spent are equal.';

    if (isDeficit) {
      verdictIcon = '⚠️';
      verdictTitle = 'Expenses are higher than money received';
      verdictSub = `₹${Math.abs(net).toLocaleString('en-IN')} more went out for supplier payouts & store expenses`;
    } else if (isSurplus) {
      verdictIcon = '🎉';
      verdictTitle = 'Positive net cash flow';
      verdictSub = `You have ₹${net.toLocaleString('en-IN')} in positive net store cash flow`;
    }

    container.innerHTML = `
      <div class="balance-grid">
        <!-- Inflow / Money In Card -->
        <div class="balance-card inflow">
          <div class="balance-card-icon" title="Money Received / Inflow">💰</div>
          <div class="balance-card-content">
            <div class="balance-card-tag">
              <span>MONEY IN</span>
              <span class="balance-pct-badge">${inPct.toFixed(1)}%</span>
            </div>
            <div class="balance-card-amount">₹${inflow.toLocaleString('en-IN')}</div>
            <div class="balance-card-title">Total Received (Sales)</div>
          </div>
        </div>

        <!-- Center Ratio Bar & Verdict Callout -->
        <div class="balance-center-meter">
          <div class="balance-ratio-bar-wrap">
            <div class="balance-ratio-header">
              <span style="color: var(--shop-green);">🟢 Money In: ${inPct.toFixed(0)}%</span>
              <span style="color: var(--ink-secondary);">⚖️ Balance Scale</span>
              <span style="color: var(--vermilion);">Money Out: ${outPct.toFixed(0)}% 🔴</span>
            </div>
            <div class="ratio-bar-container" title="Money In: ${inPct.toFixed(1)}% | Money Out: ${outPct.toFixed(1)}%">
              <div class="ratio-seg-inflow" style="width: ${inPct}%;">
                ${inPct >= 12 ? `${inPct.toFixed(0)}% In` : ''}
              </div>
              <div class="ratio-seg-outflow" style="width: ${outPct}%;">
                ${outPct >= 12 ? `${outPct.toFixed(0)}% Out` : ''}
              </div>
            </div>
          </div>

          <div class="balance-verdict-card ${isDeficit ? 'deficit' : (isSurplus ? 'surplus' : '')}">
            <div class="verdict-icon">${verdictIcon}</div>
            <div>
              <div class="verdict-text-title">${verdictTitle}</div>
              <div class="verdict-text-sub">${verdictSub}</div>
            </div>
          </div>
        </div>

        <!-- Outflow / Money Out Card -->
        <div class="balance-card outflow">
          <div class="balance-card-icon" title="Money Spent / Expenses">🛒</div>
          <div class="balance-card-content">
            <div class="balance-card-tag">
              <span>MONEY OUT</span>
              <span class="balance-pct-badge">${outPct.toFixed(1)}%</span>
            </div>
            <div class="balance-card-amount">₹${outflow.toLocaleString('en-IN')}</div>
            <div class="balance-card-title">Total Spent (Spend)</div>
          </div>
        </div>
      </div>
    `;
  }

  // 2. Soundbox Speech Narration (Plain English)
  speakCashflowSummary() {
    const btn = document.getElementById('listenCashflowAudioBtn');
    const kpis = this.dashboardData?.kpis || {};
    const inflow = Math.round(kpis.totalInflow || 0);
    const outflow = Math.round(kpis.totalOutflow || 0);
    const net = inflow - outflow;

    let spokenText = `Store Cash Flow Summary. Total money received is ${inflow.toLocaleString('en-IN')} rupees. Total money spent is ${outflow.toLocaleString('en-IN')} rupees. `;
    if (net < 0) {
      spokenText += `Expenses exceeded receipts by ${Math.abs(net).toLocaleString('en-IN')} rupees.`;
    } else if (net > 0) {
      spokenText += `Your store has a positive net cash surplus of ${net.toLocaleString('en-IN')} rupees.`;
    } else {
      spokenText += `Your cash receipts and expenses are balanced.`;
    }

    if (!('speechSynthesis' in window)) {
      alert(spokenText);
      return;
    }

    // Cancel any previous speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = 'en-IN';
    utterance.rate = 0.95;

    // Pick Indian English voice if available
    const voices = window.speechSynthesis.getVoices();
    const indVoice = voices.find(v => v.lang.includes('IN') || v.lang.startsWith('en'));
    if (indVoice) utterance.voice = indVoice;

    if (btn) btn.classList.add('speaking');

    utterance.onend = () => {
      if (btn) btn.classList.remove('speaking');
    };

    utterance.onerror = () => {
      if (btn) btn.classList.remove('speaking');
    };

    window.speechSynthesis.speak(utterance);
  }

  // 3. Monthly Money Flow Pillars Chart
  renderCashflowChart(cashflow) {
    const container = document.getElementById('cashflowChartSvg');
    if (!container) return;

    // Extract periods safely whether cashflow is an array or { periods: [...] }
    const periods = Array.isArray(cashflow) ? cashflow : (cashflow?.periods || []);

    if (!periods || periods.length === 0) {
      container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: var(--ink-muted);">No monthly cash flow data yet</div>';
      return;
    }

    const recent = periods.slice(-6); // Display up to last 6 periods
    const maxVal = Math.max(...recent.map(p => Math.max(Number(p.inflow || 0), Number(p.outflow || 0))), 1000);

    const monthNames = {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
      '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
      '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    };

    let html = `<div class="monthly-pillars-grid">`;

    recent.forEach(p => {
      const inAmt = Math.round(Number(p.inflow || 0));
      const outAmt = Math.round(Number(p.outflow || 0));
      const net = inAmt - outAmt;

      // Scale height to 135px maximum
      const inHeight = Math.max(Math.round((inAmt / maxVal) * 130), inAmt > 0 ? 8 : 2);
      const outHeight = Math.max(Math.round((outAmt / maxVal) * 130), outAmt > 0 ? 8 : 2);

      // Parse month
      const pStr = String(p.period || p.month || '');
      const parts = pStr.split('-');
      const mNum = parts[1] || '';
      const yrShort = parts[0] ? parts[0].slice(2) : '';
      const mName = monthNames[mNum] || pStr;
      const mDisplay = parts[0] ? `${mName} '${yrShort}` : pStr;

      const isPos = net >= 0;
      const netBadge = isPos 
        ? `<span class="monthly-net-tag pos" title="Net Savings: ₹${net.toLocaleString('en-IN')}">+₹${this.formatShortAmount(net)}</span>`
        : `<span class="monthly-net-tag neg" title="Net Spend: ₹${Math.abs(net).toLocaleString('en-IN')}">-₹${this.formatShortAmount(Math.abs(net))}</span>`;

      html += `
        <div class="monthly-col" title="${mName} ${parts[0] || ''}&#10;🟢 Money In: ₹${inAmt.toLocaleString('en-IN')}&#10;🔴 Money Out: ₹${outAmt.toLocaleString('en-IN')}&#10;⚖️ Net: ₹${net.toLocaleString('en-IN')}">
          <div class="monthly-bars-pair">
            <!-- Inflow Pillar (Green) -->
            <div class="pillar-bar-wrap">
              <span class="pillar-amount-tag" style="color: var(--shop-green);">${inAmt > 0 ? this.formatShortAmount(inAmt) : ''}</span>
              <div class="pillar-bar inflow" style="height: ${inHeight}px;"></div>
            </div>
            <!-- Outflow Pillar (Red) -->
            <div class="pillar-bar-wrap">
              <span class="pillar-amount-tag" style="color: var(--vermilion);">${outAmt > 0 ? this.formatShortAmount(outAmt) : ''}</span>
              <div class="pillar-bar outflow" style="height: ${outHeight}px;"></div>
            </div>
          </div>
          <div class="monthly-col-footer">
            <span class="monthly-label">${mDisplay}</span>
            ${netBadge}
          </div>
        </div>
      `;
    });

    html += `</div>
      <div style="display: flex; align-items: center; justify-content: center; gap: 2rem; margin-top: 0.85rem; font-size: 0.82rem;">
        <span style="display: flex; align-items: center; gap: 0.45rem; color: var(--shop-green); font-weight: 700;">
          <span style="width: 12px; height: 12px; background-color: var(--shop-green); border-radius: 3px;"></span>
          🟢 Money In (Sales)
        </span>
        <span style="display: flex; align-items: center; gap: 0.45rem; color: var(--vermilion); font-weight: 700;">
          <span style="width: 12px; height: 12px; background-color: var(--vermilion); border-radius: 3px;"></span>
          🔴 Money Out (Spend)
        </span>
      </div>
    `;

    container.innerHTML = html;
  }

  // 4. Where Did Money Go? Visual Category Breakdown (Appropriate Kirana Options Only)
  renderVisualExpenseSplit(categories, totalOutflow) {
    const container = document.getElementById('visualExpenseCategoryGrid');
    if (!container) return;

    // Filter out internal non-expense items or items with 0 spend
    const validCategories = (categories || []).filter(item => {
      if (item.category === 'Customer Credit') return false; // Internal ledger credit, not an expense
      return Number(item.totalAmount || item.amount || 0) > 0;
    });

    if (validCategories.length === 0) {
      container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--ink-muted);">No categorized store expenses recorded yet</div>';
      return;
    }

    // Meaningful Kirana store expense categories with relatable emojis
    const CAT_META = {
      'General Expenses': {
        title: 'Wholesale Stock & Suppliers',
        sub: 'Stock purchases & distributor payouts',
        emoji: '🏪',
        color: '#BA3826'
      },
      'Loan & EMI': {
        title: 'Udhaar & Loan Repayments',
        sub: 'Credit settlements & vendor loan EMIs',
        emoji: '🤝',
        color: '#B45309'
      },
      'Food & Dining': {
        title: 'Tea, Snacks & Daily Expenses',
        sub: 'Store refreshments & daily staff meals',
        emoji: '☕',
        color: '#D49A2A'
      },
      'Groceries': {
        title: 'Daily Groceries & Provisions',
        sub: 'Bread, milk, dairy & dry goods',
        emoji: '🍞',
        color: '#176B45'
      },
      'Shopping': {
        title: 'Store Supplies & Packaging',
        sub: 'Packing bags, tape, bill rolls & registers',
        emoji: '🛍️',
        color: '#7C3AED'
      },
      'Bills & Utilities': {
        title: 'Electricity & Store Utility Bills',
        sub: 'Power, water & shop internet bills',
        emoji: '💡',
        color: '#2563EB'
      },
      'Transport': {
        title: 'Tempo, Delivery & Fuel',
        sub: 'Goods transport, auto freight & petrol',
        emoji: '🚚',
        color: '#0D9488'
      },
      'Healthcare': {
        title: 'Medical & Personal Expenses',
        sub: 'Emergency healthcare & pharmacy',
        emoji: '💊',
        color: '#DC2626'
      },
      'Other': {
        title: 'Other Store Expenses',
        sub: 'Miscellaneous shop payouts',
        emoji: '💳',
        color: '#4B5563'
      }
    };

    container.innerHTML = validCategories.slice(0, 6).map(item => {
      const meta = CAT_META[item.category] || {
        title: item.category,
        sub: 'Store expenses',
        emoji: '🏷️',
        color: '#66706B'
      };
      const pct = Number(item.percentage || 0);
      const amount = Math.round(Number(item.totalAmount || item.amount || 0));
      const count = item.transactionCount || item.count || 1;

      return `
        <div class="visual-cat-card">
          <div class="cat-card-header">
            <div class="cat-card-icon" style="border-color: ${meta.color}33;">
              <span style="font-size: 1.4rem;">${meta.emoji}</span>
            </div>
            <div class="cat-card-info">
              <div class="cat-card-title">${meta.title}</div>
              <div class="cat-card-sub">${meta.sub} · ${count} ${count === 1 ? 'payment' : 'payments'}</div>
            </div>
          </div>
          <div class="cat-progress-track">
            <div class="cat-progress-fill" style="width: ${Math.min(Math.max(pct, 4), 100)}%; background-color: ${meta.color};"></div>
          </div>
          <div class="cat-card-footer">
            <span class="cat-card-amount">₹${amount.toLocaleString('en-IN')}</span>
            <span class="cat-card-pct" style="color: ${meta.color}; font-weight: 700;">${pct.toFixed(1)}%</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderTopCustomers(customers) {
    const listEl = document.getElementById('dashboardTopCustomersList');
    if (!listEl) return;

    if (!customers || customers.length === 0) {
      listEl.innerHTML = '<div style="padding: 1rem; color: var(--ink-muted); font-size: 0.84rem;">No customer records yet.</div>';
      return;
    }

    listEl.innerHTML = customers.map(c => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0; border-bottom: 1px solid var(--border-subtle);">
        <div>
          <div style="font-weight: 600; font-size: 0.9rem; color: var(--ink);">${this.escapeHtml(c.name)}</div>
          <div style="font-size: 0.76rem; color: var(--ink-muted);">${c.transactionCount || 1} transactions</div>
        </div>
        <div style="font-family: var(--font-mono); font-weight: 600; color: var(--shop-green);">
          ${this.formatCurrency(c.totalInflow || c.totalPaid || 0)}
        </div>
      </div>
    `).join('');
  }

  renderProductAvailability(data) {
    const noticeEl = document.getElementById('dashboardProductAnalysisNotice');
    if (noticeEl && window.HisabShopTools) window.HisabShopTools.renderInventoryNotice(noticeEl);

  }

  // =========================================================================
  // 4. Transactions View Controller
  // =========================================================================
  async fetchTransactions() {
    const search = document.getElementById('txnSearchInput')?.value || '';
    const flow = document.getElementById('txnFlowFilter')?.value || '';
    const source = document.getElementById('txnSourceFilter')?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (flow) params.append('flow', flow);
    if (source) params.append('source', source);

    if (this.isOfflineMode && window.offlineHisabEngine) {
      const res = window.offlineHisabEngine.getTransactions({ search, flow });
      this.transactions = res.data.map(t => ({
        ...t,
        cash_flow_type: t.flow === 'IN' ? 'INFLOW' : 'OUTFLOW',
        customer_name: t.customerName,
        payment_method: t.mode,
        date: t.createdAt
      }));
      this.renderTransactionsTable();
      return;
    }

    try {
      const res = await fetch(`/api/transactions?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        this.transactions = json.data.transactions || [];
        this.renderTransactionsTable();
      }
    } catch (err) {
      console.error('fetchTransactions error, switching to offline data:', err);
      if (window.offlineHisabEngine) {
        this.isOfflineMode = true;
        const res = window.offlineHisabEngine.getTransactions({ search, flow });
        this.transactions = res.data.map(t => ({
          ...t,
          cash_flow_type: t.flow === 'IN' ? 'INFLOW' : 'OUTFLOW',
          customer_name: t.customerName,
          payment_method: t.mode,
          date: t.createdAt
        }));
        this.renderTransactionsTable();
      }
    }
  }

  renderTransactionsTable() {
    const tbody = document.getElementById('txnTableBody');
    const countEl = document.getElementById('txnFilteredCount');
    if (!tbody) return;

    if (countEl) countEl.textContent = `${this.transactions.length} records`;

    if (this.transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem 1rem; color: var(--ink-muted);">
            No transactions found. Upload a CSV or record a manual transaction.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.transactions.map(t => {
      const isInflow = t.cash_flow_type === 'INFLOW';
      const badgeClass = isInflow ? 'badge-inflow' : 'badge-outflow';
      const badgeText = isInflow ? 'JAMA' : 'KHARCH';
      const amountClass = isInflow ? 'inflow' : 'outflow';
      const sign = isInflow ? '+' : '-';
      const party = t.customer_name || t.merchant || 'Counterparty';

      return `
        <tr style="cursor: pointer;" onclick="window.merchantApp.showTransactionDetail('${t.id}')">
          <td style="white-space: nowrap; font-size: 0.82rem; color: var(--ink-secondary);">${t.date || ''}</td>
          <td>
            <div style="font-weight: 600; color: var(--ink);">${this.escapeHtml(party)}</div>
            <div style="font-size: 0.76rem; color: var(--ink-muted);">${this.escapeHtml(t.description || t.narration || '')}</div>
          </td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td style="font-size: 0.8rem; color: var(--ink-secondary);">${this.escapeHtml(t.category || 'General')}</td>
          <td style="font-size: 0.78rem;"><span class="badge badge-upi">${t.mode || t.source || 'PAYMENT'}</span></td>
          <td class="table-num ${amountClass}" style="text-align: right;">
            ${sign}${this.formatCurrency(t.amount || 0)}
          </td>
        </tr>
      `;
    }).join('');
  }

  showTransactionDetail(txnId) {
    const txn = this.transactions.find(t => t.id === txnId);
    if (!txn) return;

    const modal = document.getElementById('txnDetailModal');
    const body = document.getElementById('txnDetailModalBody');
    if (!modal || !body) return;

    const isInflow = txn.cash_flow_type === 'INFLOW';
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div style="background-color: var(--surface-alt); padding: 1rem; border-radius: 6px; border: 1px solid var(--border);">
          <div style="font-size: 0.76rem; text-transform: uppercase; color: var(--ink-muted); font-weight: 600;">Transaction Amount</div>
          <div style="font-family: var(--font-mono); font-size: 1.8rem; font-weight: 700; color: ${isInflow ? 'var(--shop-green)' : 'var(--vermilion)'};">
            ${isInflow ? '+' : '-'}${this.formatCurrency(txn.amount || 0)}
          </div>
        </div>

        <table style="width: 100%; font-size: 0.86rem; border-collapse: collapse;">
          <tr><td style="padding: 0.4rem 0; color: var(--ink-muted);">Party:</td><td style="font-weight: 600; text-align: right;">${this.escapeHtml(txn.customer_name || txn.merchant || 'None')}</td></tr>
          <tr><td style="padding: 0.4rem 0; color: var(--ink-muted);">Date &amp; Time:</td><td style="text-align: right;">${txn.date} ${txn.time || ''}</td></tr>
          <tr><td style="padding: 0.4rem 0; color: var(--ink-muted);">Direction:</td><td style="text-align: right;"><span class="badge ${isInflow ? 'badge-inflow' : 'badge-outflow'}">${txn.cash_flow_type}</span></td></tr>
          <tr><td style="padding: 0.4rem 0; color: var(--ink-muted);">Category:</td><td style="text-align: right;">${this.escapeHtml(txn.category || 'General')}</td></tr>
          <tr><td style="padding: 0.4rem 0; color: var(--ink-muted);">Mode / Source:</td><td style="text-align: right;">${txn.mode || ''} (${txn.source || 'Manual'})</td></tr>
          <tr><td style="padding: 0.4rem 0; color: var(--ink-muted);">Reference:</td><td style="font-family: var(--font-mono); font-size: 0.78rem; text-align: right;">${txn.reference_number || 'N/A'}</td></tr>
          <tr><td style="padding: 0.4rem 0; color: var(--ink-muted);">System ID:</td><td style="font-family: var(--font-mono); font-size: 0.78rem; text-align: right;">${txn.id}</td></tr>
        </table>

        <div style="font-size: 0.78rem; color: var(--ink-secondary); background-color: var(--paper); padding: 0.65rem 0.85rem; border-radius: 4px; border: 1px solid var(--border);">
          <strong>Narration:</strong> ${this.escapeHtml(txn.description || txn.narration || 'No note recorded')}
        </div>
      </div>
    `;

    modal.classList.add('open');
  }

  // =========================================================================
  // 5. Customers & Counterparty Intelligence
  // =========================================================================
  async fetchCustomers() {
    if (this.isOfflineMode && window.offlineHisabEngine) {
      const res = window.offlineHisabEngine.getCustomers();
      this.customers = res.data.map(c => ({
        ...c,
        total_credit_outstanding: c.outstandingDue,
        total_transactions: c.transactionCount
      }));
      this.renderCustomersView();
      return;
    }

    try {
      const res = await fetch('/api/customers');
      const json = await res.json();
      if (json.success && json.data) {
        this.customers = json.data.customers || json.data.allCustomers || [];
        this.renderCustomersView();
      }
    } catch (err) {
      console.error('fetchCustomers error, switching to offline customers:', err);
      if (window.offlineHisabEngine) {
        this.isOfflineMode = true;
        const res = window.offlineHisabEngine.getCustomers();
        this.customers = res.data.map(c => ({
          ...c,
          total_credit_outstanding: c.outstandingDue,
          total_transactions: c.transactionCount
        }));
        this.renderCustomersView();
      }
    }
  }

  renderCustomersView() {
    const listEl = document.getElementById('customersListBody');
    const suggestionsEl = document.getElementById('customerSuggestionsContainer');

    // 1. Render Counterparty Match Suggestions
    // Detect frequent payers from transactions who are not yet added as formal customers
    if (suggestionsEl && this.transactions.length > 0) {
      const counts = new Map();
      const confirmedNames = new Set(this.customers.map(c => c.name.toLowerCase()));

      for (const t of this.transactions) {
        const name = (t.customer_name || t.merchant || '').trim();
        if (!name || confirmedNames.has(name.toLowerCase())) continue;
        const entry = counts.get(name) || { name, count: 0, totalPaid: 0 };
        entry.count += 1;
        if (t.cash_flow_type === 'INFLOW') entry.totalPaid += Number(t.amount || 0);
        counts.set(name, entry);
      }

      const frequentUnconfirmed = Array.from(counts.values()).filter(c => c.count >= 2);

      if (frequentUnconfirmed.length > 0) {
        suggestionsEl.innerHTML = `
          <div class="suggestion-box">
            <div class="suggestion-box-header">
              <span class="suggestion-box-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Suggested Customer Matches (${frequentUnconfirmed.length} detected from repeated transactions)
              </span>
            </div>
            <div class="suggestions-list">
              ${frequentUnconfirmed.map(item => `
                <div class="suggestion-card">
                  <div>
                    <div class="suggestion-party-name">${this.escapeHtml(item.name)}</div>
                    <div class="suggestion-party-meta">${item.count} payments · Total: ${this.formatCurrency(item.totalPaid)}</div>
                  </div>
                  <button class="btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;" onclick="window.merchantApp.confirmSuggestedCustomer('${this.escapeHtml(item.name)}')">
                    + Add Customer
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        suggestionsEl.innerHTML = '';
      }
    }

    // 2. Render Confirmed Customers
    if (!listEl) return;

    if (this.customers.length === 0) {
      listEl.innerHTML = `
        <div style="background-color: var(--surface); border: 1px dashed var(--border-strong); border-radius: 8px; padding: 3rem 1.5rem; text-align: center;">
          <h4 style="font-family: var(--font-display); font-size: 1.2rem; color: var(--ink); margin-bottom: 0.35rem;">No customers added yet</h4>
          <p style="color: var(--ink-secondary); font-size: 0.88rem; max-width: 440px; margin: 0 auto 1.25rem;">
            Customers appear automatically when transactions are imported, or you can add your regular kirana buyers manually.
          </p>
          <button class="btn-primary" onclick="window.merchantApp.openAddCustomerModal()">+ Add Customer</button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Udhaar Balance</th>
              <th>Total Received</th>
              <th>Notes / Address</th>
              <th style="text-align: right; min-width: 230px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.customers.map(c => {
              const due = Number(c.outstandingBalance || c.totalUdhaar || 0);
              const safeName = this.escapeHtml(c.name || 'Customer');
              const phone = c.phone || '';
              return `
                <tr>
                  <td style="font-weight: 700; color: var(--ink);">${safeName}</td>
                  <td style="color: var(--ink-secondary); font-family: var(--font-mono); font-size: 0.84rem;">${phone || '—'}</td>
                  <td class="table-num" style="color: ${due > 0 ? '#B45309' : 'var(--ink-muted)'}; font-weight: ${due > 0 ? '700' : '500'};">
                    ${this.formatCurrency(due)}
                  </td>
                  <td class="table-num inflow">${this.formatCurrency(c.totalPaid || c.totalInflow || 0)}</td>
                  <td style="font-size: 0.8rem; color: var(--ink-muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${this.escapeHtml(c.notes || '—')}
                  </td>
                  <td style="text-align: right;">
                    <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.35rem; flex-wrap: wrap;">
                      ${due > 0 ? `
                        <button class="btn-primary" style="background-color: #25D366; border-color: #1EBE5D; color: #FFF; padding: 0.3rem 0.55rem; font-size: 0.74rem;" title="Send WhatsApp / Text Reminder" onclick="window.merchantApp.openSendReminderModal('${c.id}', '${safeName}', '${phone}', ${due})">
                          💬 Reminder
                        </button>
                      ` : ''}
                      <button class="btn-secondary" style="padding: 0.3rem 0.55rem; font-size: 0.74rem;" title="Give Store Udhaar" onclick="window.merchantApp.openGiveUdhaarModal('${c.id}', '${safeName}')">
                        + Udhaar
                      </button>
                      <button class="btn-secondary" style="padding: 0.3rem 0.55rem; font-size: 0.74rem;" title="Edit Customer Details" onclick="window.merchantApp.openEditCustomerModal('${c.id}')">
                        ✏️ Edit
                      </button>
                      <button class="btn-danger" style="padding: 0.3rem 0.55rem; font-size: 0.74rem;" title="Delete Customer" onclick="window.merchantApp.deleteCustomer('${c.id}', '${safeName}')">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Customer Actions: Add, Edit, Delete
  openAddCustomerModal() {
    const nameEl = document.getElementById('addCustName');
    const phoneEl = document.getElementById('addCustPhone');
    const notesEl = document.getElementById('addCustNotes');
    if (nameEl) nameEl.value = '';
    if (phoneEl) phoneEl.value = '';
    if (notesEl) notesEl.value = '';
    this.openModal('addCustomerModal');
  }

  async openEditCustomerModal(customerId) {
    let cust = (this.customers || []).find(c => String(c.id) === String(customerId));
    if (!cust) {
      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`);
        const json = await res.json();
        if (json.success && json.data) cust = json.data;
      } catch (err) {
        console.error(err);
      }
    }
    if (!cust) {
      alert('Customer details could not be loaded.');
      return;
    }

    const idEl = document.getElementById('editCustId');
    const nameEl = document.getElementById('editCustName');
    const phoneEl = document.getElementById('editCustPhone');
    const notesEl = document.getElementById('editCustNotes');

    if (idEl) idEl.value = cust.id;
    if (nameEl) nameEl.value = cust.name || '';
    if (phoneEl) phoneEl.value = cust.phone || '';
    if (notesEl) notesEl.value = cust.notes || '';

    this.openModal('editCustomerModal');
  }

  async deleteCustomer(customerId, customerName) {
    const confirmed = confirm(`Are you sure you want to delete customer "${customerName}"?\nThis will remove them from your customer list.`);
    if (!confirmed) return;

    if (this.isOfflineMode && window.offlineHisabEngine) {
      window.offlineHisabEngine.deleteCustomer(customerId);
      this.fetchCustomers();
      this.fetchDashboard();
      return;
    }

    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        this.fetchCustomers();
        this.fetchDashboard();
      } else {
        alert(data.error?.message || 'Failed to delete customer');
      }
    } catch (err) {
      console.error('deleteCustomer error:', err);
      if (window.offlineHisabEngine) {
        window.offlineHisabEngine.deleteCustomer(customerId);
        this.fetchCustomers();
        this.fetchDashboard();
      } else {
        alert('Network error while deleting customer');
      }
    }
  }

  async confirmSuggestedCustomer(name) {
    if (this.isOfflineMode && window.offlineHisabEngine) {
      window.offlineHisabEngine.addCustomer({ name });
      this.fetchCustomers();
      return;
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        this.fetchCustomers();
      }
    } catch (err) {
      console.error('confirmSuggestedCustomer error:', err);
    }
  }

  // =========================================================================
  // 6. Udhaar / Aruvu Ledger Controller
  // =========================================================================
  async fetchUdhaar() {
    if (this.isOfflineMode && window.offlineHisabEngine) {
      const summaryRes = window.offlineHisabEngine.getCreditSummary();
      const creditsRes = window.offlineHisabEngine.getCredits();
      this.creditSummary = {
        totalOutstanding: summaryRes.data.pendingBalance,
        activeCount: summaryRes.data.activeBorrowers,
        totalRepaid: summaryRes.data.totalCollected
      };
      this.credits = creditsRes.data.map(c => ({
        ...c,
        customer_name: c.customerName,
        customer_phone: c.customerPhone,
        outstanding_amount: c.outstandingAmount,
        repaid_amount: c.repaidAmount,
        due_date: c.dueDate
      }));
      this.renderUdhaarView();
      return;
    }

    try {
      const [resSummary, resCredits] = await Promise.all([
        fetch('/api/credit/summary'),
        fetch('/api/credit')
      ]);

      const dataSummary = await resSummary.json();
      const dataCredits = await resCredits.json();

      if (dataSummary.success) this.creditSummary = dataSummary.data;
      if (dataCredits.success) this.credits = dataCredits.data?.credits || [];

      this.renderUdhaarView();
    } catch (err) {
      console.error('fetchUdhaar error, switching to offline ledger:', err);
      if (window.offlineHisabEngine) {
        this.isOfflineMode = true;
        const summaryRes = window.offlineHisabEngine.getCreditSummary();
        const creditsRes = window.offlineHisabEngine.getCredits();
        this.creditSummary = {
          totalOutstanding: summaryRes.data.pendingBalance,
          activeCount: summaryRes.data.activeBorrowers,
          totalRepaid: summaryRes.data.totalCollected
        };
        this.credits = creditsRes.data.map(c => ({
          ...c,
          customer_name: c.customerName,
          customer_phone: c.customerPhone,
          outstanding_amount: c.outstandingAmount,
          repaid_amount: c.repaidAmount,
          due_date: c.dueDate
        }));
        this.renderUdhaarView();
      }
    }
  }

  renderUdhaarView() {
    const summary = this.creditSummary || {};
    const elTotal = document.getElementById('udhaarTotalOutstanding');
    if (elTotal) elTotal.textContent = this.formatCurrency(summary.totalOutstanding || 0);

    const elActive = document.getElementById('udhaarActiveAccountsCount');
    if (elActive) elActive.textContent = (summary.activeCount || summary.activeCustomersCount || 0).toLocaleString('en-IN');

    const elRepaid = document.getElementById('udhaarTotalRepaid');
    if (elRepaid) elRepaid.textContent = this.formatCurrency(summary.totalRepaid || 0);

    const tbody = document.getElementById('udhaarTableBody');
    if (!tbody) return;

    if (this.credits.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem 1rem; color: var(--ink-muted);">
            No udhaar (credit) entries yet. Click "+ Give Udhaar" to record customer credit.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.credits.map(cr => {
      const principal = Number(cr.amount || 0);
      const repaid = Number(cr.paid_amount ?? cr.repaid ?? 0);
      const outstanding = Number(cr.outstanding_amount ?? cr.outstanding ?? 0);
      const isSettled = cr.status === 'PAID' || cr.status === 'Paid' || outstanding <= 0;
      const custName = cr.customer_name || cr.customerName || 'Customer';
      const custPhone = cr.customer_phone || cr.customerPhone || '';
      const safeCustName = this.escapeHtml(custName);
      const date = cr.issued_at || cr.date || '';

      const statusBadge = isSettled ? '<span class="badge badge-settled">Settled</span>' :
                          (cr.status === 'Overdue' ? '<span class="badge badge-partial" style="background-color: #FEE2E2; color: #DC2626;">Overdue</span>' :
                          (repaid > 0 ? '<span class="badge badge-partial">Partially Paid</span>' : '<span class="badge badge-open">Pending</span>'));

      return `
        <tr>
          <td style="font-size: 0.82rem; color: var(--ink-secondary);">${date}</td>
          <td style="font-weight: 700; color: var(--ink);">${safeCustName}</td>
          <td style="font-size: 0.82rem; color: var(--ink-muted);">${this.escapeHtml(cr.description || 'Store credit')}</td>
          <td class="table-num">${this.formatCurrency(principal)}</td>
          <td class="table-num inflow">${this.formatCurrency(repaid)}</td>
          <td class="table-num" style="color: ${outstanding > 0 ? '#B45309' : 'var(--ink-muted)'}; font-weight: 700;">
            ${this.formatCurrency(outstanding)}
          </td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.35rem; flex-wrap: wrap;">
              ${!isSettled ? `
                <button class="btn-primary" style="background-color: #25D366; border-color: #1EBE5D; color: #FFF; padding: 0.3rem 0.55rem; font-size: 0.74rem;" title="Send WhatsApp / Text Reminder" onclick="window.merchantApp.openSendReminderModal('${cr.customer_id || cr.customerId || ''}', '${safeCustName}', '${custPhone}', ${outstanding})">
                  💬 Reminder
                </button>
                <button class="btn-primary" style="padding: 0.3rem 0.55rem; font-size: 0.74rem;" title="Record Repayment" onclick="window.merchantApp.openRepaymentModal('${cr.id}', '${outstanding}', '${safeCustName}')">
                  Repay
                </button>
              ` : '<span style="color: var(--shop-green); font-size: 0.76rem; font-weight: 600; margin-right: 0.35rem;">✓ Settled</span>'}
              <button class="btn-secondary" style="padding: 0.3rem 0.55rem; font-size: 0.74rem;" title="Update Status / Due Date" onclick="window.merchantApp.openUpdateLoanModal('${cr.id}', '${safeCustName}', ${outstanding}, '${cr.status || 'Pending'}', '${cr.due_date || cr.dueDate || ''}', '${this.escapeHtml(cr.description || '')}')">
                ✏️ Status
              </button>
              <button class="btn-danger" style="padding: 0.3rem 0.55rem; font-size: 0.74rem;" title="Delete Udhaar Entry" onclick="window.merchantApp.deleteUdhaarEntry('${cr.id}', '${safeCustName}')">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Loan Status & Udhaar Management
  openUpdateLoanModal(creditId, customerName, outstanding, status, dueDate, desc) {
    const idEl = document.getElementById('updateLoanId');
    const custEl = document.getElementById('updateLoanCustName');
    const dueEl = document.getElementById('updateLoanDueAmt');
    const statusEl = document.getElementById('updateLoanStatus');
    const dateEl = document.getElementById('updateLoanDueDate');
    const descEl = document.getElementById('updateLoanDesc');

    if (idEl) idEl.value = creditId;
    if (custEl) custEl.textContent = customerName || 'Customer';
    if (dueEl) dueEl.textContent = this.formatCurrency(outstanding || 0);
    if (statusEl) statusEl.value = status || 'Pending';
    if (dateEl) dateEl.value = dueDate ? String(dueDate).slice(0, 10) : '';
    if (descEl) descEl.value = desc || '';

    this.openModal('updateLoanModal');
  }

  async deleteUdhaarEntry(creditId, customerName) {
    const confirmed = confirm(`Are you sure you want to delete this udhaar record for "${customerName}"?`);
    if (!confirmed) return;

    if (this.isOfflineMode && window.offlineHisabEngine) {
      window.offlineHisabEngine.deleteCredit(creditId);
      this.fetchUdhaar();
      this.fetchDashboard();
      return;
    }

    try {
      const res = await fetch(`/api/credit/${encodeURIComponent(creditId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        this.fetchUdhaar();
        this.fetchDashboard();
      } else {
        alert(data.error?.message || 'Failed to delete udhaar entry');
      }
    } catch (err) {
      console.error('deleteUdhaarEntry error:', err);
      if (window.offlineHisabEngine) {
        window.offlineHisabEngine.deleteCredit(creditId);
        this.fetchUdhaar();
        this.fetchDashboard();
      } else {
        alert('Network error while deleting udhaar entry');
      }
    }
  }

  // WhatsApp & SMS Dues Reminder System
  openSendReminderModal(customerId, customerName, phone, dueAmount) {
    const nameEl = document.getElementById('reminderCustName');
    const dueEl = document.getElementById('reminderDueAmt');
    const phoneEl = document.getElementById('reminderPhone');
    const msgEl = document.getElementById('reminderMessageText');

    const shopName = this.user?.shopName || document.getElementById('sidebarShopName')?.textContent || 'Our Store';
    const numAmt = Math.round(Number(dueAmount || 0));

    if (nameEl) nameEl.textContent = customerName || 'Customer';
    if (dueEl) dueEl.textContent = this.formatCurrency(numAmt);
    if (phoneEl) phoneEl.value = phone || '';

    const defaultMsg = `Namaste ${customerName || ''} ji! This is a gentle reminder from ${shopName}. Your outstanding ledger balance is ₹${numAmt.toLocaleString('en-IN')}. Kindly arrange payment when convenient. Thank you!`;
    if (msgEl) msgEl.value = defaultMsg;

    this.currentReminderTarget = { customerId, customerName, dueAmount: numAmt };
    this.openModal('sendReminderModal');
  }

  sendWhatsAppReminder() {
    const phoneInput = document.getElementById('reminderPhone');
    const msgInput = document.getElementById('reminderMessageText');
    const rawPhone = (phoneInput?.value || '').replace(/[^0-9]/g, '');
    const msg = msgInput?.value || '';

    if (!rawPhone || rawPhone.length < 10) {
      alert('Please enter a valid 10-digit mobile number to send WhatsApp reminder.');
      phoneInput?.focus();
      return;
    }

    const fullPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    // If phone number was newly entered or updated, sync to customer record
    if (this.currentReminderTarget?.customerId && rawPhone.length === 10) {
      fetch(`/api/customers/${encodeURIComponent(this.currentReminderTarget.customerId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rawPhone })
      }).then(() => this.fetchCustomers()).catch(() => {});
    }

    this.closeModal('sendReminderModal');
  }

  sendSmsReminder() {
    const phoneInput = document.getElementById('reminderPhone');
    const msgInput = document.getElementById('reminderMessageText');
    const rawPhone = (phoneInput?.value || '').replace(/[^0-9]/g, '');
    const msg = msgInput?.value || '';

    if (!rawPhone || rawPhone.length < 10) {
      alert('Please enter a valid mobile number to send SMS reminder.');
      phoneInput?.focus();
      return;
    }

    window.location.href = `sms:${rawPhone}?body=${encodeURIComponent(msg)}`;
    this.closeModal('sendReminderModal');
  }

  copyReminderText() {
    const msgInput = document.getElementById('reminderMessageText');
    const text = msgInput?.value || '';
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Reminder text copied to clipboard!');
      }).catch(() => {
        alert('Copied message text.');
      });
    } else {
      msgInput.select();
      document.execCommand('copy');
      alert('Reminder text copied to clipboard!');
    }
  }

  // =========================================================================
  // 7. CSV Ingestion Studio
  // =========================================================================
  setupCSVUpload() {
    const fileInput = document.getElementById('csvFileInput');
    const dropZone = document.getElementById('csvDropZone');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) this.handleCSVFile(e.target.files[0]);
      });
    }

    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--shop-green)';
        dropZone.style.backgroundColor = 'var(--shop-green-light)';
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border-strong)';
        dropZone.style.backgroundColor = 'var(--surface)';
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-strong)';
        dropZone.style.backgroundColor = 'var(--surface)';
        if (e.dataTransfer.files.length > 0) {
          this.handleCSVFile(e.dataTransfer.files[0]);
        }
      });
    }
  }

  handleCSVFile(file) {
    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      alert('Please upload a valid CSV file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target.result;
      this.pendingCsv = { name: file.name, text: csvText };
      await this.analyzeCSV(csvText);
    };
    reader.readAsText(file);
  }

  async analyzeCSV(csvText) {
    const statusBox = document.getElementById('csvAuditStatusBox');
    if (statusBox) {
      statusBox.innerHTML = '<div style="color: var(--shop-green); font-weight: 600;">Analyzing CSV structure and detecting columns...</div>';
      statusBox.style.display = 'block';
    }

    if (this.isOfflineMode && window.offlineHisabEngine) {
      const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
      const totalRows = Math.max(0, lines.length - 1);
      this.pendingCsv.mapping = { date: 'Auto-detected', amount: 'Auto-detected', flow: 'Auto-detected' };
      this.renderCSVMapping({ detectedMapping: { date: 'Auto-detected', amount: 'Auto-detected', cash_flow_type: 'Auto-detected', customer_name: 'Auto-detected' }, totalRows });
      if (statusBox) statusBox.innerHTML = `<div style="color: var(--shop-green); font-weight: 600;">✓ Offline CSV ready: ${totalRows} transactions identified</div>`;
      return;
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText })
      });
      const json = await res.json();

      if (json.success && json.data) {
        this.pendingCsv.mapping = json.data.detectedMapping || {};
        this.renderCSVMapping(json.data);
      } else {
        if (statusBox) statusBox.innerHTML = `<div style="color: var(--vermilion);">${json.error?.message || 'Failed to parse CSV'}</div>`;
      }
    } catch (err) {
      console.error('analyzeCSV error, falling back to offline parsing:', err);
      if (window.offlineHisabEngine) {
        this.isOfflineMode = true;
        const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const totalRows = Math.max(0, lines.length - 1);
        this.pendingCsv.mapping = { date: 'Auto-detected', amount: 'Auto-detected', flow: 'Auto-detected' };
        this.renderCSVMapping({ detectedMapping: { date: 'Auto-detected', amount: 'Auto-detected', cash_flow_type: 'Auto-detected', customer_name: 'Auto-detected' }, totalRows });
        if (statusBox) statusBox.innerHTML = `<div style="color: var(--shop-green); font-weight: 600;">✓ Offline CSV ready: ${totalRows} transactions identified</div>`;
      }
    }
  }

  renderCSVMapping(data) {
    const mappingBox = document.getElementById('csvMappingSection');
    const commitBtn = document.getElementById('csvCommitImportBtn');
    if (!mappingBox) return;

    const mapping = data.detectedMapping || {};

    mappingBox.innerHTML = `
      <div style="margin-top: 1rem; padding: 1.25rem; background-color: var(--surface-alt); border: 1.5px solid var(--border); border-radius: 6px;">
        <h4 style="font-family: var(--font-display); font-size: 1.1rem; color: var(--ink); margin-bottom: 0.5rem;">
          Verified Columns (${data.totalRows} transactions ready)
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; font-size: 0.82rem; margin-bottom: 1rem;">
          <div><strong>Date:</strong> ${mapping.date || 'Auto-detected'}</div>
          <div><strong>Amount:</strong> ${mapping.amount || 'Auto-detected'}</div>
          <div><strong>Flow/Type:</strong> ${mapping.transaction_type || mapping.cash_flow_type || 'Auto-detected'}</div>
          <div><strong>Party/Narration:</strong> ${mapping.customer_name || mapping.description || 'Auto-detected'}</div>
          <div><strong>Reference:</strong> ${mapping.transaction_id || 'Auto-detected'}</div>
        </div>
        <div style="font-size: 0.78rem; color: var(--ink-secondary);">
          Ready to import safely with cryptographic deduplication. Duplicate uploads will not double-count transactions.
        </div>
      </div>
    `;

    mappingBox.style.display = 'block';
    if (commitBtn) commitBtn.disabled = false;
  }

  async commitCSVImport() {
    if (!this.pendingCsv) return;
    const commitBtn = document.getElementById('csvCommitImportBtn');
    if (commitBtn) commitBtn.disabled = true;

    if (this.isOfflineMode && window.offlineHisabEngine) {
      const res = window.offlineHisabEngine.parseAndImportCSV(this.pendingCsv.text);
      if (res.success) {
        alert(res.message);
        this.closeModal('csvUploadModal');
        this.pendingCsv = null;
        this.fetchDashboard();
        this.fetchTransactions();
      } else {
        alert(res.error?.message || 'Could not import transactions');
      }
      if (commitBtn) commitBtn.disabled = false;
      return;
    }

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: this.pendingCsv.text,
          datasetName: this.pendingCsv.name,
          mapping: this.pendingCsv.mapping || {}
        })
      });
      const json = await res.json();

      if (json.success) {
        alert(json.message || `Successfully imported ${json.data?.insertedCount || 0} transactions!`);
        this.closeModal('csvUploadModal');
        this.pendingCsv = null;
        // Refresh views
        this.fetchDashboard();
        this.fetchTransactions();
      } else {
        alert(`Import Error: ${json.error?.message || 'Could not import transactions'}`);
      }
    } catch (err) {
      console.error('commitCSVImport error, falling back to offline import:', err);
      if (window.offlineHisabEngine) {
        this.isOfflineMode = true;
        const res = window.offlineHisabEngine.parseAndImportCSV(this.pendingCsv.text);
        if (res.success) {
          alert(res.message);
          this.closeModal('csvUploadModal');
          this.pendingCsv = null;
          this.fetchDashboard();
          this.fetchTransactions();
        }
      }
    } finally {
      if (commitBtn) commitBtn.disabled = false;
    }
  }

  downloadSampleCSV() {
    const csvContent = `Date,Customer Name,Type,Amount,Description,Payment Mode,Reference Number
2026-09-25,Ramesh Verma,INFLOW,1200,Rice and Cooking Oil,UPI,UPI/629103948512
2026-09-26,Suresh Gupta,OUTFLOW,450,Vegetable Market Wholesale,Cash,CASH-91823
2026-09-27,Priya Sharma,INFLOW,2800,Dairy and Masala Provisions,UPI,UPI/739102837461
2026-09-28,Anand Kirana Supply,OUTFLOW,5000,Flour and Ghee Stock,Bank Transfer,IMPS-928174
2026-09-29,Ramesh Verma,INFLOW,850,Wheat Flour & Sugar,UPI,UPI/849201928374
2026-09-30,Mohan Lal,INFLOW,1500,Snacks and Confectionery,Cash,CASH-92817`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hisab_sample_kirana_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // =========================================================================
  // 8. AI Assistant ("Ask Hisab") & Voice Interaction
  // =========================================================================
  setupAssistant() {
    const sendBtn = document.getElementById('assistantSendBtn');
    const input = document.getElementById('assistantTextInput');
    const micBtn = document.getElementById('assistantMicBtn');

    if (sendBtn && input) {
      sendBtn.addEventListener('click', () => this.sendAssistantQuery());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.sendAssistantQuery();
      });
    }

    if (micBtn) {
      micBtn.addEventListener('click', () => this.toggleVoiceAssistant());
    }

    // Quick prompt chip clicks
    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.textContent.trim().replace(/^"|"$/g, '');
        if (input) {
          input.value = text;
          this.sendAssistantQuery();
        }
      });
    });
  }

  async sendAssistantQuery() {
    if (!await window.hisabPrivacy.requirePermission('ai')) return;
    const input = document.getElementById('assistantTextInput');
    if (!input) return;
    const query = input.value.trim();
    if (!query) return;

    input.value = '';
    this.appendChatMessage('user', query);

    const stream = document.getElementById('assistantChatStream');
    const loadingId = 'ai-loading-' + Date.now();
    if (stream) {
      const loadingEl = document.createElement('div');
      loadingEl.className = 'chat-bubble assistant';
      loadingEl.id = loadingId;
      loadingEl.innerHTML = `<div class="bubble-content" style="color: var(--ink-muted); font-style: italic;">Checking your shop database...</div>`;
      stream.appendChild(loadingEl);
      stream.scrollTop = stream.scrollHeight;
    }

    if (this.isOfflineMode && window.offlineHisabEngine) {
      if (!/business|shop|store|customer|sales|revenue|profit|expense|cash|stock|supplier|loan|credit|udhaar|udhar|aruvu|repay|jama|kharch|బాకీ|అరువు|व्यापार|उधार/i.test(query)) {
        document.getElementById(loadingId)?.remove();
        this.appendChatMessage('assistant', 'I can help only with shop data and business questions.'); return;
      }
      if (/took|borrowed|repaid|record|add|give|gave/i.test(query)) {
        document.getElementById(loadingId)?.remove();
        this.appendChatMessage('assistant', 'Connect to your store server and sign in to record entries through the assistant. Offline mode supports ledger questions only.'); return;
      }
      setTimeout(() => {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        const ans = window.offlineHisabEngine.answerAssistantQuery(query);
        this.appendChatMessage('assistant', ans.answer, ans.evidence);
      }, 250);
      return;
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, requestId: crypto.randomUUID(), languageHint: (window.hisabI18n?.language || 'en') + '-IN' })
      });
      const data = await res.json();

      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) loadingEl.remove();

      if (!res.ok) throw new Error(data.error?.message || 'Unable to reach the Hisab AI service.');
      if (data.answer) {
        this.appendChatMessage('assistant', data.answer, data.evidence || data.scope);
        if (data.actionApplied) {
          await this.fetchCustomers(); await this.fetchUdhaar(); await this.fetchTransactions(); await this.fetchDashboard();
        }
      } else {
        this.appendChatMessage('assistant', 'I could not find matching records in your store database.');
      }
    } catch (err) {
      console.error('sendAssistantQuery error, answering offline:', err);
      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) loadingEl.remove();
      if (window.offlineHisabEngine) {
        this.appendChatMessage('assistant', 'The business assistant could not complete the request. Check your connection and retry. No automatic retry was made.');
      } else {
        this.appendChatMessage('assistant', 'Unable to reach the Hisab AI service.');
      }
    }
  }

  appendChatMessage(sender, text, evidence = null) {
    const stream = document.getElementById('assistantChatStream');
    if (!stream) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;

    let html = `<div class="bubble-content">${this.escapeHtml(text)}</div>`;
    if (evidence && sender === 'assistant') {
      html += `
        <div class="evidence-box">
          <strong>Source Scope:</strong> ${this.escapeHtml(typeof evidence === 'string' ? evidence : JSON.stringify(evidence))}
        </div>
      `;
    }

    bubble.innerHTML = html;
    stream.appendChild(bubble);
    stream.scrollTop = stream.scrollHeight;
  }

  async toggleVoiceAssistant() {
    if (!this.isRecordingVoice && !await window.hisabPrivacy.requirePermission('voice')) return;
    const micBtn = document.getElementById('assistantMicBtn');
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Safari or Edge.');
      return;
    }

    if (this.isRecordingVoice) {
      if (this.recognition) this.recognition.stop();
      this.isRecordingVoice = false;
      if (micBtn) micBtn.classList.remove('recording');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = (window.hisabI18n?.language || 'en') + '-IN';
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isRecordingVoice = true;
      if (micBtn) micBtn.classList.add('recording');
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const input = document.getElementById('assistantTextInput');
      if (input) input.value = transcript;
      this.sendAssistantQuery();
    };

    this.recognition.onerror = () => {
      this.isRecordingVoice = false;
      if (micBtn) micBtn.classList.remove('recording');
    };

    this.recognition.onend = () => {
      this.isRecordingVoice = false;
      if (micBtn) micBtn.classList.remove('recording');
    };

    this.recognition.start();
  }

  // =========================================================================
  // 9. Connected Accounts & Integrations
  // =========================================================================
  async fetchConnections() {
    try {
      const res = await fetch('/api/bank/banks');
      const data = await res.json();
      const statusEl = document.getElementById('aaConnectionStatusBadge');
      if (statusEl && data.success) {
        statusEl.textContent = data.data?.isMock ? 'SANDBOX ACTIVE' : 'LIVE AA READY';
      }
    } catch (err) {
      console.warn('fetchConnections error:', err);
    }
  }

  async initiateBankSync() {
    const btn = document.getElementById('bankSyncBtn');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch('/api/bank/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId: 'HDFC', phoneNumber: this.currentUser?.phone || '9876543210' })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Bank consent initiated successfully!');
        this.fetchDashboard();
      } else {
        alert(`Consent Error: ${data.error?.message || 'Failed'}`);
      }
    } catch (err) {
      console.error('initiateBankSync error:', err);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // =========================================================================
  // 10. Modals & Action Workflows
  // =========================================================================
  setupModals() {
    // Give Udhaar Modal Form
    const giveUdhaarForm = document.getElementById('giveUdhaarForm');
    if (giveUdhaarForm) {
      giveUdhaarForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const customerId = document.getElementById('giveUdhaarCustomerId')?.value;
        const amount = document.getElementById('giveUdhaarAmount')?.value;
        const description = document.getElementById('giveUdhaarDesc')?.value;
        if (window.HisabShopTools && !await window.HisabShopTools.checkCredit(customerId, amount)) return;
        const overrideLimit = true;

        if (this.isOfflineMode && window.offlineHisabEngine) {
          const res = window.offlineHisabEngine.issueCredit({ customerId, amount, description, overrideLimit });
          if (res.success) {
            this.closeModal('giveUdhaarModal');
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert(res.error?.message || 'Failed to issue credit');
          }
          return;
        }

        try {
          const res = await fetch('/api/credit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId, amount, description, overrideLimit })
          });
          const data = await res.json();
          if (data.success) {
            this.closeModal('giveUdhaarModal');
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert(data.error?.message || 'Failed to issue credit');
          }
        } catch (err) {
          console.error(err);
          alert('Could not confirm the credit save. Check your ledger before retrying.');
        }
      });
    }

    // Repayment Modal Form
    const repaymentForm = document.getElementById('repaymentForm');
    if (repaymentForm) {
      repaymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const creditId = document.getElementById('repaymentCreditId')?.value;
        const amount = document.getElementById('repaymentAmount')?.value;
        const mode = document.getElementById('repaymentMode')?.value || 'CASH';

        if (this.isOfflineMode && window.offlineHisabEngine) {
          const res = window.offlineHisabEngine.recordRepayment({ creditId, amount, mode });
          if (res.success) {
            this.closeModal('repaymentModal');
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert(res.error?.message || 'Failed to record repayment');
          }
          return;
        }

        try {
          const res = await fetch('/api/credit/repay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creditId, amount, mode })
          });
          const data = await res.json();
          if (data.success) {
            this.closeModal('repaymentModal');
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert(data.error?.message || 'Failed to record repayment');
          }
        } catch (err) {
          console.error(err);
          if (window.offlineHisabEngine) {
            window.offlineHisabEngine.recordRepayment({ creditId, amount, mode });
            this.closeModal('repaymentModal');
            this.fetchUdhaar();
            this.fetchDashboard();
          }
        }
      });
    }

    // Add Customer Form
    const addCustForm = document.getElementById('addCustomerForm');
    if (addCustForm) {
      addCustForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('addCustName')?.value;
        const phone = document.getElementById('addCustPhone')?.value;
        const notes = document.getElementById('addCustNotes')?.value;

        if (this.isOfflineMode && window.offlineHisabEngine) {
          const res = window.offlineHisabEngine.addCustomer({ name, phone, notes });
          if (res.success) {
            this.closeModal('addCustomerModal');
            this.fetchCustomers();
            this.fetchDashboard();
          } else {
            alert(res.error?.message || 'Failed to add customer');
          }
          return;
        }

        try {
          const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, notes })
          });
          const data = await res.json();
          if (data.success) {
            this.closeModal('addCustomerModal');
            this.fetchCustomers();
            this.fetchDashboard();
          } else {
            alert(data.error?.message || 'Failed to add customer');
          }
        } catch (err) {
          console.error(err);
          if (window.offlineHisabEngine) {
            window.offlineHisabEngine.addCustomer({ name, phone, notes });
            this.closeModal('addCustomerModal');
            this.fetchCustomers();
            this.fetchDashboard();
          } else {
            alert('Network error while adding customer');
          }
        }
      });
    }

    // Edit Customer Form
    const editCustForm = document.getElementById('editCustomerForm');
    if (editCustForm) {
      editCustForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editCustId')?.value;
        const name = document.getElementById('editCustName')?.value;
        const phone = document.getElementById('editCustPhone')?.value;
        const notes = document.getElementById('editCustNotes')?.value;

        if (this.isOfflineMode && window.offlineHisabEngine) {
          const res = window.offlineHisabEngine.updateCustomer(id, { name, phone, notes });
          if (res.success) {
            this.closeModal('editCustomerModal');
            this.fetchCustomers();
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert(res.error?.message || 'Failed to update customer');
          }
          return;
        }

        try {
          const res = await fetch(`/api/customers/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, notes })
          });
          const data = await res.json();
          if (data.success) {
            this.closeModal('editCustomerModal');
            this.fetchCustomers();
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert(data.error?.message || 'Failed to update customer');
          }
        } catch (err) {
          console.error(err);
          if (window.offlineHisabEngine) {
            window.offlineHisabEngine.updateCustomer(id, { name, phone, notes });
            this.closeModal('editCustomerModal');
            this.fetchCustomers();
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert('Network error while updating customer');
          }
        }
      });
    }

    // Update Loan / Udhaar Form
    const updateLoanForm = document.getElementById('updateLoanForm');
    if (updateLoanForm) {
      updateLoanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('updateLoanId')?.value;
        const status = document.getElementById('updateLoanStatus')?.value;
        const dueDate = document.getElementById('updateLoanDueDate')?.value;
        const description = document.getElementById('updateLoanDesc')?.value;

        if (this.isOfflineMode && window.offlineHisabEngine) {
          const res = window.offlineHisabEngine.updateCreditStatus(id, { status, dueDate, description });
          if (res.success) {
            this.closeModal('updateLoanModal');
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert(res.error?.message || 'Failed to update loan status');
          }
          return;
        }

        try {
          const res = await fetch(`/api/credit/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, dueDate, description })
          });
          const data = await res.json();
          if (data.success) {
            this.closeModal('updateLoanModal');
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert(data.error?.message || 'Failed to update loan status');
          }
        } catch (err) {
          console.error(err);
          if (window.offlineHisabEngine) {
            window.offlineHisabEngine.updateCreditStatus(id, { status, dueDate, description });
            this.closeModal('updateLoanModal');
            this.fetchUdhaar();
            this.fetchDashboard();
          } else {
            alert('Network error while updating loan status');
          }
        }
      });
    }

    // Record Manual Transaction Form
    const manualTxnForm = document.getElementById('manualTxnForm');
    if (manualTxnForm) {
      manualTxnForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const flow = document.getElementById('manualTxnFlow')?.value;
        const amount = document.getElementById('manualTxnAmount')?.value;
        const party = document.getElementById('manualTxnParty')?.value;
        const desc = document.getElementById('manualTxnDesc')?.value;
        const mode = document.getElementById('manualTxnMode')?.value;

        if (this.isOfflineMode && window.offlineHisabEngine) {
          const res = window.offlineHisabEngine.addTransaction({
            flow,
            amount,
            customerName: party,
            description: desc,
            mode
          });
          if (res.success) {
            this.closeModal('manualTxnModal');
            this.fetchTransactions();
            this.fetchDashboard();
          } else {
            alert(res.error?.message || 'Failed to record transaction');
          }
          return;
        }

        try {
          const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flow,
              amount,
              customerName: party,
              description: desc,
              mode
            })
          });
          const data = await res.json();
          if (data.success) {
            this.closeModal('manualTxnModal');
            this.fetchTransactions();
            this.fetchDashboard();
          } else {
            alert(data.error?.message || 'Failed to record transaction');
          }
        } catch (err) {
          console.error(err);
          alert('Could not confirm the save. Check your ledger before retrying.');
        }
      });
    }
  }

  openGiveUdhaarModal(custId = '', custName = '') {
    const modal = document.getElementById('giveUdhaarModal');
    const select = document.getElementById('giveUdhaarCustomerId');
    if (!modal) return;

    if (select) {
      select.innerHTML = this.customers.map(c => `
        <option value="${c.id}" ${c.id === custId ? 'selected' : ''}>${this.escapeHtml(c.name)} (${c.phone || 'No phone'})</option>
      `).join('');
    }

    modal.classList.add('open');
  }

  openRepaymentModal(creditId, outstanding, custName) {
    const modal = document.getElementById('repaymentModal');
    const idInput = document.getElementById('repaymentCreditId');
    const amtInput = document.getElementById('repaymentAmount');
    const label = document.getElementById('repaymentTargetLabel');

    if (!modal) return;
    if (idInput) idInput.value = creditId;
    if (amtInput) amtInput.value = outstanding;
    if (label) label.textContent = `Repayment for ${custName} (Outstanding: ₹${Number(outstanding).toLocaleString('en-IN')})`;

    modal.classList.add('open');
  }

  openAddCustomerModal() {
    const modal = document.getElementById('addCustomerModal');
    if (modal) modal.classList.add('open');
  }

  openManualTxnModal(flow = 'IN') {
    const modal = document.getElementById('manualTxnModal');
    const flowSelect = document.getElementById('manualTxnFlow');
    if (flowSelect && flow) flowSelect.value = ({ IN: 'INFLOW', OUT: 'OUTFLOW' }[flow] || flow);
    if (modal) modal.classList.add('open');
  }

  openCSVUploadModal() {
    const modal = document.getElementById('csvUploadModal');
    if (modal) modal.classList.add('open');
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  // =========================================================================
  // 11. Settings & Data Trust
  // =========================================================================
  setupSettings() {
    const exportBtn = document.getElementById('exportAllDataBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        if (this.isOfflineMode && window.offlineHisabEngine) {
          const jsonStr = JSON.stringify(window.offlineHisabEngine.data, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `hisab_offline_backup_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }
        window.location.href = '/api/export';
      });
    }

    // Server IP & Standalone Mode Switchers
    const saveServerBtn = document.getElementById('btnSaveServerUrl');
    const serverInput = document.getElementById('settingsServerUrl');
    const resetOfflineBtn = document.getElementById('btnResetOffline');

    if (serverInput) {
      serverInput.value = localStorage.getItem('hisab_custom_server') || '';
    }

    if (saveServerBtn && serverInput) {
      saveServerBtn.addEventListener('click', async () => {
        let url = serverInput.value.trim();
        if (!url) {
          alert('Please enter a valid server URL or IP address (e.g. http://192.168.1.15:8099)');
          return;
        }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'http://' + url;
        }
        try {
          const res = await fetch(`${url}/api/auth/me`).catch(() => null);
          if (res && res.status !== 404) {
            localStorage.setItem('hisab_custom_server', url);
            alert(`Connected successfully to ${url}!`);
            window.location.reload();
          } else {
            alert(`Connected to ${url}, but Hisab server is not responding. Please make sure "npm run dev" is running.`);
          }
        } catch (e) {
          alert(`Could not reach ${url}. Checking offline mode.`);
        }
      });
    }

    if (resetOfflineBtn) {
      resetOfflineBtn.addEventListener('click', () => {
        localStorage.removeItem('hisab_custom_server');
        this.activateOfflineMode();
        alert('Offline ledger mode enabled. Local records stay on your device. Optional browser voice services may still need internet.');
        this.fetchDashboard();
      });
    }

    const logoutBtn = document.getElementById('settingsLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (this.isOfflineMode) {
          alert('You are in offline standalone mode. Store data is saved locally on your device.');
          return;
        }
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        sessionStorage.removeItem('hisab_session');
        window.location.href = '/';
      });
    }
  }

  // Utilities
  formatCurrency(val) {
    const num = Math.round(Number(val) || 0);
    return `₹${num.toLocaleString('en-IN')}`;
  }

  formatShortAmount(val) {
    const num = Math.round(Number(val) || 0);
    if (num < 1000) return `₹${num}`;
    if (num < 100000) return `₹${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `₹${(num / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.merchantApp = new HisabMerchantApp();
});
