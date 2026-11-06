# Hisab — Multilingual Voice & AI Financial Data Analyst

> **Your Khatabook, now voice-powered.**  
> A zero-dependency financial analytics platform with voice & text natural language data querying in **Telugu (తెలుగు)**, **Hindi (हिंदी)**, and **English**, powered by local Ollama LLMs and read-only SQLite tools.

---

## 📁 Project Architecture & Organization

Hisab is organized with clean separation between the frontend, backend, and API routing layers:

```text
hisabai/
├── frontend/                     # Modern Web UI Client
│   ├── index.html                # Single Page Dashboard & Voice UI
│   ├── css/
│   │   └── style.css             # Glassmorphism, Responsive Styles & Design Tokens
│   └── js/
│       ├── app.js                # Dashboard State, Charts, Filters & AA Workflow
│       └── voice.js              # Web Speech API & Multilingual Audio Synthesis
├── backend/                      # Node.js Server & Application Logic
│   ├── server.js                 # HTTP Server, Middleware & Static File Host
│   ├── api/                      # Modular REST API Controllers
│   │   ├── index.js              # Central API Dispatcher
│   │   ├── auth.js               # /api/auth (Register, Login, Session)
│   │   ├── ai.js                 # /api/ai (Health, Chat, Memory Sessions)
│   │   ├── bank.js               # /api/bank (Connect, Consents, Sync, Webhooks)
│   │   ├── analytics.js          # /api/analytics, /api/dashboard, /api/cash-flow
│   │   ├── transactions.js       # /api/transactions, /api/customers, /api/loans, /api/export
│   │   ├── upload.js             # /api/upload, /api/audit, /api/import
│   │   └── health.js             # /api/health
│   ├── services/                 # Core Domain Services
│   │   ├── accountAggregator.js  # AA Consent & Session Orchestrator
│   │   ├── aiAgent.js            # Ollama LLM & Multilingual Routing
│   │   ├── analytics.js          # KPI & Cash Flow Calculations
│   │   ├── analyticsEngine.js    # Data Aggregations & Dimension Slicers
│   │   ├── authService.js        # PBKDF2 Password Hashing & Cookie Sessions
│   │   ├── bankNormalizer.js     # Bank Feeds to Canonical Schema
│   │   ├── categorization.js     # Expense & Inflow Classifier
│   │   ├── database.js           # node:sqlite Schema & Indices
│   │   └── upiDetector.js        # Multi-signal UPI Identification
│   └── providers/                # External AA Providers (Setu, Finvu, Mock)
├── tests/                        # Comprehensive Automated Test Suites (66 tests)
│   ├── run_all.js                # Master Test Runner
│   ├── aa_tests.js               # Account Aggregator & UPI Detection Tests
│   ├── financial_tests.js        # Financial Math & KPI Tests
│   ├── security_tests.js         # Multi-User Isolation & Auth Tests
│   └── ai_voice_tests.js         # Multilingual Voice & AI Assistant Tests
├── scripts/                      # Setup & Launch Automation
│   ├── setup.sh                  # Runtime, SQLite, and Ollama Verification
│   ├── start.sh                  # Application Daemon Launcher
│   └── test-ai.sh                # Test Suite Runner
├── server.js                     # Root Entrypoint Wrapper (delegates to backend/server.js)
├── package.json                  # NPM Configuration & Test Scripts
└── hisab_financial.db            # SQLite Database
```

---

## 🏦 Connect Bank Account (Account Aggregator / UPI Import)

Hisab supports **consent-based** bank transaction import via India's RBI Account
Aggregator (AA) framework, with automatic UPI detection, categorization and
analytics. **Hisab never asks for bank passwords, OTPs, UPI PINs or card PINs.**
All data flows through the user's explicit AA consent and can be revoked anytime
from the dashboard (Disconnect also revokes consent at the provider).

### How the flow works

```text
Connect Bank Account (dashboard)
      ↓
POST /api/bank/connect  → consent request created (PENDING)
      ↓
User approves in their AA app / consent URL (ACTIVE)
      ↓
Provider webhook / callback → consent status synced (HMAC-verified)
      ↓
POST /api/bank/sync  → FI session → transactions fetched
      ↓
Normalizer → UPI detector → Categorizer → Deduplication
      ↓
SQLite (scoped to your account) → Dashboard & UPI analytics
```

### Provider abstraction

