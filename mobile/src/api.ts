import type { components } from './api-types';
import { clearAuthSession, getAccessToken, getRefreshToken, setAuthSession } from './auth';
import { getApiBaseUrl } from './config/server';
import { isOnline, uuid } from './offline/net';
import {
  addPendingOperation,
  deleteLocalTransaction,
  getLocalCategories,
  getLocalTransactionById,
  getLocalTransactions,
  upsertLocalTransaction,
} from './offline/database';

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
export type CardBill = components['schemas']['CardBill'];
export type CardOverview = components['schemas']['CardOverview'];
export type CreateCardPurchaseRequest = components['schemas']['CreateCardPurchaseRequest'];
export type PayCardBillRequest = components['schemas']['PayCardBillRequest'];
export type PayCardBillResponse = components['schemas']['PayCardBillResponse'];
export type AnticipateInstallmentsRequest = components['schemas']['AnticipateInstallmentsRequest'];
export type AnticipateInstallmentsResponse = components['schemas']['AnticipateInstallmentsResponse'];
export type CreateAccountRequest = components['schemas']['CreateAccountRequest'];
export type UpdateAccountRequest = components['schemas']['UpdateAccountRequest'];
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
export type CreateInstallmentPlanRequest = components['schemas']['CreateInstallmentPlanRequest'];
export type GenerateInstallmentsResponse = components['schemas']['GenerateInstallmentsResponse'];
export type PayInstallmentResponse = components['schemas']['PayInstallmentResponse'];
export type SyncPullRequest = components['schemas']['SyncPullRequest'];
export type SyncPullResponse = components['schemas']['SyncPullResponse'];
export type SyncOperation = components['schemas']['SyncOperation'];
export type SyncPushRequest = components['schemas']['SyncPushRequest'];
export type SyncPushResponse = components['schemas']['SyncPushResponse'];

