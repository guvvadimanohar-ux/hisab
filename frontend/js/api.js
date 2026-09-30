/**
 * Hisab Centralized Frontend API Client
 * Modular, typed interface for all backend REST endpoints.
 * Provides unified request handling, credentials, CSRF, and error normalization.
 */

(function (window) {
  'use strict';

  class ApiError extends Error {
    constructor(message, code, status, details = {}) {
      super(message);
      this.name = 'ApiError';
      this.code = code || 'API_ERROR';
      this.status = status || 500;
      this.details = details;
    }
  }

  async function request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${window.location.origin}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };

    const config = {
      method: options.method || 'GET',
      headers,
      credentials: 'same-origin',
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (networkErr) {
      throw new ApiError('Unable to connect to Hisab server. Please check your connection.', 'NETWORK_ERROR', 0);
    }

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      const text = await response.text();
      data = { raw: text };
    }

    if (!response.ok) {
      const code = data?.error?.code || `HTTP_${response.status}`;
      const message = data?.error?.message || data?.message || response.statusText || 'Request failed';
      throw new ApiError(message, code, response.status, data);
    }

    return data;
  }

  // -------------------------------------------------------------------------
  // Modular API Domains
  // -------------------------------------------------------------------------

  const auth = {
    async register(userData) {
      return request('/api/auth/register', { method: 'POST', body: userData });
    },
    async login(identifier, password) {
      return request('/api/auth/login', { method: 'POST', body: { identifier, password } });
    },
    async logout() {
      return request('/api/auth/logout', { method: 'POST' });
    },
    async me() {
      return request('/api/auth/me');
    }
  };

  const customers = {
    async list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/api/customers${query ? `?${query}` : ''}`);
    },
    async get(id) {
      return request(`/api/customers/${encodeURIComponent(id)}`);
    },
    async create(customerData) {
      return request('/api/customers', { method: 'POST', body: customerData });
    },
    async update(id, customerData) {
      return request(`/api/customers/${encodeURIComponent(id)}`, { method: 'PUT', body: customerData });
    },
    async delete(id) {
      return request(`/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
  };

  const transactions = {
    async list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/api/transactions${query ? `?${query}` : ''}`);
    },
    async get(id) {
      return request(`/api/transactions/${encodeURIComponent(id)}`);
    },
    async create(txnData) {
      return request('/api/transactions', { method: 'POST', body: txnData });
    },
    async update(id, txnData) {
      return request(`/api/transactions/${encodeURIComponent(id)}`, { method: 'PUT', body: txnData });
    },
    async delete(id) {
      return request(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async exportCsv(params = {}) {
      const query = new URLSearchParams(params).toString();
      window.location.href = `/api/export${query ? `?${query}` : ''}`;
    }
  };

  const credit = {
    async list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/api/credit${query ? `?${query}` : ''}`);
    },
    async summary() {
      return request('/api/credit/summary');
    },
    async issue(creditData) {
      return request('/api/credit', { method: 'POST', body: creditData });
    },
    async repay(repaymentData) {
      return request('/api/credit/repay', { method: 'POST', body: repaymentData });
    },
    async getCustomerCredits(customerId) {
      return request(`/api/credit/customer/${encodeURIComponent(customerId)}`);
    }
  };

  const analytics = {
    async dashboard(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/api/dashboard${query ? `?${query}` : ''}`);
    },
    async cashflow(granularity = 'monthly', params = {}) {
      const query = new URLSearchParams({ granularity, ...params }).toString();
      return request(`/api/cash-flow?${query}`);
    },
    async upi() {
      return request('/api/analytics/upi');
    },
    async dimension(dim, params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/api/analytics/${encodeURIComponent(dim)}${query ? `?${query}` : ''}`);
    }
  };

  const payments = {
    async getConfig() {
      return request('/api/payments/config');
    },
    async createOrder(orderData) {
      return request('/api/payments/create-order', { method: 'POST', body: orderData });
    },
    async verify(paymentData) {
      return request('/api/payments/verify', { method: 'POST', body: paymentData });
    },
    async listOrders(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/api/payments/orders${query ? `?${query}` : ''}`);
    },
    async getOrder(id) {
      return request(`/api/payments/orders/${encodeURIComponent(id)}`);
    }
  };

  const bankAccounts = {
    async list() {
      return request('/api/bank/accounts');
    },
    async get(id) {
      return request(`/api/bank/accounts/${encodeURIComponent(id)}`);
    },
    async connect(connectData) {
      return request('/api/bank/connect', { method: 'POST', body: connectData });
    },
    async sync(accountId = null) {
      return request('/api/bank/sync', { method: 'POST', body: { accountId } });
    },
    async disconnect(id) {
      return request(`/api/bank/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async getSupportedBanks() {
      return request('/api/bank/banks');
    }
  };

  const ai = {
    async health() {
      return request('/api/ai/health');
    },
    async chat(query, options = {}) {
      return request('/api/ai/chat', { method: 'POST', body: { query, ...options } });
    },
    async clearSession(sessionId) {
      return request(`/api/ai/chat/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    }
  };

  const voice = {
    async transcribe(audioData, options = {}) {
      return request('/api/voice/transcribe', { method: 'POST', body: { audioData, ...options } });
    },
    async query(queryText, options = {}) {
      return request('/api/voice/query', { method: 'POST', body: { query: queryText, ...options } });
    },
    async speak(text, options = {}) {
      return request('/api/voice/speak', { method: 'POST', body: { text, ...options } });
    }
  };

  const upload = {
    async upload(csvText) {
      return request('/api/upload', { method: 'POST', body: { csvText } });
    },
    async audit(csvText, mapping, datasetName) {
      return request('/api/audit', { method: 'POST', body: { csvText, mapping, datasetName } });
    },
    async importCsv(csvText, mapping, datasetName) {
      return request('/api/import', { method: 'POST', body: { csvText, mapping, datasetName } });
    },
    async listDatasets() {
      return request('/api/datasets');
    },
    async deleteDataset(id) {
      return request(`/api/datasets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
  };

  // Expose global client
  window.HisabAPI = {
    auth,
    customers,
    transactions,
    credit,
    analytics,
    payments,
    bankAccounts,
    ai,
    voice,
    upload,
    request,
    ApiError
  };

})(window);
