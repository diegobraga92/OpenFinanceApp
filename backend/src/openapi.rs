use utoipa::OpenApi;

use crate::health;
use crate::models::{
    Account, Budget, BudgetListResponse, BudgetSummaryItem, BudgetSummaryResponse,
    BudgetWithCategory, Category, CategoryBreakdownItem, CategoryBreakdownResponse,
    CategorySummary, CreateBudgetRequest, CreateCategoryRequest, CreateLedgerTransactionRequest,
    CreateLedgerTransactionResponse, CreateTransactionRequest, LedgerEntry, LedgerEntryRequest,
    LedgerTransaction, MigrationResponse, MonthlyReportItem, MonthlyReportResponse,
    ReconciliationItem, ReconciliationUploadRequest, ReconciliationUploadResponse, StatementLine,
    SummaryResponse, Transaction, TransactionListParams, TransactionListResponse, TrendPoint,
    TrendsResponse, UpdateTransactionRequest,
};
use crate::routes::audit;
use crate::routes::auth::{self, LoginRequest, RefreshRequest, RegisterRequest};
use crate::routes::budgets;
use crate::routes::categories::{self, CategoryListParams};
use crate::routes::ledger;
use crate::routes::receipts;
use crate::routes::reports;
use crate::routes::summary::{self, SummaryParams};
use crate::routes::transactions;

/// Root OpenAPI document for the PudimFinance API.
///
/// Aggregates utoipa path/schema annotations from the backend handlers
/// and is used by both the Swagger UI at runtime and the `gen-openapi` binary.
#[derive(OpenApi)]
#[openapi(
    paths(
        health::health_handler,
        health::metrics_handler_doc,
        categories::list_categories,
        categories::create_category,
        transactions::list_transactions,
        transactions::create_transaction,
        transactions::get_transaction,
        transactions::update_transaction,
        transactions::delete_transaction,
        summary::get_summary,
        budgets::list_budgets,
        budgets::create_budget,
        budgets::budget_summary,
        budgets::delete_budget,
        reports::monthly_report,
        reports::category_breakdown,
        reports::trends,
        ledger::create_ledger_transaction,
        ledger::list_ledger_transactions,
        ledger::list_accounts,
        ledger::migrate_single_to_double,
        ledger::reconcile,
        auth::register,
        auth::login,
        auth::refresh,
        auth::me,
        audit::list_audit_events,
        receipts::scan,
        receipts::save_receipt,
        receipts::list_receipts,
        receipts::price_history,
        receipts::merge_products,
    ),
    components(schemas(
        health::HealthResponse,
        health::HealthError,
        RegisterRequest,
        LoginRequest,
        RefreshRequest,
        Account,
        CreateLedgerTransactionRequest,
        CreateLedgerTransactionResponse,
        LedgerEntry,
        LedgerEntryRequest,
        LedgerTransaction,
        MigrationResponse,
        ReconciliationItem,
        ReconciliationUploadRequest,
        ReconciliationUploadResponse,
        StatementLine,
        Category,
        CreateCategoryRequest,
        CategoryListParams,
        Transaction,
        CreateTransactionRequest,
        UpdateTransactionRequest,
        TransactionListParams,
        TransactionListResponse,
        SummaryResponse,
        CategorySummary,
        SummaryParams,
        Budget,
        CreateBudgetRequest,
        BudgetListResponse,
        BudgetWithCategory,
        BudgetSummaryItem,
        BudgetSummaryResponse,
        MonthlyReportItem,
        MonthlyReportResponse,
        CategoryBreakdownItem,
        CategoryBreakdownResponse,
        TrendPoint,
        TrendsResponse,
    )),
    info(
        title = "PudimFinance API",
        version = env!("CARGO_PKG_VERSION"),
        description = "Personal finance application API. Immutable double-entry ledger, \
                       event sourcing, real-time reporting, receipt scanning and price tracking.",
    ),
    servers(
        (url = "http://localhost:3000", description = "Local development"),
    ),
    tags(
        (name = "Health", description = "Health check and observability endpoints"),
        (name = "Categories", description = "Transaction category management"),
        (name = "Transactions", description = "Income and expense tracking"),
        (name = "Summary", description = "Monthly income/expense/balance summaries"),
        (name = "Budgets", description = "Monthly budget limits and budget vs actual tracking"),
        (name = "Reports", description = "Monthly reports, category breakdowns, and trends"),
        (name = "Ledger", description = "Double-entry ledger, event sourcing, and reconciliation"),
        (name = "Auth", description = "User registration, login, token refresh, and profile"),
        (name = "Audit", description = "Admin-only audit event search"),
        (name = "Receipts", description = "Receipt scanning (NFC-e QR), price history, and product normalization"),
    ),
    // Public API: no authentication required. Empty security requirement
    // documents that explicitly (satisfies OpenAPI `security-defined`).
    security(
        (),
    ),
)]
pub struct ApiDoc;
