/**
 * Hisab Main Application Controller
 * Handles 3D Resadex centerpiece, hamburger drawer, modals,
 * and voice assistant interactions.
 */

class HisabApp {
  constructor() {
    this.threeScene = null;
    this.isAuthenticated = false;
    this.merchantProfile = {
      fullName: 'Ramesh Garg',
      shopName: 'Garg Kirana & General Store',
      phone: '+91 98765 43210',
      email: 'ramesh.garg@store.hisab.in',
      gstin: '07AAAAA0000A1Z5'
    };
    this.activePeriod = 'all';
    this.activeProviderFilter = 'all';
    this.providerSearchQuery = '';
    this.customerFilter = 'all';
    this.customerSearchQuery = '';

    // Connection Source State (Initially unconnected)
    this.isProviderConnected = false;
    this.isCsvUploaded = false;
    this.connectedProviderName = '';
    this.activeCsvFileName = '';

    // Dataset of transactions: Initialized as empty until a provider connects or CSV is uploaded
    this.transactions = [];
    this.importedCsvRows = [];

    // Inventory dataset
    this.inventoryItems = [
      { sku: 'SKU-101', name: 'Aashirvaad Shudh Chakki Atta 10kg', category: 'Grocery', stock: 45, cost: 380, price: 440, status: 'In Stock' },
      { sku: 'SKU-102', name: 'Fortune Sunlite Sunflower Oil 1L', category: 'Edible Oil', stock: 12, cost: 135, price: 160, status: 'Low Stock' },
      { sku: 'SKU-103', name: 'Tata Salt Vacuum Evaporated 1kg', category: 'Pantry', stock: 120, cost: 22, price: 28, status: 'In Stock' },
      { sku: 'SKU-104', name: 'Maggi 2-Minute Masala Noodles 280g', category: 'Snacks', stock: 8, cost: 42, price: 50, status: 'Reorder Alert' },
      { sku: 'SKU-105', name: 'Amul Pure Cow Ghee 1L Tin', category: 'Dairy', stock: 32, cost: 580, price: 660, status: 'In Stock' }
    ];

    // Persistent SQLite Dataset State
    this.activeDatasetId = null;
    this.activeDatasetName = 'None';
    this.currentGranularity = 'monthly';
    this.financialFilters = {
      dateRange: 'all',
      flow: 'all',
      type: 'all',
      category: 'all',
      mode: 'all',
      search: ''
    };
    this.connectedBankAccounts = [];
    this.selectedBankId = 'HDFC';
    this.upiAnalytics = null;
    this.explorerPage = 1;
    this.explorerLimit = 25;
    this.rawUploadedCsvText = '';
    this.activeUploadFilename = '';
    this.detectedMapping = {};
    this.currentMapping = {};
    this.previewRows = [];
    this.rawHeaders = [];
    this.currentQualityReport = null;
    this.datasetsList = [];

    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupModals();
    this.setupHeroActions();
    this.setupThreeDResadexCenterpiece();
    this.setupVoiceAssistant();
    this.setupPolicies();
    this.setupAuthWorkspace();
    this.setupFinancialAnalytics();
    this.setupAccountAggregator();
    this.loadDatasetsList();
    this.loadBankAccounts();
    this.loadUpiAnalytics();

    // Check existing session
    try {
      const savedSession = sessionStorage.getItem('hisab_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        this.authenticateUser(parsed, false);
      }
    } catch (e) {
      console.warn('Session parse error', e);
    }
  }

  /**
   * Shared HTML-escaper for any server-derived string (narrations, merchant
   * names, descriptions) rendered into the DOM. Prevents stored XSS.
   */
  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Central 401 handler: data endpoints require a live session.
   */
  handleApiError(res, fallbackMsg) {
    if (res.status === 401) {
      this.showToast('Session expired. Please sign in again.');
      if (this.isAuthenticated) this.logoutUser();
      return true;
    }
    return false;
  }

  // =========================================================================
  // 1. Navigation & Hamburger Menu
  // =========================================================================
  setupNavigation() {
    const menuBtn = document.getElementById('menuToggleBtn');
    const drawer = document.getElementById('navDrawer');
    const overlay = document.getElementById('navOverlay');
    const closeBtn = document.getElementById('drawerCloseBtn');

    const openDrawer = () => {
      drawer.classList.add('open');
      overlay.classList.add('open');
      menuBtn.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      overlay.setAttribute('aria-hidden', 'false');
    };

    const closeDrawer = () => {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('aria-hidden', 'true');
    };

    if (menuBtn) menuBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);

