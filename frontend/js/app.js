/**
 * Hisab Main Application Controller
 * Handles 3D Resadex centerpiece, hamburger drawer, modals,
 * and voice assistant interactions.
 */

class HisabApp {
  constructor() {
    this.threeScene = null;
    this.isAuthenticated = false;
    this.merchantProfile = null;
    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupModals();
    this.setupHeroActions();
    this.setupThreeDResadexCenterpiece();
    this.setupVoiceAssistant();
    this.setupPolicies();

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
        this.showToast('This version has no paid Hisab subscription checkout. Linked providers may have their own fees.');
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
  // 2. Modals Management
  // =========================================================================
  setupModals() {
    // Escape key closes all open modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
        const drawer = document.getElementById('navDrawer');
        if (drawer && drawer.classList.contains('open')) {
          const drawerClose = document.getElementById('drawerCloseBtn');
          if (drawerClose) drawerClose.click();
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

    // Login Form Submission
    window.handleLoginSubmit = async () => {
      const identifier = document.getElementById('loginIdentifier')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;
      const captchaBox = document.getElementById('loginCaptchaBox');

      if (!identifier || !password) {
        this.showToast('Please enter your mobile/email and password');
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
        this.showToast(data.message || `Welcome back, ${merchant.shopName}!`);
        setTimeout(() => {
          window.location.href = '/app';
        }, 500);
      } catch (err) {
        console.error('login error', err);
        this.showToast('Unable to reach the Hisab server. Please try again.');
      }
    };

    // Register Step 1 Submission
    window.handleRegisterStep1Submit = async () => {
      const fullName = document.getElementById('regFullName')?.value.trim();
      const shopName = document.getElementById('regShopName')?.value.trim();
      const phone = document.getElementById('regPhone')?.value.trim();
      const email = document.getElementById('regEmail')?.value.trim();
      const password = document.getElementById('regPassword')?.value;
      const confirmPassword = document.getElementById('regConfirmPassword')?.value;
      const captchaBox = document.getElementById('regCaptchaBox');

      if (!fullName || !shopName || !phone || !password || !confirmPassword) {
        this.showToast('Please fill all required store details');
        return;
      }

      if (password !== confirmPassword) {
        this.showToast('Passwords do not match! Please check both blanks.');
        document.getElementById('regConfirmPassword')?.focus();
        return;
      }

      if (password.length < 6) {
        this.showToast('Password must be at least 6 characters long');
        return;
      }



      if (!document.getElementById('regPrivacyConsent')?.checked || !document.getElementById('regAdultConsent')?.checked) { this.showToast('Read the policies and confirm your account consent and age.'); return; }
      await window.handleCreateAccount();
    };

    window.handleCreateAccount = async () => {
      const shopName = document.getElementById('regShopName')?.value.trim() || 'My Kirana Store';
      const fullName = document.getElementById('regFullName')?.value.trim() || 'Store Owner';
      const phone = document.getElementById('regPhone')?.value.trim() || '';
      const email = document.getElementById('regEmail')?.value.trim() || '';
      const password = document.getElementById('regPassword')?.value;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shopName, fullName, phone, email, password, privacyConsent: document.getElementById("regPrivacyConsent")?.checked === true, adultConfirmation: document.getElementById("regAdultConsent")?.checked === true })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          this.showToast(data.error?.message || 'Registration failed. Please check your details.');
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
        this.showToast(data.message || `Store "${shopName}" is now active.`);
        setTimeout(() => {
          window.location.href = '/app';
        }, 500);
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
        if (this.isAuthenticated && this.merchantProfile) {
          window.location.href = '/app';
          return;
        }
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
        this.showToast('This version has no paid Hisab subscription checkout. Linked providers may have their own fees.');
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

    // 3. Inner Indian Rupee Symbol (₹) Custom Minted Mesh
    const canvasTexture = document.createElement('canvas');
    canvasTexture.width = 512;
    canvasTexture.height = 512;
    const ctx = canvasTexture.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);

    ctx.font = 'bold 310px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Subtle minted relief highlight for 3D depth
    ctx.fillStyle = 'rgba(255, 238, 190, 0.45)';
    ctx.fillText('₹', 256, 268);

    // Deep embossed coin engraving tone (rich burnished bronze/dark gold)
    ctx.fillStyle = '#2c1806';
    ctx.fillText('₹', 256, 260);

    const rupeeTexture = new THREE.CanvasTexture(canvasTexture);
    rupeeTexture.needsUpdate = true;
    const symbolGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const symbolMat = new THREE.MeshStandardMaterial({
      map: rupeeTexture,
      transparent: true,
      roughness: 0.35,
      metalness: 0.7,
      depthWrite: false
    });
    const symbolFront = new THREE.Mesh(symbolGeo, symbolMat);
    symbolFront.position.z = 0.114;
    group.add(symbolFront);

    const symbolBack = new THREE.Mesh(symbolGeo, symbolMat);
    symbolBack.position.z = -0.114;
    symbolBack.rotation.y = Math.PI;
    group.add(symbolBack);

    // Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.2);
    scene.add(ambientLight);

    const warmLight = new THREE.PointLight(0xD8A353, 3.5, 50);
    warmLight.position.set(4, 5, 6);
    scene.add(warmLight);

    const coolRimLight = new THREE.PointLight(0x4ade80, 1.5, 30);
    coolRimLight.position.set(-5, -4, -4);
    scene.add(coolRimLight);

    // Interactive mouse tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      targetX = (x / rect.width) * 1.2;
      targetY = (y / rect.height) * 1.2;
    });

    // Touch support for mobile
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        targetX = ((touch.clientX - (rect.left + rect.width / 2)) / rect.width) * 1.2;
        targetY = ((touch.clientY - (rect.top + rect.height / 2)) / rect.height) * 1.2;
      }
    }, { passive: true });

    // Animation Loop
    let clock = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      clock += 0.016;

      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      group.rotation.y += 0.008 + (mouseX * 0.02);
      group.rotation.x = Math.sin(clock * 0.8) * 0.15 + (mouseY * 0.2);
      group.position.y = Math.sin(clock * 1.5) * 0.12;

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
  // 7. Merchant Authentication State
  // =========================================================================
  authenticateUser(merchant, persist = true) {
    this.isAuthenticated = true;
    this.merchantProfile = merchant;

    if (persist) {
      try {
        sessionStorage.setItem('hisab_session', JSON.stringify(this.merchantProfile));
      } catch (e) {
        console.warn('sessionStorage write error', e);
      }
    }

    // Update Header Status & Brand Pill
    const brandBadge = document.getElementById('brandAuthBadge');
    if (brandBadge) {
      brandBadge.textContent = 'OPEN HISAB APP →';
      brandBadge.style.opacity = '1';
      brandBadge.style.cursor = 'pointer';
      brandBadge.style.borderColor = '#137333';
      brandBadge.style.color = '#137333';
      brandBadge.onclick = () => { window.location.href = '/app'; };
    }

    const headerStatusText = document.getElementById('headerStatusText');
    const headerStatusSubtext = document.getElementById('headerStatusSubtext');
    if (headerStatusText) headerStatusText.textContent = merchant.shopName || 'Store Account Active';
    if (headerStatusSubtext) headerStatusSubtext.textContent = 'Voice entry available';
  }

  logoutUser() {
    this.isAuthenticated = false;
    this.merchantProfile = null;
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    try {
      sessionStorage.removeItem('hisab_session');
    } catch (e) {
      console.warn('sessionStorage remove error', e);
    }

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
    if (headerStatusText) headerStatusText.textContent = 'Voice entry available';
    if (headerStatusSubtext) headerStatusSubtext.textContent = 'Indian Rupee (₹)';

    this.closeAllModals();
    this.showToast('Signed out successfully.');
  }

  showToast(msg) {
    window.hisabSiteFeatures?.formFeedback(msg);
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