```text
providers/accountAggregator/
  AccountAggregatorProvider.js   # interface: createConsent, getConsentStatus,
                                 #            createDataSession, fetchFinancialInformation,
                                 #            revokeConsent, verifyWebhookSignature
  SetuProvider.js                # Setu AA Bridge (sandbox + production ready)
  FinvuProvider.js               # Finvu (integration points marked; needs onboarding)
  MockAAProvider.js              # local simulator - realistic DEMO transactions
```

Switch providers with `AA_PROVIDER`; run the whole flow offline with
`AA_MOCK_MODE=true` (opt-in). Mock data is always badged **DEMO DATA** and is
never mixed with live AA data (each connection carries its own provider tag).

### Security model (multi-user)

- Real session authentication: PBKDF2-hashed passwords, HttpOnly `SameSite=Lax` session cookies
- **Every** data endpoint (bank, transactions, analytics, datasets, AI chat) is scoped to the authenticated user — no IDOR
- Webhooks: HMAC-SHA256 over the **raw** body, length-guarded timing-safe compare, event-id **idempotency**
- Rate limiting on auth/bank/CSV/AI endpoints + same-origin (CSRF) checks on mutations
- Narrations and merchant names (attacker-controllable via bank feeds) are HTML-escaped before rendering
- Security events (login failures, webhook rejections, disconnects) are logged server-side without secrets

### REST API (new / extended)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account + session |
| POST | `/api/auth/login` | Sign in (phone/email + password) |
| POST | `/api/auth/logout` | Revoke session |
| GET | `/api/auth/me` | Current user |
| POST | `/api/bank/connect` | Initiate AA consent |
| GET | `/api/bank/banks` | Supported banks + provider info |
| GET | `/api/bank/accounts` | Connected accounts (scoped) |
| GET | `/api/bank/accounts/:id` | Account detail + consent status |
| GET | `/api/bank/consents` | Consent lifecycle list |
| POST | `/api/bank/sync` | Incremental transaction sync |
| DELETE | `/api/bank/accounts/:id` | Disconnect + revoke consent + purge |
| POST | `/api/bank/webhook` | AA webhook receiver (HMAC + idempotent) |
| GET | `/api/bank/callback` | Consent redirect landing (validates state) |
| GET | `/api/transactions` | Paginated + searchable txns (filters: date, flow, category, mode, amount range, merchant, source) |
| GET | `/api/transactions/upi` | UPI-only feed |
| GET | `/api/analytics/summary\|spending\|income\|cashflow\|categories\|merchants\|upi` | AI-ready aggregate endpoints |
| GET | `/api/dashboard` | Existing KPI dashboard (now scoped) |

The AI/voice assistant answers against the **same scoped analytics layer** — a
question like *"How much did I spend on UPI this month?"* routes to
`get_upi_analytics` for the signed-in user only.

---

---

## 🌟 Features

- 🎙️ **Multilingual Voice Input (STT)**: Speak naturally in Telugu, Hindi, Indian English, or code-mixed phrases (Hinglish/Tenglish).
- 🗣️ **Text-to-Speech (TTS)**: Listens and speaks back answers in natural Indian accents using Web SpeechSynthesis.
- 🦙 **Local LLM Powered (Ollama)**: Seamlessly connects to local models (recommended: `qwen2.5:7b`, `qwen2.5:3b`, or `llama3.1:8b`) for complete data privacy and zero cloud token fees.
- 🛡️ **Zero-Hallucination Read-Only SQL Engine**: The LLM *never* executes arbitrary or modifying SQL. All answers are generated from strictly validated, parameterised read-only queries against `hisab_financial.db`.
- 🧠 **Multi-Turn Contextual Memory**: Remembers context across questions (e.g. *"What were my sales?"* ➔ *"What about Telangana?"* ➔ *"And Hyderabad?"*).
- 📊 **Visual Mini-Charts & Metric Pills**: Automatically plots bar breakdowns for UPI share, regional sales, and top customers.
- 🏦 **Account Aggregator & UPI Stack**: Live consent-based transaction imports and analytics alongside traditional CSV uploads.
- ⚡ **Zero-Dependency Core**: Runs directly on Node.js v22+ native modules (`node:http`, `node:sqlite`, `node:crypto`) — no external npm dependencies required!

---

## 🗣️ Supported Languages & Sample Prompts

