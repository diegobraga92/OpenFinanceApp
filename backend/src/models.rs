//! Data models for the Layer 1 simple transaction tracker.
//!
//! These structs map directly to the `categories` and `transactions`
//! tables created by migration `001_initial_categories_and_transactions.sql`.

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

/// A transaction category (income or expense), optionally nested via `parent_id`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Category {
    /// Unique category identifier.
    pub id: Uuid,
    /// Display name (e.g., "Food & Groceries").
    pub name: String,
    /// `income` or `expense`.
    pub r#type: String,
    /// Optional parent category for subcategories.
    pub parent_id: Option<Uuid>,
    /// Icon identifier used by the web/mobile UIs.
    pub icon: Option<String>,
    /// Hex color code (e.g., `#ef4444`).
    pub color: Option<String>,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last row update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Payload for creating a new category.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateCategoryRequest {
    /// Display name (e.g., "Food & Groceries").
    pub name: String,
    /// `income` or `expense`.
    #[schema(example = "expense")]
    pub r#type: String,
    /// Optional parent category for subcategories.
    pub parent_id: Option<Uuid>,
    /// Icon identifier used by the web/mobile UIs.
    pub icon: Option<String>,
    /// Hex color code (e.g., `#ef4444`).
    pub color: Option<String>,
}

/// Payload for updating an existing category.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateCategoryRequest {
    /// Display name (e.g., "Food & Groceries").
    pub name: String,
    /// `income` or `expense`.
    #[schema(example = "expense")]
    pub r#type: String,
    /// Optional parent category for subcategories.
    pub parent_id: Option<Uuid>,
    /// Icon identifier used by the web/mobile UIs.
    pub icon: Option<String>,
    /// Hex color code (e.g., `#ef4444`).
    pub color: Option<String>,
}

/// A single income or expense transaction.
#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
pub struct Transaction {
    /// Unique transaction identifier.
    pub id: Uuid,
    /// Human-readable description (e.g., "Lunch at Restaurante X").
    pub description: String,
    /// Monetary amount — always positive; `type` determines direction.
    pub amount: Decimal,
    /// `income` or `expense`.
    pub r#type: String,
    /// Category this transaction belongs to (nullable if category deleted).
    pub category_id: Option<Uuid>,
    /// Calendar date of the transaction.
    pub date: NaiveDate,
    /// Optional free-form notes.
    pub notes: Option<String>,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last row update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Payload for creating a new transaction.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTransactionRequest {
    /// Human-readable description (e.g., "Lunch at Restaurante X").
    pub description: String,
    /// Monetary amount — must be > 0.
    #[schema(value_type = String, example = "150.00")]
    pub amount: Decimal,
    /// `income` or `expense`.
    #[schema(example = "expense")]
    pub r#type: String,
    /// Category this transaction belongs to.
    pub category_id: Option<Uuid>,
    /// Calendar date of the transaction (ISO 8601 `YYYY-MM-DD`).
    #[schema(value_type = String, format = Date, example = "2026-04-08")]
    pub date: NaiveDate,
    /// Optional free-form notes.
    pub notes: Option<String>,
}

/// Payload for updating an existing transaction.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateTransactionRequest {
    /// Human-readable description (e.g., "Lunch at Restaurante X").
    pub description: String,
    /// Monetary amount — must be > 0.
    #[schema(value_type = String, example = "150.00")]
    pub amount: Decimal,
    /// `income` or `expense`.
    #[schema(example = "expense")]
    pub r#type: String,
    /// Category this transaction belongs to.
    pub category_id: Option<Uuid>,
    /// Calendar date of the transaction (ISO 8601 `YYYY-MM-DD`).
    #[schema(value_type = String, format = Date, example = "2026-04-08")]
    pub date: NaiveDate,
    /// Optional free-form notes.
    pub notes: Option<String>,
}

