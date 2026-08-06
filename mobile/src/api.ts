import type { components } from './api-types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export type HealthResponse = components['schemas']['HealthResponse'];
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

async function request<T>(path: string, options?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<T> {
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