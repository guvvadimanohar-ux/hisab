/**
 * Hisab UPI Detection & Extraction Engine
 * Multi-signal detection analyzing transaction mode, VPA handles, UTRs, and narration patterns.
 */

const UPI_HANDLES = [
  '@okhdfcbank', '@okaxis', '@oksbi', '@okicici', '@paytm', '@ybl',
  '@apl', '@axl', '@ibl', '@federal', '@barodampay', '@airtel',
  '@icici', '@sbi', '@hdfcbank', '@kotak', '@axisbank', '@postbank'
];

const KNOWN_UPI_MERCHANTS = [
  { match: /SWIGGY/i, cleanName: 'Swiggy', category: 'Food & Dining' },
  { match: /ZOMATO/i, cleanName: 'Zomato', category: 'Food & Dining' },
  { match: /BLINKIT/i, cleanName: 'Blinkit', category: 'Groceries' },
  { match: /ZEPTO/i, cleanName: 'Zepto', category: 'Groceries' },
  { match: /BIGBASKET/i, cleanName: 'BigBasket', category: 'Groceries' },
  { match: /AMAZON/i, cleanName: 'Amazon Pay', category: 'Shopping' },
  { match: /FLIPKART/i, cleanName: 'Flipkart', category: 'Shopping' },
  { match: /UBER/i, cleanName: 'Uber Rides', category: 'Transport' },
  { match: /OLA/i, cleanName: 'Ola Cabs', category: 'Transport' },
  { match: /RAPIDO/i, cleanName: 'Rapido', category: 'Transport' },
  { match: /NETFLIX/i, cleanName: 'Netflix', category: 'Entertainment' },
  { match: /SPOTIFY/i, cleanName: 'Spotify', category: 'Entertainment' },
  { match: /AIRTEL/i, cleanName: 'Airtel Broadband/Mobile', category: 'Bills & Utilities' },
  { match: /JIO/i, cleanName: 'Reliance Jio', category: 'Bills & Utilities' },
  { match: /BSES/i, cleanName: 'BSES Yamuna Power', category: 'Bills & Utilities' },
  { match: /INDIAN OIL|IOCL/i, cleanName: 'Indian Oil Petrol', category: 'Fuel' },
  { match: /BHARAT PETROLEUM|BPCL/i, cleanName: 'Bharat Petroleum', category: 'Fuel' },
  { match: /HINDUSTAN PETROLEUM|HPCL/i, cleanName: 'HPCL Petrol', category: 'Fuel' },
  { match: /APOLLO PHARMACY/i, cleanName: 'Apollo Pharmacy', category: 'Healthcare' }
];

/**
 * Detects whether a transaction is a UPI transaction based on multiple signals.
 * @param {Object} rawTxn { mode, narration, reference }
 * @returns {boolean}
 */
function isUpiTransaction(rawTxn = {}) {
  const mode = String(rawTxn.mode || '').trim().toUpperCase();
  if (mode === 'UPI') return true;

  const narration = String(rawTxn.narration || rawTxn.description || '').toUpperCase();
  if (narration.startsWith('UPI/') || narration.startsWith('UPI-') || narration.includes('/UPI/') || narration.includes('REV-UPI')) {
    return true;
  }

  // Check VPA handles
  const lowerNarration = narration.toLowerCase();
  const hasVpa = UPI_HANDLES.some(h => lowerNarration.includes(h));
  if (hasVpa) return true;

  const ref = String(rawTxn.reference || '').toUpperCase();
  if (ref.startsWith('UPI')) return true;

  return false;
}

/**
 * Extracts clean merchant or counterparty name and VPA from narration.
 * @param {string} narration
 * @returns {Object} { merchantName, vpa, upiRef, txnType }
 */
function extractUpiDetails(narration = '') {
  if (!narration || typeof narration !== 'string') {
    return { merchantName: 'Unknown Party', vpa: '', upiRef: '', txnType: 'P2P' };
  }

  // Check known merchants first
  for (const km of KNOWN_UPI_MERCHANTS) {
    if (km.match.test(narration)) {
      // Try extract VPA
      const vpaMatch = narration.match(/([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)/);
      const vpa = vpaMatch ? vpaMatch[1] : '';
      return {
        isUpi: true,
        merchantName: km.cleanName,
        suggestedCategory: km.category,
        vpa,
        upiRef: extractUpiRef(narration),
        txnType: 'P2M'
      };
    }
  }

  // Parse standard Indian UPI narration format: UPI/<REF_NO>/<PARTY_NAME>/<VPA>/<NOTE>
  const parts = narration.split('/');
  if (parts.length >= 4 && parts[0].toUpperCase().includes('UPI')) {
    const upiRef = parts[1]?.trim() || '';
    let partyName = parts[2]?.trim() || '';
    const vpaCandidate = parts[3]?.trim() || '';

    // Clean up party name
    partyName = cleanPartyName(partyName);

    const hasVpa = UPI_HANDLES.some(h => vpaCandidate.toLowerCase().includes(h));
    return {
      merchantName: partyName || (hasVpa ? vpaCandidate.split('@')[0] : 'UPI Payer'),
      vpa: hasVpa ? vpaCandidate : '',
      upiRef,
      txnType: hasVpa && (vpaCandidate.includes('merchant') || vpaCandidate.includes('pay')) ? 'P2M' : 'P2P'
    };
  }

  // Fallback VPA match
  const vpaMatch = narration.match(/([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)/);
  if (vpaMatch) {
    const vpa = vpaMatch[1];
    const rawName = vpa.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim();
    return {
      merchantName: cleanPartyName(rawName) || 'UPI Transfer',
      vpa,
      upiRef: extractUpiRef(narration),
      txnType: 'P2P'
    };
  }

  return {
    merchantName: cleanPartyName(narration.slice(0, 30)) || 'UPI Transaction',
    vpa: '',
    upiRef: extractUpiRef(narration),
    txnType: 'P2P'
  };
}

function extractUpiRef(narration = '') {
  const match = narration.match(/UPI\/([0-9]{10,18})/i) || narration.match(/([0-9]{12})/);
  return match ? match[1] : '';
}

function cleanPartyName(name = '') {
  return name
    .replace(/^(MR|MRS|MS|M\/S)\s+/i, '')
    .replace(/[0-9]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

module.exports = {
  isUpiTransaction,
  extractUpiDetails,
  KNOWN_UPI_MERCHANTS
};