/// Query parameters for listing transactions.
#[derive(Debug, Deserialize, ToSchema)]
pub struct TransactionListParams {
    /// Maximum number of rows to return (default 50, max 200).
    #[serde(default = "default_page_size")]
    #[schema(default = 50, minimum = 1, maximum = 200)]
    pub page_size: u32,
    /// Page offset (0-based).
    #[serde(default)]
    #[schema(default = 0, minimum = 0)]
    pub page: u32,
    /// Filter by category UUID.
    pub category_id: Option<Uuid>,
    /// Filter by `income` or `expense`.
    pub r#type: Option<String>,
    /// Filter by start date (inclusive, ISO `YYYY-MM-DD`).
    #[schema(value_type = String, format = Date)]
    pub start_date: Option<NaiveDate>,
    /// Filter by end date (inclusive, ISO `YYYY-MM-DD`).
    #[schema(value_type = String, format = Date)]
    pub end_date: Option<NaiveDate>,
}

fn default_page_size() -> u32 {
    50
}

/// Response wrapper for paginated transaction lists.
#[derive(Debug, Serialize, ToSchema)]
pub struct TransactionListResponse {
    /// Returned items for this page.
    pub items: Vec<Transaction>,
    /// Total row count matching the filters (regardless of pagination).
    pub total: i64,
    /// Current page offset.
    pub page: u32,
    /// Page size used for this request.
    pub page_size: u32,
}

/// Per-category totals for the summary endpoint.
#[derive(Debug, Serialize, ToSchema)]
pub struct CategorySummary {
    /// Category UUID (null for transactions without a category).
    pub category_id: Option<Uuid>,
    /// Category display name.
    pub category_name: Option<String>,
    /// Hex color code for the category.
    pub color: Option<String>,
    /// Icon identifier for the category.
    pub icon: Option<String>,
    /// Total amount for this category.
    #[schema(value_type = String)]
    pub total: Decimal,
}

/// Monthly summary response: income, expense, balance, and category breakdown.
#[derive(Debug, Serialize, ToSchema)]
pub struct SummaryResponse {
    /// Total income for the selected month (positive value).
    #[schema(value_type = String)]
    pub income_total: Decimal,
    /// Total expenses for the selected month (positive value).
    #[schema(value_type = String)]
    pub expense_total: Decimal,
    /// Balance = income − expense.
    #[schema(value_type = String)]
    pub balance: Decimal,
    /// Per-category breakdown for the month.
    pub by_category: Vec<CategorySummary>,
    /// Year used for the query.
    pub year: i32,
    /// Month used for the query (1-12).
    pub month: u32,
}

// ---------------------------------------------------------------------------
// Layer 2: Budgets
// ---------------------------------------------------------------------------

/// A monthly budget limit for a category.
#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct Budget {
    /// Unique budget identifier.
    pub id: Uuid,
    /// Category this budget applies to.
    pub category_id: Uuid,
    /// Month (1-12).
    pub month: i32,
    /// Year.
    pub year: i32,
    /// Maximum spend limit for the month.
    #[schema(value_type = String)]
    pub amount_limit: Decimal,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last row update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Budget joined with its category display info.
#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct BudgetWithCategory {
    /// Unique budget identifier.
    pub id: Uuid,
    /// Category id this budget applies to.
    pub category_id: Uuid,
    /// Category name.
    pub category_name: String,
    /// Category icon identifier.
    pub icon: Option<String>,
    /// Category hex color.
    pub color: Option<String>,
    /// Month (1-12).
    pub month: i32,
    /// Year.
    pub year: i32,
    /// Maximum spend limit for the month.
    #[schema(value_type = String)]
    pub amount_limit: Decimal,
}

/// Payload for creating or updating a budget (upsert).
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateBudgetRequest {
    /// Category this budget applies to (expense categories only).
    pub category_id: Uuid,
    /// Month (1-12).
    #[schema(minimum = 1, maximum = 12)]
    pub month: i32,
    /// Year.
    pub year: i32,
    /// Maximum spend limit — must be > 0.
    #[schema(value_type = String, example = "500.00")]
    pub amount_limit: Decimal,
}

