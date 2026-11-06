/**
 * Hisab Voice Assistant Orchestration Service
 * Integrates Speech-to-Text, Language Detection, AI Data Query Execution,
 * and Text-to-Speech audio response synthesis.
 */

const MockVoiceProvider = require('../providers/voice/MockVoiceProvider.js');
const CloudVoiceProvider = require('../providers/voice/CloudVoiceProvider.js');

class VoiceService {
  constructor(config = {}) {
    const providerName = (config.provider || process.env.VOICE_PROVIDER || 'mock').toLowerCase();

    if (providerName === 'cloud') {
      this.provider = new CloudVoiceProvider(config);
    } else {
      this.provider = new MockVoiceProvider(config);
    }

    this.providerName = this.provider.name;
  }

  isMockMode() {
    return this.provider.isMockMode();
  }

  async transcribe(audioData, options = {}) {
    return this.provider.transcribe(audioData, options);
  }

  async speak(text, options = {}) {
    return this.provider.synthesize(text, options);
  }

  /**
   * End-to-end voice query pipeline:
   * Audio/Query -> Transcription -> Language Detection -> AI Financial Tools -> Answer -> TTS Audio Synthesis
   */
  async processVoiceQuery(db, aiService, userId, { audioData, query, languageHint, sessionId, requestId }) {
    let resolvedQuery = (query || '').trim();
    let detectedLanguage = languageHint || null;

    // 1. Transcribe if audio is present
    if (audioData && !resolvedQuery) {
      const transcription = await this.provider.transcribe(audioData, { languageHint });
      resolvedQuery = transcription.transcript;
      detectedLanguage = transcription.language;
    }

    if (!resolvedQuery) {
      throw new Error('No voice query or audio input received');
    }

    // 2. Query AI Agent (strictly scoped to this user)
    const aiResult = await aiService.processQuery(resolvedQuery, {
      sessionId: sessionId || `voice-${userId || 'demo'}`,
      languageHint: detectedLanguage,
      userId, requestId
    });

    // 3. Synthesize audio response for the answer
    const ttsLang = aiResult.ttsLang || detectedLanguage || 'en-IN';
    let audioPayload = null;
    try {
      audioPayload = await this.provider.synthesize(aiResult.answer, { language: ttsLang });
    } catch (e) {
      console.warn('[Voice Service] Audio synthesis error:', e.message);
    }

    return {
      success: true,
      transcript: resolvedQuery,
      answer: aiResult.answer,
      language: aiResult.language,
      ttsLang,
      data: aiResult.data,
      chart: aiResult.chart || null,
      audio: audioPayload ? {
        mimeType: audioPayload.mimeType,
        dataUrl: audioPayload.dataUrl,
        audioBase64: audioPayload.audioBase64
      } : null,
      actionApplied: aiResult.actionApplied || false,
      source: aiResult.source,
      isDemo: this.provider.isMockMode()
    };
  }
}

module.exports = VoiceService;
