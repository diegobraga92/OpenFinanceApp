//! Transaction CRUD endpoints.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use rust_decimal::Decimal;
use serde_json::json;
use tracing::error;
use uuid::Uuid;

use crate::models::{
    CreateTransactionRequest, Transaction, TransactionListParams, TransactionListResponse,
    UpdateTransactionRequest,
};
use crate::state::AppState;

/// Returns a sub-router with all transaction routes mounted under `/api/transactions`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/transactions",
            get(list_transactions).post(create_transaction),
        )
        .route(
            "/api/transactions/{id}",
            get(get_transaction)
                .put(update_transaction)
                .delete(delete_transaction),
        )
}

/// Lists transactions, with optional filters (category, type, date range) and pagination.
#[utoipa::path(
    get,
    path = "/api/transactions",
    tag = "Transactions",
    params(
        ("page_size" = Option<u32>, Query, description = "Page size (default 50, max 200)"),
        ("page" = Option<u32>, Query, description = "Page offset (default 0)"),
        ("category_id" = Option<Uuid>, Query, description = "Filter by category UUID"),
        ("type" = Option<String>, Query, description = "Filter by 'income' or 'expense'"),
        ("start_date" = Option<String>, Query, description = "Filter by start date (inclusive)"),
        ("end_date" = Option<String>, Query, description = "Filter by end date (inclusive)"),
    ),
    responses(
        (status = 200, description = "Paginated list of transactions", body = TransactionListResponse),
        (status = 400, description = "Invalid filter parameters"),
    ),
)]
pub async fn list_transactions(
    State(state): State<AppState>,
    Query(params): Query<TransactionListParams>,
) -> Result<Json<TransactionListResponse>, (StatusCode, Json<serde_json::Value>)> {
    let page_size = params.page_size.clamp(1, 200);
    let offset = params.page.saturating_mul(page_size);

    if let Some(t) = &params.r#type {
        if t != "income" && t != "expense" {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "type must be 'income' or 'expense'" })),
            ));
        }
    }

    if let (Some(start), Some(end)) = (&params.start_date, &params.end_date) {
        if start > end {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "start_date must be before or equal to end_date" })),
            ));
        }
    }

    // Use nullable bind parameters: `$1::uuid IS NULL OR category_id = $1` pattern
    // allows a single static SQL query with optional filters.
    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM transactions
         WHERE ($1::uuid IS NULL OR category_id = $1)
           AND ($2::text IS NULL OR type = $2)
           AND ($3::date IS NULL OR date >= $3)
           AND ($4::date IS NULL OR date <= $4)
           AND ($5::uuid IS NULL OR account_id = $5)",
    )
    .bind(params.category_id)
    .bind(&params.r#type)
    .bind(params.start_date)
    .bind(params.end_date)
    .bind(params.account_id)
    .fetch_one(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to count transactions: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to count transactions" })),
        )
    })?;

    let items: Vec<Transaction> = sqlx::query_as(
        "SELECT id, description, amount, type, category_id, date, notes,
                installment_plan_id, account_id, created_at, updated_at
         FROM transactions
         WHERE ($1::uuid IS NULL OR category_id = $1)
           AND ($2::text IS NULL OR type = $2)
           AND ($3::date IS NULL OR date >= $3)
           AND ($4::date IS NULL OR date <= $4)
           AND ($5::uuid IS NULL OR account_id = $5)
         ORDER BY date DESC, created_at DESC
         LIMIT $6 OFFSET $7",
    )
    .bind(params.category_id)
    .bind(&params.r#type)
    .bind(params.start_date)
    .bind(params.end_date)
    .bind(params.account_id)
    .bind(page_size as i64)
    .bind(offset as i64)
    .fetch_all(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to list transactions: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch transactions" })),
        )
    })?;

    Ok(Json(TransactionListResponse {
        items,
        total: total.0,
        page: params.page,
        page_size,
    }))
}

/// Creates a new transaction.
#[utoipa::path(
    post,
    path = "/api/transactions",
    tag = "Transactions",
    request_body = CreateTransactionRequest,
    responses(
        (status = 201, description = "Transaction created", body = Transaction),
        (status = 400, description = "Invalid transaction payload"),
    ),
)]
pub async fn create_transaction(
    State(state): State<AppState>,
    Json(payload): Json<CreateTransactionRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    validate_transaction_payload(&payload.description, payload.amount, &payload.r#type)?;

    if let Some(cid) = payload.category_id {
        let exists: Option<Uuid> = sqlx::query_scalar("SELECT id FROM categories WHERE id = $1")
            .bind(cid)
            .fetch_optional(&state.pg_pool)
            .await
            .map_err(|e| {
                error!("Failed to validate category: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Failed to validate category" })),
                )
            })?;

        if exists.is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "category_id does not reference an existing category" })),
            ));
        }
    }

    if let Some(aid) = payload.account_id {
        let exists: Option<Uuid> = sqlx::query_scalar("SELECT id FROM accounts WHERE id = $1")
            .bind(aid)
            .fetch_optional(&state.pg_pool)
            .await
            .map_err(|e| {
                error!("Failed to validate account: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Failed to validate account" })),
                )
            })?;

        if exists.is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "account_id does not reference an existing account" })),
            ));
        }
    }

    let transaction = sqlx::query_as::<_, Transaction>(
        "INSERT INTO transactions (description, amount, type, category_id, date, notes, installment_plan_id, account_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, description, amount, type, category_id, date, notes,
                   installment_plan_id, account_id, created_at, updated_at",
    )
    .bind(payload.description.trim())
    .bind(payload.amount)
    .bind(&payload.r#type)
    .bind(payload.category_id)
    .bind(payload.date)
    .bind(&payload.notes)
    .bind(payload.installment_plan_id)
    .bind(payload.account_id)
    .fetch_one(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to create transaction: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to create transaction" })),
        )
    })?;

    Ok((StatusCode::CREATED, Json(transaction)))
}