async function request<T>(path: string, options?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData;
}): Promise<T> {
  // Build the request ourselves so the session token always wins over any
  // caller-supplied Authorization header (stale tokens from callers would
  // otherwise defeat the automatic refresh below).
  const doFetch = async () => {
    const base = await getApiBaseUrl();
    const token = await getAccessToken();
    const isFormData = options?.body instanceof FormData;
    return fetch(`${base}${path}`, {
      method: options?.method,
      headers: {
        // For multipart FormData the native client sets the boundary header itself.
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options?.body,
    });
  };

  let response = await doFetch();

  // Access token expired — try to refresh once, then retry the request.
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch();
    } else {
      // Refresh failed (missing/expired refresh token): drop the session so
      // the UI can show the login screen.
      await clearAuthSession();
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
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const base = await getApiBaseUrl();
        const response = await fetch(`${base}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        await setAuthSession(data.access_token, data.refresh_token, data.user);
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
  if (!(await isOnline())) {
    // Offline fallback: serve categories from the local mirror.
    const local = getLocalCategories();
    return local.map((c) => ({
      id: c.server_id ?? c.id,
      name: c.name,
      type: c.type,
      parent_id: c.parent_id ?? null,
      icon: c.icon ?? null,
      color: c.color ?? null,
      created_at: c.updated_at,
      updated_at: c.updated_at,
    }));
  }
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return request<Category[]>(`/api/categories${query}`);
}

export async function createCategory(payload: CreateCategoryRequest): Promise<Category> {
  const localId = uuid();
  if (!(await isOnline())) {
    addPendingOperation({
      operation_type: 'create',
      entity_type: 'category',
      local_id: localId,
      server_id: null,
      payload: JSON.stringify(payload),
    });
    const now = new Date().toISOString();
    return {
      id: localId,
      name: payload.name,
      type: payload.type,
      parent_id: payload.parent_id ?? null,
      icon: payload.icon ?? null,
      color: payload.color ?? null,
      created_at: now,
      updated_at: now,
    };
  }
  return request<Category>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(id: string, payload: UpdateCategoryRequest): Promise<Category> {
  if (!(await isOnline())) {
    addPendingOperation({
      operation_type: 'update',
      entity_type: 'category',
      local_id: null,
      server_id: id,
      payload: JSON.stringify(payload),
    });
    const now = new Date().toISOString();
    return {
      id,
      name: payload.name,
      type: payload.type,
      parent_id: payload.parent_id ?? null,
      icon: payload.icon ?? null,
      color: payload.color ?? null,
      created_at: now,
      updated_at: now,
    };
  }
  return request<Category>(`/api/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  if (!(await isOnline())) {
    addPendingOperation({
      operation_type: 'delete',
      entity_type: 'category',
      local_id: null,
      server_id: id,
      payload: '{}',
    });
    return;
  }
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
}): Promise<TransactionListResponse> {
  if (!(await isOnline())) {
    // Offline fallback: serve transactions from the local mirror.
    const local = getLocalTransactions();
    const items: Transaction[] = local.map((t) => ({
      id: t.server_id ?? t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category_id: t.category_id ?? null,
      date: t.date,
      notes: t.notes ?? null,
      installment_plan_id: t.installment_plan_id ?? null,
      created_at: t.updated_at,
      updated_at: t.updated_at,
    }));
    return {
      items,
      page: params?.page ?? 0,
      page_size: params?.page_size ?? items.length,
      total: items.length,
    };
  }
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

export async function createTransaction(
  payload: CreateTransactionRequest,
): Promise<Transaction> {
  const localId = uuid();
  const now = new Date().toISOString();
  if (!(await isOnline())) {
    // Optimistic offline create: store locally and queue for sync.
    upsertLocalTransaction({
      id: localId,
      server_id: null,
      description: payload.description,
      amount: payload.amount,
      type: payload.type as 'income' | 'expense',
      category_id: payload.category_id ?? null,
      date: payload.date,
      notes: payload.notes ?? null,
      installment_plan_id: payload.installment_plan_id ?? null,
      account_id: payload.account_id ?? null,
      synced: 0,
    });
    addPendingOperation({
      operation_type: 'create',
      entity_type: 'transaction',
      local_id: localId,
      server_id: null,
      payload: JSON.stringify(payload),
    });
    return {
      id: localId,
      description: payload.description,
      amount: payload.amount,
      type: payload.type,
      category_id: payload.category_id ?? null,
      date: payload.date,
      notes: payload.notes ?? null,
      installment_plan_id: payload.installment_plan_id ?? null,
      created_at: now,
      updated_at: now,
    };
  }
  const tx = await request<Transaction>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  // Mirror the created row locally so the offline view stays consistent.
  upsertLocalTransaction({
    id: tx.id,
    server_id: tx.id,
    description: tx.description,
    amount: tx.amount,
    type: tx.type as 'income' | 'expense',
    category_id: tx.category_id ?? null,
    date: tx.date,
    notes: tx.notes ?? null,
    installment_plan_id: tx.installment_plan_id ?? null,
    account_id: tx.account_id ?? null,
    synced: 1,
  });
  return tx;
}

export async function updateTransaction(
  id: string,
  payload: UpdateTransactionRequest,
): Promise<Transaction> {
  const now = new Date().toISOString();
  if (!(await isOnline())) {
    // Update the local row if present, then queue for sync.
    const local = getLocalTransactionById(id);
    addPendingOperation({
      operation_type: 'update',
      entity_type: 'transaction',
      local_id: local ? (local.synced === 0 ? local.id : null) : null,
      server_id: local && local.synced === 1 ? local.server_id : null,
      payload: JSON.stringify(payload),
    });
    if (local) {
      upsertLocalTransaction({
        id: local.id,
        server_id: local.server_id,
        description: payload.description,
        amount: payload.amount,
        type: payload.type as 'income' | 'expense',
        category_id: payload.category_id ?? null,
        date: payload.date,
        notes: payload.notes ?? null,
        installment_plan_id: local.installment_plan_id,
        account_id: local.account_id,
        synced: local.synced,
      });
    }
    return {
      id,
      description: payload.description,
      amount: payload.amount,
      type: payload.type,
      category_id: payload.category_id ?? null,
      date: payload.date,
      notes: payload.notes ?? null,
      installment_plan_id: local?.installment_plan_id ?? null,
      created_at: now,
      updated_at: now,
    };
  }
  return request<Transaction>(`/api/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  if (!(await isOnline())) {
    const local = getLocalTransactionById(id);
    addPendingOperation({
      operation_type: 'delete',
      entity_type: 'transaction',
      local_id: local && local.synced === 0 ? local.id : null,
      server_id: local && local.synced === 1 ? local.server_id : null,
      payload: '{}',
    });
    deleteLocalTransaction(id);
    return;
  }
  await request<void>(`/api/transactions/${id}`, {
    method: 'DELETE',
  });
  deleteLocalTransaction(id);
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

// Uploads a raw CSV/OFX file (as a react-native `{ uri, name, type }` file
// reference) to the reconciliation endpoint via multipart/form-data.
export async function uploadReconciliationFile(
  file: { uri: string; name?: string; type?: string },
  options?: {
    statementName?: string;
    format?: 'csv' | 'ofx';
    autoCreateUnmatched?: boolean;
  },
): Promise<ReconciliationUploadResponse> {
  const form = new FormData();
  form.append('file', file as unknown as Blob);
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
  return request<{ items: AuditEvent[]; page: number; page_size: number }>(
    `/api/audit/events${query}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

// --- Receipts ---

export async function scanReceipt(qrData: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>('/api/receipts/scan', {
    method: 'POST',
    body: JSON.stringify({ qr_data: qrData } satisfies ScanRequest),
  });
}

// Sends raw OCR text (from on-device ML Kit) to the backend for structured parsing.
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

export async function createInstallmentPlan(payload: CreateInstallmentPlanRequest): Promise<InstallmentPlan> {
  return request<InstallmentPlan>('/api/installments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchInstallmentPlan(id: string): Promise<InstallmentPlanDetail> {
  return request<InstallmentPlanDetail>(`/api/installments/${id}`);
}

export async function deleteInstallmentPlan(id: string): Promise<void> {
  return request<void>(`/api/installments/${id}`, { method: 'DELETE' });
}

export async function generateInstallments(id: string): Promise<GenerateInstallmentsResponse> {
  return request<GenerateInstallmentsResponse>(`/api/installments/${id}/generate`, { method: 'POST' });
}

export async function payInstallment(id: string, number: number): Promise<PayInstallmentResponse> {
  return request<PayInstallmentResponse>(`/api/installments/${id}/installment/${number}/pay`, { method: 'POST' });
}

// --- Sync ---

export interface SyncPushOperation {
  operation_type: 'create' | 'update' | 'delete';
  entity_type: 'transaction' | 'category';
  client_id: string;
  server_id?: string;
  payload: Record<string, unknown>;
}

/** Pulls entities changed since the given timestamp. */
export async function syncPull(lastSyncedAt: string): Promise<SyncPullResponse> {
  return request<SyncPullResponse>('/api/sync/pull', {
    method: 'POST',
    body: JSON.stringify({ last_synced_at: lastSyncedAt } satisfies SyncPullRequest),
  });
}

/** Pushes a batch of client mutations. */
export async function syncPush(operations: SyncPushOperation[]): Promise<SyncPushResponse> {
  return request<SyncPushResponse>('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ operations } satisfies SyncPushRequest),
  });
}
