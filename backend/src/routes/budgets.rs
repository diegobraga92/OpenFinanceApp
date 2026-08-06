//! Budget CRUD endpoints.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use chrono::{Datelike, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::json;
use tracing::error;
use uuid::Uuid;

use crate::models::{
    BudgetListResponse, BudgetSummaryItem, BudgetSummaryResponse, BudgetWithCategory,
    CreateBudgetRequest,
};
use crate::state::AppState;

/// Query parameters for the budget list and summary.
#[derive(Debug, Default, Deserialize)]
pub struct BudgetParams {
    /// Year (default: current year).
    pub year: Option<i32>,
    /// Month 1-12 (default: current month).
    pub month: Option<i32>,
}

/// Returns a sub-router with all budget routes mounted under `/api/budgets`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/budgets", get(list_budgets).post(create_budget))
        .route("/api/budgets/summary", get(budget_summary))
        .route("/api/budgets/{id}", axum::routing::delete(delete_budget))
}

/// Resolves year/month from query params, defaulting to the current month.
fn resolve_period(
    params: &BudgetParams,
) -> Result<(i32, i32), (StatusCode, Json<serde_json::Value>)> {
    let now = Utc::now();
    let year = params.year.unwrap_or_else(|| now.year());
    let month = params.month.unwrap_or_else(|| now.month() as i32);

    if !(1..=12).contains(&month) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "month must be between 1 and 12" })),
        ));
    }

    Ok((year, month))
}

/// Lists budgets for a given month/year, joined with category display info.
#[utoipa::path(
    get,
    path = "/api/budgets",
    tag = "Budgets",
    params(
        ("year" = Option<i32>, Query, description = "Year (default: current)"),
        ("month" = Option<i32>, Query, description = "Month 1-12 (default: current)"),
    ),
    responses(
        (status = 200, description = "List of budgets for the period", body = BudgetListResponse),
        (status = 400, description = "Invalid month parameter"),
    ),
)]
pub async fn list_budgets(
    State(state): State<AppState>,
    Query(params): Query<BudgetParams>,
) -> Result<Json<BudgetListResponse>, (StatusCode, Json<serde_json::Value>)> {
    let (year, month) = resolve_period(&params)?;

    let items: Vec<BudgetWithCategory> = sqlx::query_as(
        "SELECT b.id, b.category_id, c.name AS category_name,
                c.icon, c.color, b.month::int, b.year::int, b.amount_limit
         FROM budgets b
         JOIN categories c ON c.id = b.category_id
         WHERE b.year = $1 AND b.month = $2
         ORDER BY c.name",
    )
    .bind(year)
    .bind(month)
    .fetch_all(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to list budgets: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch budgets" })),
        )
    })?;

    Ok(Json(BudgetListResponse { items, month, year }))
}

/// Creates or updates a budget (upsert on (category_id, month, year)).
#[utoipa::path(
    post,
    path = "/api/budgets",
    tag = "Budgets",
    request_body = CreateBudgetRequest,
    responses(
        (status = 201, description = "Budget created", body = BudgetWithCategory),
        (status = 200, description = "Budget updated", body = BudgetWithCategory),
        (status = 400, description = "Invalid budget payload"),
    ),
)]
pub async fn create_budget(
    State(state): State<AppState>,
    Json(payload): Json<CreateBudgetRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    if !(1..=12).contains(&payload.month) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "month must be between 1 and 12" })),
        ));
    }
    if payload.amount_limit <= Decimal::ZERO {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "amount_limit must be greater than zero" })),
        ));
    }

    // Category must exist and be an expense category.
    let category_type: Option<String> =
        sqlx::query_scalar("SELECT type FROM categories WHERE id = $1")
            .bind(payload.category_id)
            .fetch_optional(&state.pg_pool)
            .await
            .map_err(|e| {
                error!("Failed to check category: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Failed to validate category" })),
                )
            })?;

    let cat_type = match category_type {
        Some(t) => t,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "category_id does not reference an existing category" })),
            ))
        }
    };
    if cat_type != "expense" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "budgets can only be created for expense categories" })),
        ));
    }

    let category = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<String>)>(
        "SELECT id, name, icon, color FROM categories WHERE id = $1",
    )
    .bind(payload.category_id)
    .fetch_one(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch category info: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch category info" })),
        )
    })?;

    // Upsert: create if no budget exists for (category_id, month, year), update otherwise.
    let inserted = sqlx::query_scalar::<_, bool>(
        "INSERT INTO budgets (category_id, month, year, amount_limit)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (category_id, month, year) DO UPDATE
         SET amount_limit = EXCLUDED.amount_limit, updated_at = NOW()
         RETURNING (xmax = 0) AS inserted",
    )
    .bind(payload.category_id)
    .bind(payload.month)
    .bind(payload.year)
    .bind(payload.amount_limit)
    .fetch_one(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to upsert budget: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to create/update budget" })),
        )
    })?;

    let id: Uuid = sqlx::query_scalar(
        "SELECT id FROM budgets WHERE category_id = $1 AND month = $2 AND year = $3",
    )
    .bind(payload.category_id)
    .bind(payload.month)
    .bind(payload.year)
    .fetch_one(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch budget id: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch budget" })),
        )
    })?;

    let budget = BudgetWithCategory {
        id,
        category_id: category.0,
        category_name: category.1,
        icon: category.2,
        color: category.3,
        month: payload.month,
        year: payload.year,
        amount_limit: payload.amount_limit,
    };

    let status = if inserted {
        StatusCode::CREATED
    } else {
        StatusCode::OK
    };

    Ok((status, Json(budget)))
}

