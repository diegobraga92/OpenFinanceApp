import type { components, operations } from './api-types';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  notifyAuthChanged,
  setAuthSession,
} from './auth/tokenStorage';

// When VITE_API_BASE_URL is set (e.g. http://192.168.1.100:3000) the app calls the
// backend directly. When unset/empty it uses relative URLs — in Docker the nginx
// proxy forwards them to the backend; in dev the Vite proxy does the same.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Single-flight refresh: concurrent 401s share one refresh request instead of
// hammering the backend.
let refreshPromise: Promise<string | null> | null = null;

export type Category = components['schemas']['Category'];
export type CreateCategoryRequest = components['schemas']['CreateCategoryRequest'];
export type UpdateCategoryRequest = components['schemas']['UpdateCategoryRequest'];
export type Transaction = components['schemas']['Transaction'];
export type CreateTransactionRequest = components['schemas']['CreateTransactionRequest'];
export type UpdateTransactionRequest = components['schemas']['UpdateTransactionRequest'];
export type TransactionListResponse = components['schemas']['TransactionListResponse'];
export type SummaryResponse = components['schemas']['SummaryResponse'];
export type Budget = components['schemas']['Budget'];
export type CreateBudgetRequest = components['schemas']['CreateBudgetRequest'];
export type BudgetWithCategory = components['schemas']['BudgetWithCategory'];
export type BudgetAlert = components['schemas']['BudgetAlert'];
export type BudgetAlertListResponse = components['schemas']['BudgetAlertListResponse'];
export type AcknowledgeAlertsResponse = components['schemas']['AcknowledgeAlertsResponse'];
export type BudgetSummaryItem = components['schemas']['BudgetSummaryItem'];
export type BudgetSummaryResponse = components['schemas']['BudgetSummaryResponse'];
export type MonthlyReportItem = components['schemas']['MonthlyReportItem'];
export type MonthlyReportResponse = components['schemas']['MonthlyReportResponse'];
export type CategoryBreakdownItem = components['schemas']['CategoryBreakdownItem'];
export type CategoryBreakdownResponse = components['schemas']['CategoryBreakdownResponse'];
export type TrendPoint = components['schemas']['TrendPoint'];
export type TrendsResponse = components['schemas']['TrendsResponse'];
export type Account = components['schemas']['Account'];
export type AccountWithBalance = components['schemas']['AccountWithBalance'];
export type CreateAccountRequest = components['schemas']['CreateAccountRequest'];
export type UpdateAccountRequest = components['schemas']['UpdateAccountRequest'];
export type CardBill = components['schemas']['CardBill'];
export type CardOverview = components['schemas']['CardOverview'];
export type CreateCardPurchaseRequest = components['schemas']['CreateCardPurchaseRequest'];
export type PayCardBillRequest = components['schemas']['PayCardBillRequest'];
export type PayCardBillResponse = components['schemas']['PayCardBillResponse'];
export type AnticipateInstallmentsRequest = components['schemas']['AnticipateInstallmentsRequest'];
export type AnticipateInstallmentsResponse = components['schemas']['AnticipateInstallmentsResponse'];
export type CreateLedgerTransactionRequest = components['schemas']['CreateLedgerTransactionRequest'];
export type CreateLedgerTransactionResponse = components['schemas']['CreateLedgerTransactionResponse'];
export type LedgerEntry = components['schemas']['LedgerEntry'];
export type LedgerTransaction = components['schemas']['LedgerTransaction'];
export type MigrationResponse = components['schemas']['MigrationResponse'];
export type ReconciliationItem = components['schemas']['ReconciliationItem'];
export type ReconciliationUploadRequest = components['schemas']['ReconciliationUploadRequest'];
export type ReconciliationUploadResponse = components['schemas']['ReconciliationUploadResponse'];
export type StatementLine = components['schemas']['StatementLine'];
export type RegisterRequest = components['schemas']['RegisterRequest'];
export type LoginRequest = components['schemas']['LoginRequest'];
export type RefreshRequest = components['schemas']['RefreshRequest'];
export type ScanRequest = components['schemas']['ScanRequest'];
export type OcrRequest = components['schemas']['OcrRequest'];
export type SaveReceiptRequest = components['schemas']['SaveReceiptRequest'];
export type ReceiptItemInput = components['schemas']['ReceiptItemInput'];
export type MergeProductsRequest = components['schemas']['MergeProductsRequest'];
export type InstallmentPlan = components['schemas']['InstallmentPlan'];
export type InstallmentProgress = components['schemas']['InstallmentProgress'];
export type InstallmentTransaction = components['schemas']['InstallmentTransaction'];
export type InstallmentPlanDetail = components['schemas']['InstallmentPlanDetail'];

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  // Build the request ourselves so the session token always wins over any
  // caller-supplied Authorization header (stale tokens from callers would
  // otherwise defeat the automatic refresh below).
  const doFetch = () => {
    const token = getAccessToken();
    const isFormData = options?.body instanceof FormData;
    return fetch(`${API_BASE_URL}${path}`, {
      method: options?.method,
      headers: {
        // For multipart FormData the browser sets the boundary header itself.
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options?.body,
    });
  };

  let response = await doFetch();

  // Access token expired — try to refresh once, then retry the request.
  // Only skip refresh for the auth endpoints that don't use an access token
  // (login/register/refresh). `/api/auth/me` validates the stored session, so it
  // must go through the refresh path or returning users get logged out whenever
  // the short-lived access token has expired.
  const NO_REFRESH_AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];
  if (response.status === 401 && !NO_REFRESH_AUTH_PATHS.includes(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch();
    } else {
      // Refresh failed (missing/expired refresh token): drop the session so
      // the UI can show the login screen.
      clearAuthSession();
      notifyAuthChanged();
    }
  }

  if (!response.ok) {
    let detail: string;
    try {
      const error = await response.json();
      detail = error?.error || `Request failed with status ${response.status}`;
    } catch {
      detail = `Request failed with status ${response.status}`;
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Exchanges the stored refresh token for a fresh pair of tokens.
 *
 * Uses a module-level single-flight promise so concurrent 401s share one
 * refresh round-trip. Returns the new access token, or `null` on failure.
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken } satisfies RefreshRequest),
        });
        if (!response.ok) return null;
        const data = (await response.json()) as AuthResponse;
        setAuthSession(data.access_token, data.refresh_token, data.user);
        notifyAuthChanged();
        return data.access_token;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function fetchCategories(type?: 'income' | 'expense'): Promise<Category[]> {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return request<Category[]>(`/api/categories${query}`);
}

