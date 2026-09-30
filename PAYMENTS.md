# Hisab Payment Gateway Integration Guide

Hisab provides an extensible Payment Gateway orchestration layer designed to accept customer payments via UPI QR, Netbanking, and Debit Cards.

## 1. Provider Abstraction
Payment gateways are managed via `backend/services/paymentService.js` and implement the `PaymentGatewayProvider` interface:

```text
PaymentGatewayProvider (backend/providers/payments/PaymentGatewayProvider.js)
        |
        |--- MockPaymentProvider (Offline sandbox development)
        |
        |--- RazorpayProvider (Official Razorpay Orders & Verification)
        |
        |--- CashfreeProvider (Official Cashfree PG API v2023-08-01)
```

The active provider is chosen via environment configuration:
```bash
PAYMENT_GATEWAY=mock # mock | razorpay | cashfree
```

## 2. Payment Lifecycle & Flow
```text
Customer / Shopkeeper
        ↓
1. Click "Collect Payment" or Checkout
        ↓
2. POST /api/payments/create-order
        ↓
3. PaymentService invokes active provider (e.g. Razorpay/Cashfree/Mock)
        ↓
4. Returns Order ID & Client Key (Secrets remain on backend)
        ↓
5. Customer completes payment (UPI / QR / Cards)
        ↓
6. Two verification paths:
   - Direct Verification: POST /api/payments/verify with signature
   - Webhook Verification: POST /api/webhooks/payment-gateway with HMAC-SHA256
        ↓
7. Cryptographic signature check via timingSafeEqual
        ↓
8. Payment marked PAID in payment_orders table
        ↓
9. Automatic Common Transaction Engine Ingestion (INFLOW Jama)
        ↓
10. Automatic Credit / Udhar Reconciliation (if linked to credit)
        ↓
11. Real-time Dashboard KPI & Ledger Refresh
```

## 3. Configuration & Credentials

### Development / Mock Mode
In development mode, `PAYMENT_GATEWAY=mock` allows complete end-to-end testing without external credentials. Orders and signature verifications succeed locally, and simulated payments update the ledger with clearly badged demo records.

### Production (Razorpay)
1. Register at [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Generate API Key & Secret under Settings → API Keys.
3. Configure webhook endpoint to `https://your-domain.in/api/webhooks/payment-gateway` and set a Webhook Secret.
4. Set in `.env`:
   ```bash
   PAYMENT_GATEWAY=razorpay
   RAZORPAY_KEY_ID=rzp_live_...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   ```

### Production (Cashfree)
1. Register at [Cashfree Merchant Dashboard](https://merchant.cashfree.com).
2. Generate App ID & Secret Key under Payment Gateway → Developers → API Keys.
3. Set in `.env`:
   ```bash
   PAYMENT_GATEWAY=cashfree
   CASHFREE_CLIENT_ID=...
   CASHFREE_CLIENT_SECRET=...
   CASHFREE_WEBHOOK_SECRET=...
   CASHFREE_ENVIRONMENT=production
   ```
