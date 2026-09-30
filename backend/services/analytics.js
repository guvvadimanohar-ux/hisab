/**
 * Hisab Financial Analytics & Normalization Services
 * Modular, deterministic, AI-ready calculation engine.
 */

// =========================================================================
// 1. Column Detection & Mapping Dictionary
// =========================================================================

const COLUMN_SYNONYMS = {
  date: ['date', 'txn_date', 'transaction_date', 'datetime', 'trans_date', 'value_date', 'posting_date', 'timestamp', 'time'],
  time: ['time', 'txn_time', 'transaction_time'],
  transaction_id: ['transaction_id', 'txn_id', 'txnid', 'reference', 'ref', 'ref_no', 'utr', 'order_id', 'id', 'cheque_no', 'chq_no'],
  customer_name: ['customer', 'customer_name', 'customer_party', 'payer', 'party', 'party_name', 'merchant', 'beneficiary', 'client', 'name', 'account_name'],
  description: ['description', 'narration', 'particulars', 'remarks', 'details', 'memo', 'note'],
  amount: ['amount', 'txn_amount', 'transaction_amount', 'value', 'total', 'net_amount', 'sum'],
  debit: ['debit', 'dr', 'withdrawal', 'outflow', 'paid_out', 'debit_amount'],
  credit: ['credit', 'cr', 'deposit', 'inflow', 'paid_in', 'credit_amount'],
  cash_flow_type: ['cash_flow', 'flow', 'flow_type', 'direction', 'cash_flow_type'],
  transaction_type: ['type', 'transaction_type', 'txn_type', 'dr_cr', 'entry_type'],
  payment_method: ['payment_method', 'payment_rail', 'method', 'mode', 'channel', 'provider', 'gateway', 'rail', 'instrument'],
  category: ['category', 'txn_category', 'tag', 'purpose', 'head', 'account_type'],
  balance: ['balance', 'running_balance', 'closing_balance', 'account_balance'],
  loan_id: ['loan_id', 'loan_no', 'loan_ref', 'facility_id'],
  loan_amount: ['loan_amount', 'disbursed_amount', 'principal_amount', 'sanctioned_amount'],
  repayment_amount: ['repayment_amount', 'repaid_amount', 'emi_amount', 'installment_amount'],
  status: ['status', 'state', 'settlement_status', 'txn_status']
};

/**
 * Auto-detect column mappings from raw CSV headers
 * Prioritizes exact matches, then substring matches.
 * @param {string[]} headers 
 * @returns {Object} detected mappings { standardField: rawHeader }
 */
