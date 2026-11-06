/**
 * Hisab Multilingual Voice & AI Data Analyst Engine
 * Integrates Web Speech API (STT), Web SpeechSynthesis API (TTS),
 * local Ollama backend via /api/ai/chat, multi-turn session memory,
 * dynamic audio waveform visualizer, and dual inline/modal UI synchronization.
 */

class HisabVoiceAssistant {
  constructor() {
    this.isListening = false;
    this.isSpeaking = false;
    this.isProcessing = false;
    this.recognition = null;
    this.currentLanguage = 'auto'; // 'auto', 'te-IN', 'hi-IN', 'en-IN'
    this.sessionId = this.getOrCreateSessionId();
    this.lastAnswer = '';
    this.lastTtsLang = 'en-IN';
    
    // Waveform canvas
    this.canvas = document.getElementById('waveformCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.wavePhase = 0;
    this.animFrameId = null;

    // Speech synthesis voices
    this.availableVoices = [];
    this.initVoices();

    this.initSpeechRecognition();
    this.initCanvas();
    this.bindEvents();
    this.checkHealth();
  }

  getOrCreateSessionId() {
    let sid = sessionStorage.getItem('hisab_ai_session_id');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      sessionStorage.setItem('hisab_ai_session_id', sid);
    }
    return sid;
  }

  initVoices() {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        this.availableVoices = window.speechSynthesis.getVoices();
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  getBestVoice(langCode) {
    if (!this.availableVoices || this.availableVoices.length === 0) {
      this.initVoices();
    }
    const target = (langCode || 'en-IN').toLowerCase();
    const prefix = target.split('-')[0];

    // 1. Exact match (e.g. te-IN, hi-IN, en-IN)
    let match = this.availableVoices.find(v => v.lang.toLowerCase() === target);
    if (match) return match;

    // 2. Exact prefix match (e.g. te, hi, en)
    match = this.availableVoices.find(v => v.lang.toLowerCase().startsWith(prefix));
    if (match) return match;

    // 3. Indian English fallback
    match = this.availableVoices.find(v => v.lang.toLowerCase().includes('in'));
    if (match) return match;

    // 4. Default system voice
    return this.availableVoices[0] || null;
  }

  initCanvas() {
    if (!this.canvas || !this.ctx) return;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.drawWaveform();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width = rect.width * (window.devicePixelRatio || 1);
      this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    }
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.updateRecognitionLanguage();

      this.recognition.onstart = () => {
        this.setState('listening');
        this.updateTranscript("Listening... speak your question");
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const activeText = finalTranscript || interimTranscript;
        if (activeText) {
          this.updateTranscript(`"${activeText}"`);
        }

        if (finalTranscript) {
          this.stopListening();
          this.handleQuery(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('[Speech Recognition Status]', event.error);
        if (event.error !== 'no-speech') {
          this.setState('error');
          this.updateTranscript(`Mic note: ${event.error}. You can also type below!`);
          setTimeout(() => this.setState('idle'), 3000);
        } else {
          this.setState('idle');
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          this.setState('idle');
        }
      };
    }
  }

  updateRecognitionLanguage() {
    if (!this.recognition) return;
    if (this.currentLanguage === 'te-IN') {
      this.recognition.lang = 'te-IN';
    } else if (this.currentLanguage === 'hi-IN') {
      this.recognition.lang = 'hi-IN';
    } else {
      // Default to Indian English for auto/mixed
      this.recognition.lang = 'en-IN';
    }
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    this.updateRecognitionLanguage();

    // Sync inline chips
    document.querySelectorAll('#inlineAiLangSelector .ai-lang-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Sync modal buttons
    document.querySelectorAll('#modalLangPills .modal-lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Sync active label
    const label = lang === 'te-IN' ? 'తెలుగు (Telugu)' : (lang === 'hi-IN' ? 'हिंदी (Hindi)' : (lang === 'en-IN' ? 'English' : 'Auto Detect (TE/HI/EN)'));
    const tag = document.getElementById('aiActiveLangTag');
    if (tag) tag.textContent = label;
  }

  bindEvents() {
    // 1. Inline Mic Button
    const inlineMic = document.getElementById('btnInlineAiMic');
    if (inlineMic) {
      inlineMic.addEventListener('click', () => this.toggleListening('inline'));
    }

    // 2. Modal Mic Button
    const modalMic = document.getElementById('micToggleBtn');
    if (modalMic) {
      modalMic.addEventListener('click', () => this.toggleListening('modal'));
    }

    // 3. Inline Query Send
    const inlineSend = document.getElementById('btnInlineAiSend');
    const inlineInput = document.getElementById('inlineAiQueryInput');
    if (inlineSend && inlineInput) {
      const doSend = () => {
        const val = inlineInput.value.trim();
        if (val) {
          inlineInput.value = '';
          this.handleQuery(val);
        }
      };
      inlineSend.addEventListener('click', doSend);
      inlineInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSend();
      });
    }

    // 4. Modal Query Send
    const modalSend = document.getElementById('btnModalAiSend');
    const modalInput = document.getElementById('modalAiTextInput');
    if (modalSend && modalInput) {
      const doModalSend = () => {
        const val = modalInput.value.trim();
        if (val) {
          modalInput.value = '';
          this.handleQuery(val);
        }
      };
      modalSend.addEventListener('click', doModalSend);
      modalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doModalSend();
      });
    }