/// Returns a single transaction by ID.
#[utoipa::path(
    get,
    path = "/api/transactions/{id}",
    tag = "Transactions",
    params(
        ("id" = Uuid, Path, description = "Transaction UUID"),
    ),
    responses(
        (status = 200, description = "Transaction found", body = Transaction),
        (status = 404, description = "Transaction not found"),
    ),
)]
pub async fn get_transaction(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Transaction>, (StatusCode, Json<serde_json::Value>)> {
    let transaction = sqlx::query_as::<_, Transaction>(
        "SELECT id, description, amount, type, category_id, date, notes,
                installment_plan_id, account_id, created_at, updated_at
         FROM transactions WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch transaction {}: {}", id, e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch transaction" })),
        )
    })?;

    match transaction {
        Some(t) => Ok(Json(t)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Transaction not found" })),
        )),
    }
}

/// Updates an existing transaction.
#[utoipa::path(
    put,
    path = "/api/transactions/{id}",
    tag = "Transactions",
    params(
        ("id" = Uuid, Path, description = "Transaction UUID"),
    ),
    request_body = UpdateTransactionRequest,
    responses(
        (status = 200, description = "Transaction updated", body = Transaction),
        (status = 400, description = "Invalid transaction payload"),
        (status = 404, description = "Transaction not found"),
    ),
)]
pub async fn update_transaction(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransactionRequest>,
) -> Result<Json<Transaction>, (StatusCode, Json<serde_json::Value>)> {
    validate_transaction_payload(&payload.description, payload.amount, &payload.r#type)?;

    if let Some(cid) = payload.category_id {
        let exists: Option<Uuid> = sqlx::query_scalar("SELECT id FROM categories WHERE id = $1")
            .bind(cid)
            .fetch_optional(&state.pg_pool)
            .await
            .map_err(|e| {
                error!("Failed to validate category: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Failed to validate category" })),
                )
            })?;

        if exists.is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "category_id does not reference an existing category" })),
            ));
        }
    }

    if let Some(aid) = payload.account_id {
        let exists: Option<Uuid> = sqlx::query_scalar("SELECT id FROM accounts WHERE id = $1")
            .bind(aid)
            .fetch_optional(&state.pg_pool)
            .await
            .map_err(|e| {
                error!("Failed to validate account: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Failed to validate account" })),
                )
            })?;

        if exists.is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "account_id does not reference an existing account" })),
            ));
        }
    }

    let result = sqlx::query_as::<_, Transaction>(
        "UPDATE transactions
         SET description = $1, amount = $2, type = $3, category_id = $4,
             date = $5, notes = $6, installment_plan_id = $7, account_id = $8, updated_at = NOW()
         WHERE id = $9
         RETURNING id, description, amount, type, category_id, date, notes,
                   installment_plan_id, account_id, created_at, updated_at",
    )
    .bind(payload.description.trim())
    .bind(payload.amount)
    .bind(&payload.r#type)
    .bind(payload.category_id)
    .bind(payload.date)
    .bind(&payload.notes)
    .bind(payload.installment_plan_id)
    .bind(payload.account_id)
    .bind(id)
    .fetch_optional(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to update transaction {}: {}", id, e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to update transaction" })),
        )
    })?;

    match result {
        Some(t) => Ok(Json(t)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Transaction not found" })),
        )),
    }
}

/// Deletes a transaction by ID.
#[utoipa::path(
    delete,
    path = "/api/transactions/{id}",
    tag = "Transactions",
    params(
        ("id" = Uuid, Path, description = "Transaction UUID"),
    ),
    responses(
        (status = 204, description = "Transaction deleted"),
        (status = 404, description = "Transaction not found"),
    ),
)]
pub async fn delete_transaction(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query("DELETE FROM transactions WHERE id = $1")
        .bind(id)
        .execute(&state.pg_pool)
        .await
        .map_err(|e| {
            error!("Failed to delete transaction {}: {}", id, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to delete transaction" })),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Transaction not found" })),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Shared validation for transaction create/update payloads.
fn validate_transaction_payload(
    description: &str,
    amount: Decimal,
    ttype: &str,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    if description.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "description must not be empty" })),
        ));
    }
    if amount <= Decimal::ZERO {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "amount must be greater than zero" })),
        ));
    }
    if ttype != "income" && ttype != "expense" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "type must be 'income' or 'expense'" })),
        ));
    }
    Ok(())
}
