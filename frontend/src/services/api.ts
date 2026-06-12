const API_URL = ''; // Proxied via Vite config to http://localhost:5000

function getHeaders() {
  const token = localStorage.getItem('erp_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function handleResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export const api = {
  // Auth
  async login(credentials: { email: string; passwordHash: string }) {
    // For convenience in UI, we post email and raw password
    const res = await fetch(`/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: credentials.email, password: credentials.passwordHash }),
    });
    const data = await handleResponse(res);
    localStorage.setItem('erp_token', data.token);
    return data;
  },

  async register(registration: any) {
    const res = await fetch(`/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registration),
    });
    const data = await handleResponse(res);
    localStorage.setItem('erp_token', data.token);
    return data;
  },

  async getMe() {
    const res = await fetch(`/api/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async updateTenant(tenantData: { name: string; currency: string; taxRate: number }) {
    const res = await fetch(`/api/auth/tenant`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(tenantData),
    });
    return handleResponse(res);
  },

  logout() {
    localStorage.removeItem('erp_token');
  },

  // Chart of Accounts
  async getCoA() {
    const res = await fetch(`/api/coa`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getTrialBalance() {
    const res = await fetch(`/api/coa/trial-balance`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Journal Vouchers
  async getJournals() {
    const res = await fetch(`/api/journals`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createJournal(journal: any) {
    const res = await fetch(`/api/journals`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(journal),
    });
    return handleResponse(res);
  },

  // Invoices
  async getInvoices(isPos?: boolean) {
    const qs = isPos !== undefined ? `?isPos=${isPos}` : '';
    const res = await fetch(`/api/invoices${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getInvoice(id: string) {
    const res = await fetch(`/api/invoices/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getInvoiceContacts() {
    const res = await fetch(`/api/invoices/contacts`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createContact(contact: any) {
    const res = await fetch(`/api/invoices/contacts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(contact),
    });
    return handleResponse(res);
  },

  async createInvoice(invoice: any) {
    const res = await fetch(`/api/invoices`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(invoice),
    });
    return handleResponse(res);
  },

  async updateInvoice(id: string, invoice: any) {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(invoice),
    });
    return handleResponse(res);
  },

  async deleteInvoice(id: string) {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async approveInvoice(id: string) {
    const res = await fetch(`/api/invoices/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async submitInvoiceToFbr(id: string) {
    const res = await fetch(`/api/invoices/${id}/fbr-submit`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Bills (Purchases)
  async getBills() {
    const res = await fetch(`/api/bills`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getBill(id: string) {
    const res = await fetch(`/api/bills/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createBill(bill: any) {
    const res = await fetch(`/api/bills`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(bill),
    });
    return handleResponse(res);
  },

  async approveBill(id: string) {
    const res = await fetch(`/api/bills/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Inventory
  async getProducts() {
    const res = await fetch(`/api/inventory/products`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createProduct(product: any) {
    const res = await fetch(`/api/inventory/products`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(product),
    });
    return handleResponse(res);
  },

  async adjustStock(id: string, adjustment: { quantity: number; unitCost: number; description: string; warehouse?: string }) {
    const res = await fetch(`/api/inventory/products/${id}/stock-adjustment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(adjustment),
    });
    return handleResponse(res);
  },

  // Stock Transfers
  async getStockTransfers() {
    const res = await fetch(`/api/inventory/transfers`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createStockTransfer(transfer: { productId: string; quantity: number; fromWarehouse: string; toWarehouse: string; transferNumber?: string; date?: string }) {
    const res = await fetch(`/api/inventory/transfers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(transfer),
    });
    return handleResponse(res);
  },

  // Aggregated Analytics Data
  async getAnalyticsData() {
    const [products, profitLoss, invoices, bills] = await Promise.all([
      this.getProducts(),
      this.getProfitLoss(),
      this.getInvoices(),
      this.getBills()
    ]);
    return { products, profitLoss, invoices, bills };
  },

  // Manufacturing
  async getBOMs() {
    const res = await fetch(`/api/manufacturing/boms`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createBOM(bom: any) {
    const res = await fetch(`/api/manufacturing/boms`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(bom),
    });
    return handleResponse(res);
  },

  async getJobs() {
    const res = await fetch(`/api/manufacturing/jobs`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async runJob(job: { bomId: string; quantityToBuild: number }) {
    const res = await fetch(`/api/manufacturing/jobs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(job),
    });
    return handleResponse(res);
  },

  // Reports
  async getProfitLoss(params?: { fromDate?: string; toDate?: string; comparePrevious?: boolean }) {
    const qs = new URLSearchParams();
    if (params?.fromDate)       qs.set('fromDate', params.fromDate);
    if (params?.toDate)         qs.set('toDate', params.toDate);
    if (params?.comparePrevious) qs.set('comparePrevious', 'true');
    const res = await fetch(`/api/coa/profit-loss?${qs.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getBalanceSheet(params?: { asOfDate?: string }) {
    const qs = new URLSearchParams();
    if (params?.asOfDate) qs.set('asOfDate', params.asOfDate);
    const res = await fetch(`/api/coa/balance-sheet?${qs.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getGstSummary(params?: { fromDate?: string; toDate?: string }) {
    const qs = new URLSearchParams();
    if (params?.fromDate) qs.set('fromDate', params.fromDate);
    if (params?.toDate)   qs.set('toDate', params.toDate);
    const res = await fetch(`/api/coa/gst-summary?${qs.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Bank Reconciliation
  async importBankStatement(payload: { bankAccountId: string; fileName: string; csvText: string }) {
    const res = await fetch(`/api/bank-reconciliation/import`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getBankStatements() {
    const res = await fetch(`/api/bank-reconciliation/statements`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getBankStatement(id: string) {
    const res = await fetch(`/api/bank-reconciliation/statements/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async matchStatementLine(payload: { lineId: string; targetType: 'INVOICE' | 'BILL' | 'JOURNAL'; targetId: string }) {
    const res = await fetch(`/api/bank-reconciliation/match`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async createMatchStatementLine(payload: { lineId: string; offsetAccountId: string; reference?: string }) {
    const res = await fetch(`/api/bank-reconciliation/create-match`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async unmatchStatementLine(lineId: string) {
    const res = await fetch(`/api/bank-reconciliation/unmatch`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ lineId }),
    });
    return handleResponse(res);
  },

  // Sales Orders
  async getOrders() {
    const res = await fetch(`/api/orders`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createOrder(order: any) {
    const res = await fetch(`/api/orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(order),
    });
    return handleResponse(res);
  },

  async convertOrderToInvoice(id: string) {
    const res = await fetch(`/api/orders/${id}/invoice`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async deleteOrder(id: string) {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Receipts
  async getReceipts() {
    const res = await fetch(`/api/receipts`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createReceipt(receipt: any) {
    const res = await fetch(`/api/receipts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(receipt),
    });
    return handleResponse(res);
  },

  // Post Dated Cheques (PDCs)
  async getCheques() {
    const res = await fetch(`/api/cheques`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createCheque(cheque: any) {
    const res = await fetch(`/api/cheques`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(cheque),
    });
    return handleResponse(res);
  },

  async clearCheque(id: string) {
    const res = await fetch(`/api/cheques/${id}/clear`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async bounceCheque(id: string) {
    const res = await fetch(`/api/cheques/${id}/bounce`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Customers
  async getCustomers() {
    const res = await fetch(`/api/customers`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createCustomer(customer: any) {
    const res = await fetch(`/api/customers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(customer),
    });
    return handleResponse(res);
  },

  async updateCustomer(id: string, customer: any) {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(customer),
    });
    return handleResponse(res);
  },

  // Purchase Orders (POs)
  async getPurchaseOrders() {
    const res = await fetch(`/api/purchase-orders`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createPurchaseOrder(po: any) {
    const res = await fetch(`/api/purchase-orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(po),
    });
    return handleResponse(res);
  },

  async convertPoToBill(id: string) {
    const res = await fetch(`/api/purchase-orders/${id}/bill`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async deletePurchaseOrder(id: string) {
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Payments
  async getPayments() {
    const res = await fetch(`/api/payments`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createPayment(payment: any) {
    const res = await fetch(`/api/payments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payment),
    });
    return handleResponse(res);
  },

  // Issued PDCs
  async getIssuedCheques() {
    const res = await fetch(`/api/vendor-cheques`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createIssuedCheque(cheque: any) {
    const res = await fetch(`/api/vendor-cheques`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(cheque),
    });
    return handleResponse(res);
  },

  async clearIssuedCheque(id: string) {
    const res = await fetch(`/api/vendor-cheques/${id}/clear`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async bounceIssuedCheque(id: string) {
    const res = await fetch(`/api/vendor-cheques/${id}/bounce`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Suppliers
  async getSuppliers() {
    const res = await fetch(`/api/suppliers`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createSupplier(supplier: any) {
    const res = await fetch(`/api/suppliers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(supplier),
    });
    return handleResponse(res);
  },

  async updateSupplier(id: string, supplier: any) {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(supplier),
    });
    return handleResponse(res);
  },

  // BI Reporting Module Endpoints
  reports: {
    async getReportData(endpoint: string, params?: Record<string, string>) {
      const qs = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== '') {
            qs.set(key, val);
          }
        });
      }
      const queryString = qs.toString() ? `?${qs.toString()}` : '';
      const res = await fetch(`/api/reports/${endpoint}${queryString}`, {
        headers: getHeaders(),
      });
      return handleResponse(res);
    }
  },

  // SuperAdmin Panel API Actions
  async superAdminLogin(credentials: any) {
    const res = await fetch(`/api/superadmin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    const data = await handleResponse(res);
    if (data.token) {
      localStorage.setItem('erp_token', data.token);
    }
    return data;
  },

  async getSuperAdminTenants() {
    const res = await fetch(`/api/superadmin/tenants`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async provisionTenant(tenantData: any) {
    const res = await fetch(`/api/superadmin/tenants`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(tenantData),
    });
    return handleResponse(res);
  },

  async updateTenantStatus(id: string, statusData: { status: string; endDate?: string }) {
    const res = await fetch(`/api/superadmin/tenants/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(statusData),
    });
    return handleResponse(res);
  },

  async updateTenantModules(id: string, moduleData: any) {
    const res = await fetch(`/api/superadmin/tenants/${id}/modules`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(moduleData),
    });
    return handleResponse(res);
  },

  async impersonateTenant(id: string) {
    const res = await fetch(`/api/superadmin/tenants/${id}/impersonate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await handleResponse(res);
    if (data.token) {
      localStorage.setItem('erp_token', data.token);
    }
    return data;
  },

  async getGlobalAuditLogs() {
    const res = await fetch(`/api/superadmin/logs`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getSystemMetrics() {
    const res = await fetch(`/api/superadmin/metrics`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  }
};
