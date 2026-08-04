use utoipa::OpenApi;

use crate::health;
use crate::models::{
    Category, CategorySummary, CreateCategoryRequest, CreateTransactionRequest, SummaryResponse,
    Transaction, TransactionListParams, TransactionListResponse, UpdateTransactionRequest,
};
use crate::routes::categories::{self, CategoryListParams};
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
    ),
    components(schemas(
        health::HealthResponse,
        health::HealthError,
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
    ),
    // Public API: no authentication required. Empty security requirement
    // documents that explicitly (satisfies OpenAPI `security-defined`).
    security(
        (),
    ),
)]
pub struct ApiDoc;