/// Response for a paginated/period budget list.
#[derive(Debug, Serialize, ToSchema)]
pub struct BudgetListResponse {
    /// Budgets for the selected period.
    pub items: Vec<BudgetWithCategory>,
    /// Month used for the query.
    pub month: i32,
    /// Year used for the query.
    pub year: i32,
}

/// Budget vs actual spending for a single budget.
#[derive(Debug, Serialize, ToSchema)]
pub struct BudgetSummaryItem {
    /// The budget itself (with category info).
    pub budget: BudgetWithCategory,
    /// Actual spending for the category in the month (from transactions).
    #[schema(value_type = String)]
    pub actual_spent: Decimal,
    /// Percentage of the limit used (0-100+, can exceed 100).
    #[schema(value_type = String)]
    pub percentage: Decimal,
    /// Remaining amount = condition. negative => over budget.
    #[schema(value_type = String)]
    pub remaining: Decimal,
}

/// Response for the budget summary endpoint.
#[derive(Debug, Serialize, ToSchema)]
pub struct BudgetSummaryResponse {
    /// Per-budget spend vs limit.
    pub items: Vec<BudgetSummaryItem>,
    /// Sum of all budget limits for the period.
    #[schema(value_type = String)]
    pub total_budgeted: Decimal,
    /// Sum of all actual spending for budgeted categories.
    #[schema(value_type = String)]
    pub total_spent: Decimal,
    /// Month used for the query.
    pub month: i32,
    /// Year used for the query.
    pub year: i32,
}

// ---------------------------------------------------------------------------
// Layer 2: Reports
// ---------------------------------------------------------------------------

/// A single month's income/expense totals for the monthly report.
#[derive(Debug, Serialize, ToSchema)]
pub struct MonthlyReportItem {
    /// Year.
    pub year: i32,
    /// Month (1-12).
    pub month: i32,
    /// Total income for the month.
    #[schema(value_type = String)]
    pub income_total: Decimal,
    /// Total expenses for the month.
    #[schema(value_type = String)]
    pub expense_total: Decimal,
    /// Balance = income − expense.
    #[schema(value_type = String)]
    pub balance: Decimal,
}

/// Response for the monthly report.
#[derive(Debug, Serialize, ToSchema)]
pub struct MonthlyReportResponse {
    /// One entry per month in the requested range (chronological order).
    pub months: Vec<MonthlyReportItem>,
}

/// A single category's aggregated totals for the category-breakdown report.
#[derive(Debug, Serialize, ToSchema)]
pub struct CategoryBreakdownItem {
    /// Category UUID (null when uncategorised).
    pub category_id: Option<Uuid>,
    /// Category name.
    pub category_name: Option<String>,
    /// Hex color.
    pub color: Option<String>,
    /// Icon identifier.
    pub icon: Option<String>,
    /// Total amount for the category.
    #[schema(value_type = String)]
    pub total: Decimal,
    /// Percentage of all expenses for the period.
    #[schema(value_type = String)]
    pub percentage: Decimal,
    /// Number of transactions in this category.
    pub transaction_count: i64,
}

/// Response for the category-breakdown report.
#[derive(Debug, Serialize, ToSchema)]
pub struct CategoryBreakdownResponse {
    /// Per-category totals, sorted by total descending.
    pub categories: Vec<CategoryBreakdownItem>,
    /// Date range used (ISO dates).
    pub start_date: NaiveDate,
    /// Date range used (ISO dates).
    pub end_date: NaiveDate,
}

/// A single point in the trends report.
#[derive(Debug, Serialize, ToSchema)]
pub struct TrendPoint {
    /// Human-friendly label (e.g., "2026-04").
    pub month_label: String,
    /// Year.
    pub year: i32,
    /// Month (1-12).
    pub month: i32,
    /// Income for the month.
    #[schema(value_type = String)]
    pub income_total: Decimal,
    /// Expenses for the month.
    #[schema(value_type = String)]
    pub expense_total: Decimal,
    /// Net (income − expense) for the month.
    #[schema(value_type = String)]
    pub net: Decimal,
}

