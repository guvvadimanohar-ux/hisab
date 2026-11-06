# Hisab Account Aggregator Integration Guide

Hisab implements the Reserve Bank of India (RBI) Account Aggregator (AA) framework to retrieve permitted financial transaction data with user consent.

## 1. Distinction: Payment Gateway vs. Account Aggregator

It is vital to understand the difference between these two systems:
- **Payment Gateway**: Used to *receive payments* from a customer to the shopkeeper (Money Inflow via UPI, Card, or Netbanking).
- **Account Aggregator**: Used to *retrieve bank statements and transaction history* for financial analytics from the shopkeeper's permitted bank accounts. No money is moved.

## 2. Architecture & Provider Abstraction
```text
AccountAggregatorService (backend/services/accountAggregator.js)
        |
        |--- MockAAProvider (Local sandbox simulation with realistic data)
        |
        |--- SetuProvider (Production/Sandbox Setu FIU Bridge API)
        |
        |--- FinvuProvider (Finvu AA FIU API adapter)
```

Configuration in `.env`:
```bash
AA_PROVIDER=setu         # setu | finvu
AA_ENVIRONMENT=sandbox   # sandbox | production
AA_MOCK_MODE=false       # Set true only when intentionally using demo data
```

## 3. Consent-Based Data Flow
```text
Shopkeeper
   ↓
1. Link Bank Account (HDFC, SBI, ICICI, Axis, Kotak, PNB, BOB)
   ↓
2. POST /api/bank/connect (Specifies purpose, duration, data types)
   ↓
3. Provider initiates Consent Request with RBI AA ecosystem
   ↓
4. Shopkeeper approves consent on their mobile device or AA app
   ↓
5. Webhook / Callback updates consent record to ACTIVE
   ↓
6. Initial Sync pulls permitted statement (past 90 days)
   ↓
7. Multi-signal UPI detection extracts VPA, merchant name, and handles
   ↓
8. SHA-256 / txnId invariant signature deduplication skips duplicates
   ↓
9. Ingestion into transactions table
   ↓
10. Dynamic cash flow and UPI analytics update immediately
```

## 4. Multi-Signal UPI Detection Engine
The normalizer inspects:
- `mode` field for `UPI`, `UPI/P2M`, `UPI/P2P`.
- Narration prefixes: `UPI/`, `UPI-`, `UPI/DR/`, `UPI/CR/`.
- VPA handles: `@okhdfcbank`, `@okicici`, `@okaxis`, `@paytm`, `@ybl`, `@axl`, `@ibl`.
- Extracts clean merchant names and tags rows with `is_upi = 1` and `upi_id`.

## 5. Security & Privacy Safeguards
- Hisab **never** stores or requests banking credentials, ATM PINs, UPI PINs, or OTPs.
- Shopkeepers can revoke consent at any time via `DELETE /api/bank/accounts/:id`.
- In `AA_MOCK_MODE=true`, mock accounts and transactions are clearly flagged with `isDemo: true` and `source: 'BANK_AA_MOCK'`.