export async function createCategory(payload: CreateCategoryRequest): Promise<Category> {
  return request<Category>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(id: string, payload: UpdateCategoryRequest): Promise<Category> {
  return request<Category>(`/api/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  return request<void>(`/api/categories/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchTransactions(params?: {
  page?: number;
  page_size?: number;
  category_id?: string;
  type?: 'income' | 'expense';
  start_date?: string;
  end_date?: string;
  account_id?: string;
}): Promise<TransactionListResponse> {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.page_size !== undefined) qs.set('page_size', String(params.page_size));
  if (params?.category_id) qs.set('category_id', params.category_id);
  if (params?.type) qs.set('type', params.type);
  if (params?.start_date) qs.set('start_date', params.start_date);
  if (params?.end_date) qs.set('end_date', params.end_date);
  if (params?.account_id) qs.set('account_id', params.account_id);

  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<TransactionListResponse>(`/api/transactions${query}`);
}

export async function createTransaction(
  payload: CreateTransactionRequest,
): Promise<Transaction> {
  return request<Transaction>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTransaction(
  id: string,
  payload: UpdateTransactionRequest,
): Promise<Transaction> {
  return request<Transaction>(`/api/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  return request<void>(`/api/transactions/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchSummary(
  year?: number,
  month?: number,
): Promise<SummaryResponse> {
  const qs = new URLSearchParams();
  if (year !== undefined) qs.set('year', String(year));
  if (month !== undefined) qs.set('month', String(month));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<SummaryResponse>(`/api/summary${query}`);
}

export async function createBudget(payload: CreateBudgetRequest): Promise<BudgetWithCategory> {
  return request<BudgetWithCategory>('/api/budgets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteBudget(id: string): Promise<void> {
  return request<void>(`/api/budgets/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchBudgetSummary(year?: number, month?: number): Promise<BudgetSummaryResponse> {
  const qs = new URLSearchParams();
  if (year !== undefined) qs.set('year', String(year));
  if (month !== undefined) qs.set('month', String(month));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<BudgetSummaryResponse>(`/api/budgets/summary${query}`);
}

export async function fetchBudgetAlerts(params?: {
  year?: number;
  month?: number;
  acknowledged?: boolean;
  page?: number;
  page_size?: number;
}): Promise<BudgetAlertListResponse> {
  const qs = new URLSearchParams();
  if (params?.year !== undefined) qs.set('year', String(params.year));
  if (params?.month !== undefined) qs.set('month', String(params.month));
  if (params?.acknowledged !== undefined) qs.set('acknowledged', String(params.acknowledged));
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.page_size !== undefined) qs.set('page_size', String(params.page_size));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<BudgetAlertListResponse>(`/api/budgets/alerts${query}`);
}

export async function acknowledgeBudgetAlert(id: string): Promise<{ id: string; acknowledged: boolean }> {
  return request<{ id: string; acknowledged: boolean }>(`/api/budgets/alerts/${id}/acknowledge`, {
    method: 'POST',
  });
}

export async function acknowledgeAllBudgetAlerts(year?: number, month?: number): Promise<AcknowledgeAlertsResponse> {
  const qs = new URLSearchParams();
  if (year !== undefined) qs.set('year', String(year));
  if (month !== undefined) qs.set('month', String(month));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<AcknowledgeAlertsResponse>(`/api/budgets/alerts/acknowledge-all${query}`, {
    method: 'POST',
  });
}

export async function fetchMonthlyReport(
  startYear?: number,
  startMonth?: number,
  endYear?: number,
  endMonth?: number,
  accountId?: string,
): Promise<MonthlyReportResponse> {
  const qs = new URLSearchParams();
  if (startYear !== undefined) qs.set('start_year', String(startYear));
  if (startMonth !== undefined) qs.set('start_month', String(startMonth));
  if (endYear !== undefined) qs.set('end_year', String(endYear));
  if (endMonth !== undefined) qs.set('end_month', String(endMonth));
  if (accountId) qs.set('account_id', accountId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<MonthlyReportResponse>(`/api/reports/monthly${query}`);
}

export async function fetchCategoryBreakdown(
  startDate?: string,
  endDate?: string,
): Promise<CategoryBreakdownResponse> {
  const qs = new URLSearchParams();
  if (startDate) qs.set('start_date', startDate);
  if (endDate) qs.set('end_date', endDate);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<CategoryBreakdownResponse>(`/api/reports/category-breakdown${query}`);
}

export async function fetchTrends(months?: number): Promise<TrendsResponse> {
  const qs = new URLSearchParams();
  if (months !== undefined) qs.set('months', String(months));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<TrendsResponse>(`/api/reports/trends${query}`);
}

export async function fetchAccountsWithBalance(): Promise<AccountWithBalance[]> {
  return request<AccountWithBalance[]>('/api/accounts');
}

export async function createAccount(payload: CreateAccountRequest): Promise<Account> {
  return request<Account>('/api/accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAccount(
  id: string,
  payload: UpdateAccountRequest,
): Promise<Account> {
  return request<Account>(`/api/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAccount(id: string): Promise<void> {
  return request<void>(`/api/accounts/${id}`, {
    method: 'DELETE',
  });
}

// --- Credit cards ---

export async function fetchCreditCards(): Promise<CardOverview[]> {
  return request<CardOverview[]>('/api/credit-cards');
}

export async function fetchCreditCard(id: string): Promise<CardOverview> {
  return request<CardOverview>(`/api/credit-cards/${id}`);
}

export async function fetchCardBills(id: string): Promise<CardBill[]> {
  return request<CardBill[]>(`/api/credit-cards/${id}/bills`);
}

export async function createCardPurchase(
  id: string,
  payload: CreateCardPurchaseRequest,
): Promise<Transaction> {
  return request<Transaction>(`/api/credit-cards/${id}/purchases`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function payCardBill(
  id: string,
  billId: string,
  payload: PayCardBillRequest,
): Promise<PayCardBillResponse> {
  return request<PayCardBillResponse>(`/api/credit-cards/${id}/bills/${billId}/pay`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function anticipateInstallments(
  id: string,
  payload: AnticipateInstallmentsRequest,
): Promise<AnticipateInstallmentsResponse> {
  return request<AnticipateInstallmentsResponse>(`/api/credit-cards/${id}/anticipate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createLedgerTransaction(
  payload: CreateLedgerTransactionRequest,
): Promise<CreateLedgerTransactionResponse> {
  return request<CreateLedgerTransactionResponse>('/api/ledger/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchLedgerTransactions(): Promise<LedgerTransaction[]> {
  return request<LedgerTransaction[]>('/api/ledger/transactions');
}

export async function migrateSingleToDouble(): Promise<MigrationResponse> {
  return request<MigrationResponse>('/api/migrate/single-to-double', {
    method: 'POST',
  });
}

export async function uploadReconciliation(
  payload: ReconciliationUploadRequest,
): Promise<ReconciliationUploadResponse> {
  return request<ReconciliationUploadResponse>('/api/reconciliation', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Uploads a raw CSV/OFX file to the reconciliation endpoint.
export async function uploadReconciliationFile(file: File, options?: {
  statementName?: string;
  format?: 'csv' | 'ofx';
  autoCreateUnmatched?: boolean;
}): Promise<ReconciliationUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  if (options?.statementName) form.append('statement_name', options.statementName);
  if (options?.format) form.append('format', options.format);
  if (options?.autoCreateUnmatched !== undefined) {
    form.append('auto_create_unmatched', String(options.autoCreateUnmatched));
  }
  return request<ReconciliationUploadResponse>('/api/reconciliation/upload', {
    method: 'POST',
    body: form,
  });
}

export interface ReconciliationHistoryItem {
  id: string;
  statement_name: string;
  uploaded_at: string;
  total_rows: number;
  matched_rows: number;
  unmatched_rows: number;
  status: string;
}

export async function fetchReconciliationHistory(): Promise<{ items: ReconciliationHistoryItem[] }> {
  return request<{ items: ReconciliationHistoryItem[] }>('/api/reconciliation/history');
}

// --- Auth ---

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: { id: string; email: string; role: string };
}

export async function registerUser(payload: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function refreshToken(payload: RefreshRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMe(token: string): Promise<{ id: string; email: string; role: string }> {
  return request<{ id: string; email: string; role: string }>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// --- Audit ---

export interface AuditEvent {
  id: number;
  aggregate_id: string;
  aggregate_type: string;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export async function fetchAuditEvents(
  token: string | null,
  params?: { event_type?: string; page?: number; page_size?: number },
): Promise<{ items: AuditEvent[]; page: number; page_size: number }> {
  const qs = new URLSearchParams();
  if (params?.event_type) qs.set('event_type', params.event_type);
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.page_size !== undefined) qs.set('page_size', String(params.page_size));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<{ items: AuditEvent[]; page: number; page_size: number }>(`/api/audit/events${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// --- Receipts ---

export async function scanReceipt(qrData: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>('/api/receipts/scan', {
    method: 'POST',
    body: JSON.stringify({ qr_data: qrData } satisfies ScanRequest),
  });
}

// Sends raw OCR text (from tesseract.js) to the backend for structured parsing.
export async function scanReceiptOcr(rawText: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>('/api/receipts/ocr', {
    method: 'POST',
    body: JSON.stringify({ raw_text: rawText } satisfies OcrRequest),
  });
}

export async function saveReceipt(payload: SaveReceiptRequest): Promise<{ id: string; store_id: string }> {
  return request<{ id: string; store_id: string }>('/api/receipts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchReceipts(page = 0, pageSize = 50): Promise<{ items: unknown[]; page: number; page_size: number }> {
  const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  return request<{ items: unknown[]; page: number; page_size: number }>(`/api/receipts?${qs.toString()}`);
}

export async function fetchPriceHistory(productId: string, months = 6): Promise<{ product_id: string; points: unknown[] }> {
  const qs = new URLSearchParams({ product_id: productId, months: String(months) });
  return request<{ product_id: string; points: unknown[] }>(`/api/receipts/price-history?${qs.toString()}`);
}

export async function mergeProducts(payload: MergeProductsRequest): Promise<{ target_id: string; source_id: string; status: string }> {
  return request<{ target_id: string; source_id: string; status: string }>('/api/receipts/product/merge', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// --- Installments ---

export async function fetchInstallmentPlans(): Promise<InstallmentPlan[]> {
  return request<InstallmentPlan[]>('/api/installments');
}

export async function fetchInstallmentPlan(id: string): Promise<InstallmentPlanDetail> {
  return request<InstallmentPlanDetail>(`/api/installments/${id}`);
}

export type { operations };