/// Response for the trends report.
#[derive(Debug, Serialize, ToSchema)]
pub struct TrendsResponse {
    /// Monthly points, chronological order.
    pub trends: Vec<TrendPoint>,
}

// ---------------------------------------------------------------------------
// Layer 3: Double-entry ledger
// ---------------------------------------------------------------------------

/// A chart-of-accounts account.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Account {
    /// Unique account identifier.
    pub id: Uuid,
    /// Account display name (e.g., "Cash").
    pub name: String,
    /// `asset`, `liability`, `equity`, `income`, or `expense`.
    pub r#type: String,
    /// Optional parent account.
    pub parent_id: Option<Uuid>,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// Payload for creating a new account.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateAccountRequest {
    /// Account display name (e.g., "Nubank Credit Card").
    pub name: String,
    /// `asset`, `liability`, `equity`, `income`, or `expense`.
    #[schema(example = "liability")]
    pub r#type: String,
    /// Optional parent account.
    pub parent_id: Option<Uuid>,
}

/// Payload for updating an existing account.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateAccountRequest {
    /// Account display name.
    pub name: String,
    /// `asset`, `liability`, `equity`, `income`, or `expense`.
    #[schema(example = "liability")]
    pub r#type: String,
    /// Optional parent account.
    pub parent_id: Option<Uuid>,
}

/// Account joined with its current computed balance from ledger entries.
#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct AccountWithBalance {
    /// Unique account identifier.
    pub id: Uuid,
    /// Account display name (e.g., "Credit Card").
    pub name: String,
    /// `asset`, `liability`, `equity`, `income`, or `expense`.
    pub r#type: String,
    /// Optional parent account.
    pub parent_id: Option<Uuid>,
    /// Row creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Balance = SUM(debit_amount) − SUM(credit_amount) across ledger entries.
    /// Positive for asset/expense accounts, negative for liability/income/equity
    /// under standard double-entry semantics.
    #[schema(value_type = String)]
    pub balance: Decimal,
    /// Total number of ledger entries posting to this account.
    pub transaction_count: i64,
}

const ACCOUNT_TYPES: [&str; 5] = ["asset", "liability", "equity", "income", "expense"];

/// Returns true if `t` is a valid chart-of-accounts type.
pub fn is_valid_account_type(t: &str) -> bool {
    ACCOUNT_TYPES.contains(&t)
}

/// Payload for creating a ledger transaction (double-entry).
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateLedgerTransactionRequest {
    /// Human-readable description (e.g., "Groceries at Supermarket X").
    pub description: String,
    /// Calendar date of the transaction.
    #[schema(value_type = String, format = Date, example = "2026-08-06")]
    pub date: NaiveDate,
    /// At least two entries; debits must equal credits.
    pub entries: Vec<LedgerEntryRequest>,
    /// Optional idempotency key (unique per client request).
    pub idempotency_key: Option<String>,
}

/// A single debit/credit entry in a ledger transaction.
#[derive(Debug, Deserialize, ToSchema)]
pub struct LedgerEntryRequest {
    /// Account this entry posts to.
    pub account_id: Uuid,
    /// Debit amount (positive; must be zero on credit entries).
    #[schema(value_type = String, example = "150.00")]
    pub debit_amount: Decimal,
    /// Credit amount (positive; must be zero on debit entries).
    #[schema(value_type = String, example = "0.00")]
    pub credit_amount: Decimal,
    /// Optional per-entry description.
    pub description: Option<String>,
}