/// Returns budget vs actual spending for a given month/year.
#[utoipa::path(
    get,
    path = "/api/budgets/summary",
    tag = "Budgets",
    params(
        ("year" = Option<i32>, Query, description = "Year (default: current)"),
        ("month" = Option<i32>, Query, description = "Month 1-12 (default: current)"),
    ),
    responses(
        (status = 200, description = "Budget vs actual summary", body = BudgetSummaryResponse),
        (status = 400, description = "Invalid month parameter"),
    ),
)]
pub async fn budget_summary(
    State(state): State<AppState>,
    Query(params): Query<BudgetParams>,
) -> Result<Json<BudgetSummaryResponse>, (StatusCode, Json<serde_json::Value>)> {
    let (year, month) = resolve_period(&params)?;

    // Fetch each budget joined with category, plus actual spending for the month.
    #[derive(sqlx::FromRow)]
    struct BudgetRow {
        id: Uuid,
        category_id: Uuid,
        category_name: String,
        icon: Option<String>,
        color: Option<String>,
        month: i32,
        year: i32,
        amount_limit: Decimal,
        actual_spent: Option<Decimal>,
    }

    let rows: Vec<BudgetRow> = sqlx::query_as(
        "SELECT b.id, b.category_id, c.name AS category_name,
                c.icon, c.color, b.month::int, b.year::int, b.amount_limit,
                (SELECT COALESCE(SUM(t.amount), 0)::numeric
                 FROM transactions t
                 WHERE t.category_id = b.category_id
                   AND t.type = 'expense'
                   AND EXTRACT(YEAR FROM t.date)::int = b.year
                   AND EXTRACT(MONTH FROM t.date)::int = b.month) AS actual_spent
         FROM budgets b
         JOIN categories c ON c.id = b.category_id
         WHERE b.year = $1 AND b.month = $2
         ORDER BY c.name",
    )
    .bind(year)
    .bind(month)
    .fetch_all(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch budget summary: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch budget summary" })),
        )
    })?;

    let mut items = Vec::with_capacity(rows.len());
    let mut total_budgeted = Decimal::ZERO;
    let mut total_spent = Decimal::ZERO;

    for row in rows {
        let actual = row.actual_spent.unwrap_or_default();
        let percentage = if row.amount_limit > Decimal::ZERO {
            (actual / row.amount_limit) * Decimal::from(100)
        } else {
            Decimal::ZERO
        };
        let remaining = row.amount_limit - actual;

        total_budgeted += row.amount_limit;
        total_spent += actual;

        items.push(BudgetSummaryItem {
            budget: BudgetWithCategory {
                id: row.id,
                category_id: row.category_id,
                category_name: row.category_name,
                icon: row.icon,
                color: row.color,
                month: row.month,
                year: row.year,
                amount_limit: row.amount_limit,
            },
            actual_spent: actual,
            percentage,
            remaining,
        });
    }

    Ok(Json(BudgetSummaryResponse {
        items,
        total_budgeted,
        total_spent,
        month,
        year,
    }))
}

/// Deletes a budget by ID.
#[utoipa::path(
    delete,
    path = "/api/budgets/{id}",
    tag = "Budgets",
    params(
        ("id" = Uuid, Path, description = "Budget UUID"),
    ),
    responses(
        (status = 204, description = "Budget deleted"),
        (status = 404, description = "Budget not found"),
    ),
)]
pub async fn delete_budget(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query("DELETE FROM budgets WHERE id = $1")
        .bind(id)
        .execute(&state.pg_pool)
        .await
        .map_err(|e| {
            error!("Failed to delete budget {}: {}", id, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to delete budget" })),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Budget not found" })),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
