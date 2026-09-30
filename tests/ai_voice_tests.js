/**
 * Hisab Multilingual AI & Voice Analyst Automated Test Suite
 * Validates REST APIs, English, Telugu, Hindi, Code-Mixed Queries,
 * Multi-Turn Memory Sessions, and Security/Read-Only Constraints.
 */

const http = require('node:http');
const assert = require('node:assert');
const { startServer } = require('../backend/server.js');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8099';

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  let ownedServer = null;
  try {
    await makeRequest('/api/health');
  } catch {
    console.log('--> Test server not detected. Starting test server...');
    process.env.NODE_ENV = 'test';
    const parsed = new URL(BASE_URL);
    const testPort = parseInt(parsed.port || '8099', 10);
    ownedServer = await startServer(testPort);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('====================================================');
  console.log('HISAB MULTILINGUAL AI & VOICE SUITE TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(`   Error: ${err.message}`);
      if (err.stack) console.error(`   Stack: ${err.stack.split('\n')[1]}`);
      failed++;
    }
  }

  // 1. Health Endpoint
  await test('GET /api/ai/health - Returns AI status & DB health', async () => {
    const res = await makeRequest('/api/ai/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data);
    assert.strictEqual(res.body.data.database, 'connected');
    console.log(`   (Ollama: ${res.body.data.ollama}, Model: ${res.body.data.model})`);
  });

  // 2. Empty Query Validation
  await test('POST /api/ai/chat - Rejects empty query with 400', async () => {
    const res = await makeRequest('/api/ai/chat', 'POST', { query: '   ' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'EMPTY_QUERY');
  });

  // 3. English Query - Top Customer
  await test('POST /api/ai/chat - English: "Which customer paid the most last month?"', async () => {
    const res = await makeRequest('/api/ai/chat', 'POST', {
      query: 'Which customer paid the most last month?'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.answer);
    assert.ok(res.body.language.startsWith('en'));
    assert.strictEqual(res.body.ttsLang, 'en-IN');
    assert.ok(res.body.data.top_customer);
    console.log(`   Answer snippet: "${res.body.answer.slice(0, 75)}..."`);
  });

  // 4. Telugu Query - Location Customer Count
  await test('POST /api/ai/chat - Telugu: "Hyderabad lo enni customers unnaru?"', async () => {
    const res = await makeRequest('/api/ai/chat', 'POST', {
      query: 'Hyderabad lo enni customers unnaru?'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.answer);
    assert.ok(res.body.language.startsWith('te'));
    assert.strictEqual(res.body.ttsLang, 'te-IN');
    assert.ok(res.body.answer.includes('హైదరాబాద్') || res.body.answer.includes('Hyderabad') || res.body.answer.includes('కస్టమర్లు') || res.body.answer.includes('ఖాతాదారులు'));
    console.log(`   Answer snippet: "${res.body.answer.slice(0, 75)}..."`);
  });

  // 5. Telugu Query - Regional Sales
  await test('POST /api/ai/chat - Telugu: "Telangana lo ee month total sales entha?"', async () => {
    const res = await makeRequest('/api/ai/chat', 'POST', {
      query: 'Telangana lo ee month total sales entha?'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.answer);
    assert.ok(res.body.language.startsWith('te'));
    assert.strictEqual(res.body.ttsLang, 'te-IN');
    console.log(`   Answer snippet: "${res.body.answer.slice(0, 75)}..."`);
  });

  // 6. Hindi Query - Total Sales
  await test('POST /api/ai/chat - Hindi: "Pichhle mahine ka total sales kitna tha?"', async () => {
    const res = await makeRequest('/api/ai/chat', 'POST', {
      query: 'Pichhle mahine ka total sales kitna tha?'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.answer);
    assert.ok(res.body.language.startsWith('hi'));
    assert.strictEqual(res.body.ttsLang, 'hi-IN');
    console.log(`   Answer snippet: "${res.body.answer.slice(0, 75)}..."`);
  });

  // 7. Hindi Query - Repeated Customers
  await test('POST /api/ai/chat - Hindi: "Repeated customers kaun kaun hain?"', async () => {
    const res = await makeRequest('/api/ai/chat', 'POST', {
      query: 'Repeated customers kaun kaun hain?'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.answer);
    assert.ok(res.body.language.startsWith('hi'));
    assert.strictEqual(res.body.ttsLang, 'hi-IN');
    console.log(`   Answer snippet: "${res.body.answer.slice(0, 75)}..."`);
  });

  // 8. UPI Analytics & Chart Generation
  await test('POST /api/ai/chat - UPI Analytics returns chart & breakdown', async () => {
    const res = await makeRequest('/api/ai/chat', 'POST', {
      query: 'Show UPI transactions breakdown'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.chart);
    assert.ok(res.body.chart.labels.length > 0);
    console.log(`   Chart labels: ${JSON.stringify(res.body.chart.labels)}`);
  });

  // 9. Multi-Turn Session Memory (Contextual Follow-Up)
  await test('POST /api/ai/chat - Multi-Turn Context Follow-Up', async () => {
    const testSession = 'test_session_' + Date.now();

    // Turn 1
    const res1 = await makeRequest('/api/ai/chat', 'POST', {
      query: 'What were my total sales?',
      sessionId: testSession
    });
    assert.strictEqual(res1.status, 200);
    assert.ok(res1.body.data.sales !== undefined);

    // Turn 2: Follow-up specifying location context without repeating "sales"
    const res2 = await makeRequest('/api/ai/chat', 'POST', {
      query: 'What about Telangana?',
      sessionId: testSession
    });
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.data.location, 'Telangana');

    // Turn 3: Follow-up on another city
    const res3 = await makeRequest('/api/ai/chat', 'POST', {
      query: 'And Hyderabad?',
      sessionId: testSession
    });
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.body.data.location, 'Hyderabad');

    // Clean up session
    const delRes = await makeRequest(`/api/ai/chat/${testSession}`, 'DELETE');
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);
  });

  // 10. Security & Read-Only Invariants
  await test('POST /api/ai/chat - Malicious SQL input does not modify DB', async () => {
    const evilQuery = "'; DROP TABLE transactions; SELECT * FROM datasets; --";
    const res = await makeRequest('/api/ai/chat', 'POST', { query: evilQuery });
    assert.strictEqual(res.status, 200);

    // Check that table still exists and data is intact
    const health = await makeRequest('/api/datasets');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.success, true);
  });

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (ownedServer) {
    ownedServer.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[Fatal Test Runner Error]', err);
  process.exit(1);
});
