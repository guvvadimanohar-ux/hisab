/**
 * Hisab Voice Provider Base Class
 * Defines the contract for Speech-to-Text (STT) and Text-to-Speech (TTS) providers.
 */

class VoiceProvider {
  constructor(config = {}) {
    this.name = 'base';
    this.config = config;
  }

  /**
   * Transcribes audio into text and detects spoken language
   * @param {Buffer|string} audioData Base64 audio or raw Buffer
   * @param {Object} options { languageHint, mimeType }
   * @returns {Promise<Object>} { transcript, language, confidence }
   */
  async transcribe(audioData, options = {}) {
    throw new Error('transcribe() must be implemented by voice provider');
  }

  /**
   * Synthesizes text into spoken audio
   * @param {string} text The text to synthesize
   * @param {Object} options { language, voiceGender, speed }
   * @returns {Promise<Object>} { audioBase64, mimeType, durationMs }
   */
  async synthesize(text, options = {}) {
    throw new Error('synthesize() must be implemented by voice provider');
  }

  isMockMode() {
    return false;
  }
}

module.exports = VoiceProvider;