/// A full ledger transaction with its entries.
#[derive(Debug, Serialize, ToSchema)]
pub struct LedgerTransaction {
    /// Unique transaction ID linking all entries.
    pub transaction_id: Uuid,
    /// Human-readable description.
    pub description: String,
    /// Calendar date.
    pub date: NaiveDate,
    /// All ledger entries (must balance: debits = credits).
    pub entries: Vec<LedgerEntry>,
    /// Recorded timestamp.
    pub recorded_at: DateTime<Utc>,
}

/// A single ledger entry.
#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
pub struct LedgerEntry {
    /// Unique entry identifier.
    pub id: Uuid,
    /// Transaction ID this entry belongs to.
    pub transaction_id: Uuid,
    /// Account ID this entry posts to.
    pub account_id: Uuid,
    /// Account display name (nullable, populated on list queries).
    pub account_name: Option<String>,
    /// Debit amount (always >= 0).
    #[schema(value_type = String)]
    pub debit_amount: Decimal,
    /// Credit amount (always >= 0).
    #[schema(value_type = String)]
    pub credit_amount: Decimal,
    /// Optional description.
    pub description: Option<String>,
    /// Recorded timestamp.
    pub recorded_at: DateTime<Utc>,
}

/// Response for creating a ledger transaction.
#[derive(Debug, Serialize, ToSchema)]
pub struct CreateLedgerTransactionResponse {
    /// The created ledger transaction.
    pub transaction: LedgerTransaction,
    /// HTTP status to return (201 or 200 for idempotent replay).
    pub status: u16,
}

/// Response for the migration endpoint.
#[derive(Debug, Serialize, ToSchema)]
pub struct MigrationResponse {
    /// Number of simple transactions examined.
    pub total_processed: i64,
    /// Number successfully migrated to double-entry.
    pub migrated: i64,
    /// Number already migrated (skipped).
    pub already_migrated: i64,
    /// Number that failed during migration.
    pub failed: i64,
}

// ---------------------------------------------------------------------------
// Layer 3: Reconciliation
// ---------------------------------------------------------------------------

/// A single line item from an uploaded bank statement.
#[derive(Debug, Deserialize, ToSchema)]
pub struct StatementLine {
    /// Transaction date (ISO `YYYY-MM-DD`).
    #[schema(value_type = String, format = Date)]
    pub date: NaiveDate,
    /// Description from the bank statement.
    pub description: String,
    /// Signed amount (negative for expense/debit, positive for income/credit).
    #[schema(value_type = String)]
    pub amount: Decimal,
}

/// Payload containing all CSV statement lines for reconciliation.
#[derive(Debug, Deserialize, ToSchema)]
pub struct ReconciliationUploadRequest {
    /// Name to identify this statement/reconciliation.
    pub statement_name: String,
    /// Statement lines parsed from the uploaded CSV.
    pub lines: Vec<StatementLine>,
}

/// A reconciliation item result (matched or unmatched).
#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct ReconciliationItem {
    /// Unique item identifier.
    pub id: Uuid,
    /// Reconciliation ID this item belongs to.
    pub reconciliation_id: Uuid,
    /// Statement date.
    pub statement_date: NaiveDate,
    /// Statement description.
    pub statement_description: String,
    /// Signed statement amount.
    #[schema(value_type = String)]
    pub statement_amount: Decimal,
    /// `matched` or `unmatched`.
    pub match_status: String,
    /// Transaction ID if matched, otherwise NULL.
    pub matched_transaction_id: Option<Uuid>,
    /// Match confidence (0-100).
    pub confidence: Option<Decimal>,
}

/// Response from a reconciliation upload.
#[derive(Debug, Serialize, ToSchema)]
pub struct ReconciliationUploadResponse {
    /// The reconciliation summary.
    pub reconciliation_id: Uuid,
    /// Total statement rows processed.
    pub total_rows: i64,
    /// Rows matched to existing transactions.
    pub matched_rows: i64,
    /// Rows that don't match any existing transaction.
    pub unmatched_rows: i64,
    /// Per-row match results.
    pub items: Vec<ReconciliationItem>,
}