    // Drawer links
    const homeLink = document.getElementById('drawerLinkHome');
    if (homeLink) {
      homeLink.addEventListener('click', () => {
        closeDrawer();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const howItWorksDrawer = document.getElementById('drawerLinkHowItWorks');
    if (howItWorksDrawer) {
      howItWorksDrawer.addEventListener('click', () => {
        closeDrawer();
        this.openModal('voiceModalBackdrop');
        if (window.voiceAssistant) {
          window.voiceAssistant.runSimulationMode("Ramesh paid 450 rupees for grocery");
        }
      });
    }

    const pricingDrawer = document.getElementById('drawerLinkPricing');
    if (pricingDrawer) {
      pricingDrawer.addEventListener('click', () => {
        closeDrawer();
        this.showToast('Hisab is 100% free for merchants — no subscriptions or hidden fees.');
      });
    }

    const downloadLink = document.getElementById('drawerLinkDownload');
    if (downloadLink) {
      downloadLink.addEventListener('click', () => {
        closeDrawer();
        this.openModal('apkModalBackdrop');
      });
    }

    const loginLink = document.getElementById('drawerLinkLogin');
    if (loginLink) {
      loginLink.addEventListener('click', () => {
        closeDrawer();
        this.openModal('authModalBackdrop');
      });
    }

    // Authenticated Drawer Subsections (Accessible via 3-Line Menu)
    const drawerPayments = document.getElementById('drawerAuthPayments');
    if (drawerPayments) {
      drawerPayments.addEventListener('click', () => {
        closeDrawer();
        const sec = document.getElementById('paymentsProviderSection');
        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const drawerUpload = document.getElementById('drawerAuthUploadCsv');
    if (drawerUpload) {
      drawerUpload.addEventListener('click', () => {
        closeDrawer();
        const sec = document.getElementById('csvUploadSection');
        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const drawerProfile = document.getElementById('drawerAuthProfile');
    if (drawerProfile) {
      drawerProfile.addEventListener('click', () => {
        closeDrawer();
        this.openModal('profileModalBackdrop');
      });
    }

    const drawerInventory = document.getElementById('drawerAuthInventory');
    if (drawerInventory) {
      drawerInventory.addEventListener('click', () => {
        closeDrawer();
        this.openModal('inventoryModalBackdrop');
      });
    }

    const drawerCustomers = document.getElementById('drawerAuthCustomers');
    if (drawerCustomers) {
      drawerCustomers.addEventListener('click', () => {
        closeDrawer();
        this.openModal('customersModalBackdrop');
      });
    }

    const drawerProviders = document.getElementById('drawerAuthProviders');
    if (drawerProviders) {
      drawerProviders.addEventListener('click', () => {
        closeDrawer();
        this.openModal('providersModalBackdrop');
      });
    }

    const drawerLogout = document.getElementById('drawerAuthLogout');
    if (drawerLogout) {
      drawerLogout.addEventListener('click', () => {
        closeDrawer();
        this.logoutUser();
      });
    }

    // Top logo click navigates smoothly to home
    const brandLogo = document.getElementById('brandLogo');
    if (brandLogo) {
      brandLogo.addEventListener('click', (e) => {
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  }

  // =========================================================================
  // 2. Modals Management (Elevated overlays adhering to Rule 5)
  // =========================================================================
  setupModals() {
    // Escape key closes all open modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
        const drawer = document.getElementById('navDrawer');
        if (drawer && drawer.classList.contains('open')) {
          document.getElementById('drawerCloseBtn').click();
        }
      }
    });

    // Voice Modal Closes
    const voiceClose = document.getElementById('voiceModalCloseBtn');
    if (voiceClose) {
      voiceClose.addEventListener('click', () => this.closeVoiceModal());
    }

    // APK Modal Closes
    const apkClose = document.getElementById('apkModalCloseBtn');
    const apkCancel = document.getElementById('apkCancelBtn');
    if (apkClose) apkClose.addEventListener('click', () => this.closeModal('apkModalBackdrop'));
    if (apkCancel) apkCancel.addEventListener('click', () => this.closeModal('apkModalBackdrop'));

    const apkTrigger = document.getElementById('downloadApkTriggerBtn');
    if (apkTrigger) {
      apkTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        this.showToast("Downloading Hisab_v2.4.1.apk (18.4 MB)...");
        setTimeout(() => this.closeModal('apkModalBackdrop'), 800);
      });
    }

    // Subsection Modals Closes
    const profileClose = document.getElementById('profileModalCloseBtn');
    if (profileClose) profileClose.addEventListener('click', () => this.closeModal('profileModalBackdrop'));

    const inventoryClose = document.getElementById('inventoryModalCloseBtn');
    if (inventoryClose) inventoryClose.addEventListener('click', () => this.closeModal('inventoryModalBackdrop'));

    const customersClose = document.getElementById('customersModalCloseBtn');
    if (customersClose) customersClose.addEventListener('click', () => this.closeModal('customersModalBackdrop'));

    const providersClose = document.getElementById('providersModalCloseBtn');
    if (providersClose) providersClose.addEventListener('click', () => this.closeModal('providersModalBackdrop'));

    // Financial Analytics Modals Closes
    const mappingClose = document.getElementById('mappingModalCloseBtn');
    const mappingCancel = document.getElementById('btnCancelMapping');
    if (mappingClose) mappingClose.addEventListener('click', () => this.closeModal('csvMappingModalBackdrop'));
    if (mappingCancel) mappingCancel.addEventListener('click', () => this.closeModal('csvMappingModalBackdrop'));

    const qualityClose = document.getElementById('qualityModalCloseBtn');
    const qualityCancel = document.getElementById('btnCancelQualityImport');
    if (qualityClose) qualityClose.addEventListener('click', () => this.closeModal('dataQualityModalBackdrop'));
    if (qualityCancel) qualityCancel.addEventListener('click', () => this.closeModal('dataQualityModalBackdrop'));

    const customerDetailClose = document.getElementById('customerDetailCloseBtn');
    if (customerDetailClose) customerDetailClose.addEventListener('click', () => this.closeModal('customerDetailModalBackdrop'));

    const loanStatementClose = document.getElementById('loanStatementCloseBtn');
    if (loanStatementClose) loanStatementClose.addEventListener('click', () => this.closeModal('loanStatementModalBackdrop'));

    const datasetsClose = document.getElementById('datasetsModalCloseBtn');
    if (datasetsClose) datasetsClose.addEventListener('click', () => this.closeModal('datasetsModalBackdrop'));

    const btnManageDatasets = document.getElementById('btnManageDatasets');
    if (btnManageDatasets) {
      btnManageDatasets.addEventListener('click', () => {
        this.loadDatasetsList();
        this.openModal('datasetsModalBackdrop');
      });
    }

    // 14. Add Customer Modal
    const addCustClose = document.getElementById('addCustomerModalCloseBtn');
    const addCustCancel = document.getElementById('btnCancelAddCustomer');
    if (addCustClose) addCustClose.addEventListener('click', () => this.closeModal('addCustomerModalBackdrop'));
    if (addCustCancel) addCustCancel.addEventListener('click', () => this.closeModal('addCustomerModalBackdrop'));

    const btnOpenAddCustomer = document.getElementById('btnOpenAddCustomerModal');
    if (btnOpenAddCustomer) {
      btnOpenAddCustomer.addEventListener('click', () => {
        this.openModal('addCustomerModalBackdrop');
      });
    }

    const addCustomerForm = document.getElementById('addCustomerForm');
    if (addCustomerForm) {
      addCustomerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('newCustName')?.value.trim();
        const phone = document.getElementById('newCustPhone')?.value.trim();
        const email = document.getElementById('newCustEmail')?.value.trim();
        const notes = document.getElementById('newCustNotes')?.value.trim();

        if (!name || !phone) {
          this.showToast('Name and phone number are required');
          return;
        }

        try {
          const res = await window.HisabAPI.customers.create({ name, phone, email, notes });
          this.showToast(res.message || `Customer ${name} registered successfully!`);
          this.closeModal('addCustomerModalBackdrop');
          addCustomerForm.reset();
          this.renderCustomersTable();
          this.loadCustomerDropdowns();
        } catch (err) {
          this.showToast(`Failed to add customer: ${err.message}`);
        }
      });
    }

    // 15. Issue Credit Modal
    const creditClose = document.getElementById('issueCreditModalCloseBtn');
    const creditCancel = document.getElementById('btnCancelIssueCredit');
    if (creditClose) creditClose.addEventListener('click', () => this.closeModal('issueCreditModalBackdrop'));
    if (creditCancel) creditCancel.addEventListener('click', () => this.closeModal('issueCreditModalBackdrop'));

    const btnOpenIssueCredit = document.getElementById('btnOpenIssueCreditModal');
    if (btnOpenIssueCredit) {
      btnOpenIssueCredit.addEventListener('click', () => {
        this.loadCustomerDropdowns();
        this.openModal('issueCreditModalBackdrop');
      });
    }

    const issueCreditForm = document.getElementById('issueCreditForm');
    if (issueCreditForm) {
      issueCreditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const customerSelect = document.getElementById('creditCustomerSelect');
        const customerId = customerSelect?.value;
        const customerName = customerSelect?.options[customerSelect.selectedIndex]?.dataset.name || '';
        const amount = parseFloat(document.getElementById('creditAmount')?.value || 0);
        const dueDate = document.getElementById('creditDueDate')?.value;
        const description = document.getElementById('creditDescription')?.value.trim();

        if (!customerId || isNaN(amount) || amount <= 0) {
          this.showToast('Please select a customer and valid amount');
          return;
        }

        try {
          await window.HisabAPI.credit.issue({
            customerId,
            customerName,
            amount,
            dueDate,
            description
          });
          this.showToast(`Udhar ₹${amount.toLocaleString('en-IN')} issued to ${customerName}`);
          this.closeModal('issueCreditModalBackdrop');
          issueCreditForm.reset();
          this.refreshLoansTable();
          this.renderCustomersTable();
          this.refreshDashboardData();
        } catch (err) {
          this.showToast(`Failed to issue credit: ${err.message}`);
        }
      });
    }

    // 16. Record Repayment Modal
    const repayClose = document.getElementById('recordRepaymentModalCloseBtn');
    const repayCancel = document.getElementById('btnCancelRepay');
    if (repayClose) repayClose.addEventListener('click', () => this.closeModal('recordRepaymentModalBackdrop'));
    if (repayCancel) repayCancel.addEventListener('click', () => this.closeModal('recordRepaymentModalBackdrop'));

    const btnOpenRepay = document.getElementById('btnOpenRepayModal');
    if (btnOpenRepay) {
      btnOpenRepay.addEventListener('click', () => {
        this.loadCustomerDropdowns();
        this.openModal('recordRepaymentModalBackdrop');
      });
    }

    const recordRepaymentForm = document.getElementById('recordRepaymentForm');
    if (recordRepaymentForm) {
      recordRepaymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const customerSelect = document.getElementById('repayCustomerSelect');
        const customerId = customerSelect?.value;
        const customerName = customerSelect?.options[customerSelect.selectedIndex]?.dataset.name || '';
        const amount = parseFloat(document.getElementById('repayAmount')?.value || 0);
        const mode = document.getElementById('repayMode')?.value || 'UPI';
        const reference = document.getElementById('repayReference')?.value.trim();

        if (!customerId || isNaN(amount) || amount <= 0) {
          this.showToast('Please select customer and valid repayment amount');
          return;
        }

        try {
          await window.HisabAPI.credit.repay({
            customerId,
            amount,
            mode,
            reference
          });
          this.showToast(`Repayment ₹${amount.toLocaleString('en-IN')} recorded from ${customerName}!`);
          this.closeModal('recordRepaymentModalBackdrop');
          recordRepaymentForm.reset();
          this.refreshLoansTable();
          this.renderCustomersTable();
          this.refreshDashboardData();
        } catch (err) {
          this.showToast(`Failed to record repayment: ${err.message}`);
        }
      });
    }

    // 17. Payment Gateway Modal
    const collectPaymentClose = document.getElementById('collectPaymentModalCloseBtn');
    const collectPaymentCancel = document.getElementById('btnCancelCollectPayment');
    if (collectPaymentClose) collectPaymentClose.addEventListener('click', () => this.closeModal('collectPaymentModalBackdrop'));
    if (collectPaymentCancel) collectPaymentCancel.addEventListener('click', () => this.closeModal('collectPaymentModalBackdrop'));

    const btnOpenCollectPayment = document.getElementById('btnOpenCollectPaymentModal');
    if (btnOpenCollectPayment) {
      btnOpenCollectPayment.addEventListener('click', () => {
        this.openModal('collectPaymentModalBackdrop');
      });
    }

    let activeGatewayOrder = null;
    const btnInitiateGateway = document.getElementById('btnInitiateGatewayPayment');
    const gatewayOrderBox = document.getElementById('gatewayOrderBox');
    const gatewayOrderIdDisplay = document.getElementById('gatewayOrderIdDisplay');
    const gatewayOrderStatusDisplay = document.getElementById('gatewayOrderStatusDisplay');
    const btnSimulateSuccess = document.getElementById('btnSimulateGatewaySuccess');

    if (btnInitiateGateway) {
      btnInitiateGateway.addEventListener('click', async () => {
        const customerName = document.getElementById('gatewayCustomerName')?.value.trim() || 'Store Customer';
        const amount = parseFloat(document.getElementById('gatewayAmount')?.value || 0);
        const purpose = document.getElementById('gatewayPurpose')?.value.trim() || 'Store Purchase';

        if (isNaN(amount) || amount <= 0) {
          this.showToast('Please enter a valid amount');
          return;
        }

        try {
          btnInitiateGateway.disabled = true;
          btnInitiateGateway.textContent = 'Creating Order...';
          const order = await window.HisabAPI.payments.createOrder({
            amount,
            customerName,
            purpose
          });
          activeGatewayOrder = order;

          if (gatewayOrderBox) gatewayOrderBox.style.display = 'block';
          if (gatewayOrderIdDisplay) gatewayOrderIdDisplay.textContent = order.orderId;
          if (gatewayOrderStatusDisplay) {
            gatewayOrderStatusDisplay.textContent = order.status;
            gatewayOrderStatusDisplay.className = 'stock-status-pill instock';
          }
          this.showToast(`Order ${order.orderId} created for ₹${amount}!`);
        } catch (err) {
          this.showToast(`Failed to create payment order: ${err.message}`);
        } finally {
          btnInitiateGateway.disabled = false;
          btnInitiateGateway.textContent = 'Initiate Payment Order';
        }
      });
    }

    if (btnSimulateSuccess) {
      btnSimulateSuccess.addEventListener('click', async () => {
        if (!activeGatewayOrder) {
          this.showToast('No active order to simulate');
          return;
        }

        try {
          btnSimulateSuccess.disabled = true;
          btnSimulateSuccess.textContent = 'Verifying Payment HMAC...';
          await window.HisabAPI.payments.verify({
            orderId: activeGatewayOrder.orderId,
            gatewayPaymentId: 'mock_pay_' + Date.now(),
            gatewaySignature: 'mock_sig_' + Math.random().toString(36).slice(2, 8)
          });

          this.showToast(`Payment of ₹${activeGatewayOrder.amount} verified! Ledger updated.`);
          this.closeModal('collectPaymentModalBackdrop');
          activeGatewayOrder = null;
          if (gatewayOrderBox) gatewayOrderBox.style.display = 'none';
          document.getElementById('collectPaymentForm')?.reset();
          this.refreshDashboardData();
          this.refreshLoansTable();
          this.renderCustomersTable();
          this.loadExplorerTransactions();
        } catch (err) {
          this.showToast(`Payment verification error: ${err.message}`);
        } finally {
          btnSimulateSuccess.disabled = false;
          btnSimulateSuccess.textContent = 'Simulate Customer Payment & Verify HMAC →';
        }
      });
    }

    // Auth Modal Setup
    const authClose = document.getElementById('authModalCloseBtn');
    if (authClose) authClose.addEventListener('click', () => this.closeModal('authModalBackdrop'));

    const tabLogin = document.getElementById('tabLoginBtn');
    const tabRegister = document.getElementById('tabRegisterBtn');
    const loginFormBlock = document.getElementById('loginFormBlock');
    const registerFormBlock = document.getElementById('registerFormBlock');
    const registerStep1Form = document.getElementById('registerStep1Form');
    const registerOtpStage = document.getElementById('registerOtpStage');
    const authHeaderTitle = document.getElementById('authModalHeaderTitle');

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        if (loginFormBlock) loginFormBlock.style.display = 'block';
        if (registerFormBlock) registerFormBlock.style.display = 'none';
        if (authHeaderTitle) authHeaderTitle.textContent = 'Merchant Login';
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        if (loginFormBlock) loginFormBlock.style.display = 'none';
        if (registerFormBlock) {
          registerFormBlock.style.display = 'block';
          if (registerStep1Form) registerStep1Form.style.display = 'block';
          if (registerOtpStage) registerOtpStage.style.display = 'none';
        }
        if (authHeaderTitle) authHeaderTitle.textContent = 'Register Merchant Store';
      });
    }

    // Password Visibility Toggle
    document.querySelectorAll('.toggle-password-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        const eyeOpen = btn.querySelector('.eye-open');
        const eyeClosed = btn.querySelector('.eye-closed');

        if (input.type === 'password') {
          input.type = 'text';
          if (eyeOpen) eyeOpen.style.display = 'none';
          if (eyeClosed) eyeClosed.style.display = 'block';
        } else {
          input.type = 'password';
          if (eyeOpen) eyeOpen.style.display = 'block';
          if (eyeClosed) eyeClosed.style.display = 'none';
        }
      });
    });

    // Interactive CAPTCHA handler (login & register)
    const setupCaptcha = (boxId, squareId, spinnerId, checkmarkId) => {
      const box = document.getElementById(boxId);
      const square = document.getElementById(squareId);
      const spinner = document.getElementById(spinnerId);
      const checkmark = document.getElementById(checkmarkId);

      if (box) {
        box.addEventListener('click', () => {
          if (box.dataset.verified === 'true') return;

          if (square) square.style.display = 'none';
          if (spinner) spinner.style.display = 'block';

          setTimeout(() => {
            if (spinner) spinner.style.display = 'none';
            if (checkmark) checkmark.style.display = 'block';
            box.dataset.verified = 'true';
            box.setAttribute('aria-checked', 'true');
            box.classList.add('verified');
          }, 650);
        });
      }
    };

    setupCaptcha('loginCaptchaBox', 'loginCaptchaSquare', 'loginCaptchaSpinner', 'loginCaptchaCheckmark');
    setupCaptcha('regCaptchaBox', 'regCaptchaSquare', 'regCaptchaSpinner', 'regCaptchaCheckmark');

    // Login Form Submission
    window.handleLoginSubmit = async () => {
      const identifier = document.getElementById('loginIdentifier').value.trim();
      const password = document.getElementById('loginPassword').value;
      const captchaBox = document.getElementById('loginCaptchaBox');

      if (!identifier || !password) {
        this.showToast('Please enter your mobile/email and password');
        return;
      }

      if (captchaBox && captchaBox.dataset.verified !== 'true') {
        this.showToast('Please check "I\'m not a robot" to continue');
        captchaBox.classList.add('shake');
        setTimeout(() => captchaBox.classList.remove('shake'), 400);
        return;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          this.showToast(data.error?.message || 'Incorrect phone/email or password.');
          return;
        }

        const user = data.data.user;
        const merchant = {
          id: user.id,
          fullName: user.fullName || user.shopName,
          shopName: user.shopName,
          phone: user.phone || identifier,
          email: user.email || '',
          gstin: ''
        };

        this.closeModal('authModalBackdrop');
        this.authenticateUser(merchant);
        this.showToast(data.message || `Welcome, ${merchant.shopName}!`);
      } catch (err) {
        console.error('login error', err);
        this.showToast('Unable to reach the Hisab server. Please try again.');
      }
    };

    // Register Step 1 Submission
    window.handleRegisterStep1Submit = () => {
      const fullName = document.getElementById('regFullName').value.trim();
      const shopName = document.getElementById('regShopName').value.trim();
      const phone = document.getElementById('regPhone').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirmPassword = document.getElementById('regConfirmPassword').value;
      const captchaBox = document.getElementById('regCaptchaBox');

      if (!fullName || !shopName || !phone || !email || !password || !confirmPassword) {
        this.showToast('Please fill all required store details');
        return;
      }

      // Validate passwords match
      if (password !== confirmPassword) {
        this.showToast('Passwords do not match! Please check both blanks.');
        document.getElementById('regConfirmPassword').focus();
        return;
      }

      if (password.length < 6) {
        this.showToast('Password must be at least 6 characters long');
        return;
      }

      // Check CAPTCHA
      if (captchaBox && captchaBox.dataset.verified !== 'true') {
        this.showToast('Please verify "I\'m not a robot"');
        captchaBox.classList.add('shake');
        setTimeout(() => captchaBox.classList.remove('shake'), 400);
        return;
      }

      // Transition to Step 2: OTP Authentication
      if (registerStep1Form) registerStep1Form.style.display = 'none';
      if (registerOtpStage) {
        registerOtpStage.style.display = 'block';
        const displayPhone = document.getElementById('displayOtpPhone');
        if (displayPhone) displayPhone.textContent = `+91 ${phone}`;
        this.startOtpTimer();
        const firstOtp = document.getElementById('otpBox1');
        if (firstOtp) setTimeout(() => firstOtp.focus(), 150);
      }
      this.showToast(`6-digit OTP code sent to +91 ${phone}`);
    };

    // OTP Digit Inputs Auto-advance & Backspace
    const otpBoxes = [
      document.getElementById('otpBox1'),
      document.getElementById('otpBox2'),
      document.getElementById('otpBox3'),
      document.getElementById('otpBox4'),
      document.getElementById('otpBox5'),
      document.getElementById('otpBox6')
    ].filter(Boolean);

    otpBoxes.forEach((box, index) => {
      box.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < otpBoxes.length - 1) {
          otpBoxes[index + 1].focus();
        }
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && index > 0) {
          otpBoxes[index - 1].focus();
        }
      });
    });

    // Demo OTP Fill Button
    const demoFillBtn = document.getElementById('otpDemoFillBtn');
    if (demoFillBtn) {
      demoFillBtn.addEventListener('click', () => {
        const code = '482910';
        otpBoxes.forEach((box, idx) => {
          if (box) box.value = code[idx] || '';
        });
        if (otpBoxes[5]) otpBoxes[5].focus();
        this.showToast('Demo OTP 482910 auto-filled');
      });
    }

    // OTP Back Button
    const otpBackBtn = document.getElementById('otpBackBtn');
    if (otpBackBtn) {
      otpBackBtn.addEventListener('click', () => {
        if (registerOtpStage) registerOtpStage.style.display = 'none';
        if (registerStep1Form) registerStep1Form.style.display = 'block';
      });
    }

    // OTP Resend Button
    const otpResendBtn = document.getElementById('otpResendBtn');
    if (otpResendBtn) {
      otpResendBtn.addEventListener('click', () => {
        this.startOtpTimer();
        this.showToast('New OTP sent to your phone');
      });
    }

    // Handle OTP Verification
    window.handleOtpVerification = async () => {
      const enteredCode = otpBoxes.map(b => b.value).join('');
      if (enteredCode.length < 6) {
        this.showToast('Please enter the full 6-digit OTP code');
        return;
      }

      const shopName = document.getElementById('regShopName').value.trim() || 'My Kirana Store';
      const fullName = document.getElementById('regFullName').value.trim() || 'Store Owner';
      const phone = document.getElementById('regPhone').value.trim() || '';
      const email = document.getElementById('regEmail').value.trim() || '';
      const password = document.getElementById('regPassword').value;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shopName, fullName, phone, email, password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          this.showToast(data.error?.message || 'Registration failed. Please check your details.');
          // Surface duplicate-account / validation errors back at the form
          if (data.error?.code === 'ACCOUNT_EXISTS' || data.error?.code === 'MISSING_FIELDS') {
            if (registerOtpStage) registerOtpStage.style.display = 'none';
            if (registerStep1Form) registerStep1Form.style.display = 'block';
          }
          return;
        }

        const user = data.data.user;
        const merchant = {
          id: user.id,
          fullName: user.fullName || fullName,
          shopName: user.shopName,
          phone: user.phone || phone,
          email: user.email || email,
          gstin: ''
        };

        this.closeModal('authModalBackdrop');
        this.authenticateUser(merchant);
        this.showToast(data.message || `Verified! Store "${shopName}" is now active.`);
      } catch (err) {
        console.error('register error', err);
        this.showToast('Unable to reach the Hisab server. Please try again.');
      }
    };
  }

  startOtpTimer() {
    let timeLeft = 30;
    const countdownEl = document.getElementById('otpCountdown');
    const resendBtn = document.getElementById('otpResendBtn');
    if (resendBtn) resendBtn.disabled = true;

    clearInterval(this.otpInterval);
    this.otpInterval = setInterval(() => {
      timeLeft--;
      if (countdownEl) countdownEl.textContent = timeLeft.toString();
      if (timeLeft <= 0) {
        clearInterval(this.otpInterval);
        if (resendBtn) resendBtn.disabled = false;
        if (countdownEl) countdownEl.textContent = '0';
      }
    }, 1000);
  }

  openModal(backdropId) {
    const backdrop = document.getElementById(backdropId);
    if (backdrop) {
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    if (backdropId === 'customersModalBackdrop') {
      this.renderCustomersTable();
      this.renderHighestPayingCustomers();
    }
  }

  closeModal(backdropId) {
    const backdrop = document.getElementById(backdropId);
    if (backdrop) {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    });
    if (window.voiceAssistant) {
      window.voiceAssistant.stopListening();
    }
  }

  closeVoiceModal() {
    this.closeModal('voiceModalBackdrop');
    if (window.voiceAssistant) {
      window.voiceAssistant.stopListening();
    }
  }

  // =========================================================================
  // 3. Hero Actions & Voice Chat Trigger
  // =========================================================================
  setupHeroActions() {
    const enterBtn = document.getElementById('heroEnterBtn');
    if (enterBtn) {
      enterBtn.addEventListener('click', () => {
        this.openModal('authModalBackdrop');
        const tabLogin = document.getElementById('tabLoginBtn');
        if (tabLogin) tabLogin.click();
        const input = document.getElementById('loginIdentifier');
        if (input) setTimeout(() => input.focus(), 150);
      });
    }

    const howItWorksLink = document.getElementById('navLinkHowItWorks');
    if (howItWorksLink) {
      howItWorksLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openModal('voiceModalBackdrop');
        if (window.voiceAssistant) {
          window.voiceAssistant.runSimulationMode("Ramesh paid 450 rupees for grocery");
        }
      });
    }

    const pricingLink = document.getElementById('navLinkPricing');
    if (pricingLink) {
      pricingLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showToast('Hisab is 100% free for merchants — no subscriptions or hidden fees.');
      });
    }

    const voiceBtn = document.getElementById('voiceChatBtn');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        this.openModal('voiceModalBackdrop');
        if (window.voiceAssistant) {
          window.voiceAssistant.startListening();
        }
      });
    }

    // Hero suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-sample');
        this.openModal('voiceModalBackdrop');
        if (window.voiceAssistant) {
          window.voiceAssistant.runSimulationMode(text);
        }
      });
    });

    // Footer Quick Buttons
    const footerVoice = document.getElementById('footerVoiceBtn');
    if (footerVoice) {
      footerVoice.addEventListener('click', () => {
        this.openModal('voiceModalBackdrop');
        if (window.voiceAssistant) {
          window.voiceAssistant.startListening();
        }
      });
    }

    const footerApk = document.getElementById('footerApkBtn');
    if (footerApk) {
      footerApk.addEventListener('click', () => this.openModal('apkModalBackdrop'));
    }
  }

  // =========================================================================
  // 4. 3D Resadex-Inspired Centerpiece (Three.js WebGL with tactile ledger token)
  // =========================================================================
  setupThreeDResadexCenterpiece() {
    const container = document.getElementById('centerpieceViewport');
    const canvas = document.getElementById('threeCanvas');
    if (!container || !canvas || typeof THREE === 'undefined') {
      console.info('Three.js initialized in tactile 2D canvas fallback');
      return;
    }

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const width = container.clientWidth || 440;
    const height = container.clientHeight || 260;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 5.2;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Sculpted 3D Bahi-Khata Ledger Token / Acoustic Gyro
    const group = new THREE.Group();
    scene.add(group);

    // 1. Central Metallic Cylinder / Ledger Coin
    const coinGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.22, 64);
    // Warm burnished brass material
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xC49A45,
      roughness: 0.35,
      metalness: 0.8
    });
    const coinMesh = new THREE.Mesh(coinGeo, coinMat);
    coinMesh.rotation.x = Math.PI / 2;
    group.add(coinMesh);

    // 2. Outer Vermilion Ring (Bahi-Khata Red)
    const ringGeo = new THREE.TorusGeometry(1.8, 0.07, 16, 100);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xBA3826,
      roughness: 0.4,
      metalness: 0.5
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    // 3. Inner Indian Rupee Symbol (₹) Custom Mesh Plane
    const canvasTexture = document.createElement('canvas');
    canvasTexture.width = 256;
    canvasTexture.height = 256;
    const ctx = canvasTexture.getContext('2d');
    ctx.fillStyle = '#C49A45';
    ctx.fillRect(0, 0, 256, 256);
    ctx.font = 'bold 150px serif';
    ctx.fillStyle = '#121815';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₹', 128, 128);

    const texture = new THREE.CanvasTexture(canvasTexture);
    const faceGeo = new THREE.CircleGeometry(1.35, 64);
    const faceMat = new THREE.MeshBasicMaterial({ map: texture });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = 0.12;
    group.add(faceMesh);

    // Subtle Lighting (warm museum lighting)
    const ambientLight = new THREE.AmbientLight(0xFFFBF4, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.6);
    keyLight.position.set(4, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xF4DFC8, 0.8);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);

    // Mouse Tracking Physics (Resadex dynamic tilt)
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0.2;
    let targetRotY = 0;

    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX = x * 1.6;
      mouseY = y * 1.6;
    });

    container.addEventListener('mouseleave', () => {
      mouseX = 0;
      mouseY = 0;
    });

    // Click to nudge
    container.addEventListener('click', () => {
      targetRotY += Math.PI * 0.5;
      group.scale.set(1.06, 1.06, 1.06);
      setTimeout(() => group.scale.set(1, 1, 1), 200);
    });

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Ambient floating bobbing
      group.position.y = Math.sin(elapsedTime * 1.8) * 0.08;

      // Smooth lerp rotation towards mouse
      targetRotY += 0.008; // subtle ambient spin
      group.rotation.y += (targetRotY + mouseX - group.rotation.y) * 0.06;
      group.rotation.x += (0.25 + mouseY - group.rotation.x) * 0.06;

      ringMesh.rotation.z = elapsedTime * 0.4;

      renderer.render(scene, camera);
    };
    animate();

    // Window resize handler
    window.addEventListener('resize', () => {
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    });
  }

  // =========================================================================
  // 5. Voice Assistant Initialization
  // =========================================================================
  setupVoiceAssistant() {
    if (window.HisabVoiceAssistant) {
      window.voiceAssistant = new window.HisabVoiceAssistant();
    }
  }

  // =========================================================================
  // 6. Policy Modals (Rules 26 & 27 Compliance)
  // =========================================================================
  setupPolicies() {
    // ToS triggers
    ['footerTosBtn', 'drawerToSBtn', 'authToSLink'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          this.closeAllModals();
          this.openModal('tosModalBackdrop');
        });
      }
    });

    const tosClose = document.getElementById('tosModalCloseBtn');
    if (tosClose) tosClose.addEventListener('click', () => this.closeModal('tosModalBackdrop'));

    // Privacy triggers
    ['footerPrivacyBtn', 'drawerPrivacyBtn', 'authPrivacyLink'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          this.closeAllModals();
          this.openModal('privacyModalBackdrop');
        });
      }
    });

    const privacyClose = document.getElementById('privacyModalCloseBtn');
    if (privacyClose) privacyClose.addEventListener('click', () => this.closeModal('privacyModalBackdrop'));
  }

  // =========================================================================
  // 7. Authenticated Merchant Workspace Engine (Payments & CSV Intelligence)
  // =========================================================================

  authenticateUser(merchant, persist = true) {
    this.isAuthenticated = true;
    this.merchantProfile = { ...this.merchantProfile, ...merchant };

    if (persist) {
      try {
        sessionStorage.setItem('hisab_session', JSON.stringify(this.merchantProfile));
      } catch (e) {
        console.warn('sessionStorage write error', e);
      }
    }

    // Toggle main workspace views
    const homeSection = document.getElementById('home');
    const merchantWorkspace = document.getElementById('merchantWorkspace');
    if (homeSection) homeSection.style.display = 'none';
    if (merchantWorkspace) {
      merchantWorkspace.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Toggle drawer navigation sets
    const publicLinks = document.getElementById('publicDrawerLinks');
    const authLinks = document.getElementById('authDrawerLinks');
    if (publicLinks) publicLinks.style.display = 'none';
    if (authLinks) authLinks.style.display = 'block';

    // Update Header Status & Brand Pill
    const brandBadge = document.getElementById('brandAuthBadge');
    if (brandBadge) {
      brandBadge.textContent = 'VERIFIED MERCHANT';
      brandBadge.style.opacity = '0.9';
      brandBadge.style.borderColor = '#137333';
      brandBadge.style.color = '#137333';
    }

    const headerStatusText = document.getElementById('headerStatusText');
    const headerStatusSubtext = document.getElementById('headerStatusSubtext');
    if (headerStatusText) headerStatusText.textContent = 'NPCI UPI & Bank Gateway Connected';
    if (headerStatusSubtext) headerStatusSubtext.textContent = 'Real-time Sync';

    // Populate Merchant Details in UI
    const storeInitials = (this.merchantProfile.shopName || 'S').charAt(0).toUpperCase();
    ['merchantAvatarLetter', 'profileAvatarLetter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = storeInitials;
    });

    ['workspaceStoreName', 'profileStoreName'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = this.merchantProfile.shopName;
    });

    ['workspaceOwnerName', 'profileOwnerName'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = this.merchantProfile.fullName;
    });

    const phoneEl = document.getElementById('profilePhone');
    if (phoneEl) phoneEl.textContent = this.merchantProfile.phone;

    const emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.textContent = this.merchantProfile.email;

    // Enforce condition: Show ONLY the 2 onboarding options if neither condition is satisfied
    this.updateDataStageVisibility();
  }

  logoutUser() {
    this.isAuthenticated = false;
    // Revoke the server-side session too (best effort; cookie is HttpOnly)
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    try {
      sessionStorage.removeItem('hisab_session');
    } catch (e) {
      console.warn('sessionStorage remove error', e);
    }

    // Toggle views back
    const homeSection = document.getElementById('home');
    const merchantWorkspace = document.getElementById('merchantWorkspace');
    if (homeSection) homeSection.style.display = 'block';
    if (merchantWorkspace) merchantWorkspace.style.display = 'none';

    // Toggle drawer navigation
    const publicLinks = document.getElementById('publicDrawerLinks');
    const authLinks = document.getElementById('authDrawerLinks');
    if (publicLinks) publicLinks.style.display = 'block';
    if (authLinks) authLinks.style.display = 'none';

    // Reset Header
    const brandBadge = document.getElementById('brandAuthBadge');
    if (brandBadge) {
      brandBadge.textContent = 'BETA 2.4';
      brandBadge.style.opacity = '0.55';
      brandBadge.style.borderColor = 'var(--border-strong)';
      brandBadge.style.color = 'var(--ink-secondary)';
    }

    const headerStatusText = document.getElementById('headerStatusText');
    const headerStatusSubtext = document.getElementById('headerStatusSubtext');
    if (headerStatusText) headerStatusText.textContent = 'Voice Engine Active';
    if (headerStatusSubtext) headerStatusSubtext.textContent = 'Indian Rupee (₹)';

    this.closeAllModals();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.showToast('Workspace locked. Returned to public homepage.');
  }

  // =========================================================================
  // Connection Flow & Conditional Data Reveal Controller
  // =========================================================================

  connectPaymentProvider(providerName) {
    this.isProviderConnected = true;
    this.connectedProviderName = providerName || 'NPCI UPI Stack';

    // Populate transaction records for provider if currently empty
    if (this.transactions.length === 0) {
      this.transactions = this.getDefaultTransactions();
    }

    this.updateDataStageVisibility();
    this.closeAllModals();
    this.showToast(`Connected to ${this.connectedProviderName}! Accounts and provider records unlocked.`);
  }

  disconnectDataSource() {
    this.isProviderConnected = false;
    this.isCsvUploaded = false;
    this.activeDatasetId = null;
    this.activeDatasetName = 'None';
    this.connectedProviderName = '';
    this.activeCsvFileName = '';
    this.transactions = [];
    this.importedCsvRows = [];

    // Clear file inputs
    const promptInput = document.getElementById('promptCsvFileInput');
    if (promptInput) promptInput.value = '';
    const mainCsvInput = document.getElementById('csvFileInput');
    if (mainCsvInput) mainCsvInput.value = '';

    // Clear CSV status card
    const clearCsvBtn = document.getElementById('clearCsvBtn');
    if (clearCsvBtn) clearCsvBtn.style.display = 'none';
    const statusTag = document.getElementById('ingestionStatusTag');
    if (statusTag) statusTag.textContent = 'Awaiting Connection';
    const fileNameEl = document.getElementById('ingestionFileName');
    if (fileNameEl) fileNameEl.textContent = 'None';
    const rowsCountEl = document.getElementById('ingestionRowsCount');
    if (rowsCountEl) rowsCountEl.textContent = '0';
    const repeatCountEl = document.getElementById('ingestionRepeatCount');
    if (repeatCountEl) repeatCountEl.textContent = '0';

    const activeDatasetTitle = document.getElementById('activeDatasetTitle');
    if (activeDatasetTitle) activeDatasetTitle.textContent = 'No Dataset Selected';
    const activeDatasetRowsCount = document.getElementById('activeDatasetRowsCount');
    if (activeDatasetRowsCount) activeDatasetRowsCount.textContent = '0 Records';

    this.updateDataStageVisibility();
    this.showToast('Data source disconnected. Returned to initial 2-option connection setup.');
  }

  updateDataStageVisibility() {
    const unconnectedStage = document.getElementById('unconnectedSetupStage');
    const connectedStage = document.getElementById('connectedDataStage');
    const headerStatusText = document.getElementById('headerStatusText');
    const headerStatusSubtext = document.getElementById('headerStatusSubtext');
    const activeLabel = document.getElementById('activeSourceLabel');
    const activeSub = document.getElementById('activeSourceSub');

    const hasActiveSource = this.isProviderConnected || this.isCsvUploaded || !!this.activeDatasetId;

    if (hasActiveSource) {
      if (unconnectedStage) unconnectedStage.style.display = 'none';
      if (connectedStage) connectedStage.style.display = 'block';

      if (this.isProviderConnected && (this.isCsvUploaded || this.activeDatasetId)) {
        if (activeLabel) activeLabel.textContent = `${this.connectedProviderName} + Statement (${this.activeDatasetName || this.activeCsvFileName})`;
        if (activeSub) activeSub.textContent = 'Dual stream merged • Live settlement feeds active';
        if (headerStatusText) headerStatusText.textContent = `${this.connectedProviderName} + Statement Ingested`;
        if (headerStatusSubtext) headerStatusSubtext.textContent = 'Multi-source active';
      } else if (this.isProviderConnected) {
        if (activeLabel) activeLabel.textContent = `${this.connectedProviderName} Connected`;
        if (activeSub) activeSub.textContent = 'Live settlement feeds streaming';
        if (headerStatusText) headerStatusText.textContent = `${this.connectedProviderName} Connected`;
        if (headerStatusSubtext) headerStatusSubtext.textContent = 'Real-time Sync';
      } else if (this.isCsvUploaded || this.activeDatasetId) {
        if (activeLabel) activeLabel.textContent = `Statement Ingested: ${this.activeDatasetName || this.activeCsvFileName}`;
        if (activeSub) activeSub.textContent = `Normalized SQLite financial ledger active`;
        if (headerStatusText) headerStatusText.textContent = 'Statement Ingested';
        if (headerStatusSubtext) headerStatusSubtext.textContent = `Ledger verified`;
      }

      this.refreshAllWorkspaceData();
      if (typeof this.refreshFinancialDashboard === 'function') {
        this.refreshFinancialDashboard();
      }
    } else {
      if (unconnectedStage) unconnectedStage.style.display = 'block';
      if (connectedStage) connectedStage.style.display = 'none';

      if (headerStatusText) headerStatusText.textContent = 'Awaiting Connection (Setup)';
      if (headerStatusSubtext) headerStatusSubtext.textContent = 'Connect Provider or Upload CSV';
    }
  }

  setupAuthWorkspace() {
    // Quick Subnav Actions
    const subnavProfile = document.getElementById('subnavModalProfile');
    if (subnavProfile) subnavProfile.addEventListener('click', () => this.openModal('profileModalBackdrop'));

    const subnavInventory = document.getElementById('subnavModalInventory');
    if (subnavInventory) subnavInventory.addEventListener('click', () => this.openModal('inventoryModalBackdrop'));

    const subnavCustomers = document.getElementById('subnavModalCustomers');
    if (subnavCustomers) subnavCustomers.addEventListener('click', () => this.openModal('customersModalBackdrop'));

    const viewFullCustBtn = document.getElementById('viewFullCustomersBtn');
    if (viewFullCustBtn) viewFullCustBtn.addEventListener('click', () => this.openModal('customersModalBackdrop'));

    const quickLock = document.getElementById('quickLockBtn');
    if (quickLock) quickLock.addEventListener('click', () => this.logoutUser());

    const syncBtn = document.getElementById('syncGatewaysBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.showToast('Connecting to NPCI UPI & Bank Core... Feeds synchronized.');
      });
    }

    const downloadReportBtn = document.getElementById('workspaceDownloadReportBtn');
    if (downloadReportBtn) downloadReportBtn.addEventListener('click', () => this.exportRecordsCsv());

    const exportFilteredBtn = document.getElementById('exportFilteredBtn');
    if (exportFilteredBtn) exportFilteredBtn.addEventListener('click', () => this.exportRecordsCsv());

    // Connection Option 1: Payment Provider Buttons
    const btnConnectPrompt = document.getElementById('btnConnectProviderPrompt');
    if (btnConnectPrompt) {
      btnConnectPrompt.addEventListener('click', () => {
        this.openModal('providersModalBackdrop');
      });
    }

    const btnQuickUpi = document.getElementById('btnQuickConnectUpi');
    if (btnQuickUpi) {
      btnQuickUpi.addEventListener('click', () => {
        this.connectPaymentProvider('NPCI UPI Stack');
      });
    }

    // Modal Provider Connect Buttons
    document.querySelectorAll('.btn-connect-rail').forEach(btn => {
      btn.addEventListener('click', () => {
        const providerName = btn.dataset.providerName || 'Payment Provider';
        this.connectPaymentProvider(providerName);
      });
    });

    // Connection Option 2: CSV Upload Actions
    const btnPromptUploadCsv = document.getElementById('btnPromptUploadCsv');
    const promptCsvFileInput = document.getElementById('promptCsvFileInput');
    if (btnPromptUploadCsv && promptCsvFileInput) {
      btnPromptUploadCsv.addEventListener('click', () => {
        promptCsvFileInput.click();
      });

      promptCsvFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.processCsvFile(e.target.files[0]);
        }
      });
    }

    const btnPromptLoadSample = document.getElementById('btnPromptLoadSampleCsv');
    if (btnPromptLoadSample) {
      btnPromptLoadSample.addEventListener('click', () => {
        const sampleContent = this.generateSampleCsv();
        this.ingestCsvText(sampleContent, 'sample_merchant_statement.csv');
      });
    }

    const btnPromptDownloadTemplate = document.getElementById('btnPromptDownloadTemplate');
    if (btnPromptDownloadTemplate) {
      btnPromptDownloadTemplate.addEventListener('click', () => {
        this.downloadSampleCsv();
      });
    }

    // Active Connection Banner Actions
    const btnSwitchAddSource = document.getElementById('btnSwitchAddSource');
    if (btnSwitchAddSource) {
      btnSwitchAddSource.addEventListener('click', () => {
        this.openModal('providersModalBackdrop');
      });
    }

    const btnDisconnect = document.getElementById('btnDisconnectSource');
    if (btnDisconnect) {
      btnDisconnect.addEventListener('click', () => {
        this.disconnectDataSource();
      });
    }

    // Period selector chips
    document.querySelectorAll('.period-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.period-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activePeriod = chip.dataset.period;
        this.refreshAllWorkspaceData();
      });
    });

    // Provider filter tabs
    document.querySelectorAll('.provider-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.provider-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeProviderFilter = btn.dataset.provider;
        this.renderProviderRecordsTable();
      });
    });

    // Provider search input
    const providerSearch = document.getElementById('providerSearchInput');
    if (providerSearch) {
      providerSearch.addEventListener('input', (e) => {
        this.providerSearchQuery = e.target.value.toLowerCase().trim();
        this.renderProviderRecordsTable();
      });
    }

    // Customers modal search & filters
    const custSearch = document.getElementById('customersSearchInput');
    if (custSearch) {
      custSearch.addEventListener('input', (e) => {
        this.customerSearchQuery = e.target.value.toLowerCase().trim();
        this.renderCustomersTable();
      });
    }

    document.querySelectorAll('.cust-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.cust-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.customerFilter = chip.dataset.filter;
        this.renderCustomersTable();
      });
    });

    // Inventory Add SKU Form
    const invForm = document.getElementById('invAddForm');
    if (invForm) {
      invForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('invItemName').value.trim();
        const sku = document.getElementById('invSkuCode').value.trim();
        const category = document.getElementById('invCategory').value.trim();
        const stock = parseInt(document.getElementById('invStockQty').value, 10) || 0;
        const cost = parseFloat(document.getElementById('invUnitCost').value) || 0;
        const price = parseFloat(document.getElementById('invSellingPrice').value) || 0;

        if (!name || !sku) return;

        let status = 'In Stock';
        if (stock <= 10) status = 'Reorder Alert';
        else if (stock <= 20) status = 'Low Stock';

        this.inventoryItems.unshift({ sku, name, category, stock, cost, price, status });
        invForm.reset();
        this.renderInventoryTable();
        this.showToast(`SKU ${sku} (${name}) added to stock inventory.`);
      });
    }

    // CSV Ingestion Setup
    this.setupCsvIngestion();

    // Initial render if any condition is satisfied
    if (this.isProviderConnected || this.isCsvUploaded) {
      this.refreshAllWorkspaceData();
    }
  }

  refreshAllWorkspaceData() {
    this.renderLiquidityMetrics();
    this.renderFlowChart();
    this.renderHighestPayingCustomers();
    this.renderProviderRecordsTable();
    this.renderInventoryTable();
    this.renderCustomersTable();
  }

  getDefaultTransactions() {
    return [
      { id: 'TXN-9081', date: '2026-09-08 18:40', ref: 'UPI/6251892018', customer: 'Rajesh Kirana & Sons', provider: 'UPI / QR', flow: 'inflow', amount: 18600, status: 'Settled' },
      { id: 'TXN-9082', date: '2026-09-08 17:15', ref: 'POS/8821940122', customer: 'Sharma Enterprises', provider: 'Card PoS', flow: 'inflow', amount: 28900, status: 'Settled' },
      { id: 'TXN-9083', date: '2026-09-08 15:30', ref: 'NEFT/HDFC902811', customer: 'Wholesale Flour Mills', provider: 'Bank NEFT', flow: 'outflow', amount: 24500, status: 'Settled' },
      { id: 'TXN-9084', date: '2026-09-08 14:10', ref: 'UPI/7710294819', customer: 'Anita Verma', provider: 'UPI / QR', flow: 'inflow', amount: 6500, status: 'Settled' },
      { id: 'TXN-9085', date: '2026-09-07 19:25', ref: 'POS/9912048123', customer: 'Gupta Provisions', provider: 'Card PoS', flow: 'inflow', amount: 16800, status: 'Settled' },
      { id: 'TXN-9086', date: '2026-09-07 16:45', ref: 'UPI/6619284011', customer: 'Sharma Enterprises', provider: 'UPI / QR', flow: 'inflow', amount: 14200, status: 'Settled' },
      { id: 'TXN-9087', date: '2026-09-07 13:00', ref: 'NEFT/BSES192840', customer: 'BSES Yamuna Power', provider: 'Bank NEFT', flow: 'outflow', amount: 9800, status: 'Settled' },
      { id: 'TXN-9088', date: '2026-09-06 20:10', ref: 'CSH/4820194821', customer: 'Mehta Sweets & Snacks', provider: 'Bahi-Khata Cash', flow: 'inflow', amount: 8400, status: 'Settled' },
      { id: 'TXN-9089', date: '2026-09-06 18:30', ref: 'UPI/8829104822', customer: 'Rajesh Kirana & Sons', provider: 'UPI / QR', flow: 'inflow', amount: 15400, status: 'Settled' },
      { id: 'TXN-9090', date: '2026-09-06 14:20', ref: 'POS/7710294821', customer: 'Deepak Electric Works', provider: 'Card PoS', flow: 'inflow', amount: 4200, status: 'Settled' },
      { id: 'TXN-9091', date: '2026-09-05 17:50', ref: 'UPI/4410294811', customer: 'Anita Verma', provider: 'UPI / QR', flow: 'inflow', amount: 7100, status: 'Settled' },
      { id: 'TXN-9092', date: '2026-09-05 15:15', ref: 'NEFT/DAIRY92811', customer: 'Dairy Supplies India', provider: 'Bank NEFT', flow: 'outflow', amount: 16500, status: 'Settled' },
      { id: 'TXN-9093', date: '2026-09-05 11:30', ref: 'UPI/5519204822', customer: 'Gupta Provisions', provider: 'UPI / QR', flow: 'inflow', amount: 9400, status: 'Settled' },
      { id: 'TXN-9094', date: '2026-09-04 19:40', ref: 'POS/3310294819', customer: 'Rajesh Kirana & Sons', provider: 'Card PoS', flow: 'inflow', amount: 8500, status: 'Settled' },
      { id: 'TXN-9095', date: '2026-09-04 16:20', ref: 'UPI/1129304928', customer: 'Rohan Medical Store', provider: 'UPI / QR', flow: 'inflow', amount: 5300, status: 'Settled' },
      { id: 'TXN-9096', date: '2026-09-04 12:10', ref: 'UPI/9920194821', customer: 'Mehta Sweets & Snacks', provider: 'UPI / QR', flow: 'inflow', amount: 6200, status: 'Settled' },
      { id: 'TXN-9097', date: '2026-09-03 18:00', ref: 'POS/6610294820', customer: 'Deepak Electric Works', provider: 'Card PoS', flow: 'inflow', amount: 3900, status: 'Settled' },
      { id: 'TXN-9098', date: '2026-09-03 15:30', ref: 'CSH/7720194811', customer: 'Rohan Medical Store', provider: 'Bahi-Khata Cash', flow: 'inflow', amount: 4800, status: 'Settled' },
      { id: 'TXN-9099', date: '2026-09-02 14:00', ref: 'NEFT/PACK902811', customer: 'Apex Packaging Ltd', provider: 'Bank NEFT', flow: 'outflow', amount: 6400, status: 'Settled' },
      { id: 'TXN-9100', date: '2026-09-02 11:15', ref: 'MDR/GATEWAY881', customer: 'Gateway MDR Charges', provider: 'Bank NEFT', flow: 'outflow', amount: 5200, status: 'Settled' },
      { id: 'TXN-9101', date: '2026-09-01 19:00', ref: 'UPI/8819204812', customer: 'Kavita Singh', provider: 'UPI / QR', flow: 'inflow', amount: 7800, status: 'Settled' },
      { id: 'TXN-9102', date: '2026-09-01 16:30', ref: 'POS/5510294811', customer: 'Vikram Patel', provider: 'Card PoS', flow: 'inflow', amount: 9200, status: 'Settled' },
      { id: 'TXN-9103', date: '2026-09-01 13:10', ref: 'UPI/3310294819', customer: 'Pooja Textiles', provider: 'UPI / QR', flow: 'inflow', amount: 6150, status: 'Settled' },
      { id: 'TXN-9104', date: '2026-09-01 10:20', ref: 'CSH/1120194812', customer: 'Arun Traders', provider: 'Bahi-Khata Cash', flow: 'inflow', amount: 5400, status: 'Settled' }
    ];
  }

  // =========================================================================
  // Inflow & Outflow Analysis
  // =========================================================================
  calculateLiquidityMetrics() {
    let totalInflow = 0;
    let totalOutflow = 0;
    let upiInflow = 0;
    let cardInflow = 0;
    let netInflow = 0;
    let vendorOutflow = 0;
    let utilityOutflow = 0;
    let feeOutflow = 0;
    let outflowCount = 0;

    this.transactions.forEach(t => {
      if (t.flow === 'inflow') {
        totalInflow += t.amount;
        if (t.provider.includes('UPI')) upiInflow += t.amount;
        else if (t.provider.includes('PoS') || t.provider.includes('Card')) cardInflow += t.amount;
        else netInflow += t.amount;
      } else {
        totalOutflow += t.amount;
        outflowCount += 1;
        if (t.customer.includes('Wholesale') || t.customer.includes('Dairy') || t.customer.includes('Apex')) {
          vendorOutflow += t.amount;
        } else if (t.customer.includes('Power') || t.customer.includes('Rent') || t.customer.includes('Insurance')) {
          utilityOutflow += t.amount;
        } else {
          feeOutflow += t.amount;
        }
      }
    });

    const netBalance = totalInflow - totalOutflow;
    const retentionRate = totalInflow > 0 ? ((netBalance / totalInflow) * 100).toFixed(1) : '0.0';

    return {
      totalInflow,
      totalOutflow,
      netBalance,
      upiInflow,
      cardInflow,
      netInflow,
      vendorOutflow,
      utilityOutflow,
      feeOutflow,
      outflowCount,
      retentionRate
    };
  }

  renderLiquidityMetrics() {
    const metrics = this.calculateLiquidityMetrics();

    const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtInt = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const totalInflowEl = document.getElementById('metricTotalInflow');
    if (totalInflowEl) totalInflowEl.textContent = fmt(metrics.totalInflow);

    const totalOutflowEl = document.getElementById('metricTotalOutflow');
    if (totalOutflowEl) totalOutflowEl.textContent = fmt(metrics.totalOutflow);

    const netBalanceEl = document.getElementById('metricNetBalance');
    if (netBalanceEl) netBalanceEl.textContent = fmt(metrics.netBalance);

    const upiVal = document.getElementById('inflowUpiVal');
    if (upiVal) upiVal.textContent = `₹${fmtInt(metrics.upiInflow)}`;

    const cardVal = document.getElementById('inflowCardVal');
    if (cardVal) cardVal.textContent = `₹${fmtInt(metrics.cardInflow)}`;

    const netVal = document.getElementById('inflowNetVal');
    if (netVal) netVal.textContent = `₹${fmtInt(metrics.netInflow)}`;

    const vendorVal = document.getElementById('outflowVendorVal');
    if (vendorVal) vendorVal.textContent = `₹${fmtInt(metrics.vendorOutflow)}`;

    const utilityVal = document.getElementById('outflowUtilityVal');
    if (utilityVal) utilityVal.textContent = `₹${fmtInt(metrics.utilityOutflow)}`;

    const feeVal = document.getElementById('outflowFeeVal');
    if (feeVal) feeVal.textContent = `₹${fmtInt(metrics.feeOutflow)}`;

    const outflowCountTag = document.getElementById('outflowCountTag');
    if (outflowCountTag) outflowCountTag.textContent = `${metrics.outflowCount} Disbursements`;

    const retentionPercentTag = document.getElementById('retentionPercentTag');
    if (retentionPercentTag) retentionPercentTag.textContent = `${metrics.retentionRate}%`;

    const retentionBarFill = document.getElementById('retentionBarFill');
    if (retentionBarFill) retentionBarFill.style.width = `${Math.min(Math.max(metrics.retentionRate, 5), 100)}%`;
  }

  // =========================================================================
  // Inflow vs Outflow Visualizer Chart (SVG)
  // =========================================================================
  renderFlowChart() {
    const svg = document.getElementById('flowSvgChart');
    if (!svg) return;

    // Group by day for the past 7 days
    const days = ['02 Sep', '03 Sep', '04 Sep', '05 Sep', '06 Sep', '07 Sep', '08 Sep'];
    const dataByDay = days.map((d, index) => {
      const dayPrefix = `2026-09-0${index + 2}`;
      let inflow = 0;
      let outflow = 0;
      this.transactions.forEach(t => {
        if (t.date.startsWith(dayPrefix)) {
          if (t.flow === 'inflow') inflow += t.amount;
          else outflow += t.amount;
        }
      });
      return { day: d, inflow, outflow };
    });

    const maxVal = Math.max(...dataByDay.map(d => Math.max(d.inflow, d.outflow)), 35000);
    const chartW = 760;
    const chartH = 170;
    const paddingLeft = 40;
    const paddingBottom = 26;
    const barWidth = 18;
    const groupGap = (chartW - paddingLeft - 20) / days.length;

    let svgHtml = `
      <!-- Chart grid lines -->
      <line x1="${paddingLeft}" y1="20" x2="${chartW}" y2="20" stroke="var(--border-rule)" stroke-dasharray="3 3"/>
      <line x1="${paddingLeft}" y1="75" x2="${chartW}" y2="75" stroke="var(--border-rule)" stroke-dasharray="3 3"/>
      <line x1="${paddingLeft}" y1="130" x2="${chartW}" y2="130" stroke="var(--border-rule)"/>
    `;

    dataByDay.forEach((item, idx) => {
      const groupX = paddingLeft + (idx * groupGap) + 15;
      const usableHeight = 110;
      const inflowHeight = (item.inflow / maxVal) * usableHeight;
      const outflowHeight = (item.outflow / maxVal) * usableHeight;

      const inflowY = 130 - inflowHeight;
      const outflowY = 130 - outflowHeight;

      svgHtml += `
        <!-- Day Group: ${item.day} -->
        <rect x="${groupX}" y="${inflowY}" width="${barWidth}" height="${inflowHeight}" rx="2" fill="#137333">
          <title>${item.day} Inflow: ₹${item.inflow.toLocaleString('en-IN')}</title>
        </rect>
        <rect x="${groupX + barWidth + 4}" y="${outflowY}" width="${barWidth}" height="${outflowHeight}" rx="2" fill="var(--accent-vermilion)">
          <title>${item.day} Outflow: ₹${item.outflow.toLocaleString('en-IN')}</title>
        </rect>
        <text x="${groupX + barWidth}" y="150" fill="var(--ink-secondary)" font-size="11" font-family="var(--font-sans)" font-weight="600" text-anchor="middle">${item.day}</text>
      `;
    });

    svg.innerHTML = svgHtml;
  }

  // =========================================================================
  // Highest Paying Customers & Repeat Payer Identification Engine
  // =========================================================================
  getCustomersAnalysis() {
    const customerMap = {};
    const excludedExpenseAccounts = [
      'Wholesale Flour Mills', 'BSES Yamuna Power', 'Dairy Supplies India',
      'Apex Packaging Ltd', 'Gateway MDR Charges', 'National Insurance Co', 'Suresh Logistics'
    ];

    this.transactions.forEach(t => {
      if (excludedExpenseAccounts.includes(t.customer)) return;

      if (!customerMap[t.customer]) {
        customerMap[t.customer] = {
          name: t.customer,
          totalSpend: 0,
          totalTransactions: 0,
          inflowCount: 0,
          providers: {},
          lastActive: t.date.split(' ')[0],
          transactions: []
        };
      }

      customerMap[t.customer].totalTransactions += 1;
      customerMap[t.customer].transactions.push(t);
      if (t.flow === 'inflow') {
        customerMap[t.customer].totalSpend += t.amount;
        customerMap[t.customer].inflowCount += 1;
      }
      customerMap[t.customer].providers[t.provider] = (customerMap[t.customer].providers[t.provider] || 0) + 1;
      if (t.date > customerMap[t.customer].lastActive) {
        customerMap[t.customer].lastActive = t.date.split(' ')[0];
      }
    });

    const customers = Object.values(customerMap).map(c => {
      // Find preferred provider
      let preferredProvider = 'UPI / QR';
      let maxPCount = 0;
      for (const [p, count] of Object.entries(c.providers)) {
        if (count > maxPCount) {
          maxPCount = count;
          preferredProvider = p;
        }
      }

      // Repeat Payer Detection: 2 or more transactions
      const isRepeatPayer = c.transactions.length >= 2;

      return {
        ...c,
        preferredProvider,
        isRepeatPayer
      };
    });

    // Sort by highest spend
    customers.sort((a, b) => b.totalSpend - a.totalSpend);
    return customers;
  }

  renderHighestPayingCustomers() {
    const customers = this.getCustomersAnalysis();
    const repeatPayers = customers.filter(c => c.isRepeatPayer);

    // Update counts across UI
    const headerCount = document.getElementById('headerCustomerCount');
    if (headerCount) headerCount.textContent = customers.length.toString();

    const subnavRepeat = document.getElementById('subnavRepeatCount');
    if (subnavRepeat) subnavRepeat.textContent = `${repeatPayers.length} Repeat Payers`;

    const repeatSummary = document.getElementById('repeatPayerSummaryText');
    if (repeatSummary) {
      repeatSummary.textContent = `${repeatPayers.length} Repeat Payers currently identified with 2 or more settlements. All are automatically indexed into the Customers subsection.`;
    }

    const drawerRepeatBadge = document.getElementById('drawerRepeatCustomersBadge');
    if (drawerRepeatBadge) drawerRepeatBadge.textContent = `${repeatPayers.length} Repeat`;

    // Render Top 4 Highest Paying Customers
    const topGrid = document.getElementById('topPayersGrid');
    const top4 = customers.slice(0, 4);
    if (top4.length === 0) {
      topGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: var(--ink-secondary); background: var(--bg-surface); border: 1px dashed var(--border-rule); border-radius: var(--radius-md);">
          No customer payment records yet. Connect a payment provider or upload a CSV file to populate high-value payers.
        </div>
      `;
      return;
    }

    topGrid.innerHTML = top4.map((c, index) => {
      const rank = index + 1;
      const formattedSpend = c.totalSpend.toLocaleString('en-IN');
      const repeatTag = c.isRepeatPayer
        ? `<span class="repeat-status-tag repeat-active">★ Repeat Payer (${c.transactions.length})</span>`
        : `<span class="repeat-status-tag">First-Time Payer</span>`;

      return `
        <div class="top-payer-card" style="cursor: pointer;" data-customer-name="${this.escapeHtml(c.name)}" title="Click to view full customer statement">
          <span class="payer-rank-badge">#0${rank}</span>
          <div>
            <h4 class="payer-name">${this.escapeHtml(c.name)}</h4>
            <div class="payer-metrics-row">
              <span class="currency-symbol">₹</span>
              <span>${formattedSpend}</span>
            </div>
          </div>
          <div class="payer-meta-footer">
            ${repeatTag}
            <span class="text-muted">${this.escapeHtml(c.preferredProvider)}</span>
          </div>
        </div>
      `;
    }).join('');

    topGrid.querySelectorAll('.top-payer-card').forEach(card => {
      card.addEventListener('click', () => {
        const name = card.dataset.customerName;
        if (name) this.openCustomerStatement(name);
      });
    });
  }

  // =========================================================================
  // Provider Records Table
  // =========================================================================
  renderProviderRecordsTable() {
    const tbody = document.getElementById('providerRecordsTableBody');
    if (!tbody) return;

    let filtered = [...this.transactions];

    // Filter by provider
    if (this.activeProviderFilter !== 'all') {
      filtered = filtered.filter(t => t.provider.toLowerCase().includes(this.activeProviderFilter.toLowerCase()));
    }

    // Filter by search query
    if (this.providerSearchQuery) {
      filtered = filtered.filter(t =>
        t.customer.toLowerCase().includes(this.providerSearchQuery) ||
        t.ref.toLowerCase().includes(this.providerSearchQuery) ||
        t.provider.toLowerCase().includes(this.providerSearchQuery)
      );
    }

    const countAll = document.getElementById('countAllProviders');
    if (countAll) countAll.textContent = this.transactions.length.toString();

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--ink-secondary);">
            No records match the current filter or search criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(t => {
      const isFlowIn = t.flow === 'inflow';
      const flowBadgeClass = isFlowIn ? 'inflow' : 'outflow';
      const flowText = isFlowIn ? 'Inflow (Jama)' : 'Outflow (Payout)';
      const amountColor = isFlowIn ? 'color: var(--tally-jama);' : 'color: var(--accent-vermilion);';
      const sign = isFlowIn ? '+' : '-';

      return `
        <tr>
          <td><span style="font-family: var(--font-mono, monospace); font-size: 0.78rem;">${t.date}</span></td>
          <td><code style="font-size: 0.75rem; background: var(--bg-muted); padding: 0.15rem 0.35rem; border-radius: 3px;">${t.ref}</code></td>
          <td><strong>${t.customer}</strong></td>
          <td><span style="font-size: 0.78rem; color: var(--ink-secondary);">${t.provider}</span></td>
          <td><span class="flow-badge ${flowBadgeClass}">${flowText}</span></td>
          <td class="text-right"><strong style="${amountColor}">${sign}₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td>
            <span class="status-check-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              ${t.status}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // =========================================================================
  // Inventory Table Management
  // =========================================================================
  renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    let totalValuation = 0;
    let alertCount = 0;

    this.inventoryItems.forEach(item => {
      totalValuation += (item.stock * item.cost);
      if (item.status !== 'In Stock') alertCount += 1;
    });

    const totalSkusEl = document.getElementById('invTotalSkus');
    if (totalSkusEl) totalSkusEl.textContent = `${this.inventoryItems.length} Active SKUs`;

    const subnavInventoryCount = document.getElementById('subnavInventoryCount');
    if (subnavInventoryCount) subnavInventoryCount.textContent = `${this.inventoryItems.length} SKUs`;

    const drawerInventoryBadge = document.getElementById('drawerInventoryBadge');
    if (drawerInventoryBadge) drawerInventoryBadge.textContent = `${this.inventoryItems.length} SKUs`;

    const totalValEl = document.getElementById('invTotalValuation');
    if (totalValEl) totalValEl.textContent = `₹${totalValuation.toLocaleString('en-IN')}`;

    const alertCountEl = document.getElementById('invAlertCount');
    if (alertCountEl) alertCountEl.textContent = `${alertCount} Stock Alerts`;

    tbody.innerHTML = this.inventoryItems.map(item => {
      const margin = (((item.price - item.cost) / item.price) * 100).toFixed(1);
      let statusClass = 'instock';
      if (item.status === 'Low Stock') statusClass = 'lowstock';
      if (item.status === 'Reorder Alert') statusClass = 'reorder';

      return `
        <tr>
          <td><code style="font-size: 0.75rem; background: var(--bg-muted); padding: 0.15rem 0.35rem; border-radius: 3px;">${item.sku}</code></td>
          <td><strong>${item.name}</strong></td>
          <td><span style="font-size: 0.78rem; color: var(--ink-secondary);">${item.category}</span></td>
          <td class="text-right"><strong>${item.stock}</strong></td>
          <td class="text-right">₹${item.cost.toFixed(2)}</td>
          <td class="text-right">₹${item.price.toFixed(2)}</td>
          <td class="text-right"><span style="color: #137333; font-weight: 700;">+${margin}%</span></td>
          <td><span class="stock-status-pill ${statusClass}">${item.status}</span></td>
        </tr>
      `;
    }).join('');
  }

  // =========================================================================
  // Customers Subsection Table Management
  // =========================================================================
  async renderCustomersTable() {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;

    let customers = [];
    try {
      const res = await window.HisabAPI.customers.list({
        search: this.customerSearchQuery || '',
        limit: 100
      });
      if (res && res.data && Array.isArray(res.data.customers) && res.data.customers.length > 0) {
        customers = res.data.customers.map(c => ({
          name: c.name,
          phone: c.phone,
          isRepeatPayer: (c.transaction_count > 1 || c.total_credit > 0),
          totalSpend: Number(c.total_inflow || 0),
          totalCredit: Number(c.total_credit || 0),
          outstandingCredit: Number(c.outstanding_credit || 0),
          transactionsCount: c.transaction_count || 0,
          preferredProvider: 'UPI / QR',
          lastActive: c.last_activity_date || (c.created_at ? c.created_at.slice(0, 10) : '-')
        }));
      }
    } catch (err) {
      console.warn('Backend customer list fallback', err);
    }

    // Fallback if no backend customers returned yet
    if (customers.length === 0) {
      const clientAnalysis = this.getCustomersAnalysis();
      customers = clientAnalysis.map(c => ({
        ...c,
        transactionsCount: c.transactions ? c.transactions.length : 0
      }));
    }

    const repeatPayers = customers.filter(c => c.isRepeatPayer);
    const totalSpend = customers.reduce((acc, c) => acc + c.totalSpend, 0);

    // Update modal meta stats
    const modalTotal = document.getElementById('modalTotalCustomersCount');
    if (modalTotal) modalTotal.textContent = customers.length.toString();

    const allFilterCount = document.getElementById('allCustFilterCount');
    if (allFilterCount) allFilterCount.textContent = customers.length.toString();

    const modalRepeat = document.getElementById('modalRepeatCustomersCount');
    if (modalRepeat) modalRepeat.textContent = repeatPayers.length.toString();

    const repeatFilterCount = document.getElementById('repeatCustFilterCount');
    if (repeatFilterCount) repeatFilterCount.textContent = repeatPayers.length.toString();

    const modalSpend = document.getElementById('modalCustomersTotalSpend');
    if (modalSpend) modalSpend.textContent = `₹${totalSpend.toLocaleString('en-IN')}`;

    // Apply Filter
    if (this.customerFilter === 'repeat') {
      customers = customers.filter(c => c.isRepeatPayer);
    } else if (this.customerFilter === 'high-value') {
      customers = customers.filter(c => c.totalSpend >= 10000);
    }

    // Apply Search
    if (this.customerSearchQuery) {
      const q = this.customerSearchQuery.toLowerCase();
      customers = customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
    }

    if (customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--ink-secondary);">
            No customer records found. Click "+ Add Customer" above to register a customer account.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = customers.map(c => {
      const statusBadge = c.isRepeatPayer
        ? `<span class="repeat-status-tag repeat-active">★ Repeat Payer (${c.transactionsCount} txns)</span>`
        : `<span class="repeat-status-tag">First-time Payer</span>`;

      const udharBadge = c.outstandingCredit > 0
        ? `<span class="stock-status-pill reorder" style="margin-left: 0.5rem; font-size: 0.72rem;">Udhar ₹${c.outstandingCredit.toLocaleString('en-IN')}</span>`
        : '';

      return `
        <tr class="clickable-cust-row" style="cursor: pointer;" data-cust-name="${this.escapeHtml(c.name)}" title="Click to view full customer statement">
          <td>
            <strong>${this.escapeHtml(c.name)}</strong>${udharBadge}
            ${c.phone ? `<br><span style="font-family: var(--font-mono, monospace); font-size: 0.72rem; color: var(--ink-secondary);">+91 ${this.escapeHtml(c.phone)}</span>` : ''}
          </td>
          <td>${statusBadge}</td>
          <td class="text-right"><strong style="color: var(--tally-jama);">₹${c.totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td class="text-right"><strong>${c.transactionsCount}</strong></td>
          <td><span style="font-size: 0.78rem; color: var(--ink-secondary);">${this.escapeHtml(c.preferredProvider)}</span></td>
          <td><span style="font-family: var(--font-mono, monospace); font-size: 0.78rem;">${c.lastActive}</span></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.clickable-cust-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.dataset.custName;
        if (name) this.openCustomerStatement(name);
      });
    });
  }

  // =========================================================================
  // Section 2: Financial Transaction Analytics Engine & SQLite Integration
  // =========================================================================

  setupFinancialAnalytics() {
    // 1. Ingestion Drag & Drop and File Inputs
    const fileInput = document.getElementById('csvFileInput');
    const dropZone = document.getElementById('csvDropZone');
    const browseBtn = document.getElementById('browseCsvBtn');
    const promptInput = document.getElementById('promptCsvFileInput');
    const btnPromptUpload = document.getElementById('btnPromptUploadCsv');

    const triggerUpload = (inputEl) => {
      if (inputEl) inputEl.click();
    };

    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerUpload(fileInput);
      });
    }

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => triggerUpload(fileInput));

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      ['dragleave', 'dragend'].forEach(evt => {
        dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover'));
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.processCsvFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.processCsvFile(e.target.files[0]);
        }
      });
    }

    if (btnPromptUpload && promptInput) {
      btnPromptUpload.addEventListener('click', () => triggerUpload(promptInput));
      promptInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.processCsvFile(e.target.files[0]);
        }
      });
    }

    // 2. Sample Template Download & Demo Loader
    const sampleDownloadBtn = document.getElementById('downloadSampleCsvBtn');
    const promptDownloadBtn = document.getElementById('btnPromptDownloadTemplate');
    const handleDownloadTemplate = () => this.downloadSampleCsv();

    if (sampleDownloadBtn) sampleDownloadBtn.addEventListener('click', handleDownloadTemplate);
    if (promptDownloadBtn) promptDownloadBtn.addEventListener('click', handleDownloadTemplate);

    const loadDemoBtn = document.getElementById('loadDemoCsvBtn');
    const promptLoadDemoBtn = document.getElementById('btnPromptLoadSampleCsv');
    const handleLoadDemo = () => this.loadStandardFinancialDemo();

    if (loadDemoBtn) loadDemoBtn.addEventListener('click', handleLoadDemo);
    if (promptLoadDemoBtn) promptLoadDemoBtn.addEventListener('click', handleLoadDemo);

    // 3. Clear Dataset Button
    const clearCsvBtn = document.getElementById('clearCsvBtn');
    if (clearCsvBtn) {
      clearCsvBtn.addEventListener('click', () => {
        this.disconnectDataSource();
      });
    }

    // 4. Mapping Modal Action
    const btnProceedToAudit = document.getElementById('btnConfirmMappingAndImport');
    if (btnProceedToAudit) {
      btnProceedToAudit.addEventListener('click', () => this.handleProceedToAudit());
    }

    // 5. Quality Audit Modal Action
    const btnFinalizeImport = document.getElementById('btnFinalizeImport');
    if (btnFinalizeImport) {
      btnFinalizeImport.addEventListener('click', () => this.handleCommitToDatabase());
    }

    // 6. Global Financial Filter Bar Listeners
    const filterDate = document.getElementById('filterDateRange');
    if (filterDate) {
      filterDate.addEventListener('change', (e) => {
        this.financialFilters.dateRange = e.target.value;
        this.refreshFinancialDashboard();
      });
    }

    const filterFlow = document.getElementById('filterFlowDirection');
    if (filterFlow) {
      filterFlow.addEventListener('change', (e) => {
        this.financialFilters.flow = e.target.value;
        this.refreshFinancialDashboard();
      });
    }

    const filterType = document.getElementById('filterTxnType');
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        this.financialFilters.type = e.target.value;
        this.refreshFinancialDashboard();
      });
    }

    const filterCat = document.getElementById('filterCategory');
    if (filterCat) {
      filterCat.addEventListener('change', (e) => {
        this.financialFilters.category = e.target.value;
        this.refreshFinancialDashboard();
      });
    }

    const filterRail = document.getElementById('filterPaymentRail');
    if (filterRail) {
      filterRail.addEventListener('change', (e) => {
        this.financialFilters.mode = e.target.value;
        this.refreshFinancialDashboard();
      });
    }

    const filterSearch = document.getElementById('filterSearchInput');
    if (filterSearch) {
      let debounceTimer = null;
      filterSearch.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.financialFilters.search = e.target.value.trim();
          this.refreshFinancialDashboard();
        }, 250);
      });
    }

    const filterSource = document.getElementById('filterSource');
    if (filterSource) {
      filterSource.addEventListener('change', (e) => {
        this.financialFilters.source = e.target.value;
        this.refreshFinancialDashboard();
      });
    }

    const filterMerchant = document.getElementById('filterMerchant');
    if (filterMerchant) {
      let debounceTimerMerchant = null;
      filterMerchant.addEventListener('input', (e) => {
        clearTimeout(debounceTimerMerchant);
        debounceTimerMerchant = setTimeout(() => {
          this.financialFilters.merchant = e.target.value.trim();
          this.refreshFinancialDashboard();
        }, 300);
      });
    }

    const filterAmountMin = document.getElementById('filterAmountMin');
    const filterAmountMax = document.getElementById('filterAmountMax');
    const handleAmountFilter = () => {
      this.financialFilters.amount_min = filterAmountMin?.value || '';
      this.financialFilters.amount_max = filterAmountMax?.value || '';
      this.refreshFinancialDashboard();
    };
    if (filterAmountMin) {
      let debounceTimerMin = null;
      filterAmountMin.addEventListener('input', () => {
        clearTimeout(debounceTimerMin);
        debounceTimerMin = setTimeout(handleAmountFilter, 400);
      });
    }
    if (filterAmountMax) {
      let debounceTimerMax = null;
      filterAmountMax.addEventListener('input', () => {
        clearTimeout(debounceTimerMax);
        debounceTimerMax = setTimeout(handleAmountFilter, 400);
      });
    }

    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        this.financialFilters = { dateRange: 'all', flow: 'all', type: 'all', category: 'all', mode: 'all', source: 'all', search: '', merchant: '', amount_min: '', amount_max: '' };
        if (filterDate) filterDate.value = 'all';
        if (filterFlow) filterFlow.value = 'all';
        if (filterType) filterType.value = 'all';
        if (filterCat) filterCat.value = 'all';
        if (filterRail) filterRail.value = 'all';
        if (filterSearch) filterSearch.value = '';
        if (filterSource) filterSource.value = 'all';
        if (filterMerchant) filterMerchant.value = '';
        if (filterAmountMin) filterAmountMin.value = '';
        if (filterAmountMax) filterAmountMax.value = '';
        this.refreshFinancialDashboard();
        this.showToast('Global financial filters reset.');
      });
    }

    // 7. Cash Flow Granularity Toggles
    document.querySelectorAll('.granularity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.granularity-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentGranularity = btn.dataset.granularity || 'monthly';
        this.refreshFinancialDashboard();
      });
    });

    // 8. Transaction Explorer Pagination & Export
    const btnPagePrev = document.getElementById('btnPagePrev');
    if (btnPagePrev) {
      btnPagePrev.addEventListener('click', () => {
        if (this.explorerPage > 1) {
          this.explorerPage--;
          this.fetchAndRenderExplorer();
        }
      });
    }

    const btnPageNext = document.getElementById('btnPageNext');
    if (btnPageNext) {
      btnPageNext.addEventListener('click', () => {
        this.explorerPage++;
        this.fetchAndRenderExplorer();
      });
    }

    const exportExplorerCsvBtn = document.getElementById('exportExplorerCsvBtn');
    if (exportExplorerCsvBtn) {
      exportExplorerCsvBtn.addEventListener('click', () => this.exportFilteredTransactions());
    }

    // 9. Printable Loan Statement Action
    const btnPrintLoan = document.getElementById('btnPrintLoanStatement');
    if (btnPrintLoan) {
      btnPrintLoan.addEventListener('click', () => {
        window.print();
      });
    }
  }

  // =========================================================================
  // Standard Demo CSV & Template Generation
  // =========================================================================

  generateStandardFinancialDemoCsv() {
    return `Date,Transaction_ID,Customer_Party,Description,Amount,Cash_Flow,Type,Payment_Rail,Category,Loan_Ref,Status
2026-09-08 18:40,TXN-9081,Rajesh Kirana & Sons,Wholesale edible oil and grains settlement,18600,INFLOW,PAYMENT,UPI / QR,Retail,,Settled
2026-09-08 17:15,TXN-9082,Sharma Enterprises,Commercial dairy supply invoice settlement,28900,INFLOW,PAYMENT,Card PoS,Commercial,,Settled
2026-09-08 15:30,TXN-9083,Wholesale Flour Mills,Bulk wheat flour 500kg procurement,24500,OUTFLOW,EXPENSE,Bank NEFT,Supplies,,Settled
2026-09-08 14:10,TXN-9084,Anita Verma,Retail monthly provisions grocery,6500,INFLOW,PAYMENT,UPI / QR,Retail,,Settled
2026-09-07 19:25,TXN-9085,Gupta Provisions,Rice bags 200kg bulk purchase,16800,INFLOW,PAYMENT,Card PoS,Wholesale,,Settled
2026-09-07 16:45,TXN-9086,Sharma Enterprises,Spices & dry fruits bulk dispatch,14200,INFLOW,PAYMENT,UPI / QR,Commercial,,Settled
2026-09-07 13:00,TXN-9087,BSES Yamuna Power,Store electricity & commercial billing,9800,OUTFLOW,EXPENSE,Bank NEFT,Utilities,,Settled
2026-09-06 20:10,TXN-9088,Mehta Sweets & Snacks,Pure Desi Ghee 20 tins settlement,8400,INFLOW,PAYMENT,Bahi-Khata Cash,Retail,,Settled
2026-09-06 18:30,TXN-9089,Rajesh Kirana & Sons,Packaged tea & sugar consignment,15400,INFLOW,PAYMENT,UPI / QR,Retail,,Settled
2026-09-06 14:20,TXN-9090,Deepak Electric Works,Working Capital Credit Facility Disbursement,50000,OUTFLOW,LOAN_GIVEN,Bank NEFT,Loan Ledger,LN-2026-01,Disbursed
2026-09-05 17:50,TXN-9091,Anita Verma,Weekly vegetables & dairy supplies,7100,INFLOW,PAYMENT,UPI / QR,Retail,,Settled
2026-09-05 15:15,TXN-9092,Dairy Supplies India,Butter and pasteurized milk supplies,16500,OUTFLOW,EXPENSE,Bank NEFT,Supplies,,Settled
2026-09-05 11:30,TXN-9093,Gupta Provisions,Pulses and legumes consignment,9400,INFLOW,PAYMENT,UPI / QR,Wholesale,,Settled
2026-09-04 19:40,TXN-9094,Rajesh Kirana & Sons,Daily stock replenishment order,8500,INFLOW,PAYMENT,Card PoS,Retail,,Settled
2026-09-04 16:20,TXN-9095,Rohan Medical Store,Shop expansion commercial loan facility,30000,OUTFLOW,LOAN_GIVEN,Bank NEFT,Loan Ledger,LN-2026-02,Disbursed
2026-09-04 12:10,TXN-9096,Mehta Sweets & Snacks,Condensed milk and baking ingredients,6200,INFLOW,PAYMENT,UPI / QR,Retail,,Settled
2026-09-03 18:00,TXN-9097,Deepak Electric Works,Loan Repayment Installment 01,15000,INFLOW,LOAN_REPAYMENT,UPI / QR,Loan Ledger,LN-2026-01,Settled
2026-09-03 15:30,TXN-9098,Rohan Medical Store,Medical storefront counter supplies,4800,INFLOW,PAYMENT,Bahi-Khata Cash,Retail,,Settled
2026-09-02 14:00,TXN-9099,Apex Packaging Ltd,Cardboard boxes and jute packaging bags,6400,OUTFLOW,EXPENSE,Bank NEFT,Supplies,,Settled
2026-09-02 11:15,TXN-9100,Gateway MDR Charges,Payment gateway processing & network charges,5200,OUTFLOW,EXPENSE,Bank NEFT,Financial,,Settled
2026-09-01 19:00,TXN-9101,Kavita Singh,Organic food grains & spices order,7800,INFLOW,PAYMENT,UPI / QR,Retail,,Settled
2026-09-01 16:30,TXN-9102,Vikram Patel,Flour and edible oil retail delivery,9200,INFLOW,PAYMENT,Card PoS,Retail,,Settled
2026-09-01 13:10,TXN-9103,Deepak Electric Works,Loan Repayment Installment 02,10000,INFLOW,LOAN_REPAYMENT,Bank NEFT,Loan Ledger,LN-2026-01,Settled
2026-09-01 10:20,TXN-9104,Rohan Medical Store,Loan Repayment Installment 01,10000,INFLOW,LOAN_REPAYMENT,UPI / QR,Loan Ledger,LN-2026-02,Settled
2026-08-30 11:00,TXN-9105,Kavita Singh,Gourmet condiments and honey,8400,INFLOW,PAYMENT,UPI / QR,Retail,,Settled`;
  }

  downloadSampleCsv() {
    const csvData = this.generateStandardFinancialDemoCsv();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'hisab_financial_transaction_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Financial CSV template downloaded.');
  }

  loadStandardFinancialDemo() {
    const demoCsv = this.generateStandardFinancialDemoCsv();
    this.processCsvString(demoCsv, 'BahiKhata_Demo_Q3_Statement.csv');
  }

  // =========================================================================
  // File Ingestion Pipeline & Auto-Mapping
  // =========================================================================

  processCsvFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.showToast('Please upload a valid .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.processCsvString(e.target.result, file.name);
    };
    reader.onerror = () => {
      this.showToast('Error reading the CSV file.');
    };
    reader.readAsText(file);
  }

  async processCsvString(csvText, fileName) {
    this.rawUploadedCsvText = csvText;
    this.activeUploadFilename = fileName || 'Uploaded_Statement.csv';

    try {
      this.showToast('Analyzing statement structure and column signatures...');
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, fileName: this.activeUploadFilename })
      });

      const res = await response.json();
      if (!res.success) {
        this.showToast(res.error?.message || 'Failed to parse CSV statement.');
        return;
      }

      this.rawHeaders = res.data.headers || [];
      this.detectedMapping = res.data.detectedMapping || {};
      this.previewRows = res.data.previewRows || [];

      this.openMappingModal(res.data, this.activeUploadFilename);
    } catch (err) {
      console.error('Upload error', err);
      this.showToast('Backend server connection error. Ensure Hisab server is running.');
    }
  }

  openMappingModal(data, fileName) {
    const grid = document.getElementById('mappingConfigGrid');
    if (!grid) return;

    const TARGET_FIELDS = [
      { key: 'date', label: 'Transaction Date', required: true, desc: 'Date or timestamp column' },
      { key: 'customer_name', label: 'Customer / Party Name', required: true, desc: 'Payer, merchant, or counterparty' },
      { key: 'amount', label: 'Transaction Amount (₹)', required: true, desc: 'Monetary transaction value' },
      { key: 'transaction_type', label: 'Transaction Type', required: false, desc: 'Payment, Expense, Loan Given, Repayment' },
      { key: 'cash_flow_type', label: 'Cash Flow Direction', required: false, desc: 'Inflow (Jama) or Outflow (Kharcha)' },
      { key: 'category', label: 'Category', required: false, desc: 'Retail, Wholesale, Supplies, etc.' },
      { key: 'payment_method', label: 'Payment Rail / Mode', required: false, desc: 'UPI, PoS Card, NEFT, Cash' },
      { key: 'reference_number', label: 'Reference / UTR / Order ID', required: false, desc: 'Unique transaction identifier' },
      { key: 'loan_id', label: 'Loan Facility Reference', required: false, desc: 'Credit account / loan number' },
      { key: 'description', label: 'Description / Narration', required: false, desc: 'Memo or note details' }
    ];

    let gridHtml = '';
    TARGET_FIELDS.forEach(field => {
      const detectedHeader = data.detectedMapping[field.key] || '';
      const isRequired = field.required;

      let optionsHtml = `<option value="">-- Do Not Map / None --</option>`;
      data.headers.forEach(h => {
        const selected = (detectedHeader && detectedHeader.toLowerCase() === h.toLowerCase()) ? 'selected' : '';
        optionsHtml += `<option value="${h}" ${selected}>${h}</option>`;
      });

      gridHtml += `
        <div class="mapping-field-card">
          <div class="mapping-field-info">
            <span class="mapping-field-name">
              ${field.label} ${isRequired ? '<span class="text-crimson">*</span>' : ''}
            </span>
            <span class="mapping-field-desc">${field.desc}</span>
          </div>
          <select class="mapping-select" data-target-field="${field.key}">
            ${optionsHtml}
          </select>
        </div>
      `;
    });
    grid.innerHTML = gridHtml;

    // Render Raw Preview Table
    const thead = document.getElementById('mappingPreviewThead');
    const tbody = document.getElementById('mappingPreviewTbody');
    if (thead && tbody) {
      thead.innerHTML = `<tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
      tbody.innerHTML = data.previewRows.slice(0, 3).map(r => {
        return `<tr>${data.headers.map(h => `<td>${r[h] || ''}</td>`).join('')}</tr>`;
      }).join('');
    }

    this.openModal('csvMappingModalBackdrop');
  }

  async handleProceedToAudit() {
    // Read selected mappings
    const selects = document.querySelectorAll('#mappingConfigGrid .mapping-select');
    const currentMapping = {};
    selects.forEach(sel => {
      const target = sel.dataset.targetField;
      const val = sel.value.trim();
      if (val) currentMapping[target] = val;
    });

    // Validate required fields
    if (!currentMapping.date) {
      this.showToast('Please map the Date column to continue.');
      return;
    }
    if (!currentMapping.customer_name) {
      this.showToast('Please map the Customer / Party Name column.');
      return;
    }
    if (!currentMapping.amount && !currentMapping.debit && !currentMapping.credit) {
      this.showToast('Please map the Amount (or Debit/Credit) column.');
      return;
    }

    this.currentMapping = currentMapping;

    try {
      this.showToast('Conducting pre-import data quality audit...');
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: this.rawUploadedCsvText,
          mapping: this.currentMapping,
          datasetName: this.activeUploadFilename
        })
      });

      const res = await response.json();
      if (!res.success) {
        this.showToast(res.error?.message || 'Quality audit failed.');
        return;
      }

      const qr = res.data.qualityReport;
      this.currentQualityReport = qr;

      // Populate Data Quality Modal
      const scoreEl = document.getElementById('qualityAccuracyScore');
      if (scoreEl) scoreEl.textContent = `${qr.accuracyScore}%`;

      const nameEl = document.getElementById('qualityDatasetName');
      if (nameEl) nameEl.textContent = this.activeUploadFilename;

      const descEl = document.getElementById('qualitySummaryDesc');
      if (descEl) descEl.textContent = `Scanned ${qr.totalScanned} rows: ${qr.validRows} valid records normalized, ${qr.duplicatesDetected} duplicate signatures flagged.`;

      const qTotal = document.getElementById('qTotalRows');
      if (qTotal) qTotal.textContent = qr.totalScanned.toLocaleString('en-IN');

      const qValid = document.getElementById('qValidRows');
      if (qValid) qValid.textContent = qr.validRows.toLocaleString('en-IN');

      const qInvalid = document.getElementById('qInvalidRows');
      if (qInvalid) qInvalid.textContent = qr.invalidRows.toLocaleString('en-IN');

      const qDup = document.getElementById('qDuplicateRows');
      if (qDup) qDup.textContent = qr.duplicatesDetected.toLocaleString('en-IN');

      const qCust = document.getElementById('qMissingCustomers');
      if (qCust) qCust.textContent = qr.missingCustomers.toLocaleString('en-IN');

      const qAmt = document.getElementById('qMissingAmounts');
      if (qAmt) qAmt.textContent = qr.missingAmounts.toLocaleString('en-IN');

      // Transition modals
      this.closeModal('csvMappingModalBackdrop');
      this.openModal('dataQualityModalBackdrop');
    } catch (err) {
      console.error('Audit error', err);
      this.showToast('Audit failed due to connection issue.');
    }
  }

  async handleCommitToDatabase() {
    try {
      this.showToast('Committing normalized transactions to SQLite database...');
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: this.rawUploadedCsvText,
          mapping: this.currentMapping,
          datasetName: this.activeUploadFilename
        })
      });

      const res = await response.json();
      if (!res.success) {
        this.showToast(res.error?.message || 'Import failed.');
        return;
      }

      this.activeDatasetId = res.data.datasetId;
      this.activeDatasetName = res.data.datasetName;
      this.isCsvUploaded = true;

      // Update active dataset pill card
      const titleEl = document.getElementById('activeDatasetTitle');
      if (titleEl) titleEl.textContent = this.activeDatasetName;

      const rowsEl = document.getElementById('activeDatasetRowsCount');
      if (rowsEl) rowsEl.textContent = `${res.data.insertedCount} Records (${res.data.dateRange})`;

      const clearBtn = document.getElementById('clearCsvBtn');
      if (clearBtn) clearBtn.style.display = 'inline-flex';

      this.closeModal('dataQualityModalBackdrop');
      this.updateDataStageVisibility();
      this.refreshFinancialDashboard();
      this.showToast(`Imported ${res.data.insertedCount} transactions into persistent SQLite ledger!`);
    } catch (err) {
      console.error('Import error', err);
      this.showToast('Commit to database failed.');
    }
  }

  // =========================================================================
  // Primary Financial Analytics Dashboard Refresh
  // =========================================================================

  async refreshFinancialDashboard() {
    try {
      const params = new URLSearchParams();
      if (this.activeDatasetId) params.set('dataset_id', this.activeDatasetId);
      if (this.currentGranularity) params.set('granularity', this.currentGranularity);
      if (this.financialFilters.flow !== 'all') params.set('flow', this.financialFilters.flow);
      if (this.financialFilters.type !== 'all') params.set('type', this.financialFilters.type);
      if (this.financialFilters.category !== 'all') params.set('category', this.financialFilters.category);
      if (this.financialFilters.mode && this.financialFilters.mode !== 'all') params.set('mode', this.financialFilters.mode);
      if (this.financialFilters.search) params.set('search', this.financialFilters.search);

      // Date range translation
      const now = new Date();
      if (this.financialFilters.dateRange === 'today') {
        const todayStr = now.toISOString().slice(0, 10);
        params.set('date_start', todayStr);
        params.set('date_end', todayStr);
      } else if (this.financialFilters.dateRange === 'this_week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        params.set('date_start', d.toISOString().slice(0, 10));
      } else if (this.financialFilters.dateRange === 'this_month') {
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        params.set('date_start', mStart);
      } else if (this.financialFilters.dateRange === 'last_month') {
        const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
        const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
        params.set('date_start', lmStart);
        params.set('date_end', lmEnd);
      } else if (this.financialFilters.dateRange === 'this_year') {
        params.set('date_start', `${now.getFullYear()}-01-01`);
      }

      const response = await fetch(`/api/dashboard?${params.toString()}`);
      const res = await response.json();
      if (!res.success) return;

      const { kpis, cashflow, topCustomers, mostFrequentCustomers, loansSummary, insights } = res.data;

      const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtInt = (n) => Number(n || 0).toLocaleString('en-IN');

      // 1. Total Cash Inflow KPI
      const kpiInflow = document.getElementById('kpiTotalInflow');
      if (kpiInflow) kpiInflow.textContent = fmt(kpis.totalInflow);
      const kpiInflowCount = document.getElementById('kpiInflowCount');
      if (kpiInflowCount) kpiInflowCount.textContent = `${kpis.inflowCount} settlements received`;

      // 2. Total Cash Outflow KPI
      const kpiOutflow = document.getElementById('kpiTotalOutflow');
      if (kpiOutflow) kpiOutflow.textContent = fmt(kpis.totalOutflow);
      const kpiOutflowCount = document.getElementById('kpiOutflowCount');
      if (kpiOutflowCount) kpiOutflowCount.textContent = `${kpis.outflowCount} disbursements paid`;

      // 3. Net Cash Flow KPI
      const kpiNet = document.getElementById('kpiNetCashFlow');
      const kpiNetWrap = document.getElementById('kpiNetBalanceColor');
      if (kpiNet) {
        const sign = kpis.netCashFlow >= 0 ? '+' : '-';
        kpiNet.textContent = `${sign}${fmt(Math.abs(kpis.netCashFlow))}`;
        if (kpiNetWrap) {
          if (kpis.netCashFlow >= 0) {
            kpiNetWrap.className = 'kpi-number-row text-jama';
          } else {
            kpiNetWrap.className = 'kpi-number-row text-crimson';
          }
        }
      }

      // 4. Total Transactions KPI
      const kpiTxns = document.getElementById('kpiTotalTransactions');
      if (kpiTxns) kpiTxns.textContent = fmtInt(kpis.totalTransactions);

      // 5. Unique Customers KPI
      const kpiUnique = document.getElementById('kpiUniqueCustomers');
      if (kpiUnique) kpiUnique.textContent = fmtInt(kpis.uniqueCustomers);

      // 6. Repeated Customers KPI
      const kpiRepeated = document.getElementById('kpiRepeatedCustomers');
      if (kpiRepeated) kpiRepeated.textContent = fmtInt(kpis.repeatedCustomers);

      // 7. Highest Paid Customer KPI
      const kpiHighestCust = document.getElementById('kpiHighestPaidCustomer');
      const kpiHighestAmt = document.getElementById('kpiHighestPaidAmount');
      if (kpiHighestCust) kpiHighestCust.textContent = kpis.highestPaidCustomer?.name || 'None';
      if (kpiHighestAmt) kpiHighestAmt.textContent = `₹${fmt(kpis.highestPaidCustomer?.totalInflow || 0)} total volume`;

      // 8. Outstanding Loans KPI
      const kpiLoans = document.getElementById('kpiOutstandingLoans');
      const kpiLoansCap = document.getElementById('kpiLoansCaption');
      if (kpiLoans) kpiLoans.textContent = fmt(kpis.totalOutstandingLoans);
      if (kpiLoansCap) {
        if (loansSummary.hasLoanData) {
          kpiLoansCap.textContent = `${loansSummary.activeCount} active credit facilities`;
        } else {
          kpiLoansCap.textContent = 'No credit facilities in dataset';
        }
      }

      // 9. Executive Financial Findings Banner
      const insightsList = document.getElementById('insightsList');
      if (insightsList && Array.isArray(insights)) {
        insightsList.innerHTML = insights.map(item => `<li>${item}</li>`).join('');
      }

      // 10. Cashflow Trends Chart
      this.renderCashflowSvgChart(cashflow.series || []);

      // 11. Largest Transactions Cards
      const largestInflowAmt = document.getElementById('largestInflowAmount');
      const largestInflowCust = document.getElementById('largestInflowCustomer');
      const largestInflowDate = document.getElementById('largestInflowDate');
      if (largestInflowAmt) largestInflowAmt.textContent = `₹${fmt(cashflow.largestInflow?.amount || 0)}`;
      if (largestInflowCust) largestInflowCust.textContent = cashflow.largestInflow?.customer_name || 'None';
      if (largestInflowDate) largestInflowDate.textContent = `Date: ${cashflow.largestInflow?.date || '-'}`;

      const largestOutflowAmt = document.getElementById('largestOutflowAmount');
      const largestOutflowCust = document.getElementById('largestOutflowCustomer');
      const largestOutflowDate = document.getElementById('largestOutflowDate');
      if (largestOutflowAmt) largestOutflowAmt.textContent = `₹${fmt(cashflow.largestOutflow?.amount || 0)}`;
      if (largestOutflowCust) largestOutflowCust.textContent = cashflow.largestOutflow?.customer_name || 'None';
      if (largestOutflowDate) largestOutflowDate.textContent = `Date: ${cashflow.largestOutflow?.date || '-'}`;

      const avgTxnAmt = document.getElementById('avgTransactionAmount');
      if (avgTxnAmt) avgTxnAmt.textContent = `₹${fmt(cashflow.averageTransactionValue || 0)}`;

      // 12. Top Spenders Table
      const topSpendersBody = document.getElementById('topSpendersTableBody');
      if (topSpendersBody) {
        if (!topCustomers || topCustomers.length === 0) {
          topSpendersBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--ink-secondary);">No customer spending records yet.</td></tr>`;
        } else {
          topSpendersBody.innerHTML = topCustomers.map(c => `
            <tr>
              <td>
                <button type="button" class="link-btn-text btn-customer-view" data-customer="${c.name}">
                  <strong>${c.name}</strong>
                </button>
              </td>
              <td class="text-right text-jama">₹${fmt(c.totalInflow)}</td>
              <td class="text-right">${c.totalTransactions}</td>
              <td>
                <button type="button" class="action-btn-outline btn-customer-view" data-customer="${c.name}">
                  Statement
                </button>
              </td>
            </tr>
          `).join('');
        }
      }

      // 13. Most Frequent Customers Table
      const freqBody = document.getElementById('mostFrequentTableBody');
      if (freqBody) {
        if (!mostFrequentCustomers || mostFrequentCustomers.length === 0) {
          freqBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--ink-secondary);">No frequent customer activity yet.</td></tr>`;
        } else {
          freqBody.innerHTML = mostFrequentCustomers.map(c => `
            <tr>
              <td>
                <button type="button" class="link-btn-text btn-customer-view" data-customer="${c.name}">
                  <strong>${c.name}</strong>
                </button>
              </td>
              <td class="text-right"><strong>${c.totalTransactions}</strong></td>
              <td class="text-right text-jama">₹${fmt(c.totalInflow)}</td>
              <td>
                <button type="button" class="action-btn-outline btn-customer-view" data-customer="${c.name}">
                  Statement
                </button>
              </td>
            </tr>
          `).join('');
        }
      }

      // Bind all Statement clicks
      document.querySelectorAll('.btn-customer-view').forEach(btn => {
        btn.addEventListener('click', () => {
          const custName = btn.dataset.customer;
          if (custName) this.openCustomerStatement(custName);
        });
      });

      // 14. Loan Management Table
      const loanGivenEl = document.getElementById('loanTotalGiven');
      const loanRepaidEl = document.getElementById('loanTotalRepaid');
      const loanOutEl = document.getElementById('loanTotalOutstanding');
      if (loanGivenEl) loanGivenEl.textContent = `₹${fmt(loansSummary.totalLoansGiven)}`;
      if (loanRepaidEl) loanRepaidEl.textContent = `₹${fmt(loansSummary.totalRepaid)}`;
      if (loanOutEl) loanOutEl.textContent = `₹${fmt(loansSummary.totalOutstanding)}`;

      await this.refreshLoansTable();

      // 15. Refresh Explorer & Datasets & UPI Analytics
      this.explorerPage = 1;
      this.fetchAndRenderExplorer();
      this.loadDatasetsList();
      await this.loadUpiAnalytics();
      await this.loadBankAccounts();

    } catch (err) {
      console.error('refreshFinancialDashboard error', err);
    }
  }

  // =========================================================================
  // Cashflow Trends SVG Visualizer Chart
  // =========================================================================

  renderCashflowSvgChart(series = []) {
    const svg = document.getElementById('analyticsSvgChart');
    if (!svg) return;

    if (!series || series.length === 0) {
      svg.innerHTML = `
        <text x="380" y="90" fill="var(--ink-secondary)" font-size="12" font-family="var(--font-sans)" text-anchor="middle">
          No cash flow data available for the selected period.
        </text>
      `;
      return;
    }

    const chartW = 760;
    const chartH = 180;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const maxVal = Math.max(...series.map(s => Math.max(s.inflow || 0, s.outflow || 0)), 1000);
    const usableWidth = chartW - paddingLeft - paddingRight;
    const usableHeight = chartH - paddingTop - paddingBottom;
    const groupGap = usableWidth / series.length;
    const barWidth = Math.min(Math.max(groupGap * 0.35, 8), 24);

    let svgHtml = `
      <!-- Grid lines -->
      <line x1="${paddingLeft}" y1="${paddingTop}" x2="${chartW - paddingRight}" y2="${paddingTop}" stroke="var(--border-rule)" stroke-dasharray="3 3"/>
      <line x1="${paddingLeft}" y1="${paddingTop + usableHeight * 0.5}" x2="${chartW - paddingRight}" y2="${paddingTop + usableHeight * 0.5}" stroke="var(--border-rule)" stroke-dasharray="3 3"/>
      <line x1="${paddingLeft}" y1="${paddingTop + usableHeight}" x2="${chartW - paddingRight}" y2="${paddingTop + usableHeight}" stroke="var(--border-rule)"/>
    `;

    series.forEach((s, idx) => {
      const groupX = paddingLeft + (idx * groupGap) + (groupGap - barWidth * 2 - 4) / 2;
      const inflowHeight = ((s.inflow || 0) / maxVal) * usableHeight;
      const outflowHeight = ((s.outflow || 0) / maxVal) * usableHeight;

      const inflowY = (paddingTop + usableHeight) - inflowHeight;
      const outflowY = (paddingTop + usableHeight) - outflowHeight;

      svgHtml += `
        <!-- Inflow Bar -->
        <rect x="${groupX}" y="${inflowY}" width="${barWidth}" height="${inflowHeight}" rx="2" fill="#137333">
          <title>${s.period} Inflow: ₹${Number(s.inflow).toLocaleString('en-IN')}</title>
        </rect>
        <!-- Outflow Bar -->
        <rect x="${groupX + barWidth + 3}" y="${outflowY}" width="${barWidth}" height="${outflowHeight}" rx="2" fill="var(--accent-vermilion)">
          <title>${s.period} Outflow: ₹${Number(s.outflow).toLocaleString('en-IN')}</title>
        </rect>
        <!-- Period Label -->
        <text x="${groupX + barWidth}" y="${chartH - 10}" fill="var(--ink-secondary)" font-size="10" font-family="var(--font-sans)" font-weight="600" text-anchor="middle">
          ${s.period}
        </text>
      `;
    });

    svg.innerHTML = svgHtml;
  }

  // =========================================================================
  // Loan Management & Statements
  // =========================================================================

  async refreshLoansTable() {
    const tbody = document.getElementById('loansTableBody');
    if (!tbody) return;

    try {
      const params = new URLSearchParams();
      if (this.activeDatasetId) params.set('dataset_id', this.activeDatasetId);

      const response = await fetch(`/api/loans?${params.toString()}`);
      const res = await response.json();
      if (!res.success) return;

      const { loans, hasLoanData } = res.data;
      const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const totalGiven = loans.reduce((s, l) => s + (l.principal || 0), 0);
      const totalRepaid = loans.reduce((s, l) => s + (l.repaid || 0), 0);
      const totalOutstanding = loans.reduce((s, l) => s + (l.outstanding || 0), 0);

      const elGiven = document.getElementById('loanTotalGiven');
      if (elGiven) elGiven.textContent = `₹${fmt(totalGiven)}`;
      const elRepaid = document.getElementById('loanTotalRepaid');
      if (elRepaid) elRepaid.textContent = `₹${fmt(totalRepaid)}`;
      const elOut = document.getElementById('loanTotalOutstanding');
      if (elOut) elOut.textContent = `₹${fmt(totalOutstanding)}`;

      if (!hasLoanData || loans.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 2rem; color: var(--ink-secondary);">
              No udhar or loan records found. Click "+ Issue Udhar" above to create customer credit.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = loans.map(l => {
        const isSettled = l.status === 'SETTLED';
        const statusClass = isSettled ? 'instock' : 'reorder';

        return `
          <tr>
            <td><code style="font-size: 0.75rem; background: var(--bg-muted); padding: 0.15rem 0.35rem; border-radius: 3px;">${l.loan_id}</code></td>
            <td><strong>${l.customer_name}</strong></td>
            <td><span style="font-family: var(--font-mono, monospace); font-size: 0.78rem;">${l.sanction_date}</span></td>
            <td class="text-right">₹${fmt(l.principal)}</td>
            <td class="text-right text-jama">₹${fmt(l.repaid)}</td>
            <td class="text-right text-crimson"><strong>₹${fmt(l.outstanding)}</strong></td>
            <td><span style="font-family: var(--font-mono, monospace); font-size: 0.78rem;">${l.last_payment_date || '-'}</span></td>
            <td><span class="stock-status-pill ${statusClass}">${l.status}</span></td>
            <td>
              <button type="button" class="action-btn-outline btn-view-loan-statement" data-loan-id="${l.loan_id}">
                Statement
              </button>
            </td>
          </tr>
        `;
      }).join('');

      document.querySelectorAll('.btn-view-loan-statement').forEach(btn => {
        btn.addEventListener('click', () => {
          const loanId = btn.dataset.loanId;
          if (loanId) this.openLoanStatement(loanId);
        });
      });
    } catch (err) {
      console.error('refreshLoansTable error', err);
    }
  }

  async openLoanStatement(loanId) {
    try {
      const response = await fetch('/api/loans');
      const res = await response.json();
      if (!res.success) return;

      const loan = (res.data.loans || []).find(l => l.loan_id === loanId);
      if (!loan) {
        this.showToast('Loan record not found.');
        return;
      }

      const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const nameEl = document.getElementById('lsCustomerName');
      if (nameEl) nameEl.textContent = loan.customer_name;

      const idEl = document.getElementById('lsLoanId');
      if (idEl) idEl.textContent = loan.loan_id;

      const pillEl = document.getElementById('lsStatusPill');
      if (pillEl) {
        pillEl.textContent = loan.status;
        pillEl.className = `stock-status-pill ${loan.status === 'SETTLED' ? 'instock' : 'reorder'}`;
      }

      const origEl = document.getElementById('lsOriginalAmount');
      if (origEl) origEl.textContent = `₹${fmt(loan.principal)}`;

      const dateEl = document.getElementById('lsSanctionDate');
      if (dateEl) dateEl.textContent = `Sanctioned: ${loan.sanction_date}`;

      const repaidEl = document.getElementById('lsTotalRepaid');
      if (repaidEl) repaidEl.textContent = `₹${fmt(loan.repaid)}`;

      const countEl = document.getElementById('lsRepaymentCount');
      if (countEl) countEl.textContent = `${loan.repayments?.length || 0} installments`;

      const outEl = document.getElementById('lsOutstandingBalance');
      if (outEl) outEl.textContent = `₹${fmt(loan.outstanding)}`;

      const tbody = document.getElementById('lsRepaymentsTbody');
      if (tbody) {
        if (!loan.repayments || loan.repayments.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--ink-secondary);">No installments received yet.</td></tr>`;
        } else {
          tbody.innerHTML = loan.repayments.map(r => `
            <tr>
              <td><span style="font-family: var(--font-mono, monospace); font-size: 0.78rem;">${r.date}</span></td>
              <td><code style="font-size: 0.75rem;">${r.reference_number || r.id}</code></td>
              <td class="text-right text-jama"><strong>₹${fmt(r.amount)}</strong></td>
              <td><span class="status-check-pill">Verified Inflow</span></td>
            </tr>
          `).join('');
        }
      }

      this.openModal('loanStatementModalBackdrop');
    } catch (err) {
      console.error('openLoanStatement error', err);
    }
  }

  async loadCustomerDropdowns() {
    try {
      const res = await window.HisabAPI.customers.list({ limit: 100 });
      const customers = res?.data?.customers || [];

      const creditSelect = document.getElementById('creditCustomerSelect');
      const repaySelect = document.getElementById('repayCustomerSelect');

      if (creditSelect) {
        const creditOptions = ['<option value="">-- Choose Customer --</option>']
          .concat(customers.map(c => `<option value="${c.id}" data-name="${this.escapeHtml(c.name)}">${this.escapeHtml(c.name)} (${c.phone || 'No phone'}) - Outstanding: ₹${Number(c.outstanding_credit || 0).toLocaleString('en-IN')}</option>`));
        creditSelect.innerHTML = creditOptions.join('');
      }

      if (repaySelect) {
        const repayOptions = ['<option value="">-- Choose Customer --</option>']
          .concat(customers.map(c => `<option value="${c.id}" data-name="${this.escapeHtml(c.name)}">${this.escapeHtml(c.name)} (Outstanding: ₹${Number(c.outstanding_credit || 0).toLocaleString('en-IN')})</option>`));
        repaySelect.innerHTML = repayOptions.join('');
      }
    } catch (err) {
      console.warn('loadCustomerDropdowns error', err);
    }
  }

  // =========================================================================
  // Customer Statement & Lifetime Activity Modal
  // =========================================================================

  async openCustomerStatement(customerName) {
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(customerName)}`);
      const res = await response.json();
      if (!res.success) return;

      const cust = res.data;
      const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const nameEl = document.getElementById('cdName');
      if (nameEl) nameEl.textContent = cust.name;

      const idEl = document.getElementById('cdId');
      if (idEl) idEl.textContent = `ID: ${cust.customer_id || 'CUST-' + Math.abs(cust.name.split('').reduce((a,c)=>a+c.charCodeAt(0),0))}`;

      const repeatEl = document.getElementById('cdRepeatBadge');
      if (repeatEl) {
        if (cust.isRepeatPayer) {
          repeatEl.textContent = `★ Repeat Customer (${cust.totalTransactions} txns)`;
          repeatEl.style.display = 'inline-flex';
        } else {
          repeatEl.textContent = 'First-time Customer';
          repeatEl.style.display = 'inline-flex';
        }
      }

      const methodEl = document.getElementById('cdMethodBadge');
      if (methodEl) methodEl.textContent = cust.preferredPaymentMethod || 'UPI / QR';

      const totalTxns = document.getElementById('cdTotalTxns');
      if (totalTxns) totalTxns.textContent = cust.totalTransactions;

      const totalInflow = document.getElementById('cdTotalInflow');
      if (totalInflow) totalInflow.textContent = `₹${fmt(cust.totalInflow)}`;

      const totalOutflow = document.getElementById('cdTotalOutflow');
      if (totalOutflow) totalOutflow.textContent = `₹${fmt(cust.totalOutflow)}`;

      const netContrib = document.getElementById('cdNetContrib');
      if (netContrib) netContrib.textContent = `₹${fmt(cust.netContribution)}`;

      const tbody = document.getElementById('cdTransactionsTbody');
      if (tbody) {
        if (!cust.transactions || cust.transactions.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1.5rem; color: var(--ink-secondary);">No transaction history found.</td></tr>`;
        } else {
          tbody.innerHTML = cust.transactions.map(t => {
            const isFlowIn = t.cash_flow_type === 'INFLOW' || t.flow === 'inflow';
            const flowClass = isFlowIn ? 'inflow' : 'outflow';
            const flowText = isFlowIn ? 'Inflow (Jama)' : 'Outflow (Kharcha)';
            const amtColor = isFlowIn ? 'color: var(--tally-jama);' : 'color: var(--accent-vermilion);';
            const sign = isFlowIn ? '+' : '-';

            return `
              <tr>
                <td><span style="font-family: var(--font-mono, monospace); font-size: 0.78rem;">${t.date}</span></td>
                <td><code style="font-size: 0.75rem;">${t.reference_number || t.ref || t.id}</code></td>
                <td>${t.description || '-'}</td>
                <td><span class="flow-badge ${flowClass}">${flowText}</span></td>
                <td class="text-right"><strong style="${amtColor}">${sign}₹${fmt(t.amount)}</strong></td>
                <td><span style="font-size: 0.78rem; color: var(--ink-secondary);">${t.payment_method || t.provider || '-'}</span></td>
                <td><span class="status-check-pill">${t.status || 'Settled'}</span></td>
              </tr>
            `;
          }).join('');
        }
      }

      this.openModal('customerDetailModalBackdrop');
    } catch (err) {
      console.error('openCustomerStatement error', err);
    }
  }

  // =========================================================================
  // Transaction Explorer (Paginated, Searchable, Filtered)
  // =========================================================================

  async fetchAndRenderExplorer() {
    const tbody = document.getElementById('explorerTableBody');
    if (!tbody) return;

    try {
      const params = new URLSearchParams();
      if (this.activeDatasetId) params.set('dataset_id', this.activeDatasetId);
      params.set('page', this.explorerPage);
      params.set('limit', this.explorerLimit);

      if (this.financialFilters.flow !== 'all') params.set('flow', this.financialFilters.flow);
      if (this.financialFilters.type !== 'all') params.set('type', this.financialFilters.type);
      if (this.financialFilters.category !== 'all') params.set('category', this.financialFilters.category);
      if (this.financialFilters.mode && this.financialFilters.mode !== 'all') params.set('mode', this.financialFilters.mode);
      if (this.financialFilters.search) params.set('search', this.financialFilters.search);

      const response = await fetch(`/api/transactions?${params.toString()}`);
      const res = await response.json();
      if (!res.success) return;

      const { transactions, total, page, limit, totalPages } = res.data;
      this.totalExplorerRecords = total;

      // Update Pagination Bar
      const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
      const endIdx = Math.min(page * limit, total);
      const pageInfo = document.getElementById('paginationInfo');
      if (pageInfo) pageInfo.textContent = `Showing ${startIdx} - ${endIdx} of ${total} transactions`;

      const pageNum = document.getElementById('pageNumberDisplay');
      if (pageNum) pageNum.textContent = `Page ${page} of ${Math.max(totalPages, 1)}`;

      const btnPrev = document.getElementById('btnPagePrev');
      if (btnPrev) btnPrev.disabled = (page <= 1);

      const btnNext = document.getElementById('btnPageNext');
      if (btnNext) btnNext.disabled = (page >= totalPages);

      if (transactions.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--ink-secondary);">
              No transactions match the selected filter parameters.
            </td>
          </tr>
        `;
        return;
      }

      const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      tbody.innerHTML = transactions.map(t => {
        const isFlowIn = (t.cash_flow_type || '').toUpperCase() === 'INFLOW';
        const flowClass = isFlowIn ? 'inflow' : 'outflow';
        const flowLabel = isFlowIn ? 'Inflow' : 'Outflow';
        const amtColor = isFlowIn ? 'color: var(--tally-jama);' : 'color: var(--accent-vermilion);';
        const sign = isFlowIn ? '+' : '-';

        return `
          <tr>
            <td><span style="font-family: var(--font-mono, monospace); font-size: 0.78rem;">${t.date} ${t.time || ''}</span></td>
            <td><code style="font-size: 0.75rem; background: var(--bg-muted); padding: 0.15rem 0.35rem; border-radius: 3px;">${t.reference_number || t.id}</code></td>
            <td>
              <button type="button" class="link-btn-text btn-customer-view" data-customer="${t.customer_name}">
                <strong>${t.customer_name}</strong>
              </button>
            </td>
            <td><span style="font-size: 0.78rem; color: var(--ink-secondary);">${t.description || '-'}</span></td>
            <td><span style="font-size: 0.75rem; font-weight: 600;">${t.transaction_type}</span></td>
            <td><span class="flow-badge ${flowClass}">${flowLabel}</span></td>
            <td class="text-right"><strong style="${amtColor}">${sign}₹${fmt(t.amount)}</strong></td>
            <td><span style="font-size: 0.78rem; color: var(--ink-secondary);">${t.payment_method || '-'}</span></td>
            <td><span style="font-size: 0.78rem;">${t.category || '-'}</span></td>
            <td><span class="status-check-pill">${t.status || 'Settled'}</span></td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-customer-view').forEach(btn => {
        btn.addEventListener('click', () => {
          const custName = btn.dataset.customer;
          if (custName) this.openCustomerStatement(custName);
        });
      });

    } catch (err) {
      console.error('fetchAndRenderExplorer error', err);
    }
  }

  // =========================================================================
  // Dataset Management (Persistent SQLite Datasets)
  // =========================================================================

  async loadDatasetsList() {
    const tbody = document.getElementById('datasetsTableBody');
    const countBadge = document.getElementById('datasetsCountBadge');

    try {
      const response = await fetch('/api/datasets');
      const res = await response.json();
      if (!res.success) return;

      this.datasetsList = res.data || [];
      if (countBadge) countBadge.textContent = this.datasetsList.length.toString();

      if (!tbody) return;

      if (this.datasetsList.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 2rem; color: var(--ink-secondary);">
              No persistent datasets uploaded yet. Upload a CSV statement to create a persistent SQLite dataset.
            </td>
          </tr>
        `;
        return;
      }

      const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      tbody.innerHTML = this.datasetsList.map(ds => {
        const isCurrent = ds.id === this.activeDatasetId;
        const statusBadge = isCurrent
          ? `<span class="repeat-status-tag repeat-active">★ Active Dataset</span>`
          : `<span class="status-check-pill">Saved</span>`;

        const switchBtn = isCurrent
          ? `<button type="button" class="action-btn-outline" disabled style="opacity: 0.6;">Current</button>`
          : `<button type="button" class="action-btn-outline btn-switch-dataset" data-id="${ds.id}" data-name="${ds.name}">Switch To</button>`;

        return `
          <tr>
            <td><strong>${ds.name}</strong></td>
            <td><span style="font-family: var(--font-mono, monospace); font-size: 0.78rem;">${ds.uploaded_at.slice(0, 16).replace('T', ' ')}</span></td>
            <td><span style="font-family: var(--font-mono, monospace); font-size: 0.78rem;">${ds.date_start} to ${ds.date_end}</span></td>
            <td class="text-right"><strong>${ds.row_count}</strong></td>
            <td class="text-right text-jama">₹${fmt(ds.total_inflow)}</td>
            <td class="text-right text-crimson">₹${fmt(ds.total_outflow)}</td>
            <td>${statusBadge}</td>
            <td style="display: flex; gap: 0.5rem; align-items: center;">
              ${switchBtn}
              <button type="button" class="action-btn-outline text-crimson btn-delete-dataset" data-id="${ds.id}" data-name="${ds.name}" title="Delete dataset">
                Delete
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-switch-dataset').forEach(btn => {
        btn.addEventListener('click', () => {
          const dsId = btn.dataset.id;
          const dsName = btn.dataset.name;
          this.switchDataset(dsId, dsName);
        });
      });

      tbody.querySelectorAll('.btn-delete-dataset').forEach(btn => {
        btn.addEventListener('click', () => {
          const dsId = btn.dataset.id;
          const dsName = btn.dataset.name;
          this.deleteDataset(dsId, dsName);
        });
      });

    } catch (err) {
      console.error('loadDatasetsList error', err);
    }
  }

  switchDataset(datasetId, datasetName) {
    this.activeDatasetId = datasetId;
    this.activeDatasetName = datasetName;
    this.isCsvUploaded = true;

    const titleEl = document.getElementById('activeDatasetTitle');
    if (titleEl) titleEl.textContent = datasetName;

    const clearBtn = document.getElementById('clearCsvBtn');
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    this.closeModal('datasetsModalBackdrop');
    this.updateDataStageVisibility();
    this.refreshFinancialDashboard();
    this.showToast(`Switched active dataset to: ${datasetName}`);
  }

  async deleteDataset(datasetId, datasetName) {
    if (!confirm(`Are you sure you want to delete dataset "${datasetName}"? This will remove its transactions from the SQLite ledger.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/datasets/${encodeURIComponent(datasetId)}`, { method: 'DELETE' });
      const res = await response.json();
      if (!res.success) {
        this.showToast(res.error?.message || 'Could not delete dataset.');
        return;
      }

      if (this.activeDatasetId === datasetId) {
        this.activeDatasetId = null;
        this.activeDatasetName = 'None';
        this.isCsvUploaded = false;
        this.updateDataStageVisibility();
      }

      this.loadDatasetsList();
      this.refreshFinancialDashboard();
      this.showToast(`Dataset "${datasetName}" deleted.`);
    } catch (err) {
      console.error('deleteDataset error', err);
      this.showToast('Failed to delete dataset.');
    }
  }

  // =========================================================================
  // Export Filtered Transactions
  // =========================================================================

  exportFilteredTransactions() {
    const params = new URLSearchParams();
    if (this.activeDatasetId) params.set('dataset_id', this.activeDatasetId);
    if (this.financialFilters.flow !== 'all') params.set('flow', this.financialFilters.flow);
    if (this.financialFilters.search) params.set('search', this.financialFilters.search);

    const exportUrl = `/api/export?${params.toString()}`;
    window.location.href = exportUrl;
    this.showToast('Exporting filtered transactions CSV...');
  }

  // =========================================================================
  // Account Aggregator (AA) & Automated UPI Integration
  // =========================================================================

  setupAccountAggregator() {
    // 1. Open Bank Connect Modal buttons
    const btnPrompt = document.getElementById('btnConnectBankPrompt');
    if (btnPrompt) {
      btnPrompt.addEventListener('click', () => {
        this.openModal('bankConnectModalBackdrop');
      });
    }

    const btnLinkAnother = document.getElementById('btnLinkAnotherBank');
    if (btnLinkAnother) {
      btnLinkAnother.addEventListener('click', () => {
        this.openModal('bankConnectModalBackdrop');
      });
    }

    // 2. 1-Click Connect Demo Bank button
    const btnQuickConnect = document.getElementById('btnQuickConnectUpi');
    if (btnQuickConnect) {
      btnQuickConnect.addEventListener('click', async () => {
        await this.connectAndSyncBank('HDFC', '9876543210');
      });
    }

    // 3. Bank Selection Tiles inside Modal
    document.querySelectorAll('#bankSelectionGrid .bank-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        document.querySelectorAll('#bankSelectionGrid .bank-tile').forEach(t => t.classList.remove('selected'));
        tile.classList.add('selected');
        this.selectedBankId = tile.dataset.bankId || 'HDFC';
      });
    });

    // 4. Modal Confirm & Cancel
    const btnConfirm = document.getElementById('btnConfirmBankConnect');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', async () => {
        const phone = document.getElementById('bankConnectPhone')?.value || '9876543210';
        const vpa = document.getElementById('bankConnectVpa')?.value || '';
        this.closeModal('bankConnectModalBackdrop');
        await this.connectAndSyncBank(this.selectedBankId, phone, vpa);
      });
    }

    const btnCancel = document.getElementById('btnCancelBankConnect');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.closeModal('bankConnectModalBackdrop');
      });
    }

    const btnClose = document.getElementById('bankModalCloseBtn');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.closeModal('bankConnectModalBackdrop');
      });
    }

    // 5. Sync Now Button in Bank Strip
    const btnSyncNow = document.getElementById('btnSyncBankNow');
    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', async () => {
        await this.syncBankAccount();
      });
    }

    // 6. Disconnect Bank Button
    const btnDisconnectBank = document.getElementById('btnDisconnectBank');
    if (btnDisconnectBank) {
      btnDisconnectBank.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to disconnect your bank account and purge synced transactions?')) return;
        await this.disconnectBank();
      });
    }
  }

  async connectAndSyncBank(bankId = 'HDFC', phoneNumber = '9876543210', customerVpa = '') {
    try {
      this.showToast(`Connecting to ${bankId} via RBI Account Aggregator...`);
      const connectRes = await fetch('/api/bank/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId, phoneNumber, customerVpa })
      });
      if (this.handleApiError(connectRes)) return;
      const connectData = await connectRes.json();
      if (!connectData.success) {
        this.showToast(connectData.error?.message || 'Bank connection failed.');
        return;
      }

      // Real AA flows return a consent URL the user must visit to approve.
      // Mock mode returns ACTIVE immediately; production PENDING flows pause here.
      if (connectData.data.consentUrl && connectData.data.status !== 'ACTIVE') {
        this.showToast('Consent request created. Complete approval in your bank / AA app...');
        window.open(connectData.data.consentUrl, '_blank', 'noopener');
        await this.loadBankAccounts();
        return;
        // After the user approves, the provider webhook updates consent status;
        // the next "Sync Transactions" completes the data fetch.
      }

      this.showToast('Consent authorized. Fetching verified UPI & bank transactions...');
      const syncRes = await fetch('/api/bank/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connectData.data.accountId })
      });
      if (this.handleApiError(syncRes)) return;
      const syncData = await syncRes.json();

      this.isProviderConnected = true;
      this.connectedProviderName = `${connectData.data.bankName} (AA)`;

      // Transition to connected data stage
      const setupStage = document.getElementById('unconnectedSetupStage');
      if (setupStage) setupStage.style.display = 'none';
      const dataStage = document.getElementById('connectedDataStage');
      if (dataStage) dataStage.style.display = 'block';

      const sourceLabel = document.getElementById('activeSourceLabel');
      if (sourceLabel) sourceLabel.textContent = `${connectData.data.bankName} (AA Stream)`;

      await this.loadBankAccounts();
      await this.refreshFinancialDashboard();
      await this.loadUpiAnalytics();

      this.showToast(syncData.message || 'Bank account and UPI transactions synced successfully!');
    } catch (err) {
      console.error('connectAndSyncBank error', err);
      this.showToast('Bank connection failed.');
    }
  }

  async syncBankAccount(accountId = null) {
    const btn = document.getElementById('btnSyncBankNow');
    const btnText = document.getElementById('btnSyncBankText');
    if (btn) btn.classList.add('syncing');
    if (btnText) btnText.textContent = 'Syncing...';      try {
      const response = await fetch('/api/bank/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountId ? { accountId } : {})
      });
      if (this.handleApiError(response)) return;
      const res = await response.json();
      if (res.success) {
        const d = res.data;
        if (d.isUpToDate) {
          this.showToast(`You're up to date — no new transactions. (${d.duplicatesSkipped} already imported)`);
        } else {
          this.showToast(`✓ ${d.insertedCount} new transactions imported (${d.upiCount} UPI detected), ${d.duplicatesSkipped} duplicates skipped.`);
        }
        await this.loadBankAccounts();
        await this.refreshFinancialDashboard();
        await this.loadUpiAnalytics();
      } else {
        this.showToast(res.error?.message || 'Sync failed.');
      }
    } catch (err) {
      console.error('syncBankAccount error', err);
      this.showToast('Sync request encountered an error.');
    } finally {
      if (btn) btn.classList.remove('syncing');
      if (btnText) btnText.textContent = 'Sync Transactions';
    }
  }

  async disconnectBank() {
    try {
      if (this.connectedBankAccounts.length === 0) return;
      const accId = this.connectedBankAccounts[0].id;
      const response = await fetch(`/api/bank/accounts/${accId}`, { method: 'DELETE' });
      if (this.handleApiError(response)) return;
      const res = await response.json();
      if (res.success) {
        this.showToast('Bank disconnected, consent revoked and synced records purged.');
        this.isProviderConnected = false;
        await this.loadBankAccounts();
        await this.refreshFinancialDashboard();
        await this.loadUpiAnalytics();
      } else {
        this.showToast(res.error?.message || 'Unable to disconnect bank account.');
      }
    } catch (err) {
      console.error('disconnectBank error', err);
    }
  }

  async loadBankAccounts() {
    try {
      const response = await fetch('/api/bank/accounts');
      const res = await response.json();
      if (!res.success) return;

      this.connectedBankAccounts = res.data || [];
      const strip = document.getElementById('connectedBankSyncStrip');
      const bankNameEl = document.getElementById('connectedBankName');
      const maskedEl = document.getElementById('connectedBankMaskedAcc');
      const badgeEl = document.getElementById('connectedBankStatusBadge');
      const lastSyncEl = document.getElementById('connectedBankLastSync');
      const txnCountEl = document.getElementById('connectedBankTxnCount');

      if (this.connectedBankAccounts.length > 0) {
        const primaryAcc = this.connectedBankAccounts[0];
        if (strip) strip.style.display = 'flex';
        if (bankNameEl) bankNameEl.textContent = primaryAcc.bank_name;
        if (maskedEl) maskedEl.textContent = primaryAcc.account_number_masked;
        if (badgeEl) {
          const isDemo = primaryAcc.provider === 'mock' || primaryAcc.provider === 'MockAA';
          const status = (primaryAcc.status || 'ACTIVE').toUpperCase();
          badgeEl.textContent = isDemo ? 'DEMO DATA' : (status === 'ACTIVE' ? 'LIVE AA' : status);
          badgeEl.className = 'aa-tag-pill';
          if (status === 'ACTIVE') badgeEl.classList.add('status-active');
          else if (status === 'PENDING') badgeEl.classList.add('status-pending');
          else if (status === 'REVOKED' || status === 'EXPIRED' || status === 'FAILED') badgeEl.classList.add('status-' + status.toLowerCase());
        }
        if (lastSyncEl) {
          const syncTime = primaryAcc.last_synced_at ? new Date(primaryAcc.last_synced_at).toLocaleTimeString() : 'Never';
          lastSyncEl.textContent = `Last Synced: ${syncTime}`;
        }
        if (txnCountEl) {
          txnCountEl.textContent = `${primaryAcc.transaction_count || 0} Transactions (${primaryAcc.upi_count || 0} UPI)`;
        }

        // Update consent status text
        const consentStatusEl = document.getElementById('connectedBankConsentStatus');
        if (consentStatusEl) {
          const status = (primaryAcc.status || 'ACTIVE').toUpperCase();
          if (status === 'ACTIVE') {
            consentStatusEl.textContent = 'Active (RBI AA)';
            consentStatusEl.className = 'consent-status-text active';
          } else if (status === 'REVOKED') {
            consentStatusEl.textContent = 'Revoked';
            consentStatusEl.className = 'consent-status-text expired';
          } else if (status === 'EXPIRED') {
            consentStatusEl.textContent = 'Expired — Reconnect Required';
            consentStatusEl.className = 'consent-status-text expired';
          } else {
            consentStatusEl.textContent = status;
            consentStatusEl.className = 'consent-status-text';
          }
        }

        // If authenticated and banks exist, ensure workspace is shown
        if (this.isAuthenticated) {
          this.isProviderConnected = true;
          const setupStage = document.getElementById('unconnectedSetupStage');
          if (setupStage) setupStage.style.display = 'none';
          const dataStage = document.getElementById('connectedDataStage');
          if (dataStage) dataStage.style.display = 'block';
          const src = document.getElementById('activeSourceLabel');
          if (src) src.textContent = `${primaryAcc.bank_name} (AA Connected)`;
        }
      } else {
        if (strip) strip.style.display = 'none';
      }
    } catch (err) {
      console.error('loadBankAccounts error', err);
    }
  }

  async loadUpiAnalytics() {
    try {
      const response = await fetch('/api/analytics/upi');
      const res = await response.json();
      if (!res.success) return;

      const data = res.data;
      this.upiAnalytics = data;

      const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const totalSpendEl = document.getElementById('upiTotalSpendVal');
      if (totalSpendEl) totalSpendEl.textContent = fmt(data.totalSpend);

      const paymentCountEl = document.getElementById('upiPaymentCountVal');
      if (paymentCountEl) paymentCountEl.textContent = `${data.paymentCount} outgoing payments`;

      const totalInflowEl = document.getElementById('upiTotalInflowVal');
      if (totalInflowEl) totalInflowEl.textContent = fmt(data.totalReceived);

      const receiptCountEl = document.getElementById('upiReceiptCountVal');
      if (receiptCountEl) receiptCountEl.textContent = `${data.receiptCount} incoming receipts`;

      const avgPaymentEl = document.getElementById('upiAveragePaymentVal');
      if (avgPaymentEl) avgPaymentEl.textContent = fmt(data.averagePayment);

      const netFlowEl = document.getElementById('upiNetFlowVal');
      if (netFlowEl) {
        const sign = data.netFlow >= 0 ? '+' : '';
        netFlowEl.textContent = `Net: ${sign}₹${fmt(data.netFlow)}`;
      }

      const highestPaymentEl = document.getElementById('upiHighestPaymentVal');
      if (highestPaymentEl) highestPaymentEl.textContent = fmt(data.highestPayment?.amount || 0);

      const highestMerchantEl = document.getElementById('upiHighestMerchantVal');
      if (highestMerchantEl) highestMerchantEl.textContent = `To: ${data.highestPayment?.merchant || 'None'}`;

      // Render Top Merchants List (escapeHtml: merchant names derive from bank narrations)
      const merchantListEl = document.getElementById('upiMerchantList');
      if (merchantListEl) {
        if (!data.topMerchants || data.topMerchants.length === 0) {
          merchantListEl.innerHTML = '<div class="upi-empty-state">No UPI payments detected in current statement.</div>';
        } else {
          merchantListEl.innerHTML = data.topMerchants.map(m => `
            <div class="upi-merchant-row">
              <div class="merchant-info">
                <span class="merchant-name">${this.escapeHtml(m.name)}</span>
                <span class="merchant-count">(${m.count} payments)</span>
              </div>
              <span class="merchant-amount text-crimson">-₹${fmt(m.totalAmount)}</span>
            </div>
          `).join('');
        }
      }

      // Render Top Categories List
      const categoryListEl = document.getElementById('upiCategoryList');
      if (categoryListEl) {
        if (!data.topCategories || data.topCategories.length === 0) {
          categoryListEl.innerHTML = '<div class="upi-empty-state">No categorized UPI records available.</div>';
        } else {
          categoryListEl.innerHTML = data.topCategories.map(c => `
            <div class="upi-category-row">
              <div class="category-info">
                <span class="category-name">${this.escapeHtml(c.category)}</span>
                <span class="category-count">(${c.count} txns)</span>
              </div>
              <span class="category-amount">₹${fmt(c.totalAmount)}</span>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.error('loadUpiAnalytics error', err);
    }
  }

  showToast(msg) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if (toast && toastMsg) {
      toastMsg.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3200);
    }
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.hisabApp = new HisabApp();
});