function detectColumnMappings(headers) {
  const cleanHeaders = headers.map(h => (h || '').trim());
  const detected = {};
  const usedHeaders = new Set();

  // First pass: exact matches
  for (const [field, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    for (const header of cleanHeaders) {
      if (usedHeaders.has(header)) continue;
      const lower = header.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const matches = synonyms.some(syn => lower === syn);
      if (matches) {
        detected[field] = header;
        usedHeaders.add(header);
        break;
      }
    }
  }

  // Second pass: substring matches
  for (const [field, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    if (detected[field]) continue;
    for (const header of cleanHeaders) {
      if (usedHeaders.has(header)) continue;
      const lower = header.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const matches = synonyms.some(syn => lower.includes(syn));
      if (matches) {
        detected[field] = header;
        usedHeaders.add(header);
        break;
      }
    }
  }

  // Fallback check for amount: If no unified amount, check for debit/credit
  if (!detected.amount && (detected.debit || detected.credit)) {
    detected._split_debit_credit = true;
  }

  return detected;
}

// =========================================================================
// 2. CSV Parser (RFC-4180 Compliant with Quote Handling)
// =========================================================================

function parseCsvString(csvText) {
  if (!csvText || typeof csvText !== 'string') return { headers: [], rows: [] };

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  function parseLine(line) {
    const cells = [];
    let inQuotes = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cell.trim().replace(/^["']|["']$/g, ''));
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim().replace(/^["']|["']$/g, ''));
    return cells;
  }

  const rawHeaders = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.length > 0 && cells.some(c => c !== '')) {
      const rowObj = {};
      rawHeaders.forEach((h, idx) => {
        rowObj[h] = cells[idx] || '';
      });
      rows.push(rowObj);
    }
  }

  return { headers: rawHeaders, rows };
}

// =========================================================================
// 3. Data Cleaning & Normalization Engine
// =========================================================================

function cleanNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).replace(/₹|,|\s|\$/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function cleanDate(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  const str = String(val).trim();

  // Try ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try parsing with Date constructor
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Normalizes an array of raw rows using mapping specifications
 * Returns cleaned transactions, duplicate tracker, and data quality metrics.
 */
function normalizeTransactions(rawRows, mapping, datasetId = 'DS-1', sourceFile = 'import.csv') {
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  let missingCustomerCount = 0;
  let missingDateCount = 0;
  let missingAmountCount = 0;

  const seenSignatures = new Set();
  const normalized = [];

  rawRows.forEach((row, index) => {
    // 1. Customer Name
    let customerName = (row[mapping.customer_name] || '').trim();
    if (!customerName) {
      missingCustomerCount++;
      customerName = `Unspecified Party #${index + 1}`;
    }

    // 2. Date
    const rawDate = row[mapping.date];
    if (!rawDate) missingDateCount++;
    const date = cleanDate(rawDate);

    // 3. Time
    const time = (row[mapping.time] || '12:00:00').trim();

    // 4. Amount & Cash Flow Direction
    let amount = 0;
    let cashFlowType = 'INFLOW';
    let transactionType = 'PAYMENT';

    const debitVal = cleanNumber(row[mapping.debit]);
    const creditVal = cleanNumber(row[mapping.credit]);
    const directAmount = cleanNumber(row[mapping.amount]);

    if (debitVal !== null && debitVal > 0) {
      amount = debitVal;
      cashFlowType = 'OUTFLOW';
      transactionType = 'EXPENSE';
    } else if (creditVal !== null && creditVal > 0) {
      amount = creditVal;
      cashFlowType = 'INFLOW';
      transactionType = 'RECEIPT';
    } else if (directAmount !== null) {
      amount = Math.abs(directAmount);
      // Direction detection from type or signed amount
      const rawType = String(row[mapping.transaction_type] || '').toLowerCase();
      if (directAmount < 0 || rawType.includes('out') || rawType.includes('debit') || rawType.includes('payout') || rawType.includes('dr') || rawType.includes('expense') || rawType.includes('given')) {
        cashFlowType = 'OUTFLOW';
        transactionType = rawType.includes('loan') ? 'LOAN_GIVEN' : 'EXPENSE';
      } else {
        cashFlowType = 'INFLOW';
        transactionType = rawType.includes('repay') ? 'LOAN_REPAYMENT' : 'PAYMENT';
      }
    } else {
      missingAmountCount++;
      invalidRows++;
      return; // Skip records with no determinable monetary value
    }

    // Explicit Type Overrides
    const explicitType = String(row[mapping.transaction_type] || '').toUpperCase();
    if (explicitType.includes('LOAN') && (explicitType.includes('GIVEN') || explicitType.includes('DISBURS'))) {
      transactionType = 'LOAN_GIVEN';
      cashFlowType = 'OUTFLOW';
    } else if (explicitType.includes('LOAN') && explicitType.includes('RECEIV')) {
      transactionType = 'LOAN_RECEIVED';
      cashFlowType = 'INFLOW';
    } else if (explicitType.includes('REPAY')) {
      transactionType = 'LOAN_REPAYMENT';
      cashFlowType = 'INFLOW';
    }

    // 5. Loan Identification
    let loanId = (row[mapping.loan_id] || '').trim();
    const cleanLoanAmt = cleanNumber(row[mapping.loan_amount]);
    const cleanRepayAmt = cleanNumber(row[mapping.repayment_amount]);

    if (!loanId && (transactionType.startsWith('LOAN') || cleanLoanAmt || cleanRepayAmt)) {
      loanId = `LN-${customerName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-1`;
    }

    // 6. Reference / Transaction ID
    const txnId = (row[mapping.transaction_id] || `TXN-${datasetId}-${index + 1}`).trim();
    const referenceNumber = (row[mapping.reference_number] || txnId).trim();
    const description = (row[mapping.description] || `${transactionType} via ${customerName}`).trim();
    const paymentMethod = (row[mapping.payment_method] || 'Bank / Gateway').trim();
    const category = (row[mapping.category] || (transactionType.startsWith('LOAN') ? 'Loan Ledger' : 'Commercial Trade')).trim();
    const status = (row[mapping.status] || 'Settled').trim();
    const balance = cleanNumber(row[mapping.balance]) || 0;

    // 7. Duplicate Detection Signature (date + amount + customerName + referenceNumber)
    const signature = `${date}|${amount.toFixed(2)}|${customerName.toLowerCase()}|${referenceNumber.toLowerCase()}`;
    let isDup = false;
    if (seenSignatures.has(signature)) {
      duplicateRows++;
      isDup = true;
    } else {
      seenSignatures.add(signature);
    }

    validRows++;

    normalized.push({
      id: `TXN-${datasetId}-${index + 1}`,
      dataset_id: datasetId,
      date,
      time,
      customer_id: `CUST-${customerName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`,
      customer_name: customerName,
      description,
      amount,
      transaction_type: transactionType,
      cash_flow_type: cashFlowType,
      payment_method: paymentMethod,
      category,
      reference_number: referenceNumber,
      loan_id: loanId || null,
      status,
      balance,
      source_file: sourceFile,
      is_duplicate: isDup,
      created_at: new Date().toISOString()
    });
  });

  const qualityReport = {
    total_rows: rawRows.length,
    totalScanned: rawRows.length,
    valid_rows: validRows,
    validRows: validRows,
    invalid_rows: invalidRows,
    invalidRows: invalidRows,
    duplicate_rows: duplicateRows,
    duplicatesDetected: duplicateRows,
    missing_customer_count: missingCustomerCount,
    missingCustomers: missingCustomerCount,
    missing_date_count: missingDateCount,
    missingDates: missingDateCount,
    missing_amount_count: missingAmountCount,
    missingAmounts: missingAmountCount,
    accuracy_rate: rawRows.length > 0 ? (((validRows - duplicateRows) / rawRows.length) * 100).toFixed(1) : '100.0',
    accuracyScore: rawRows.length > 0 ? (((validRows - duplicateRows) / rawRows.length) * 100).toFixed(1) : '100.0'
  };

  return { normalized, qualityReport };
}

// =========================================================================
// 4. Financial Calculations & Analytics Engine
// =========================================================================

/**
 * Calculates primary financial KPIs
 */
function calculateDashboardKPIs(transactions) {
  let totalInflow = 0;
  let totalOutflow = 0;
  const customerMap = {};
  const loanMap = {};

  transactions.forEach(t => {
    const amt = t.amount || 0;
    if (t.cash_flow_type === 'INFLOW') {
      totalInflow += amt;
    } else {
      totalOutflow += amt;
    }

    // Customer aggregation
    const cName = t.customer_name;
    if (!customerMap[cName]) {
      customerMap[cName] = { name: cName, count: 0, inflow: 0, outflow: 0, totalAmount: 0 };
    }
    customerMap[cName].count += 1;
    if (t.cash_flow_type === 'INFLOW') {
      customerMap[cName].inflow += amt;
    } else {
      customerMap[cName].outflow += amt;
    }
    customerMap[cName].totalAmount += amt;

    // Loan aggregation
    if (t.loan_id) {
      if (!loanMap[t.loan_id]) {
        loanMap[t.loan_id] = {
          loanId: t.loan_id,
          customer: cName,
          given: 0,
          received: 0,
          repaid: 0
        };
      }
      if (t.transaction_type === 'LOAN_GIVEN') {
        loanMap[t.loan_id].given += amt;
      } else if (t.transaction_type === 'LOAN_RECEIVED') {
        loanMap[t.loan_id].received += amt;
      } else if (t.transaction_type === 'LOAN_REPAYMENT') {
        loanMap[t.loan_id].repaid += amt;
      }
    }
  });

  const netCashFlow = totalInflow - totalOutflow;
  const uniqueCustomersCount = Object.keys(customerMap).length;
  const repeatedCustomers = Object.values(customerMap).filter(c => c.count > 1);

  // Highest paying customer (Highest cumulative inflow)
  let highestPaidCustomer = { name: 'None', amount: 0 };
  for (const c of Object.values(customerMap)) {
    if (c.inflow > highestPaidCustomer.amount) {
      highestPaidCustomer = { name: c.name, amount: c.inflow };
    }
  }
  // Fallback to highest total volume if no positive inflow
  if (highestPaidCustomer.amount === 0 && uniqueCustomersCount > 0) {
    const sorted = Object.values(customerMap).sort((a, b) => b.totalAmount - a.totalAmount);
    if (sorted[0]) highestPaidCustomer = { name: sorted[0].name, amount: sorted[0].totalAmount };
  }

  // Outstanding loan calculations
  let totalOutstandingLoans = 0;
  for (const l of Object.values(loanMap)) {
    const balance = Math.max(0, (l.given || l.received) - l.repaid);
    totalOutstandingLoans += balance;
  }

  return {
    totalInflow,
    totalOutflow,
    netCashFlow,
    totalTransactions: transactions.length,
    uniqueCustomersCount,
    uniqueCustomers: uniqueCustomersCount,
    repeatedCustomersCount: repeatedCustomers.length,
    repeatedCustomers: repeatedCustomers.length,
    highestPaidCustomerName: highestPaidCustomer.name,
    highestPaidCustomerAmount: highestPaidCustomer.amount,
    highestPaidCustomer: { name: highestPaidCustomer.name, totalInflow: highestPaidCustomer.amount },
    outstandingLoans: totalOutstandingLoans,
    totalOutstandingLoans: totalOutstandingLoans,
    hasLoanData: Object.keys(loanMap).length > 0,
    inflowCount: transactions.filter(t => t.cash_flow_type === 'INFLOW').length,
    outflowCount: transactions.filter(t => t.cash_flow_type === 'OUTFLOW').length
  };
}

/**
 * Calculates Cash Flow aggregations across periods
 */
function calculateCashFlowTrends(transactions, granularity = 'monthly') {
  const periodMap = {};

  transactions.forEach(t => {
    const dateStr = t.date || '2026-09-01';
    let key = dateStr.slice(0, 7); // Default monthly: YYYY-MM

    if (granularity === 'daily') {
      key = dateStr; // YYYY-MM-DD
    } else if (granularity === 'weekly') {
      const d = new Date(dateStr);
      const weekNum = Math.ceil((d.getDate() - 1) / 7) + 1;
      key = `${dateStr.slice(0, 7)} W${weekNum}`;
    } else if (granularity === 'yearly') {
      key = dateStr.slice(0, 4);
    }

    if (!periodMap[key]) {
      periodMap[key] = { period: key, inflow: 0, outflow: 0, net: 0, count: 0 };
    }

    const amt = t.amount || 0;
    if (t.cash_flow_type === 'INFLOW') {
      periodMap[key].inflow += amt;
    } else {
      periodMap[key].outflow += amt;
    }
    periodMap[key].count += 1;
    periodMap[key].net = periodMap[key].inflow - periodMap[key].outflow;
  });

  const sortedPeriods = Object.values(periodMap).sort((a, b) => a.period.localeCompare(b.period));

  // Find largest inflow and outflow
  let largestInflow = { amount: 0, customer: 'None', date: '-' };
  let largestOutflow = { amount: 0, customer: 'None', date: '-' };
  let totalInflowAmt = 0;
  let totalOutflowAmt = 0;
  let inflowCount = 0;
  let outflowCount = 0;

  transactions.forEach(t => {
    const amt = t.amount || 0;
    if (t.cash_flow_type === 'INFLOW') {
      totalInflowAmt += amt;
      inflowCount++;
      if (amt > largestInflow.amount) {
        largestInflow = { amount: amt, customer: t.customer_name, date: t.date, ref: t.reference_number };
      }
    } else {
      totalOutflowAmt += amt;
      outflowCount++;
      if (amt > largestOutflow.amount) {
        largestOutflow = { amount: amt, customer: t.customer_name, date: t.date, ref: t.reference_number };
      }
    }
  });

  const averageTransaction = transactions.length > 0
    ? (totalInflowAmt + totalOutflowAmt) / transactions.length
    : 0;

  return {
    periods: sortedPeriods,
    largestInflow,
    largestOutflow,
    inflowCount,
    outflowCount,
    averageTransaction
  };
}

/**
 * Calculates Customer Analytics & Lifetime Activity
 */
function calculateCustomerAnalytics(transactions) {
  const customerMap = {};

  transactions.forEach(t => {
    const name = t.customer_name;
    const amt = t.amount || 0;

    if (!customerMap[name]) {
      customerMap[name] = {
        name,
        customerId: t.customer_id,
        totalTransactions: 0,
        totalInflow: 0,
        totalOutflow: 0,
        netContribution: 0,
        largestTransaction: 0,
        firstTransactionDate: t.date,
        lastTransactionDate: t.date,
        preferredMethod: t.payment_method,
        methods: {},
        transactions: []
      };
    }

    const c = customerMap[name];
    c.totalTransactions += 1;
    if (t.cash_flow_type === 'INFLOW') {
      c.totalInflow += amt;
    } else {
      c.totalOutflow += amt;
    }
    c.netContribution = c.totalInflow - c.totalOutflow;
    if (amt > c.largestTransaction) c.largestTransaction = amt;

    if (t.date < c.firstTransactionDate) c.firstTransactionDate = t.date;
    if (t.date > c.lastTransactionDate) c.lastTransactionDate = t.date;

    c.methods[t.payment_method] = (c.methods[t.payment_method] || 0) + 1;
    c.transactions.push(t);
  });

  const customers = Object.values(customerMap).map(c => {
    let maxMethod = 'Bank';
    let maxCount = 0;
    for (const [m, count] of Object.entries(c.methods)) {
      if (count > maxCount) {
        maxCount = count;
        maxMethod = m;
      }
    }

    const averageTransaction = c.totalTransactions > 0
      ? (c.totalInflow + c.totalOutflow) / c.totalTransactions
      : 0;

    return {
      ...c,
      preferredMethod: maxMethod,
      averageTransaction,
      isRepeatCustomer: c.totalTransactions > 1
    };
  });

  const topPayingCustomers = [...customers].sort((a, b) => b.totalInflow - a.totalInflow);
  const mostFrequentCustomers = [...customers].sort((a, b) => b.totalTransactions - a.totalTransactions);
  const repeatedCustomers = customers.filter(c => c.isRepeatCustomer);

  return {
    allCustomers: customers,
    topPayingCustomers,
    mostFrequentCustomers,
    repeatedCustomers
  };
}

/**
 * Calculates Loan Management & Outstanding Balances
 */
function calculateLoanAnalytics(transactions) {
  const loanMap = {};

  transactions.forEach(t => {
    if (!t.loan_id) return;

    const lid = t.loan_id;
    if (!loanMap[lid]) {
      loanMap[lid] = {
        loanId: lid,
        customer: t.customer_name,
        startDate: t.date,
        originalAmount: 0,
        totalRepaid: 0,
        outstandingAmount: 0,
        lastPaymentDate: t.date,
        status: 'ACTIVE',
        repayments: []
      };
    }

    const l = loanMap[lid];
    const amt = t.amount || 0;

    if (t.transaction_type === 'LOAN_GIVEN' || t.transaction_type === 'LOAN_RECEIVED') {
      l.originalAmount += amt;
      if (t.date < l.startDate) l.startDate = t.date;
    } else if (t.transaction_type === 'LOAN_REPAYMENT' || (t.cash_flow_type === 'INFLOW' && t.description.toLowerCase().includes('repay'))) {
      l.totalRepaid += amt;
      if (t.date > l.lastPaymentDate) l.lastPaymentDate = t.date;
      l.repayments.push({
        date: t.date,
        amount: amt,
        reference: t.reference_number
      });
    }
  });

  const loans = Object.values(loanMap).map(l => {
    l.outstandingAmount = Math.max(0, l.originalAmount - l.totalRepaid);

    if (l.originalAmount > 0 && l.outstandingAmount === 0) {
      l.status = 'PAID';
    } else if (l.totalRepaid > 0 && l.outstandingAmount > 0) {
      l.status = 'PARTIALLY_PAID';
    } else {
      l.status = 'ACTIVE';
    }

    l.loan_id = l.loanId;
    l.customer_name = l.customer;
    l.sanction_date = l.startDate;
    l.principal = l.originalAmount;
    l.repaid = l.totalRepaid;
    l.outstanding = l.outstandingAmount;
    l.last_payment_date = l.lastPaymentDate;

    return l;
  });

  const totalLoansGiven = loans.reduce((acc, l) => acc + l.originalAmount, 0);
  const totalRepaid = loans.reduce((acc, l) => acc + l.totalRepaid, 0);
  const totalOutstanding = loans.reduce((acc, l) => acc + l.outstandingAmount, 0);

  return {
    loans,
    totalLoansGiven,
    totalRepaid,
    totalOutstanding,
    hasLoanData: loans.length > 0
  };
}

/**
 * Generates natural-language executive financial findings
 */
function generateFinancialInsights(kpi, cashflow, customers, loans) {
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const insights = [];

  insights.push(`Total cash inflow reached ${fmt(kpi.totalInflow)}, with total disbursements of ${fmt(kpi.totalOutflow)}, delivering a net cash position of ${fmt(kpi.netCashFlow)}.`);

  if (customers.topPayingCustomers.length > 0 && customers.topPayingCustomers[0].totalInflow > 0) {
    const top = customers.topPayingCustomers[0];
    insights.push(`Highest-paying counterparty is ${top.name} with ${fmt(top.totalInflow)} across ${top.totalTransactions} transactions.`);
  }

  if (customers.mostFrequentCustomers.length > 0) {
    const freq = customers.mostFrequentCustomers[0];
    insights.push(`Most active customer is ${freq.name} with ${freq.totalTransactions} recorded transactions.`);
  }

  if (customers.repeatedCustomers.length > 0) {
    insights.push(`${customers.repeatedCustomers.length} repeat customers identified (${((customers.repeatedCustomers.length / (kpi.uniqueCustomersCount || 1)) * 100).toFixed(1)}% repeat transaction rate).`);
  }

  if (cashflow.largestInflow && cashflow.largestInflow.amount > 0) {
    insights.push(`Largest single incoming settlement was ${fmt(cashflow.largestInflow.amount)} on ${cashflow.largestInflow.date} from ${cashflow.largestInflow.customer}.`);
  }

  if (loans.hasLoanData) {
    insights.push(`Active loan portfolio contains ${fmt(loans.totalOutstanding)} in outstanding balances across ${loans.loans.length} recorded credit lines.`);
  }

  return insights;
}

// Export for Node.js or Browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    COLUMN_SYNONYMS,
    detectColumnMappings,
    parseCsvString,
    cleanNumber,
    cleanDate,
    normalizeTransactions,
    calculateDashboardKPIs,
    calculateCashFlowTrends,
    calculateCustomerAnalytics,
    calculateLoanAnalytics,
    generateFinancialInsights
  };
}
