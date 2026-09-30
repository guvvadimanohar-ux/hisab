# Hisab System Architecture

```text
                    HISAB
                      |
        ┌─────────────┴──────────────┐
        |                            |
     FRONTEND                     BACKEND
        |                            |
 Dashboard                       REST / API Layer
 Customers                          |
 Transactions                  Business Services
 Credit / Udhar                     |
 Analytics                      node:sqlite Database
 AI Chat                            |
 Voice Engine                  Integrations & Providers
                                    |
             ┌──────────────────────┼──────────────────────┐
             |                      |                      |
        Payment Gateway       Account Aggregator       Voice Engine
             |                      |                      |
     Receive Payments       Retrieve permitted bank      STT / TTS
     (Mock, Razorpay,        data (Mock, Setu,       (Mock, Cloud,
        Cashfree)                 Finvu)               WebSpeech)
             |                      |                      |
             └──────────────┬───────┴──────────────────────┘
                            |
                       Transaction
                         Engine
                            |
                         Database
                            |
              ┌─────────────┼─────────────┐
              |             |             |
          Dashboard      Analytics        AI Assistant
                                            |
                                          Voice
```

## 1. Architectural Principles
1. **Zero-Trust Multi-Tenancy**: Every request is authenticated using HttpOnly session cookies. Every database query enforces `user_id = ?` scoping at the SQL level to completely prevent Insecure Direct Object References (IDOR).
2. **Common Transaction Engine**: All transaction data from manual entries, CSV statement imports, Account Aggregator bank synchronization, and Payment Gateway receipts enters a single unified ingestion pipeline (`backend/services/transactionEngine.js`).
3. **Provider Abstraction Layers**:
   - Payments: `PaymentGatewayProvider` with `MockPaymentProvider`, `RazorpayProvider`, and `CashfreeProvider`.
   - Account Aggregator: `AccountAggregatorProvider` with `MockAAProvider`, `SetuProvider`, and `FinvuProvider`.
   - Voice: `VoiceProvider` with `MockVoiceProvider` and `CloudVoiceProvider`.
4. **Authoritative Backend Ledger Math**: Calculations for customer balances, credit outstanding (`outstanding = credit - repayment`), UPI totals, and inflows/outflows are always executed on the server or in SQL queries. The frontend never computes nor dictates ledger state.

## 2. Layered Directory Organization
```text
hisabai/
├── frontend/                     # Static UI Assets
│   ├── index.html                # Single-page interface & elevated modal dialogs
│   ├── css/style.css             # Rich styling, themes, and animations
│   ├── js/api.js                 # Centralized typed API client (window.HisabAPI)
│   ├── js/voice.js               # Voice assistant UI, Web Speech API & audio visualizer
│   └── js/app.js                 # Frontend application controller & state
├── backend/                      # Node.js Server & Business Logic
│   ├── server.js                 # HTTP server, routing, security headers & static host
│   ├── api/                      # REST API endpoint handlers
│   │   ├── index.js              # Central API router & dispatcher
│   │   ├── auth.js               # Registration, login, session, logout
│   │   ├── customers.js          # Customer management & lifetime activity
│   │   ├── credit.js             # Udhar issuance, repayments & summaries
│   │   ├── transactions.js       # Transaction CRUD & loan ledger merges
│   │   ├── analytics.js          # KPI summaries, cashflow & UPI breakdown
│   │   ├── payments.js           # Orders, checkout verification, refunds, webhooks
│   │   ├── bank.js               # Account Aggregator bank linking & sync
│   │   ├── ai.js                 # AI chat with scoped financial tools
│   │   ├── voice.js              # Spoken audio transcription & TTS
│   │   ├── upload.js             # CSV statement parser & audit
│   │   └── health.js             # Health probe & DB connectivity
│   ├── services/                 # Core Domain Services
│   │   ├── database.js           # SQLite setup, tables, migrations & indexes
│   │   ├── authService.js        # PBKDF2 hashing & session management
│   │   ├── customerService.js    # Customer data access & stats
│   │   ├── creditService.js      # Credit / Udhar balance calculations
│   │   ├── transactionEngine.js  # Unified ingestion, deduplication & UPI tags
│   │   ├── paymentService.js     # Gateway orchestration & ledger reconciliation
│   │   ├── accountAggregator.js  # AA consent & transaction synchronization
│   │   ├── aiAgent.js            # Financial reasoning agent & deterministic tools
│   │   └── voiceService.js       # STT/TTS coordination & audio pipeline
│   └── providers/                # Pluggable Provider Adapters
│       ├── payments/             # MockPaymentProvider, RazorpayProvider, CashfreeProvider
│       ├── voice/                # MockVoiceProvider, CloudVoiceProvider
│       └── ...
└── tests/                        # Comprehensive automated test suites
```
