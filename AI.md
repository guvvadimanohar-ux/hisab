# Hisab AI Financial Assistant

The Hisab AI Assistant (`backend/services/aiAgent.js`) is a financial reasoning agent that answers business questions using deterministic database tools.

## 1. Architecture: Grounded Tools vs. Hallucination
The AI assistant NEVER invents or fabricates financial figures. Instead, user queries are matched to strictly controlled backend tools that run SQL queries against the authenticated user's shop data:

```text
User Question (Spoken or Typed)
      ↓
Intent Analysis & Entity Extraction
      ↓
Deterministic Backend Financial Tool
      ↓
node:sqlite Database Query (scoped by user_id = ?)
      ↓
Structured Financial Result & KPIs
      ↓
Language-Aligned Response Generator (Ollama / Local Fallback)
      ↓
Answer Text + Chart Data + TTS Audio
```

## 2. Controlled Financial Tools
All tools are defined in `backend/services/aiAgent.js` and enforce multi-user isolation:

| Tool Name | Purpose | Output |
|---|---|---|
| `get_highest_paying_customer` | Identify top payer by total settled amount | Customer name, total spend, transactions count |
| `get_frequent_customers` | Identify customers with repeated orders | Ranked list with transaction counts |
| `get_total_sales` | Total inflow / revenue for period | Total revenue, customer count, period |
| `get_upi_analytics` | UPI share vs. non-UPI and provider breakdown | Total UPI volume, transaction count, top merchants |
| `get_customer_count` | Unique customer count | Customer count, location breakdown |
| `get_loan_summary` | Outstanding udhar and repayment totals | Given, repaid, outstanding, overdue count |
| `get_transactions_by_date` | Recent ledger statement records | Formatted recent transaction rows |
| `get_expense_summary` | Outflow and category breakdown | Outflow totals, top expense categories |

## 3. Multilingual Support
The AI assistant natively detects and answers in regional languages:
- **English**: "Who paid me the most this month?"
- **Telugu**: "ఈ నెల ఎంత UPI payment వచ్చింది?", "Hyderabad lo enni customers unnaru?"
- **Hindi**: "इस महीने कितनी कमाई हुई?", "Repeated customers kaun kaun hain?"
- **Tamil, Kannada, Marathi, Bengali**: Standard translation & transliteration hints.

## 4. Multi-Turn Session Memory
Sessions are preserved in `ai_conversations` and `ai_messages` tables, allowing contextual follow-up questions such as:
- Turn 1: "Who is my highest paying customer?" -> "Garg Kirana Corp (₹1,50,000)"
- Turn 2: "How many times did they pay?" -> "They paid 12 times via UPI QR."
