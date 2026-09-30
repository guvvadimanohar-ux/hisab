# Hisab Database Architecture & Schema

Hisab uses a zero-dependency, persistent SQLite database powered by Node.js 22+'s built-in `node:sqlite` (`DatabaseSync`).

The database is initialized and managed by `backend/services/database.js`.

## 1. Tables Overview

| Table Name | Primary Purpose | Key Indexes |
|------------|-----------------|-------------|
| `users` | Authenticated merchants and shop owners | `id`, `phone`, `email` |
| `shops` | Store details linked to owners | `id`, `owner_id` |
| `auth_sessions` | Cryptographic session tokens with expiration | `token_hash`, `user_id` |
| `customers` | Customers and parties registered with shop | `id`, `user_id`, `phone`, `name` |
| `transactions` | Central financial transaction ledger | `user_id`, `date`, `cash_flow_type`, `customer_name`, `mode`, `source` |
| `credits` | Credit / Uddera / Aruvu facilities granted | `id`, `user_id`, `customer_id`, `status` |
| `payments` | Customer repayment records and receipts | `id`, `user_id`, `customer_id`, `credit_id` |
| `payment_orders`| Online payment gateway orders & states | `id`, `user_id`, `customer_id`, `gateway_order_id` |
| `bank_accounts`| Bank accounts connected via Account Aggregator | `id`, `user_id`, `account_reference` |
| `consents` | RBI Account Aggregator consent records | `id`, `user_id`, `consent_reference` |
| `sync_jobs` | Incremental bank transaction sync logs | `id`, `user_id`, `bank_account_id` |
| `datasets` | Uploaded CSV bank statements & audit files | `id`, `user_id`, `uploaded_at` |
| `webhook_events`| Processed webhooks for replay prevention | `id`, `provider` |
| `ai_conversations`| User AI assistant multi-turn sessions | `id`, `user_id` |
| `ai_messages` | Conversation query and answer turns | `id`, `conversation_id` |

## 2. Table Definitions

### `users`
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `customers`
```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `credits` (Udhar / Credit Facility)
```sql
CREATE TABLE credits (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  outstanding_amount REAL NOT NULL,
  status TEXT DEFAULT 'Pending', -- 'Pending', 'Partially Paid', 'Paid', 'Overdue'
  issued_at TEXT NOT NULL,
  due_date TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
```

### `payments` (Repayments & Receipts)
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_id TEXT,
  credit_id TEXT,
  transaction_id TEXT,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  mode TEXT NOT NULL,          -- 'UPI', 'CASH', 'BANK_TRANSFER', 'CARD', 'GATEWAY'
  reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `transactions` (Common Transaction Engine)
```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  dataset_id TEXT,
  user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  date TEXT NOT NULL,
  time TEXT,
  amount REAL NOT NULL,
  cash_flow_type TEXT NOT NULL, -- 'INFLOW' (Jama) or 'OUTFLOW' (Kharcha)
  transaction_type TEXT NOT NULL,
  mode TEXT,
  payment_method TEXT,
  category TEXT,
  subcategory TEXT,
  reference_number TEXT,
  narration TEXT,
  merchant TEXT,
  source TEXT DEFAULT 'MANUAL',  -- 'MANUAL', 'CSV', 'ACCOUNT_AGGREGATOR', 'PAYMENT_GATEWAY'
  loan_id TEXT,
  bank_account_id TEXT,
  provider_transaction_id TEXT,
  is_upi INTEGER DEFAULT 0,
  upi_id TEXT,
  status TEXT DEFAULT 'Settled',
  balance REAL DEFAULT 0,
  is_duplicate INTEGER DEFAULT 0,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `payment_orders`
```sql
CREATE TABLE payment_orders (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_id TEXT,
  credit_id TEXT,
  gateway TEXT NOT NULL,
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'CREATED', -- 'CREATED', 'PAID', 'FAILED', 'CANCELLED'
  purpose TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 3. Data Integrity & Migration Strategy
- Automatic Column Migration: On server initialization, table schemas are inspected using `PRAGMA table_info`. Missing columns are added cleanly using `ALTER TABLE ADD COLUMN` without dropping data.
- Deduplication Constraints: Composite checks on `(user_id, source, provider_transaction_id)` or SHA-256 fallback hashes prevent double-counting across CSV re-uploads, bank syncs, and webhook retries.
