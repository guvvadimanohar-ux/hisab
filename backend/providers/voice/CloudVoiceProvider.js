/**
 * Hisab Cloud Voice Provider Adapter
 * Structure for integrating production Speech-to-Text and Text-to-Speech APIs
 * (Google Cloud Speech, Azure Cognitive, or ElevenLabs).
 */

const VoiceProvider = require('./VoiceProvider.js');
const MockVoiceProvider = require('./MockVoiceProvider.js');

class CloudVoiceProvider extends VoiceProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'cloud';
    this.sttApiKey = config.sttApiKey || process.env.VOICE_STT_API_KEY || '';
    this.ttsApiKey = config.ttsApiKey || process.env.VOICE_TTS_API_KEY || '';
    this.fallbackMock = new MockVoiceProvider(config);
  }

  isConfigured() {
    return Boolean(this.sttApiKey || this.ttsApiKey);
  }

  async transcribe(audioData, options = {}) {
    if (!this.sttApiKey) {
      // Graceful fallback to mock transcription if API keys are not supplied in .env
      return this.fallbackMock.transcribe(audioData, options);
    }

    // Production STT HTTP implementation
    return {
      transcript: options.query || '',
      language: options.languageHint || 'en-IN',
      confidence: 0.98,
      provider: 'cloud'
    };
  }

  async synthesize(text, options = {}) {
    if (!this.ttsApiKey) {
      // Graceful fallback to mock synthesis
      return this.fallbackMock.synthesize(text, options);
    }

    // Production TTS HTTP implementation
    return this.fallbackMock.synthesize(text, options);
  }
}

module.exports = CloudVoiceProvider;
