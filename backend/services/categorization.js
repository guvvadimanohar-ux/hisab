/**
 * Hisab Financial Categorization Engine
 * Classifies transactions into standard merchant categories based on keywords,
 * narration analysis, and cash flow direction.
 */

const CATEGORY_RULES = [
  // 1. Food & Dining
  {
    category: 'Food & Dining',
    keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'dhaba', 'bakery', 'pizza', 'burger', 'mcdonald', 'kfc', 'starbucks', 'chai', 'tea stall']
  },
  // 2. Groceries
  {
    category: 'Groceries',
    keywords: ['kirana', 'blinkit', 'zepto', 'bigbasket', 'dmart', 'd-mart', 'spencer', 'supermarket', 'provisions', 'atta', 'oil', 'flour', 'grains', 'dairy', 'milk', 'amul', 'mother dairy']
  },
  // 3. Shopping & Retail
  {
    category: 'Shopping',
    keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'retail', 'cloth', 'textile', 'boutique', 'garment', 'fashion', 'electronics', 'croma', 'reliance digital']
  },
  // 4. Transport & Cabs
  {
    category: 'Transport',
    keywords: ['uber', 'ola', 'rapido', 'metro', 'irctc', 'railway', 'bus', 'flight', 'indigo', 'air india', 'makemytrip', 'redbus', 'toll', 'fastag']
  },
  // 5. Fuel
  {
    category: 'Fuel',
    keywords: ['petrol', 'diesel', 'cng', 'fuel', 'iocl', 'indian oil', 'bpcl', 'bharat petroleum', 'hpcl', 'hindustan petroleum', 'shell petrol']
  },
  // 6. Bills & Utilities
  {
    category: 'Bills & Utilities',
    keywords: ['electricity', 'power', 'bses', 'tatapower', 'bescom', 'water bill', 'airtel', 'jio', 'vodafone', 'vi bill', 'broadband', 'gas bill', 'indane', 'bharatgas', 'hp gas', 'piped gas']
  },
  // 7. Rent
  {
    category: 'Rent',
    keywords: ['rent', 'house rent', 'shop rent', 'landlord', 'monthly lease', 'office rent', 'maintenance']
  },
  // 8. Healthcare & Medical
  {
    category: 'Healthcare',
    keywords: ['pharmacy', 'chemist', 'hospital', 'clinic', 'doctor', 'apollo', 'medplus', '1mg', 'pharmeasy', 'pathology', 'lab', 'medical store']
  },
  // 9. Entertainment & Subscriptions
  {
    category: 'Entertainment',
    keywords: ['netflix', 'spotify', 'hotstar', 'prime video', 'youtube', 'apple', 'google play', 'pvr', 'inox', 'cinema', 'movie']
  },
  // 10. Cash Withdrawal
  {
    category: 'Cash Withdrawal',
    keywords: ['atm', 'cash-wdl', 'cash withdrawal', 'self withdrawal', 'atm wdl']
  },
  // 11. Loans & EMI
  {
    category: 'Loan & EMI',
    keywords: ['loan', 'emi', 'repay', 'repayment', 'bajaj finance', 'hdb financial', 'chola', 'muthoot', 'home credit', 'credit card payment', 'credit bill']
  },
  // 12. Investments & Savings
  {
    category: 'Investment',
    keywords: ['mutual fund', 'zerodha', 'groww', 'upstox', 'sip', 'fd', 'fixed deposit', 'recurring deposit', 'gold', 'shares', 'equity']
  },
  // 13. Salary (Credits only)
  {
    category: 'Salary',
    isIncomeOnly: true,
    keywords: ['salary', 'payroll', 'wages', 'sal/']
  },
  // 14. Business Income
  {
    category: 'Business Income',
    isIncomeOnly: true,
    keywords: ['pos settlement', 'merchant settlement', 'qr collection', 'customer payment', 'trade receipt', 'inward remittance', 'sales receipt']
  }
];

/**
 * Categorizes a transaction based on narration, merchant name, and cash flow type.
 * @param {Object} txn { narration, merchant, flow, amount }
 * @returns {string} Category name
 */
function categorizeTransaction(txn = {}) {
  const text = `${txn.merchant || ''} ${txn.narration || ''} ${txn.description || ''}`.toLowerCase();
  const isIncome = (txn.flow || '').toUpperCase() === 'INFLOW' || (txn.type || '').toUpperCase() === 'CREDIT';

  // Check specific income rules first if credit
  if (isIncome) {
    if (text.includes('salary') || text.includes('payroll')) {
      return 'Salary';
    }
    if (text.includes('settlement') || text.includes('payment received') || text.includes('sales')) {
      return 'Business Income';
    }
    if (text.includes('loan repayment') || (text.includes('repay') && text.includes('loan'))) {
      return 'Loan & EMI';
    }
  }

  // Iterate rule set
  for (const rule of CATEGORY_RULES) {
    if (rule.isIncomeOnly && !isIncome) continue;
    const match = rule.keywords.some(kw => text.includes(kw));
    if (match) {
      return rule.category;
    }
  }

  // Fallbacks based on flow
  if (isIncome) {
    return 'Customer Receipts';
  }
  return 'General Expenses';
}

module.exports = {
  categorizeTransaction,
  CATEGORY_RULES
};
