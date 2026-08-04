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