    // 5. Language selector chips
    document.querySelectorAll('#inlineAiLangSelector .ai-lang-chip, #modalLangPills .modal-lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setLanguage(btn.dataset.lang);
      });
    });

    // 6. Prompt suggestion chips
    document.querySelectorAll('#inlineAiPromptSuggestions .ai-prompt-chip, #modalPromptChips .modal-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.query;
        if (q) this.handleQuery(q);
      });
    });

    // 7. TTS Read Aloud buttons
    const inlineTts = document.getElementById('btnInlineAiSpeak');
    if (inlineTts) {
      inlineTts.addEventListener('click', () => this.toggleTTS(this.lastAnswer, this.lastTtsLang));
    }
    const modalTts = document.getElementById('btnModalTtsPlay');
    if (modalTts) {
      modalTts.addEventListener('click', () => this.toggleTTS(this.lastAnswer, this.lastTtsLang));
    }

    // 8. Clear response buttons
    const inlineClear = document.getElementById('btnInlineAiClear');
    if (inlineClear) {
      inlineClear.addEventListener('click', () => {
        const card = document.getElementById('inlineAiResponseCard');
        if (card) card.style.display = 'none';
        this.stopSpeaking();
      });
    }

    // 9. Voice Modal Close Button
    const voiceClose = document.getElementById('voiceModalCloseBtn');
    if (voiceClose) {
      voiceClose.addEventListener('click', () => {
        this.stopListening();
        this.stopSpeaking();
      });
    }
  }

  async checkHealth() {
    try {
      const res = await fetch('/api/ai/health');
      if (res.ok) {
        const json = await res.json();
        const pill = document.getElementById('aiEngineStatusPill');
        const modalPill = document.getElementById('modalAiEnginePill');
        if (json.data && json.data.ollama) {
          const modelName = json.data.model || 'qwen2.5';
          if (pill) pill.textContent = `${json.data?.provider === 'groq' ? 'Groq' : 'AI'}: ${modelName}`;
          if (modalPill) modalPill.textContent = `${json.data?.provider === 'groq' ? 'Groq' : 'AI'}: ${modelName}`;
        } else {
          if (pill) pill.textContent = 'Engine: Local Fast SQL';
          if (modalPill) modalPill.textContent = 'Ledger engine';
        }
      }
    } catch (e) {
      // Background check error ignored
    }
  }

  toggleListening(context = 'inline') {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening(context);
    }
  }

  async startListening(context = 'inline') {
    if (!await window.hisabPrivacy.requirePermission('voice')) return;
    this.stopSpeaking();

    if (this.recognition) {
      try {
        this.recognition.start();
        return;
      } catch (err) {
        console.warn('[Speech Recognition Start Error]', err);
      }
    }

    // Fallback if browser SpeechRecognition is disabled or blocked
    this.runSpeechFallback(context);
  }

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    this.setState('idle');
  }

  runSimulationMode(sampleText = null) {
    this.stopSpeaking();
    this.setState('listening');
    const fallbackSamples = [
      "Telangana lo ee month total sales entha?",
      "Which customer paid the most last month?",
      "Hyderabad lo enni customers unnaru?",
      "Pichhle mahine ka total sales kitna tha?",
      "Repeated customers kaun kaun hain?",
      "Show UPI transactions breakdown"
    ];
    const phrase = sampleText || fallbackSamples[Math.floor(Math.random() * fallbackSamples.length)];
    let charIdx = 0;
    this.updateTranscript('"Listening..."');
    const interval = setInterval(() => {
      charIdx++;
      this.updateTranscript(`"${phrase.slice(0, charIdx)}"`);
      if (charIdx >= phrase.length) {
        clearInterval(interval);
        setTimeout(() => {
          this.setState('idle');
          this.handleQuery(phrase);
        }, 400);
      }
    }, 35);
  }

  runSpeechFallback(context) {
    this.runSimulationMode();
  }

  setState(state) {
    // state: 'idle' | 'listening' | 'processing' | 'speaking' | 'error'
    this.isListening = (state === 'listening');
    this.isProcessing = (state === 'processing');
    this.isSpeaking = (state === 'speaking');

    // UI Updates: Mic Buttons
    const inlineMic = document.getElementById('btnInlineAiMic');
    const modalMic = document.getElementById('micToggleBtn');
    const inlineBox = document.getElementById('inlineAiInputBox');
    const avatarPulse = document.getElementById('inlineAiAvatarPulse');
    const voicePulse = document.getElementById('voicePulseIndicator');
    const modalStatus = document.getElementById('voiceModalStatus');
    const inlineOrb = document.getElementById('inlineAiStatusOrb');
    const modalOrb = document.getElementById('modalAiStatusOrb');

    [inlineMic, modalMic, inlineBox, avatarPulse].forEach(el => {
      if (!el) return;
      el.classList.remove('listening', 'processing', 'speaking', 'error');
      if (state !== 'idle') el.classList.add(state);
    });

    const statusMap = {
      idle: 'Voice Assistant Ready',
      listening: 'Listening to speech...',
      processing: 'Analyzing financial data...',
      speaking: 'Speaking answer...',
      error: 'Error encountered'
    };

    if (modalStatus) modalStatus.textContent = statusMap[state] || 'Ready';
    if (voicePulse) {
      voicePulse.classList.toggle('listening', state === 'listening');
    }

    const orbClass = state === 'processing' ? 'processing' : (state === 'error' ? 'error' : '');
    [inlineOrb, modalOrb].forEach(orb => {
      if (!orb) return;
      orb.className = 'ai-status-orb ' + orbClass;
    });

    const micLbl = document.getElementById('inlineMicLiveLabel');
    if (micLbl) {
      micLbl.textContent = state === 'listening' ? 'Stop' : (state === 'processing' ? 'Thinking' : 'Speak');
    }
  }

  updateTranscript(text) {
    const transcriptEl = document.getElementById('speechTranscript');
    if (transcriptEl) transcriptEl.textContent = text;
  }

  /**
   * Dispatches Query to /api/ai/chat and updates both Inline and Modal views
   */
  async handleQuery(queryText) {
    if (!await window.hisabPrivacy.requirePermission('ai')) return;
    if (!queryText || !queryText.trim()) return;
    const cleanQuery = queryText.trim();

    this.setState('processing');
    this.updateTranscript(`"${cleanQuery}"`);

    // Show response cards in processing state
    this.renderProcessingState(cleanQuery);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: cleanQuery,
          sessionId: this.sessionId,
          requestId: crypto.randomUUID(),
          languageHint: this.currentLanguage !== 'auto' ? this.currentLanguage : null
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to analyze query.');
      }

      this.lastAnswer = data.answer;
      this.lastTtsLang = data.ttsLang || 'en-IN';

      this.renderAnswer(cleanQuery, data);
      this.setState('idle');

      // Auto-read response aloud if query originated via voice
      if (this.isListening || document.getElementById('voiceModalBackdrop')?.classList.contains('active')) {
        this.speakText(data.answer, data.ttsLang);
      }
    } catch (err) {
      console.error('[AI Query Error]', err);
      this.setState('error');
      this.renderError(cleanQuery, err.message);
    }
  }

  renderProcessingState(query) {
    // 1. Inline Card
    const inlineCard = document.getElementById('inlineAiResponseCard');
    if (inlineCard) {
      inlineCard.style.display = 'block';
      const echo = document.getElementById('inlineAiUserQueryEcho');
      const text = document.getElementById('inlineAiAnswerText');
      const pills = document.getElementById('inlineAiDataPillsRow');
      const chartBox = document.getElementById('inlineAiChartContainer');
      const langBadge = document.getElementById('inlineAiResponseLangBadge');

      if (echo) echo.textContent = `Q: "${query}"`;
      if (text) text.innerHTML = `<em>Analyzing your transactions, please hold...</em>`;
      if (pills) pills.innerHTML = '';
      if (chartBox) chartBox.style.display = 'none';
      if (langBadge) langBadge.textContent = 'Analyzing';
    }

    // 2. Modal Card
    const modalCard = document.getElementById('modalAiAnswerCard');
    if (modalCard) {
      modalCard.style.display = 'block';
      const echo = document.getElementById('modalAiEcho');
      const text = document.getElementById('modalAiText');
      const pills = document.getElementById('modalAiPills');
      const chartBox = document.getElementById('modalAiChartBox');

      if (echo) echo.textContent = `Q: "${query}"`;
      if (text) text.innerHTML = `<em>Querying hisab database...</em>`;
      if (pills) pills.innerHTML = '';
      if (chartBox) chartBox.style.display = 'none';
    }
  }

  renderAnswer(query, res) {
    const formattedHtml = this.formatMarkdown(res.answer);
    const langLabel = res.language ? res.language.toUpperCase() : 'ANSWER';

    // 1. Update Inline Card
    const inlineCard = document.getElementById('inlineAiResponseCard');
    if (inlineCard) {
      inlineCard.style.display = 'block';
      const echo = document.getElementById('inlineAiUserQueryEcho');
      const text = document.getElementById('inlineAiAnswerText');
      const pills = document.getElementById('inlineAiDataPillsRow');
      const langBadge = document.getElementById('inlineAiResponseLangBadge');

      if (echo) echo.textContent = `Q: "${query}"`;
      if (text) text.innerHTML = formattedHtml;
      if (langBadge) langBadge.textContent = langLabel;
      if (pills) this.renderPills(pills, res.data);

      if (res.chart) {
        this.renderChart('inlineAiChartCanvas', 'inlineAiChartContainer', res.chart);
      }
    }

    // 2. Update Modal Card
    const modalCard = document.getElementById('modalAiAnswerCard');
    if (modalCard) {
      modalCard.style.display = 'block';
      const echo = document.getElementById('modalAiEcho');
      const text = document.getElementById('modalAiText');
      const pills = document.getElementById('modalAiPills');
      const langBadge = document.getElementById('modalAiResponseLang');

      if (echo) echo.textContent = `Q: "${query}"`;
      if (text) text.innerHTML = formattedHtml;
      if (langBadge) langBadge.textContent = langLabel;
      if (pills) this.renderPills(pills, res.data);

      if (res.chart) {
        this.renderChart('modalAiChartCanvas', 'modalAiChartBox', res.chart);
      }
    }
  }

  renderError(query, errMsg) {
    const errorHtml = `<span style="color: #DC2626;">⚠️ <strong>Could not complete query:</strong> ${errMsg}</span>`;
    
    const inlineText = document.getElementById('inlineAiAnswerText');
    if (inlineText) inlineText.innerHTML = errorHtml;

    const modalText = document.getElementById('modalAiText');
    if (modalText) modalText.innerHTML = errorHtml;
  }

  formatMarkdown(text) {
    if (!text) return '';
    // Format bold **text**
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Format newlines
    html = html.replace(/\n\n/g, '<br/><br/>');
    html = html.replace(/\n/g, '<br/>');
    return html;
  }

  renderPills(container, data) {
    container.innerHTML = '';
    if (!data || typeof data !== 'object') return;

    // Extract notable metric cards
    const items = [];

    if (data.total_sales !== undefined) {
      items.push({ label: 'Total Sales', val: `₹${Number(data.total_sales).toLocaleString('en-IN')}`, cls: 'inflow' });
    }
    if (data.total_expenses !== undefined) {
      items.push({ label: 'Total Expenses', val: `₹${Number(data.total_expenses).toLocaleString('en-IN')}`, cls: 'outflow' });
    }
    if (data.net_cashflow !== undefined) {
      items.push({ label: 'Net Cash Flow', val: `₹${Number(data.net_cashflow).toLocaleString('en-IN')}`, cls: data.net_cashflow >= 0 ? 'inflow' : 'outflow' });
    }
    if (data.customer_count !== undefined) {
      items.push({ label: 'Total Customers', val: data.customer_count, cls: '' });
    }
    if (data.location) {
      items.push({ label: 'Location', val: data.location, cls: '' });
    }
    if (data.top_customer) {
      items.push({ label: 'Top Customer', val: data.top_customer.customer_name, cls: '' });
      items.push({ label: 'Top Spender Total', val: `₹${Number(data.top_customer.total_paid).toLocaleString('en-IN')}`, cls: 'inflow' });
    }
    if (data.repeated_customer_count !== undefined) {
      items.push({ label: 'Repeat Customers', val: data.repeated_customer_count, cls: '' });
    }
    if (data.upi_share_pct !== undefined) {
      items.push({ label: 'UPI Share', val: `${data.upi_share_pct}%`, cls: '' });
    }

    items.forEach(item => {
      const pill = document.createElement('div');
      pill.className = 'ai-metric-pill';
      pill.innerHTML = `
        <span class="metric-lbl">${item.label}</span>
        <span class="metric-val ${item.cls}">${item.val}</span>
      `;
      container.appendChild(pill);
    });
  }

  renderChart(canvasId, containerId, chartData) {
    const container = document.getElementById(containerId);
    const canvas = document.getElementById(canvasId);
    if (!container || !canvas) return;

    container.style.display = 'block';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const labels = chartData.labels || [];
    const values = chartData.data || [];
    if (labels.length === 0 || values.length === 0) return;

    const maxVal = Math.max(...values, 100);
    const padding = 35;
    const barWidth = Math.min(45, (width - padding * 2) / (labels.length * 1.5));
    const gap = (width - padding * 2 - (barWidth * labels.length)) / Math.max(labels.length - 1, 1);

    // Draw baseline
    ctx.beginPath();
    ctx.strokeStyle = '#E2D9C8';
    ctx.lineWidth = 1;
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw Bars
    labels.forEach((lbl, idx) => {
      const val = values[idx] || 0;
      const barHeight = ((height - padding * 2) * (val / maxVal));
      const x = padding + idx * (barWidth + gap);
      const y = height - padding - barHeight;

      // Bar fill
      ctx.fillStyle = idx === 0 ? '#BA3826' : '#D97706';
      ctx.fillRect(x, y, barWidth, barHeight);

      // Value label on top
      ctx.fillStyle = '#2A2421';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const formattedVal = val >= 1000 ? `₹${(val/1000).toFixed(1)}k` : `₹${val}`;
      ctx.fillText(formattedVal, x + barWidth / 2, y - 5);

      // Category label below
      ctx.fillStyle = '#6B5E55';
      ctx.font = '10px sans-serif';
      const shortLbl = lbl.length > 10 ? lbl.slice(0, 9) + '..' : lbl;
      ctx.fillText(shortLbl, x + barWidth / 2, height - padding + 15);
    });
  }

  /**
   * Text-To-Speech (TTS) Implementation
   */
  toggleTTS(text, lang) {
    if (this.isSpeaking) {
      this.stopSpeaking();
    } else {
      this.speakText(text, lang);
    }
  }

  speakText(text, langCode = 'en-IN') {
    if (!('speechSynthesis' in window)) return;
    if (!text) return;

    this.stopSpeaking();

    // Strip markdown tags and quotes for smooth speech
    const cleanSpeech = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/₹/g, 'rupees ')
      .replace(/[#*_`]/g, '')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = langCode || 'en-IN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voice = this.getBestVoice(langCode);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      this.setState('speaking');
      this.setTtsButtonsActive(true);
    };

    utterance.onend = () => {
      this.setState('idle');
      this.setTtsButtonsActive(false);
    };

    utterance.onerror = (e) => {
      console.warn('[TTS Error]', e);
      this.setState('idle');
      this.setTtsButtonsActive(false);
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.setState('idle');
    this.setTtsButtonsActive(false);
  }

  setTtsButtonsActive(active) {
    const inlineBtn = document.getElementById('btnInlineAiSpeak');
    const modalBtn = document.getElementById('btnModalTtsPlay');
    const inlineLbl = document.getElementById('inlineAiSpeakLabel');
    const modalLbl = document.getElementById('modalTtsPlayLabel');

    [inlineBtn, modalBtn].forEach(b => {
      if (b) b.classList.toggle('playing', active);
    });

    if (inlineLbl) inlineLbl.textContent = active ? 'Stop' : 'Read Aloud';
    if (modalLbl) modalLbl.textContent = active ? 'Stop' : 'Speak';
  }

  /**
   * Waveform Drawing Animation Loop
   */
  drawWaveform() {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2;

    this.ctx.clearRect(0, 0, width, height);

    // Dynamic amplitude based on current state
    let baseAmp = height * 0.06;
    let speed = 0.02;

    if (this.isListening) {
      baseAmp = height * 0.28;
      speed = 0.09;
    } else if (this.isSpeaking) {
      baseAmp = height * 0.22;
      speed = 0.07;
    } else if (this.isProcessing) {
      baseAmp = height * 0.14;
      speed = 0.05;
    }

    this.wavePhase += speed;

    // Centerline reference
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#E5DFD3';
    this.ctx.lineWidth = 1;
    this.ctx.moveTo(0, centerY);
    this.ctx.lineTo(width, centerY);
    this.ctx.stroke();

    // Primary wave
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.isListening ? '#BA3826' : (this.isSpeaking ? '#059669' : '#8A5E28');
    this.ctx.lineWidth = (this.isListening || this.isSpeaking) ? 2.5 : 1.5;

    for (let x = 0; x < width; x += 2) {
      const norm = x / width;
      const envelope = Math.sin(norm * Math.PI);
      const y = centerY + Math.sin(norm * 14 + this.wavePhase) *
                          Math.cos(norm * 7 - this.wavePhase * 0.5) *
                          baseAmp * envelope;
      if (x === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();

    // Harmonic wave
    if (this.isListening || this.isSpeaking) {
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.isListening ? 'rgba(186, 56, 38, 0.4)' : 'rgba(5, 150, 105, 0.4)';
      this.ctx.lineWidth = 1.5;

      for (let x = 0; x < width; x += 2) {
        const norm = x / width;
        const envelope = Math.sin(norm * Math.PI);
        const y = centerY + Math.sin(norm * 22 - this.wavePhase * 1.2) *
                            (baseAmp * 0.6) * envelope;
        if (x === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.stroke();
    }

    this.animFrameId = requestAnimationFrame(() => this.drawWaveform());
  }
}

window.HisabVoiceAssistant = HisabVoiceAssistant;
