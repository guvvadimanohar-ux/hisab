/**
 * Hisab AI - Offline Standalone Engine & Local Storage Database
 * Provides 100% offline functionality with zero server and zero internet.
 * Uses persistent browser/Android storage (localStorage + WebAppInterface).
 */

class OfflineHisabEngine {
  constructor() {
    this.STORAGE_KEY = 'hisab_offline_data_v1';
    this.data = this.loadData();
  }

  loadData() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read localStorage:', e);
    }
    return this.getInitialSeedData();
  }

  saveData() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  getInitialSeedData() {
    return { user: { id: 'OFFLINE-MERCHANT-01', fullName: 'Shop Owner', shopName: 'My Kirana Store', phone: '' }, customers: [], credits: [], transactions: [] };
  }

  getExampleData() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 259200000).toISOString().slice(0, 10);

    return {
      user: {
        id: 'OFFLINE-MERCHANT-01',
        fullName: 'Kirana Store Owner',
        shopName: 'Shri Ganesh Kirana & General Stores',
        phone: '9876543210'
      },
      customers: [
        { id: 'CUST-101', name: 'Ramesh Verma', phone: '9823012345', notes: 'House #4, Main Bazar', createdAt: threeDaysAgo },
        { id: 'CUST-102', name: 'Sita Devi', phone: '9845098765', notes: 'Gali No. 3, Near School', createdAt: threeDaysAgo },
        { id: 'CUST-103', name: 'Rajesh Kumar', phone: '9711223344', notes: 'Shop #12, Market Road', createdAt: twoDaysAgo },
        { id: 'CUST-104', name: 'Suresh Patil', phone: '9900112233', notes: 'Opposite Milk Booth', createdAt: yesterday },
        { id: 'CUST-105', name: 'Anita Sharma', phone: '9877665544', notes: 'Flat 201, Green Apts', createdAt: yesterday }
      ],
      credits: [
        {
          id: 'CRD-201',
          customerId: 'CUST-101',
          customerName: 'Ramesh Verma',
          customerPhone: '9823012345',
          amount: 2500,
          repaidAmount: 500,
          outstandingAmount: 2000,
          status: 'Partially Paid',
          description: 'Aashirvaad Atta 10kg, Fortune Oil 2L',
          dueDate: new Date(Date.now() + 604800000).toISOString().slice(0, 10),
          createdAt: twoDaysAgo
        },
        {
          id: 'CRD-202',
          customerId: 'CUST-102',
          customerName: 'Sita Devi',
          customerPhone: '9845098765',
          amount: 1450,
          repaidAmount: 0,
          outstandingAmount: 1450,
          status: 'Pending',
          description: 'Basmati Rice 5kg, Sugar 2kg, Tea packet',
          dueDate: new Date(Date.now() + 432000000).toISOString().slice(0, 10),
          createdAt: yesterday
        },
        {
          id: 'CRD-203',
          customerId: 'CUST-103',
          customerName: 'Rajesh Kumar',
          customerPhone: '9711223344',
          amount: 850,
          repaidAmount: 0,
          outstandingAmount: 850,
          status: 'Overdue',
          description: 'Detergent powder, Spices, Soap pack',
          dueDate: yesterday,
          createdAt: threeDaysAgo
        },
        {
          id: 'CRD-204',
          customerId: 'CUST-104',
          customerName: 'Suresh Patil',
          customerPhone: '9900112233',
          amount: 1200,
          repaidAmount: 1200,
          outstandingAmount: 0,
          status: 'Paid',
          description: 'Dry fruits & spices',
          dueDate: today,
          createdAt: threeDaysAgo
        }
      ],
      transactions: [
        { id: 'TXN-301', flow: 'IN', amount: 3500, customerName: 'Ramesh Verma', description: 'Counter Daily Sales (Cash & UPI)', mode: 'UPI', category: 'Daily Groceries & Provisions', createdAt: today },
        { id: 'TXN-302', flow: 'IN', amount: 500, customerName: 'Ramesh Verma', description: 'Udhaar Partial Repayment', mode: 'CASH', category: 'Udhaar & Loan Repayments', createdAt: today },
        { id: 'TXN-303', flow: 'OUT', amount: 4500, customerName: 'Metro Cash & Carry', description: 'Wholesale Rice & Grain Sacks Stock', mode: 'BANK_TRANSFER', category: 'Wholesale Stock & Suppliers', createdAt: today },
        { id: 'TXN-304', flow: 'OUT', amount: 280, customerName: 'Chai & Snacks', description: 'Store Tea, Biscuits & Snacks for Staff', mode: 'CASH', category: 'Tea, Snacks & Daily Expenses', createdAt: today },
        { id: 'TXN-305', flow: 'IN', amount: 4800, customerName: 'Counter Sales', description: 'Evening Kirana Provisions Sales', mode: 'CASH', category: 'Daily Groceries & Provisions', createdAt: yesterday },
        { id: 'TXN-306', flow: 'IN', amount: 1200, customerName: 'Suresh Patil', description: 'Udhaar Full Clearance', mode: 'UPI', category: 'Udhaar & Loan Repayments', createdAt: yesterday },
        { id: 'TXN-307', flow: 'OUT', amount: 1250, customerName: 'Electricity Board', description: 'Shop Electricity & Refrigerator Bill', mode: 'UPI', category: 'Electricity & Store Utility Bills', createdAt: yesterday },
        { id: 'TXN-308', flow: 'OUT', amount: 600, customerName: 'Local Tempo Delivery', description: 'Goods Delivery & Tempo Auto Freight', mode: 'CASH', category: 'Tempo, Delivery & Fuel', createdAt: twoDaysAgo },
        { id: 'TXN-309', flow: 'IN', amount: 6200, customerName: 'Counter Sales', description: 'Weekend Store Grocery Sales', mode: 'UPI', category: 'Daily Groceries & Provisions', createdAt: twoDaysAgo },
        { id: 'TXN-310', flow: 'IN', amount: 5100, customerName: 'Counter Sales', description: 'Morning Daily Provisions Sales', mode: 'CASH', category: 'Daily Groceries & Provisions', createdAt: threeDaysAgo },
        { id: 'TXN-311', flow: 'OUT', amount: 3200, customerName: 'Amul Dairy Distributor', description: 'Milk Pouches, Paneer & Butter Crates', mode: 'UPI', category: 'Wholesale Stock & Suppliers', createdAt: threeDaysAgo }
      ]
    };
  }

  // -------------------------------------------------------------------------
  // Auth & Profile
  // -------------------------------------------------------------------------
  getProfile() {
    return { success: true, user: this.data.user };
  }

  // -------------------------------------------------------------------------
  // Dashboard Metrics & Calculations
  // -------------------------------------------------------------------------
  getDashboardMetrics() {
    const txns = this.data.transactions || [];
    let totalInflow = 0;
    let totalOutflow = 0;

    txns.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.flow === 'IN') totalInflow += amt;
      else if (t.flow === 'OUT') totalOutflow += amt;
    });

    const net = totalInflow - totalOutflow;

    // Udhaar summary
    const credits = this.data.credits || [];
    let totalUdhaar = 0;
    let totalRecovered = 0;
    let pendingUdhaar = 0;
    let overdueCount = 0;

    credits.forEach(c => {
      const amt = Number(c.amount) || 0;
      const repaid = Number(c.repaidAmount) || 0;
      const out = Number(c.outstandingAmount) || 0;
      totalUdhaar += amt;
      totalRecovered += repaid;
      pendingUdhaar += out;
      if (c.status === 'Overdue' || (out > 0 && c.dueDate && new Date(c.dueDate) < new Date())) {
        overdueCount++;
      }
    });

    // Repeated customers calculation
    const custMap = {};
    txns.forEach(t => {
      if (t.flow === 'IN' && t.customerName && t.customerName !== 'Counter Sales') {
        custMap[t.customerName] = (custMap[t.customerName] || 0) + 1;
      }
    });
    const repeatedCustomers = Object.keys(custMap).filter(k => custMap[k] >= 2).length;

    // Spending breakdown
    const categoryTotals = {};
    txns.filter(t => t.flow === 'OUT').forEach(t => {
      const cat = t.category || 'Other Store Expenses';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount || 0);
    });

    const spendingCategories = Object.keys(categoryTotals).map(cat => ({
      category: cat,
      amount: categoryTotals[cat],
      count: txns.filter(t => t.flow === 'OUT' && t.category === cat).length
    })).sort((a, b) => b.amount - a.amount);

    // 7-day flow daily trends
    const dailyMap = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      dailyMap[d] = { date: d, jama: 0, udhar: 0 };
    }

    txns.forEach(t => {
      const day = dailyMap[String(t.date || t.createdAt || '').slice(0, 10)];
      if (day && t.flow === 'IN') day.jama += Number(t.amount) || 0;
      if (day && t.flow === 'OUT') day.udhar += Number(t.amount) || 0;
    });
    const dailyFlows = Object.values(dailyMap);
    const activeCustomers = Object.keys(custMap).length;
    const identifiedCustomerInflow = txns.filter(t => t.flow === 'IN' && t.customerName && t.customerName !== 'Counter Sales').reduce((sum,t) => sum + (Number(t.amount) || 0), 0);
    const avgSpend = activeCustomers > 0 ? Math.round(identifiedCustomerInflow / activeCustomers) : 0;
    const repeatRate = activeCustomers > 0 ? (repeatedCustomers / activeCustomers) * 100 : 0;

    const kpis = {
      totalInflow,
      totalOutflow,
      netCashFlow: net,
      transactionCount: txns.length,
      activeCustomers,
      averageCustomerSpend: avgSpend,
      repeatCustomerRate: repeatRate
    };

    const loansSummary = {
      totalLoansGiven: totalUdhaar,
      totalRepaid: totalRecovered,
      totalOutstanding: pendingUdhaar,
      hasLoanData: credits.length > 0,
      activeCount: credits.filter(c => Number(c.outstandingAmount || 0) > 0).length
    };

    const months = {};
    txns.forEach(t => {
      const period = String(t.date || t.createdAt || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(period)) return;
      const month = months[period] ||= { period, inflow: 0, outflow: 0, net: 0 };
      if (t.flow === 'IN') month.inflow += Number(t.amount) || 0;
      if (t.flow === 'OUT') month.outflow += Number(t.amount) || 0;
      month.net = month.inflow - month.outflow;
    });
    const cashflow = Object.values(months).sort((a,b) => a.period.localeCompare(b.period));

    const expenseCategories = spendingCategories.map(cat => ({
      category: cat.category,
      totalAmount: cat.amount,
      percentage: totalOutflow > 0 ? Math.round((cat.amount / totalOutflow) * 1000) / 10 : 0,
      transactionCount: cat.count
    }));

    const topPaying = Object.entries(custMap).map(([name, count]) => {
      const spend = txns.filter(t => t.customerName === name && t.flow === 'IN')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      return { name, totalInflow: spend, transactionCount: count, customer_name: name, total_spent: spend, transaction_count: count };
    }).sort((a, b) => b.total_spent - a.total_spent);

    return {
      success: true,
      data: {
        kpis,
        loansSummary,
        cashflow,
        expenseCategories,
        topCustomers: topPaying.slice(0, 5),
        repeatedCustomers: topPaying.filter(c => c.transaction_count >= 2),
        transactionCount: txns.length,
        summary: {
          totalInflow,
          totalOutflow,
          net,
          totalCustomers: (this.data.customers || []).length,
          repeatedCustomers,
          totalTransactions: txns.length,
          totalUdhaar,
          totalRecovered,
          pendingUdhaar,
          overdueCount
        },
        dailyFlows
      }
    };
  }

  // -------------------------------------------------------------------------
  // Customer CRUD
  // -------------------------------------------------------------------------
  getCustomers() {
    const list = (this.data.customers || []).map(c => {
      // Calculate dynamic udhaar and total transactions for customer
      const custCredits = (this.data.credits || []).filter(cr => cr.customerId === c.id || cr.customerName === c.name);
      const totalUdhaar = custCredits.reduce((sum, cr) => sum + (Number(cr.outstandingAmount) || 0), 0);
      const custTxns = (this.data.transactions || []).filter(t => t.customerName === c.name);
      return {
        ...c,
        outstandingDue: totalUdhaar,
        transactionCount: custTxns.length
      };
    });
    return { success: true, data: list, count: list.length };
  }

  addCustomer({ name, phone, notes }) {
    if (!name || !name.trim()) {
      return { success: false, error: { message: 'Customer name is required' } };
    }
    const newCust = {
      id: 'CUST-' + Date.now().toString().slice(-6),
      name: name.trim(),
      phone: (phone || '').trim(),
      notes: (notes || '').trim(),
      createdAt: new Date().toISOString().slice(0, 10)
    };
    this.data.customers.unshift(newCust);
    this.saveData();
    return { success: true, data: newCust };
  }

  updateCustomer(id, { name, phone, notes }) {
    const cust = this.data.customers.find(c => c.id === id);
    if (!cust) return { success: false, error: { message: 'Customer not found' } };

    if (name) {
      const oldName = cust.name;
      cust.name = name.trim();
      // Update linked credits and transactions
      this.data.credits.forEach(cr => {
        if (cr.customerId === id || cr.customerName === oldName) cr.customerName = cust.name;
      });
      this.data.transactions.forEach(t => {
        if (t.customerName === oldName) t.customerName = cust.name;
      });
    }
    if (phone !== undefined) {
      cust.phone = (phone || '').trim();
      this.data.credits.forEach(cr => {
        if (cr.customerId === id) cr.customerPhone = cust.phone;
      });
    }
    if (notes !== undefined) cust.notes = (notes || '').trim();

    this.saveData();
    return { success: true, data: cust };
  }

  deleteCustomer(id) {
    const idx = this.data.customers.findIndex(c => c.id === id);
    if (idx === -1) return { success: false, error: { message: 'Customer not found' } };
    this.data.customers.splice(idx, 1);
    this.saveData();
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Credit / Udhaar Ledger
  // -------------------------------------------------------------------------
  getCredits() {
    return { success: true, data: this.data.credits || [] };
  }

  getCreditSummary() {
    const credits = this.data.credits || [];
    let totalGiven = 0;
    let totalCollected = 0;
    let pending = 0;
    let overdue = 0;

    credits.forEach(c => {
      totalGiven += Number(c.amount || 0);
      totalCollected += Number(c.repaidAmount || 0);
      pending += Number(c.outstandingAmount || 0);
      if (c.status === 'Overdue') overdue++;
    });

    return {
      success: true,
      data: {
        totalGiven,
        totalCollected,
        pendingBalance: pending,
        activeBorrowers: credits.filter(c => Number(c.outstandingAmount || 0) > 0).length,
        overdueCount: overdue
      }
    };
  }

  issueCredit({ customerId, amount, description, dueDate, overrideLimit = false }) {
    const cust = this.data.customers.find(c => c.id === customerId);
    const numAmt = Number(amount);
    if (!cust || !numAmt || numAmt <= 0) {
      return { success: false, error: { message: 'Invalid customer or credit amount' } };
    }

    const limit = this.data.shopTools?.limits?.[customerId];
    const due = this.data.credits.filter(entry => entry.customerId === customerId).reduce((sum, entry) => sum + Number(entry.outstandingAmount || 0), 0);
    if (limit != null && Math.round((due + numAmt) * 100) > Math.round(limit * 100) && overrideLimit !== true) {
      return { success: false, error: { message: 'Credit limit exceeded. Review and approve an owner override.' } };
    }

    const newCredit = {
      id: 'CRD-' + Date.now().toString().slice(-6),
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone || '',
      amount: numAmt,
      repaidAmount: 0,
      outstandingAmount: numAmt,
      status: 'Pending',
      description: (description || 'Items on Credit').trim(),
      dueDate: dueDate || new Date(Date.now() + 604800000).toISOString().slice(0, 10),
      createdAt: new Date().toISOString().slice(0, 10)
    };

    this.data.credits.unshift(newCredit);

    // Also record transaction
    this.data.transactions.unshift({
      id: 'TXN-' + Date.now().toString().slice(-6),
      flow: 'OUT',
      amount: numAmt,
      customerName: cust.name,
      description: `Udhaar Issued: ${newCredit.description}`,
      mode: 'UDHAAR',
      category: 'Udhaar Given to Customers',
      createdAt: new Date().toISOString().slice(0, 10)
    });

    this.saveData();
    return { success: true, data: newCredit };
  }

  recordRepayment({ creditId, amount, mode }) {
    const cr = this.data.credits.find(c => c.id === creditId);
    const numAmt = Number(amount);
    if (!cr || !numAmt || numAmt <= 0) {
      return { success: false, error: { message: 'Invalid credit record or amount' } };
    }

    const outstanding = Number(cr.outstandingAmount || 0);
    const payAmt = Math.min(numAmt, outstanding);
    cr.repaidAmount = (Number(cr.repaidAmount) || 0) + payAmt;
    cr.outstandingAmount = Math.max(0, outstanding - payAmt);

    if (cr.outstandingAmount === 0) {
      cr.status = 'Paid';
    } else {
      cr.status = 'Partially Paid';
    }

    // Add Jama transaction
    this.data.transactions.unshift({
      id: 'TXN-' + Date.now().toString().slice(-6),
      flow: 'IN',
      amount: payAmt,
      customerName: cr.customerName,
      description: `Udhaar Repayment (${cr.status})`,
      mode: mode || 'CASH',
      category: 'Udhaar & Loan Repayments',
      createdAt: new Date().toISOString().slice(0, 10)
    });

    this.saveData();
    return { success: true, data: cr };
  }

  updateCreditStatus(id, { status, dueDate, description }) {
    const cr = this.data.credits.find(c => c.id === id);
    if (!cr) return { success: false, error: { message: 'Udhaar record not found' } };

    if (status) {
      cr.status = status;
      if (status === 'Paid') {
        cr.repaidAmount = cr.amount;
        cr.outstandingAmount = 0;
      }
    }
    if (dueDate) cr.dueDate = dueDate;
    if (description !== undefined) cr.description = description;

    this.saveData();
    return { success: true, data: cr };
  }

  deleteCredit(id) {
    const idx = this.data.credits.findIndex(c => c.id === id);
    if (idx === -1) return { success: false, error: { message: 'Credit record not found' } };
    this.data.credits.splice(idx, 1);
    this.saveData();
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Transaction Engine
  // -------------------------------------------------------------------------
  getTransactions(params = {}) {
    let list = [...(this.data.transactions || [])];

    if (params.flow && params.flow !== 'ALL') {
      list = list.filter(t => t.flow === params.flow);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(t =>
        (t.customerName || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      data: list,
      total: list.length
    };
  }

  addTransaction({ flow, amount, customerName, description, mode }) {
    flow = flow === 'OUTFLOW' ? 'OUT' : flow === 'INFLOW' ? 'IN' : flow;
    const numAmt = Number(amount);
    if (!numAmt || numAmt <= 0) {
      return { success: false, error: { message: 'Invalid transaction amount' } };
    }

    let category = 'Daily Groceries & Provisions';
    if (flow === 'OUT') {
      const descLower = (description || '').toLowerCase();
      if (descLower.includes('wholesale') || descLower.includes('supplier') || descLower.includes('atta') || descLower.includes('oil')) {
        category = 'Wholesale Stock & Suppliers';
      } else if (descLower.includes('tea') || descLower.includes('snack') || descLower.includes('chai') || descLower.includes('coffee')) {
        category = 'Tea, Snacks & Daily Expenses';
      } else if (descLower.includes('current') || descLower.includes('electric') || descLower.includes('bill') || descLower.includes('recharge')) {
        category = 'Electricity & Store Utility Bills';
      } else if (descLower.includes('tempo') || descLower.includes('auto') || descLower.includes('delivery') || descLower.includes('freight')) {
        category = 'Tempo, Delivery & Fuel';
      } else {
        category = 'Store Supplies & Packaging';
      }
    }

    const newTxn = {
      id: 'TXN-' + Date.now().toString().slice(-6),
      flow: flow || 'IN',
      amount: numAmt,
      customerName: (customerName || 'Counter Sale').trim(),
      description: (description || (flow === 'IN' ? 'Provisions Sale' : 'Store Expense')).trim(),
      mode: mode || 'CASH',
      category,
      createdAt: window.HisabDaily ? window.HisabDaily.day() : new Date().toISOString().slice(0, 10)
    };

    this.data.transactions.unshift(newTxn);

    // If customer name was provided and doesn't exist, create customer
    if (customerName && customerName !== 'Counter Sale') {
      const exists = this.data.customers.some(c => c.name.toLowerCase() === customerName.toLowerCase());
      if (!exists) {
        this.data.customers.unshift({
          id: 'CUST-' + Date.now().toString().slice(-6),
          name: customerName.trim(),
          phone: '',
          notes: 'Added from transaction',
          createdAt: new Date().toISOString().slice(0, 10)
        });
      }
    }

    this.saveData();
    return { success: true, data: newTxn };
  }

  // -------------------------------------------------------------------------
  // Offline CSV Bank & UPI Statement Ingestion
  // -------------------------------------------------------------------------
  parseAndImportCSV(csvText) {
    if (!csvText || !csvText.trim()) {
      return { success: false, error: { message: 'CSV content is empty' } };
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      return { success: false, error: { message: 'CSV has no data rows' } };
    }

    const header = lines[0].toLowerCase();
    const rows = lines.slice(1);
    let imported = 0;

    rows.forEach((row, i) => {
      const parts = row.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) return;

      // Extract amount
      let amt = 0;
      let flow = 'IN';
      let desc = 'Imported Statement Entry';
      let party = 'Bank / UPI Customer';

      // Try finding amount in columns
      for (const part of parts) {
        const cleaned = part.replace(/[₹$,\s]/g, '');
        const val = parseFloat(cleaned);
        if (!isNaN(val) && val > 0 && amt === 0) {
          amt = val;
        }
      }

      // Check credit / debit keyword
      const rowLower = row.toLowerCase();
      if (rowLower.includes('dr') || rowLower.includes('debit') || rowLower.includes('withdrawal') || rowLower.includes('paid to')) {
        flow = 'OUT';
      } else if (rowLower.includes('cr') || rowLower.includes('credit') || rowLower.includes('deposit') || rowLower.includes('received from')) {
        flow = 'IN';
      }

      if (parts[1]) desc = parts[1];
      if (parts[2] && parts[2].length > 3) party = parts[2];

      if (amt > 0) {
        this.data.transactions.unshift({
          id: 'CSV-TXN-' + (Date.now() + i),
          flow,
          amount: amt,
          customerName: party,
          description: desc,
          mode: 'UPI',
          category: flow === 'IN' ? 'Daily Groceries & Provisions' : 'Wholesale Stock & Suppliers',
          createdAt: new Date().toISOString().slice(0, 10)
        });
        imported++;
      }
    });

    this.saveData();
    return { success: true, count: imported, message: `Successfully imported ${imported} statement transactions offline!` };
  }

  // -------------------------------------------------------------------------
  // Offline Smart Store Assistant
  // -------------------------------------------------------------------------
  answerAssistantQuery(query) {
    if(window.HisabTools){const C=window.HisabTools;const answer=C.answer({...C.empty(),...(this.data.shopTools||{})},this.data.credits,this.data.transactions,this.data.customers,query);if(answer)return {success:true,answer,language:'en-IN',source:'offline_shop_tools'};}

    const q = (query || '').toLowerCase();
    const summary = this.getDashboardMetrics().data.summary;
    const language = window.hisabI18n?.language || 'en';
    const say = (en, hi, te) => ({en,hi,te}[language] || en);
    const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
    const result = answer => ({answer, evidence: say('Records in this browser','इस ब्राउज़र के रिकॉर्ड','ఈ బ్రౌజర్ రికార్డులు')});
    if (!this.data.transactions.length && !this.data.credits.length) return result(say('Your ledger is empty. Add a transaction or import a statement to get answers from your records.','आपका खाता खाली है। उत्तर पाने के लिए लेन-देन जोड़ें या स्टेटमेंट आयात करें।','మీ ఖాతా ఖాళీగా ఉంది. జవాబుల కోసం లావాదేవీ జోడించండి లేదా స్టేట్‌మెంట్ దిగుమతి చేయండి.'));
    const weekly = /this week|ఈ వారం|इस सप्ताह|is hafte/.test(q);
    const today = /today|ఈ రోజు|आज|aaj/.test(q);
    const start = new Date(); start.setHours(0,0,0,0);
    if (weekly) start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const txns = this.data.transactions.filter(t => !weekly && !today || (new Date(t.date || t.createdAt) >= start && new Date(t.date || t.createdAt) <= new Date()));
    const period = weekly ? say('this week (Monday to today)','इस सप्ताह (सोमवार से आज)','ఈ వారం (సోమవారం నుంచి ఈరోజు)') : today ? say('today','आज','ఈరోజు') : say('across all saved records','सभी सहेजे रिकॉर्ड में','అన్ని భద్రపరిచిన రికార్డుల్లో');
    if (/udhaar|udhar|debt|owes|pending|उधार|बकाया|అరువు|బాకీ/.test(q)) {
      const names = [...new Set(this.data.credits.filter(c => Number(c.outstandingAmount) > 0).map(c=>c.customerName))].join(', ');
      return result(say(`Outstanding credit: ${money(summary.pendingUdhaar)}. Customers: ${names || 'None'}.`,`बकाया उधार: ${money(summary.pendingUdhaar)}। ग्राहक: ${names || 'कोई नहीं'}।`,`బాకీ అరువు: ${money(summary.pendingUdhaar)}. వినియోగదారులు: ${names || 'ఎవరూ లేరు'}.`));
    }
    if (/repeat|regular|नियमित|दोबारा|మళ్లీ|తరచూ/.test(q)) {
      const counts = {};
      txns.filter(t=>t.flow==='IN' && t.customerName).forEach(t=>{ counts[t.customerName]=(counts[t.customerName]||0)+1; });
      const names = Object.keys(counts).filter(name=>counts[name]>1);
      return result(say(`Repeat customers ${period}: ${names.join(', ') || 'None'}.`,`${period} नियमित ग्राहक: ${names.join(', ') || 'कोई नहीं'}।`,`${period} తరచూ కొనేవారు: ${names.join(', ') || 'ఎవరూ లేరు'}.`));
    }
    if (/highest|most|top customer|सबसे|అత్యధిక|ఎక్కువ/.test(q)) {
      const totals = {};
      txns.filter(t=>t.flow==='IN' && t.customerName).forEach(t=>{ totals[t.customerName]=(totals[t.customerName]||0)+Number(t.amount||0); });
      const top = Object.entries(totals).sort((a,b)=>b[1]-a[1])[0];
      if (!top) return result(say('No received payments in this period.','इस अवधि में कोई भुगतान नहीं मिला।','ఈ వ్యవధిలో చెల్లింపులు అందలేదు.'));
      return result(say(`Top paying customer ${period}: ${top[0]} — ${money(top[1])}.`,`${period} सबसे अधिक भुगतान: ${top[0]} — ${money(top[1])}।`,`${period} అత్యధిక చెల్లింపుదారు: ${top[0]} — ${money(top[1])}.`));
    }
    const incoming = txns.filter(t=>t.flow==='IN').reduce((s,t)=>s+Number(t.amount||0),0);
    const outgoing = txns.filter(t=>t.flow==='OUT').reduce((s,t)=>s+Number(t.amount||0),0);
    if (/average|औसत|సగటు/.test(q)) {
      const count = txns.filter(t=>t.flow==='OUT').length;
      return result(say(`Average expense per outgoing transaction ${period}: ${money(count ? outgoing/count : 0)}.`,`${period} प्रति खर्च लेन-देन का औसत: ${money(count ? outgoing/count : 0)}।`,`${period} ప్రతి ఖర్చు లావాదేవీ సగటు: ${money(count ? outgoing/count : 0)}.`));
    }
    if (/sales|jama|inflow|income|receive|जमा|मिला|मिली|बिक्री|వచ్చి|అమ్మక|జమ/.test(q)) return result(say(`Money received ${period}: ${money(incoming)}.`,`${period} प्राप्त राशि: ${money(incoming)}।`,`${period} వచ్చిన డబ్బు: ${money(incoming)}.`));
    if (/spend|spent|expense|खर्च|ఖర్చు/.test(q)) return result(say(`Money spent ${period}: ${money(outgoing)}.`,`${period} खर्च: ${money(outgoing)}।`,`${period} ఖర్చు: ${money(outgoing)}.`));
    return result(say('I can answer questions about received money, expenses, repeat customers, and outstanding credit from this browser’s records.','मैं इस ब्राउज़र के रिकॉर्ड से जमा, खर्च, नियमित ग्राहकों और बकाया उधार के बारे में बता सकता हूँ।','ఈ బ్రౌజర్ రికార్డుల నుంచి జమ, ఖర్చులు, తరచూ కొనేవారు, బాకీ అరువు గురించి చెప్పగలను.'));
  }
}

// Instantiate offline engine
window.offlineHisabEngine = new OfflineHisabEngine();
