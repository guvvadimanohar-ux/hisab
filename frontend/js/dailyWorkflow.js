/* Shared, deterministic shop calculations. Amounts are calculated in paise. */
(function(root) {
  const day = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  function money(value) {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e10) throw Error('Enter a valid non-negative amount.');
    return Math.round(Number(value) * 100);
  }
  function cashSummary(transactions, date, opening) {
    let received = 0, paid = 0;
    for (const t of transactions) {
      if ((t.date || t.createdAt || '').slice(0, 10) !== date || (t.payment_method || t.mode || '').toUpperCase() !== 'CASH') continue;
      if (t.transaction_type === 'Credit Given' || t.category === 'Customer Credit') continue;
      if (t.is_duplicate || (t.status && !['Settled','Completed','Success'].includes(t.status))) continue;
      const flow = t.cash_flow_type || t.flow;
      if (['IN','INFLOW'].includes(flow)) received += money(t.amount);
      if (['OUT','OUTFLOW'].includes(flow)) paid += money(t.amount);
    }
    return { received: received / 100, paid: paid / 100, expected: (money(opening) + received - paid) / 100 };
  }
  function actions(credits, transactions, date) {
    const items = credits.filter(c => Number(c.outstanding_amount ?? c.outstandingAmount) > 0 && (c.due_date || c.dueDate) && (c.due_date || c.dueDate) <= date).map(c => ({ kind:'due', name:c.customer_name || c.customerName || 'Customer', amount:Number(c.outstanding_amount ?? c.outstandingAmount), date:c.due_date || c.dueDate, overdue:(c.due_date || c.dueDate) < date }));
    items.sort((a,b) => a.date.localeCompare(b.date));
    const review = transactions.filter(t => t.is_duplicate || !t.category || ['Other','General','Uncategorized'].includes(t.category)).length;
    if (review) items.push({kind:'review', count:review});
    return items;
  }
  function parseEntry(text) {
    const normalized = text.replace(/[०-९]/g,c=>String(c.charCodeAt(0)-2406)).replace(/[౦-౯]/g,c=>String(c.charCodeAt(0)-3174));
    const amounts = normalized.match(/\d[\d,]*(?:\.\d{1,2})?/g) || [];
    if (amounts.length !== 1) throw Error('Use one numeric amount, for example: Paid supplier 2,000 rupees.');
    const amount = Number(amounts[0].replace(/,/g,''));
    if (!amount || !Number.isFinite(amount)) throw Error('Enter an amount greater than zero.');
    const credit = /udhaa?r|udha+a?r|credit|ఉధార్|అప్పు|उधार/i.test(normalized);
    const out = /paid|spent|expense|kharch|చెల్లిం|खर्च|दिया/i.test(normalized);
    if (credit && /paid|repaid|repayment|received/i.test(normalized)) throw Error('For repayments, open the customer’s Udhaar record and choose Record repayment.');
    const incoming = /received|sale|jama|వచ్చి|అమ్మ|मिला|जमा/i.test(normalized);
    if (!credit && (out === incoming)) throw Error('Say received, paid, or udhaar so the entry type is clear.');
    let party = normalized.replace(amounts[0],'').replace(/\b(received|paid|spent|expense|sale|jama|kharch|rupees?|rs|inr|cash|upi|bank|to|from|ki|ko|ku|udhaa?r|udha+a?r|credit)\b/gi,'').replace(/[₹:]/g,'').trim();
    return {type:credit?'credit':'transaction', flow:out?'OUTFLOW':'INFLOW', amount, party, mode:/upi/i.test(normalized)?'UPI':/bank/i.test(normalized)?'BANK':'CASH', description:text};
  }
  const api = { day, money, cashSummary, actions, parseEntry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HisabDaily = api;
})(typeof window !== 'undefined' ? window : globalThis);
