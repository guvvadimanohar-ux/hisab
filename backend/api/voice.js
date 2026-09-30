/**
 * Voice Assistant REST API Controller
 * Provides transcription, spoken AI financial query execution, and TTS synthesis.
 */

async function handleVoiceRoutes(req, res, pathname, searchParams, context) {
  const { db, voiceService, aiService, helpers } = context;
  const { sendJson, sendError, requireAuth, guardMutation, parseBody } = helpers;

  // POST /api/voice/transcribe -> Speech to Text
  if (pathname === '/api/voice/transcribe' && req.method === 'POST') {
    if (!guardMutation(req, res, 'voice', 30)) return true;
    const user = requireAuth(req, res, { allowDemo: true });
    if (!user) return true;

    try {
      const body = await parseBody(req);
      const result = await voiceService.transcribe(body.audioData || body.audio, {
        languageHint: body.languageHint
      });
      sendJson(res, 200, { success: true, data: result });
    } catch (err) {
      sendError(res, 400, 'TRANSCRIPTION_FAILED', err.message);
    }
    return true;
  }

  // POST /api/voice/query -> Full voice pipeline: Query -> AI Analysis -> TTS Audio
  if (pathname === '/api/voice/query' && req.method === 'POST') {
    if (!guardMutation(req, res, 'voice', 30)) return true;
    const user = requireAuth(req, res, { allowDemo: true });
    if (!user) return true;

    try {
      const body = await parseBody(req);
      const result = await voiceService.processVoiceQuery(db, aiService, user.id === 'demo-user' ? null : user.id, {
        audioData: body.audioData || body.audio,
        query: body.query,
        languageHint: body.languageHint,
        sessionId: body.sessionId
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendError(res, 400, 'VOICE_QUERY_FAILED', err.message);
    }
    return true;
  }

  // POST /api/voice/speak -> Text to Speech
  if (pathname === '/api/voice/speak' && req.method === 'POST') {
    if (!guardMutation(req, res, 'voice', 30)) return true;
    const user = requireAuth(req, res, { allowDemo: true });
    if (!user) return true;

    try {
      const body = await parseBody(req);
      const text = body.text || '';
      if (!text) {
        sendError(res, 400, 'EMPTY_TEXT', 'Text is required for speech synthesis.');
        return true;
      }
      const audio = await voiceService.speak(text, {
        language: body.language || body.ttsLang
      });
      sendJson(res, 200, { success: true, data: audio });
    } catch (err) {
      sendError(res, 400, 'TTS_FAILED', err.message);
    }
    return true;
  }

  return false;
}

module.exports = { handleVoiceRoutes };
