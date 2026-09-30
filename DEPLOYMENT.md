# Hisab Deployment Guide

## 1. Prerequisites
- **Node.js**: Version 22.0.0 or higher (for built-in `node:sqlite`).
- **Disk**: 500 MB minimum (includes SQLite database storage).
- **RAM**: 512 MB minimum (1 GB+ recommended if running local Ollama).

## 2. Environment Setup
1. Clone the repository into your deployment environment.
2. Copy the template:
   ```bash
   cp .env.example .env
   ```
3. Generate a strong authentication secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Add to `.env` as `AUTH_SECRET=...`.

## 3. Database Initialization & Seeding
To initialize the database schema and populate realistic demonstration data:
```bash
npm run seed
```
This sets up:
- Test merchant credentials: `9876543210` / `DemoPass123!`
- Initial shop: `Garg Kirana & General Store`
- Registered customers with transaction history
- Active credits, repayments, and multi-rail payment transactions

## 4. Running the Application

### Development Mode (with Live Reload / Testing)
```bash
npm run dev
# or
node backend/server.js
```
The server will start on `http://localhost:8099`.

### Running All Automated Tests
```bash
npm test
```
Executes all 7 test suites:
1. `aa_tests.js`: Account Aggregator & UPI Detection
2. `financial_tests.js`: Math, Inflow/Outflow & Deduplication
3. `security_tests.js`: Password hashing, multi-user isolation, IDOR, and webhooks
4. `customer_credit_tests.js`: Customer CRUD, Udhar issuance, repayments, and balance math
5. `payment_gateway_tests.js`: Gateway orders, signatures, HMAC webhooks, and reconciliation
6. `voice_tests.js`: Speech-to-text, regional language detection, and TTS WAV synthesis
7. `ai_voice_tests.js`: Multilingual financial query processing and chart generation

### Production Mode (via Process Manager / PM2)
```bash
npm install -g pm2
pm2 start backend/server.js --name hisab
pm2 save
pm2 startup
```

## 5. Reverse Proxy Configuration (Nginx)
```nginx
server {
    listen 80;
    server_name hisab.yourstore.in;

    location / {
        proxy_pass http://127.0.0.1:8099;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 6. Health Check Endpoint
Hisab exposes a public health probe:
```bash
curl http://localhost:8099/api/health
```
Returns:
```json
{
  "status": "HEALTHY",
  "version": "2.4.1",
  "database": "CONNECTED",
  "timestamp": "2026-09-26T20:45:00.000Z"
}
```