| Language | Script / Style | Sample Query | Meaning |
|---|---|---|---|
| **Telugu** | Romanized / Native | `"Telangana lo ee month total sales entha?"` | "What is this month's total sales in Telangana?" |
| **Telugu** | Romanized / Native | `"Hyderabad lo enni customers unnaru?"` | "How many customers are there in Hyderabad?" |
| **Telugu** | Code-mixed | `"Top customer evaru and entha pay chesaru?"` | "Who is the top customer and how much did they pay?" |
| **Hindi** | Romanized / Native | `"Pichhle mahine ka total sales kitna tha?"` | "What was last month's total sales?" |
| **Hindi** | Hinglish | `"Repeated customers kaun kaun hain?"` | "Who are the recurring customers?" |
| **English** | Indian English | `"Which customer paid the most last month?"` | Identifies top payer by net inflow |
| **English** | Indian English | `"Show UPI transactions breakdown"` | UPI volume, percentage share & chart |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js v22.0.0+** (with native `node:sqlite` enabled)
- Optional but recommended: **[Ollama](https://ollama.com)** for local LLM inference

### 2. Setup
Run the automated environment setup script:
```bash
./scripts/setup.sh
```
This verifies your Node.js runtime, checks the Ollama daemon, and creates your `.env` configuration.

Or configure manually:
```bash
cp .env.example .env
# Review .env - mock mode is OFF by default; set AA_MOCK_MODE=true to opt in
```
Then start the server (`./scripts/start.sh` or `node server.js`), open
http://localhost:8099, **register an account** and use **Connect Bank Account**.
With mock mode on you get realistic DEMO transactions (UPI/NEFT/IMPS/ATM/Salary)
flowing through the exact same pipeline as a real AA connection.

### 2b. AA Sandbox setup (real provider)

To move beyond mock data you need a legitimate FIU onboarding:

1. Create an account on your chosen AA provider (e.g. [Setu Bridge](https://bridge.setu.co))
   and complete their FIU onboarding for **sandbox**.
2. Copy the sandbox credentials into `.env`:
   `AA_CLIENT_ID`, `AA_CLIENT_SECRET`, `AA_PRODUCT_ID`, `AA_FIU_ID`.
3. Set `AA_ENVIRONMENT=sandbox` and `AA_MOCK_MODE=false`.
4. Expose your webhook publicly (e.g. via a tunnel) and set
   `AA_WEBHOOK_URL` + `AA_WEBHOOK_SECRET` (from the provider dashboard) so
   consent updates reach `POST /api/bank/webhook`.
5. Ensure `AA_CALLBACK_URL` is reachable for the consent redirect.

Consent approval then happens in the user's AA app (e.g. Finvu/OneMoney/CAMS);
Hisab never collects bank credentials.

### 2c. Production setup (regulatory reality check)

Going live with real bank data requires:

- An NBFC-AA (Account Aggregator) license held by your **provider** — your
  integration rides on their FIU registration with Sahamati.
- Signed agreements with the AA provider, data-privacy compliance
  (India DPDP Act), and adherence to Sahamati/NCAA AA ecosystem standards.
- HTTPS on all public endpoints, and production credentials issued by the
  provider after their compliance review.

**This codebase is NOT a substitute for those approvals.** Working code in
sandbox does not imply regulatory clearance to operate in production.

### 3. Recommended Ollama Models
To pull the recommended multilingual model:
```bash
ollama pull qwen2.5:7b
# Or a lighter 3B model for lower memory:
ollama pull qwen2.5:3b
```
*(Note: If Ollama is offline or downloading, Hisab automatically falls back to its instant deterministic analysis engine, ensuring 100% uptime and test pass rates!)*

### 4. Start Server
```bash
./scripts/start.sh
# or: node server.js
```
Open your browser at **http://localhost:8099**.

---

## 🧪 Testing

Run the automated test suite covering English, Telugu, Hindi, multi-turn memory, and security constraints:
```bash
./scripts/test-ai.sh
# or: node tests/ai_voice_tests.js
```

You can also run the full test suite including Account Aggregator, Financial analytics and Security:
```bash
node tests/aa_tests.js        # UPI detection, categorization, dedupe, mock AA (25 checks)
node tests/financial_tests.js # CSV analytics engine (9 checks)
node tests/security_tests.js  # auth, IDOR isolation, rate limits, webhooks, consent lifecycle (22 checks)
```

---

## 📡 REST API Reference

### 1. AI Engine Health
`GET /api/ai/health`
```json
{
  "success": true,
  "data": {
    "ollama": true,
    "ollamaHost": "http://localhost:11434",
    "model": "qwen2.5:7b",
    "database": "connected"
  }
}
```

### 2. AI Chat & Voice Query
`POST /api/ai/chat`

**Request Body:**
```json
{
  "query": "Telangana lo ee month total sales entha?",
  "sessionId": "user_session_abc123",
  "languageHint": "auto"
}
```

**Response:**
```json
{
  "success": true,
  "query": "Telangana lo ee month total sales entha?",
  "language": "te",
  "ttsLang": "te-IN",
  "answer": "తెలంగాణ (Telangana) లో మొత్తం సేల్స్: ₹48,000.00.",
  "data": {
    "location": "Telangana",
    "total_sales": 48000,
    "transaction_count": 8
  },
  "chart": {
    "type": "bar",
    "labels": ["Telangana", "Others"],
    "data": [48000, 15000]
  },
  "sessionId": "user_session_abc123",
  "source": "ollama"
}
```

### 3. Reset Conversational Memory
`DELETE /api/ai/chat/:sessionId`

---

## 🔒 Security & Privacy Guarantees

1. **Read-Only Database Connection**: Tools only execute `SELECT` statements with parameter bindings (`?`).
2. **Anti-Hallucination**: Financial numbers are calculated directly by SQLite aggregation functions before being passed to natural language templates or LLM context.
3. **No Raw SQL from Client**: Client text is matched against validated intent patterns; arbitrary SQL strings are sanitized and rejected.
4. **100% Local**: No transaction or financial metadata is sent to third-party APIs. Everything runs on your machine.
5. **Consent-Based Data Access**: Bank transactions are retrieved exclusively through India's Account Aggregator ecosystem. Hisab never asks for bank passwords, UPI PINs, OTPs, or ATM PINs.
6. **Webhook Verification**: Incoming AA webhooks are verified using HMAC-SHA256 signatures before processing.
7. **No Secrets in Frontend**: All provider credentials (AA_CLIENT_SECRET, webhook secrets) remain server-side only.

---

## 🏦 Account Aggregator & UPI Integration

### Architecture

```
         HISAB FRONTEND
              |
      Connect Bank Account
              |
         HISAB BACKEND
              |
    Account Aggregator Service
              |
    +─────────+─────────+
    |                   |
  Setu              Finvu
(Production)     (Stub Ready)
    |                   |
    +─────────+─────────+
              |
       AA Consent Flow
              |
        User's Bank
              |
     Transaction Data
              |
    +─────────+─────────+
    |         |         |
 Normalize   UPI     Categorize
    |      Detect       |
    +─────────+─────────+
              |
           SQLite DB
              |
         Dashboard &
        UPI Analytics
```

### Provider Abstraction

```
providers/
  accountAggregator/
    AccountAggregatorProvider.js   ← Abstract base class
    SetuProvider.js                ← Setu AA Bridge (sandbox + production)
    FinvuProvider.js               ← Finvu AA (architecture-ready stub)
    MockAAProvider.js              ← Development mock with realistic data
```

### Mock Mode (Development)

When `AA_MOCK_MODE=true`, Hisab uses the `MockAAProvider` which:
- Simulates consent creation and approval (instant)
- Returns 16 realistic test transactions (UPI, NEFT, IMPS, ATM, Salary)
- Tags all data as **DEMO DATA** / `BANK_AA_MOCK` source
- Supports 7 Indian banks (HDFC, SBI, ICICI, Axis, Kotak, PNB, BoB)

**To use mock mode:**
1. Set `AA_MOCK_MODE=true` in `.env`
2. Start the server: `npm run dev`
3. Click "Connect Bank Account" in the dashboard
4. Select any bank → "Confirm & Connect"
5. Transactions are immediately imported and analyzed

### Sandbox Setup (Setu)

1. Register at [Setu Bridge](https://bridge.setu.co)
2. Create a product and note your credentials
3. Update `.env`:
   ```env
   AA_MOCK_MODE=false
   AA_PROVIDER=setu
   AA_ENVIRONMENT=sandbox
   AA_CLIENT_ID=your_setu_client_id
   AA_CLIENT_SECRET=your_setu_client_secret
   AA_PRODUCT_ID=your_product_id
   AA_FIU_ID=your_fiu_id
   ```
4. Set callback URLs to your publicly accessible server (use ngrok for local dev)

### Production Setup

> ⚠️ Production access requires legitimate provider onboarding, regulatory compliance (RBI NBFC-AA/FIU registration), and production credentials. The code is architecturally ready but production deployment requires completing the Setu/Finvu onboarding process.

Set `AA_ENVIRONMENT=production` and update credentials with production values.

---

## ⚙️ Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8099` | HTTP server port |
| `AA_PROVIDER` | `setu` | Account Aggregator provider: `setu`, `finvu`, or `mock` |
| `AA_ENVIRONMENT` | `sandbox` | Environment: `sandbox` or `production` |
| `AA_MOCK_MODE` | `false` | Enable mock mode for development (overrides provider) |
| `AA_CLIENT_ID` | *(empty)* | Setu client ID (from Setu Bridge dashboard) |
| `AA_CLIENT_SECRET` | *(empty)* | Setu client secret |
| `AA_PRODUCT_ID` | *(empty)* | Setu product instance ID |
| `AA_FIU_ID` | *(empty)* | FIU registration ID |
| `AA_BASE_URL` | `https://fiu-sandbox.setu.co` | Setu API base URL |
| `AA_CALLBACK_URL` | `http://localhost:8099/api/bank/callback` | OAuth callback URL |
| `AA_WEBHOOK_URL` | `http://localhost:8099/api/bank/webhook` | Webhook notification URL |
| `AA_WEBHOOK_SECRET` | *(empty)* | HMAC secret for webhook signature verification |
| `INITIAL_TRANSACTION_DAYS` | `90` | Days of historical transactions on initial sync |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama LLM server URL |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Ollama model for AI chat |
| `DEFAULT_AI_LANGUAGE` | `auto` | Default AI language: `auto`, `te-IN`, `hi-IN`, `en-IN` |
| `AI_READ_ONLY_MODE` | `true` | Enforce read-only SQL for AI queries |

---

## 📡 Banking & Analytics API Reference

### Bank Account Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/bank/banks` | List supported banks and provider info |
| `POST` | `/api/bank/connect` | Initiate AA consent and register bank account |
| `GET` | `/api/bank/accounts` | List connected bank accounts with stats |
| `GET` | `/api/bank/consents` | List all consent records |
| `POST` | `/api/bank/sync` | Incremental sync of bank transactions |
| `DELETE` | `/api/bank/accounts/:id` | Disconnect bank and purge transactions |
| `POST` | `/api/bank/consents/:id/revoke` | Revoke AA consent |
| `POST` | `/api/bank/webhook` | Receive AA provider webhook notifications |

### Analytics (AI-Ready)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics/upi` | UPI spending/income, top merchants, categories |
| `GET` | `/api/analytics/spending` | Spending aggregation by category, merchant, month |
| `GET` | `/api/analytics/income` | Income aggregation by source, category, month |
| `GET` | `/api/analytics/cashflow` | Net cashflow with daily/weekly/monthly/yearly granularity |
| `GET` | `/api/analytics/categories` | Category breakdown with percentages |
| `GET` | `/api/analytics/merchants` | Merchant analysis (most frequent, highest spend) |

### Data Management

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | CSV upload with auto-column detection |
| `POST` | `/api/audit` | Dry-run normalization quality report |
| `POST` | `/api/import` | Import CSV with confirmed mappings |
| `GET` | `/api/dashboard` | Primary KPIs, trends, customer leaders |
| `GET` | `/api/transactions` | Paginated transaction explorer with filters |
| `GET` | `/api/cash-flow` | Granular cash flow aggregations |
| `GET` | `/api/customers` | Customer analytics directory |
| `GET` | `/api/export` | Export transactions as CSV |

### Query Parameters (Transactions & Analytics)

All analytics endpoints support these optional query parameters:

| Parameter | Description |
|---|---|
| `date_start` | Filter from date (YYYY-MM-DD) |
| `date_end` | Filter to date (YYYY-MM-DD) |
| `flow` | `INFLOW` or `OUTFLOW` |
| `mode` | `UPI`, `NEFT`, `IMPS`, `ATM` |
| `source` | `CSV` or `BANK_AA` |
| `category` | Transaction category name |
| `merchant` | Merchant name (partial match) |
| `amount_min` | Minimum transaction amount |
| `amount_max` | Maximum transaction amount |
| `search` | Free-text search across customer, description, reference, merchant, narration |
| `bank_account_id` | Filter by specific bank account |
| `granularity` | `daily`, `weekly`, `monthly`, `yearly` (cashflow endpoint) |
