# Hisab Security Architecture & Policy

## 1. Core Financial Protection Standards
Hisab strictly adheres to Indian regulatory and banking guidelines for financial software:
1. **Never Collect or Store Sensitive Authentication Data**:
   - Hisab **NEVER** asks for, stores, or transmits:
     - Internet banking passwords or login credentials
     - Debit card / ATM PINs
     - UPI PINs
     - SMS or WhatsApp OTPs
2. **Zero Screen Scraping**:
   - Hisab does not scrape personal banking applications (Google Pay, PhonePe, Paytm, BHIM, or netbanking portals).
   - All banking integrations function exclusively through RBI-approved Account Aggregator standards and direct merchant payment gateways.

## 2. Authentication & Session Management
- **Password Security**: Passwords are saved with dynamic per-user 16-byte random salts using PBKDF2 (`crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512')`).
- **Session Tokens**: Cryptographic 32-byte tokens generated using `crypto.randomBytes(32)`.
- **HttpOnly Cookies**: Session tokens are passed via `hisab_session` with `HttpOnly`, `Path=/`, `SameSite=Lax`, and `Max-Age=604800` (7 days). Tokens are never exposed to browser `document.cookie` scripts.
- **Session Revocation**: Logging out deletes the session record from `auth_sessions` immediately, invalidating any future requests.

## 3. Authorization & Tenant Isolation
- **No IDOR (Insecure Direct Object Reference)**:
  - Every REST endpoint extracts `user.id` from the authenticated session.
  - Queries across `customers`, `credits`, `transactions`, `bank_accounts`, `payments`, and `payment_orders` explicitly enforce `user_id = ?`.
  - Attempting to query another merchant's ID returns 404 or null.

## 4. Rate Limiting & Abuse Prevention
- An in-memory sliding bucket rate limiter throttles mutations (`guardMutation`).
- Sensitive operations (login, registration, upload, payment verification, voice) are capped per minute per IP to defend against brute force and denial of service.

## 5. Webhook Security
- Both Payment Gateway (`/api/webhooks/payment-gateway`) and Account Aggregator (`/api/bank/webhook`) endpoints verify cryptographic HMAC-SHA256 signatures before processing payloads.
- Verifications use `crypto.timingSafeEqual` with buffer length checking to eliminate timing attack vectors.
- Processed webhooks are logged in `webhook_events` to provide idempotent replay protection.

## 6. XSS & Injection Defenses
- Frontend utilizes the centralized `escapeHtml` utility for any dynamically rendered user or bank narration strings.
- All backend database operations utilize parameterized queries (`db.prepare(...).all(...)`), eliminating SQL injection.
