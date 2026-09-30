/**
 * Customer Management REST API Controller
 * Provides customer listing, creation, detailed profile, editing, and deletion.
 */

const {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../services/customerService.js');

async function handleCustomerRoutes(req, res, pathname, searchParams, context) {
  const { db, helpers } = context;
  const { sendJson, sendError, requireAuth, guardMutation, parseBody } = helpers;

  // GET /api/customers (list or query)
  if (pathname === '/api/customers' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;

    const search = searchParams.get('search') || searchParams.get('q') || '';
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 50;

    const result = listCustomers(db, user.id, { search, page, limit });
    sendJson(res, 200, { success: true, data: result });
    return true;
  }

  // POST /api/customers (create customer)
  if (pathname === '/api/customers' && req.method === 'POST') {
    if (!guardMutation(req, res, 'customers', 20)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    try {
      const body = await parseBody(req);
      const customer = createCustomer(db, user.id, body);
      sendJson(res, 201, {
        success: true,
        data: customer,
        message: `Customer ${customer.name} added successfully.`
      });
    } catch (err) {
      sendError(res, 400, 'CUSTOMER_CREATION_FAILED', err.message);
    }
    return true;
  }

  // GET /api/customers/:id (customer profile & statement)
  if (pathname.startsWith('/api/customers/') && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return true;

    const idOrName = decodeURIComponent(pathname.replace('/api/customers/', ''));
    let profile = getCustomerById(db, user.id, idOrName);

    // Fallback search by name if id didn't match directly
    if (!profile) {
      const custRow = db.prepare('SELECT id FROM customers WHERE user_id = ? AND LOWER(name) = LOWER(?)').get(user.id, idOrName);
      if (custRow) {
        profile = getCustomerById(db, user.id, custRow.id);
      }
    }

    if (!profile) {
      sendError(res, 404, 'CUSTOMER_NOT_FOUND', `Customer '${idOrName}' not found.`);
      return true;
    }

    sendJson(res, 200, { success: true, data: profile });
    return true;
  }

  // PUT /api/customers/:id (update customer)
  if (pathname.startsWith('/api/customers/') && req.method === 'PUT') {
    if (!guardMutation(req, res, 'customers', 20)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const customerId = decodeURIComponent(pathname.replace('/api/customers/', ''));
    try {
      const body = await parseBody(req);
      const updated = updateCustomer(db, user.id, customerId, body);
      if (!updated) {
        sendError(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');
        return true;
      }
      sendJson(res, 200, { success: true, data: updated, message: 'Customer updated successfully.' });
    } catch (err) {
      sendError(res, 400, 'CUSTOMER_UPDATE_FAILED', err.message);
    }
    return true;
  }

  // DELETE /api/customers/:id
  if (pathname.startsWith('/api/customers/') && req.method === 'DELETE') {
    if (!guardMutation(req, res, 'customers', 15)) return true;
    const user = requireAuth(req, res);
    if (!user) return true;

    const customerId = decodeURIComponent(pathname.replace('/api/customers/', ''));
    const deleted = deleteCustomer(db, user.id, customerId);
    if (!deleted) {
      sendError(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');
      return true;
    }
    sendJson(res, 200, { success: true, message: 'Customer deleted successfully.' });
    return true;
  }

  return false;
}

module.exports = { handleCustomerRoutes };
