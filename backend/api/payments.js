/**
 * Payment Gateway API Routes
 * Handles payment order creation, verification, webhooks, and status queries.
 */

async function handlePaymentRoutes(req, res, pathname, searchParams, context) {
  const { db, helpers } = context;
  const { sendJson, sendError, requireAuth, guardMutation, parseBody, getClientIp, securityLog } = helpers;

  // Only handle /api/payments/* routes
  if (!pathname.startsWith('/api/payments')) {
    return false;
  }

  // Extract path segments after /api/payments
  const subPath = pathname.replace(/^\/api\/payments/, '') || '/';

  try {
    // Initialize payment gateway service lazily (or from context if already added)
    let paymentGateway = context.paymentGateway;
    if (!paymentGateway) {
      const PaymentGatewayService = require('../services/paymentGateway.js');
      paymentGateway = new PaymentGatewayService();
      context.paymentGateway = paymentGateway;
    }

    // GET /api/payments/methods - List supported payment methods
    if (req.method === 'GET' && subPath === '/methods') {
      const user = requireAuth(req, res, { allowDemo: true });
      if (!user) return true;

      try {
        const methods = await paymentGateway.getSupportedMethods();
        return sendJson(res, 200, { success: true, methods, provider: paymentGateway.getProviderName(), isMock: paymentGateway.isMockMode() });
      } catch (err) {
        console.error('[Payments] getSupportedMethods error:', err);
        return sendError(res, 500, 'METHODS_FETCH_FAILED', 'Failed to fetch payment methods');
      }
    }

    // GET /api/payments/orders/:id - Get order status
    if (req.method === 'GET' && subPath.startsWith('/orders/')) {
      const user = requireAuth(req, res, { allowDemo: true });
      if (!user) return true;

      const orderId = subPath.split('/orders/')[1];
      if (!orderId) {
        return sendError(res, 400, 'INVALID_ORDER_ID', 'Order ID is required');
      }

      try {
        const order = await paymentGateway.getOrderStatus(orderId);
        return sendJson(res, 200, { success: true, order, provider: paymentGateway.getProviderName(), isMock: paymentGateway.isMockMode() });
      } catch (err) {
        console.error('[Payments] getOrderStatus error:', err);
        if (err.message.includes('not found')) {
          return sendError(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
        }
        return sendError(res, 500, 'ORDER_STATUS_FAILED', 'Failed to fetch order status');
      }
    }

    // POST /api/payments/orders - Create payment order
    if (req.method === 'POST' && subPath === '/orders') {
      const user = requireAuth(req, res, { allowDemo: true });
      if (!user) return true;

      if (!guardMutation(req, res, 'payments_create', 30)) return true;

      try {
        const body = await parseBody(req);
        const { amount, currency = 'INR', receipt, customer, callbackUrl, webhookUrl, notes, method } = body;

        if (!amount || parseInt(amount, 10) <= 0) {
          return sendError(res, 400, 'INVALID_AMOUNT', 'Amount must be a positive integer in paise');
        }

        // Add user context to notes for tracking
        const enrichedNotes = {
          ...notes,
          userId: user.id,
          shopName: user.shopName,
          createdBy: user.fullName || user.shopName
        };

        const order = await paymentGateway.createOrder({
          amount: parseInt(amount, 10),
          currency,
          receipt,
          customer: customer || { name: user.fullName || user.shopName, email: '', phone: '' },
          callbackUrl,
          webhookUrl,
          notes: enrichedNotes,
          method
        });

        securityLog('PAYMENT_ORDER_CREATED', { userId: user.id, orderId: order.orderId, amount: order.amount });

        return sendJson(res, 201, { success: true, order, provider: paymentGateway.getProviderName(), isMock: paymentGateway.isMockMode() });
      } catch (err) {
        console.error('[Payments] createOrder error:', err);
        if (err.message.includes('credentials')) {
          return sendError(res, 503, 'PROVIDER_NOT_CONFIGURED', err.message);
        }
        return sendError(res, 500, 'ORDER_CREATION_FAILED', 'Failed to create payment order');
      }
    }

    // POST /api/payments/verify - Verify payment signature
    if (req.method === 'POST' && subPath === '/verify') {
      const user = requireAuth(req, res, { allowDemo: true });
      if (!user) return true;

      if (!guardMutation(req, res, 'payments_verify', 30)) return true;

      try {
        const body = await parseBody(req);
        const { orderId, paymentId, signature } = body;

        if (!orderId || !paymentId) {
          return sendError(res, 400, 'MISSING_PARAMS', 'orderId and paymentId are required');
        }

        const result = await paymentGateway.verifyPayment({ orderId, paymentId, signature });

        if (result.verified) {
          securityLog('PAYMENT_VERIFIED', { userId: user.id, orderId, paymentId, status: result.status });
        } else {
          securityLog('PAYMENT_VERIFICATION_FAILED', { userId: user.id, orderId, paymentId, error: result.error });
        }

        return sendJson(res, 200, { success: true, ...result, provider: paymentGateway.getProviderName(), isMock: paymentGateway.isMockMode() });
      } catch (err) {
        console.error('[Payments] verifyPayment error:', err);
        if (err.message.includes('credentials')) {
          return sendError(res, 503, 'PROVIDER_NOT_CONFIGURED', err.message);
        }
        return sendError(res, 500, 'VERIFICATION_FAILED', 'Payment verification failed');
      }
    }

    // POST /api/payments/webhook - Payment gateway webhook receiver
    if (req.method === 'POST' && subPath === '/webhook') {
      // Webhooks don't require auth, but we verify the signature
      try {
        const rawBody = await parseBody(req, { raw: true });
        const headers = req.headers;

        // Verify webhook signature
        const isValid = paymentGateway.verifyWebhookSignature(headers, rawBody);

        if (!isValid) {
          securityLog('WEBHOOK_SIGNATURE_INVALID', { ip: getClientIp(req), path: pathname });
          return sendError(res, 401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
        }

        // Parse the body for processing
        let payload;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = { raw: rawBody };
        }

        securityLog('WEBHOOK_RECEIVED', { provider: paymentGateway.getProviderName(), eventType: payload.type || payload.event, orderId: payload.data?.order?.id || payload.order_id });

        // Process webhook based on provider event type
        await processWebhookEvent(paymentGateway, payload, user);

        // Acknowledge receipt
        return sendJson(res, 200, { success: true, received: true });
      } catch (err) {
        console.error('[Payments] webhook error:', err);
        securityLog('WEBHOOK_PROCESSING_ERROR', { error: err.message });
        return sendError(res, 500, 'WEBHOOK_PROCESSING_FAILED', 'Webhook processing failed');
      }
    }

    // POST /api/payments/refund - Initiate refund
    if (req.method === 'POST' && subPath === '/refund') {
      const user = requireAuth(req, res, { allowDemo: true });
      if (!user) return true;

      if (!guardMutation(req, res, 'payments_refund', 10)) return true;

      try {
        const body = await parseBody(req);
        const { paymentId, amount, reason } = body;

        if (!paymentId) {
          return sendError(res, 400, 'MISSING_PAYMENT_ID', 'paymentId is required');
        }

        const refund = await paymentGateway.refund({ paymentId, amount: amount ? parseInt(amount, 10) : undefined, reason });

        securityLog('REFUND_INITIATED', { userId: user.id, paymentId, refundId: refund.refundId, amount: refund.amount });

        return sendJson(res, 200, { success: true, refund, provider: paymentGateway.getProviderName(), isMock: paymentGateway.isMockMode() });
      } catch (err) {
        console.error('[Payments] refund error:', err);
        if (err.message.includes('credentials')) {
          return sendError(res, 503, 'PROVIDER_NOT_CONFIGURED', err.message);
        }
        return sendError(res, 500, 'REFUND_FAILED', 'Failed to initiate refund');
      }
    }

    // Unhandled payment route
    return sendError(res, 404, 'ENDPOINT_NOT_FOUND', `Payment endpoint not found: ${req.method} ${pathname}`);

  } catch (err) {
    console.error('[Payments] Route handler error:', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Payment route handler error');
  }

  return true;
}

/**
 * Process webhook events from payment providers
 * Normalizes provider-specific events to common actions
 */
async function processWebhookEvent(paymentGateway, payload, user) {
  const provider = paymentGateway.getProviderName();
  const isMock = paymentGateway.isMockMode();

  try {
    let eventType = payload.type || payload.event;
    let orderId = null;
    let paymentId = null;
    let status = null;

    // Normalize based on provider
    if (provider === 'Razorpay') {
      // Razorpay: payload.event = 'payment.captured', 'payment.failed', 'order.paid', etc.
      eventType = payload.event;
      orderId = payload.payload?.payment?.entity?.order_id || payload.payload?.order?.entity?.id;
      paymentId = payload.payload?.payment?.entity?.id;
      status = payload.payload?.payment?.entity?.status || payload.payload?.order?.entity?.status;
    } else if (provider === 'Cashfree') {
      // Cashfree: payload.type = 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'ORDER_PAID', etc.
      eventType = payload.type;
      orderId = payload.data?.order?.order_id || payload.data?.order_id;
      paymentId = payload.data?.payment?.cf_payment_id || payload.data?.payment_id;
      status = payload.data?.payment?.payment_status || payload.data?.order_status;
    } else {
      // Mock provider
      eventType = payload.type;
      orderId = payload.data?.order?.id;
      paymentId = payload.data?.payment?.paymentId;
      status = payload.data?.order?.status;
    }

    console.log(`[Webhook] ${provider} event: ${eventType}`, { orderId, paymentId, status });

    // Here you could update local database records, send notifications, etc.
    // For now, we log and acknowledge

    return { processed: true, eventType, orderId, paymentId, status };
  } catch (err) {
    console.error('[Webhook] Processing error:', err);
    return { processed: false, error: err.message };
  }
}

module.exports = { handlePaymentRoutes };