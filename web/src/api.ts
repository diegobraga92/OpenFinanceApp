import type { components, operations } from './api-types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export type HealthResponse = components['schemas']['HealthResponse'];
export type HealthError = components['schemas']['HealthError'];
export type Category = components['schemas']['Category'];
export type CreateCategoryRequest = components['schemas']['CreateCategoryRequest'];
export type Transaction = components['schemas']['Transaction'];
export type CreateTransactionRequest = components['schemas']['CreateTransactionRequest'];
export type UpdateTransactionRequest = components['schemas']['UpdateTransactionRequest'];
export type TransactionListResponse = components['schemas']['TransactionListResponse'];
export type SummaryResponse = components['schemas']['SummaryResponse'];
export type Budget = components['schemas']['Budget'];
export type CreateBudgetRequest = components['schemas']['CreateBudgetRequest'];
export type BudgetListResponse = components['schemas']['BudgetListResponse'];
export type BudgetWithCategory = components['schemas']['BudgetWithCategory'];
export type BudgetSummaryItem = components['schemas']['BudgetSummaryItem'];
export type BudgetSummaryResponse = components['schemas']['BudgetSummaryResponse'];
export type MonthlyReportItem = components['schemas']['MonthlyReportItem'];
export type MonthlyReportResponse = components['schemas']['MonthlyReportResponse'];
export type CategoryBreakdownItem = components['schemas']['CategoryBreakdownItem'];
export type CategoryBreakdownResponse = components['schemas']['CategoryBreakdownResponse'];
export type TrendPoint = components['schemas']['TrendPoint'];
export type TrendsResponse = components['schemas']['TrendsResponse'];
export type Account = components['schemas']['Account'];
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
export type SaveReceiptRequest = components['schemas']['SaveReceiptRequest'];
export type ReceiptItemInput = components['schemas']['ReceiptItemInput'];
export type MergeProductsRequest = components['schemas']['MergeProductsRequest'];

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

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

export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
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

export async function fetchTransactions(params?: {
  page?: number;
  page_size?: number;
  category_id?: string;
  type?: 'income' | 'expense';
  start_date?: string;
  end_date?: string;
}): Promise<TransactionListResponse> {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.page_size !== undefined) qs.set('page_size', String(params.page_size));
  if (params?.category_id) qs.set('category_id', params.category_id);
  if (params?.type) qs.set('type', params.type);
  if (params?.start_date) qs.set('start_date', params.start_date);
  if (params?.end_date) qs.set('end_date', params.end_date);

  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<TransactionListResponse>(`/api/transactions${query}`);
}

export async function fetchTransaction(id: string): Promise<Transaction> {
  return request<Transaction>(`/api/transactions/${id}`);
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

export async function fetchBudgets(year?: number, month?: number): Promise<BudgetListResponse> {
  const qs = new URLSearchParams();
  if (year !== undefined) qs.set('year', String(year));
  if (month !== undefined) qs.set('month', String(month));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<BudgetListResponse>(`/api/budgets${query}`);
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

export async function fetchMonthlyReport(
  startYear?: number,
  startMonth?: number,
  endYear?: number,
  endMonth?: number,
): Promise<MonthlyReportResponse> {
  const qs = new URLSearchParams();
  if (startYear !== undefined) qs.set('start_year', String(startYear));
  if (startMonth !== undefined) qs.set('start_month', String(startMonth));
  if (endYear !== undefined) qs.set('end_year', String(endYear));
  if (endMonth !== undefined) qs.set('end_month', String(endMonth));
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

export async function fetchAccounts(): Promise<Account[]> {
  return request<Account[]>('/api/ledger/accounts');
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
  token: string,
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

export type { operations };
