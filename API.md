# Hisab REST API Reference

All requests and responses use JSON (`Content-Type: application/json`).
All data endpoints require authentication via HttpOnly session cookie (`hisab_session`).
Mutations are CSRF-protected and rate-limited.

---

## 1. Authentication (`/api/auth`)

### `POST /api/auth/register`
Register a new shop owner merchant account.
- **Request Body**:
  ```json
  {
    "shopName": "Sri Lakshmi Kirana",
    "fullName": "Lakshmi Narayana",
    "phone": "9848012345",
    "email": "lakshmi@store.in",
    "password": "Password123!"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "user": { "id": "USR-...", "shopName": "Sri Lakshmi Kirana", "fullName": "Lakshmi Narayana" }
  }
  ```

### `POST /api/auth/login`
Authenticate with phone/email and password. Sets `hisab_session` cookie.
- **Request Body**:
  ```json
  {
    "identifier": "9848012345",
    "password": "Password123!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "user": { "id": "USR-...", "shopName": "Sri Lakshmi Kirana", "fullName": "Lakshmi Narayana" }
  }
  ```

### `GET /api/auth/me`
Retrieve active session user profile.
- **Response** (`200 OK`):
  ```json
  { "success": true, "user": { "id": "USR-...", "shopName": "Sri Lakshmi Kirana" } }
  ```

### `POST /api/auth/logout`
Revoke session and clear session cookie.

---

## 2. Customer Management (`/api/customers`)

### `GET /api/customers`
List all customers for the authenticated shop.
- **Query Parameters**:
  - `search`: Filter by name, phone, or email.
  - `page`: Page index (default: `1`).
  - `limit`: Number of records (default: `50`).
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "customers": [
        {
          "id": "CUST-101",
          "name": "Sunil Kumar",
          "phone": "9848011223",
          "total_inflow": 4500,
          "outstanding_credit": 1200,
          "transaction_count": 8,
          "last_activity_date": "2026-09-20"
        }
      ],
      "total": 1,
      "page": 1,
      "totalPages": 1
    }
  }
  ```

### `POST /api/customers`
Create a customer record.
- **Request Body**:
  ```json
  {
    "name": "Sunil Kumar",
    "phone": "9848011223",
    "email": "sunil@example.com",
    "notes": "Regular neighbor"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "data": { "id": "CUST-...", "name": "Sunil Kumar", "phone": "9848011223" },
    "message": "Customer Sunil Kumar added successfully."
  }
  ```

### `GET /api/customers/:id`
Retrieve customer profile with lifetime transaction statement and credit balances.
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "id": "CUST-101",
      "name": "Sunil Kumar",
      "stats": {
        "totalInflow": 4500,
        "totalOutflow": 0,
        "netVolume": 4500,
        "totalCredit": 2500,
        "totalRepaid": 1300,
        "outstandingCredit": 1200,
        "transactionCount": 8
      },
      "transactions": [...],
      "credits": [...],
      "payments": [...]
    }
  }
  ```

---

## 3. Credit & Udhar Ledger (`/api/credit`)

### `GET /api/credit`
List issued credits with computed status and overdue flags.
- **Query Parameters**: `customerId`, `status` (`Pending`, `Partially Paid`, `Paid`, `Overdue`), `page`, `limit`.

### `POST /api/credit`
Issue credit / Udhar to a customer. Automatically records in Common Transaction Engine.
- **Request Body**:
  ```json
  {
    "customerId": "CUST-101",
    "customerName": "Sunil Kumar",
    "amount": 1500,
    "dueDate": "2026-10-15",
    "description": "10kg Rice and Oil"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "data": {
      "id": "CRD-...",
      "amount": 1500,
      "outstanding_amount": 1500,
      "status": "Pending"
    }
  }
  ```

### `POST /api/credit/repay`
Record repayment against outstanding customer credit.
- **Request Body**:
  ```json
  {
    "customerId": "CUST-101",
    "creditId": "CRD-...",
    "amount": 500,
    "mode": "UPI",
    "reference": "UPI/3219087612"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "paymentId": "PAY-...",
      "amountRepaid": 500,
      "customerRemainingOutstanding": 1000,
      "status": "Partially Paid"
    }
  }
  ```

---

## 4. Payment Gateway (`/api/payments`)

### `POST /api/payments/create-order`
Create an online payment gateway order (Mock, Razorpay, or Cashfree).
- **Request Body**:
  ```json
  {
    "amount": 850,
    "customerName": "Vikram Singh",
    "purpose": "Kirana Groceries"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "order": {
      "orderId": "order_mock_...",
      "amount": 850,
      "currency": "INR",
      "status": "CREATED",
      "keyId": "rzp_test_..."
    }
  }
  ```

### `POST /api/payments/verify`
Verify payment signature and reconcile into ledger and credits.
- **Request Body**:
  ```json
  {
    "orderId": "order_mock_...",
    "paymentId": "pay_mock_...",
    "signature": "mock_sig_..."
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "verified": true,
    "orderId": "order_mock_...",
    "orderStatus": "PAID",
    "transactionId": "TXN-...",
    "creditReconciled": true
  }
  ```

### `POST /api/webhooks/payment-gateway`
Receive provider webhooks with HMAC-SHA256 verification.

---

## 5. Account Aggregator Bank Data (`/api/bank`)

### `GET /api/bank/banks`
List supported banks with FIP IDs and logos.

### `POST /api/bank/connect`
Initiate RBI Account Aggregator consent request.

### `POST /api/bank/sync`
Synchronize latest bank statement records and auto-detect UPI VPAs.

### `DELETE /api/bank/accounts/:id`
Revoke consent and unlink bank account.

---

## 6. AI & Voice Assistant (`/api/ai` & `/api/voice`)

### `POST /api/ai/chat`
Ask natural language questions about financial performance.
- **Request Body**:
  ```json
  {
    "query": "Who paid me the most this month?",
    "sessionId": "session_xyz"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "answer": "The highest-paying customer was Garg Kirana Corp with ₹1,50,000.",
    "toolUsed": "get_highest_paying_customer",
    "chart": { "labels": [...], "data": [...] },
    "ttsLang": "en-IN"
  }
  ```

### `POST /api/voice/query`
Voice-to-voice query: Speech input transcribed, AI tools executed, WAV audio synthesized.
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "transcript": "How much UPI payment came today?",
    "answer": "You received ₹45,200 via UPI today.",
    "audio": {
      "mimeType": "audio/wav",
      "dataUrl": "data:audio/wav;base64,..."
    },
    "ttsLang": "en-IN"
  }
  ```
