/**
 * Health Check API Routes
 */

async function handleHealthRoutes(req, res, pathname, searchParams, { helpers }) {
  const { sendJson } = helpers;

  // GET /api/health
  if (pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, {
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString()
    });
    return true;
  }

  return false;
}

module.exports = { handleHealthRoutes };
