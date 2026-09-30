/**
 * Hisab Mock & Hybrid Voice Provider
 * Provides offline speech transcription simulation and dynamic WAV tone synthesis
 * enabling zero-dependency voice playback in all browsers.
 */

const VoiceProvider = require('./VoiceProvider.js');

class MockVoiceProvider extends VoiceProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'mock';
    this.supportedLanguages = ['en-IN', 'te-IN', 'hi-IN', 'ta-IN', 'kn-IN', 'mr-IN', 'bn-IN'];
  }

  isMockMode() {
    return true;
  }

  /**
   * Detects language from text script
   */
  detectLanguage(text = '') {
    // Telugu range: 0C00-0C7F
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
    // Devanagari range: 0900-097F (Hindi/Marathi)
    if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
    // Tamil range: 0B80-0BFF
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
    // Kannada range: 0C80-0CFF
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
    // Bengali range: 0980-09FF
    if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';

    // Romanized Telugu keywords
    const lower = text.toLowerCase();
    if (/\b(enni|entha|unnaru|chesaru|lo|ee|undi|amma|garu)\b/.test(lower)) return 'te-IN';
    if (/\b(kitna|kaun|tha|hai|pichhle|mahine|hain|huye|aaya)\b/.test(lower)) return 'hi-IN';

    return 'en-IN';
  }

  async transcribe(audioData, options = {}) {
    let transcriptText = options.query || options.fallbackText || '';
    if (!transcriptText && typeof audioData === 'string' && !audioData.startsWith('data:')) {
      transcriptText = audioData;
    }

    const detectedLang = options.languageHint || this.detectLanguage(transcriptText);

    return {
      transcript: transcriptText || 'How much UPI payment came today?',
      language: detectedLang,
      confidence: 0.95,
      isDemo: true
    };
  }

  /**
   * Generates a minimal valid PCM WAV audio buffer for browser playback
   */
  generateMinimalWav(durationSeconds = 0.5) {
    const sampleRate = 8000;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const buffer = Buffer.alloc(44 + numSamples);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples, 4);
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM = 1)
    buffer.writeUInt16LE(1, 22);  // NumChannels (Mono = 1)
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(sampleRate, 28); // ByteRate
    buffer.writeUInt16LE(1, 32);  // BlockAlign
    buffer.writeUInt16LE(8, 34);  // BitsPerSample

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples, 40);

    // Simple gentle tone waveform
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const val = 128 + Math.floor(40 * Math.sin(2 * Math.PI * 440 * t));
      buffer.writeUInt8(val, 44 + i);
    }

    return buffer;
  }

  async synthesize(text, options = {}) {
    const lang = options.language || this.detectLanguage(text);
    const wavBuffer = this.generateMinimalWav(0.6);

    return {
      text,
      language: lang,
      mimeType: 'audio/wav',
      audioData: wavBuffer.toString('base64'),
      audioBase64: wavBuffer.toString('base64'),
      dataUrl: `data:audio/wav;base64,${wavBuffer.toString('base64')}`,
      durationMs: 600,
      isDemo: true
    };
  }
}

module.exports = MockVoiceProvider;
