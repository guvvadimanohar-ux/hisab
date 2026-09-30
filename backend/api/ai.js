/**
 * AI & Voice Assistant API Routes
 * Multilingual Voice & AI Financial Analytics Query Processor.
 */

async function handleAiRoutes(req, res, pathname, searchParams, context) {
  const { aiService, helpers } = context;
  const { sendJson, sendError, requireAuth, guardMutation, parseBody } = helpers;

  // GET /api/ai/health -> Status of Ollama connection, models & DB
  if (pathname === '/api/ai/health' && req.method === 'GET') {
    const health = await aiService.checkHealth();
    sendJson(res, 200, { success: true, data: health });
    return true;
  }

  // POST /api/ai/chat -> Multilingual Voice / Text Financial Analytics Query
  if (pathname === '/api/ai/chat' && req.method === 'POST') {
    if (!guardMutation(req, res, 'ai', 30)) return true;
    const user = requireAuth(req, res, { allowDemo: true });
    if (!user) return true;

    const body = await parseBody(req);
    const query = (body.query || '').trim();
    if (!query) {
      sendError(res, 400, 'EMPTY_QUERY', 'Query cannot be empty.');
      return true;
    }

    // The AI assistant runs strictly inside the caller's data scope.
    const result = await aiService.processQuery(query, {
      sessionId: body.sessionId || `user-${user.id}`,
      languageHint: body.languageHint || null,
      userId: user.id === 'demo-user' ? null : user.id
    });
    sendJson(res, 200, result);
    return true;
  }

  // DELETE /api/ai/chat/:sessionId -> Reset conversational memory session
  if (pathname.startsWith('/api/ai/chat/') && req.method === 'DELETE') {
    const user = requireAuth(req, res, { allowDemo: true });
    if (!user) return true;
    const sessionId = decodeURIComponent(pathname.replace('/api/ai/chat/', ''));
    // Only the owning user can clear their own session namespace
    aiService.clearSession(sessionId.startsWith('user-') ? sessionId : `user-${user.id}`);
    sendJson(res, 200, { success: true, message: 'Session cleared successfully.' });
    return true;
  }

  return false;
}

module.exports = { handleAiRoutes };
