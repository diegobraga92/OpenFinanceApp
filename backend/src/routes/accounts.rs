//! Account CRUD endpoints.
//!
//! Manages the chart of accounts (assets, liabilities, credit cards, income,
//! expense, equity). Account balances are computed on the fly from the
//! immutable `ledger_entries` table.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;
use tracing::error;
use uuid::Uuid;

use crate::models::{
    is_valid_account_type, Account, AccountWithBalance, CreateAccountRequest, UpdateAccountRequest,
};
use crate::state::AppState;

/// Returns a sub-router with all account routes mounted under `/api/accounts`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/accounts", get(list_accounts).post(create_account))
        .route(
            "/api/accounts/{id}",
            get(get_account).put(update_account).delete(delete_account),
        )
}

/// Lists all accounts with their computed balances.
#[utoipa::path(
    get,
    path = "/api/accounts",
    tag = "Accounts",
    responses(
        (status = 200, description = "List of accounts with balances", body = [AccountWithBalance]),
    ),
)]
pub async fn list_accounts(
    State(state): State<AppState>,
) -> Result<Json<Vec<AccountWithBalance>>, (StatusCode, Json<serde_json::Value>)> {
    let accounts = sqlx::query_as::<_, AccountWithBalance>(
        "SELECT a.id, a.name, a.type, a.parent_id, a.created_at,
                COALESCE(SUM(e.debit_amount) - SUM(e.credit_amount), 0) AS balance,
                COUNT(e.id) AS transaction_count
         FROM accounts a
         LEFT JOIN ledger_entries e ON e.account_id = a.id
         GROUP BY a.id
         ORDER BY
           CASE a.type
             WHEN 'asset' THEN 0
             WHEN 'liability' THEN 1
             WHEN 'equity' THEN 2
             WHEN 'income' THEN 3
             ELSE 4
           END,
           a.name",
    )
    .fetch_all(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to list accounts: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to list accounts" })),
        )
    })?;

    Ok(Json(accounts))
}

/// Fetches a single account with its computed balance.
#[utoipa::path(
    get,
    path = "/api/accounts/{id}",
    tag = "Accounts",
    params(
        ("id" = Uuid, Path, description = "Account UUID"),
    ),
    responses(
        (status = 200, description = "Account found", body = AccountWithBalance),
        (status = 404, description = "Account not found"),
    ),
)]
pub async fn get_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AccountWithBalance>, (StatusCode, Json<serde_json::Value>)> {
    let account = sqlx::query_as::<_, AccountWithBalance>(
        "SELECT a.id, a.name, a.type, a.parent_id, a.created_at,
                COALESCE(SUM(e.debit_amount) - SUM(e.credit_amount), 0) AS balance,
                COUNT(e.id) AS transaction_count
         FROM accounts a
         LEFT JOIN ledger_entries e ON e.account_id = a.id
         WHERE a.id = $1
         GROUP BY a.id",
    )
    .bind(id)
    .fetch_optional(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch account: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch account" })),
        )
    })?;

    match account {
        Some(acc) => Ok(Json(acc)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Account not found" })),
        )),
    }
}

/// Validates a parent account id, returning a 400 error string on failure.
async fn validate_parent(
    state: &AppState,
    parent_id: Option<Uuid>,
    self_id: Option<Uuid>,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    if let Some(pid) = parent_id {
        if self_id == Some(pid) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "parent_id cannot reference the account itself" })),
            ));
        }
        let exists: Option<Uuid> = sqlx::query_scalar("SELECT id FROM accounts WHERE id = $1")
            .bind(pid)
            .fetch_optional(&state.pg_pool)
            .await
            .map_err(|e| {
                error!("Failed to validate parent account: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Failed to validate parent account" })),
                )
            })?;

        if exists.is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "parent_id does not reference an existing account" })),
            ));
        }
    }
    Ok(())
}

/// Creates a new account.
///
/// Returns `400` if the payload is invalid (missing name, invalid type,
/// non-existent parent).
#[utoipa::path(
    post,
    path = "/api/accounts",
    tag = "Accounts",
    request_body = CreateAccountRequest,
    responses(
        (status = 201, description = "Account created", body = Account),
        (status = 400, description = "Invalid account payload"),
    ),
)]
pub async fn create_account(
    State(state): State<AppState>,
    Json(payload): Json<CreateAccountRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "name must not be empty" })),
        ));
    }

    if !is_valid_account_type(&payload.r#type) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "type must be one of: asset, liability, equity, income, expense"
            })),
        ));
    }

    validate_parent(&state, payload.parent_id, None).await?;

    let account = sqlx::query_as::<_, Account>(
        "INSERT INTO accounts (name, type, parent_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, type, parent_id, created_at",
    )
    .bind(name)
    .bind(&payload.r#type)
    .bind(payload.parent_id)
    .fetch_one(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to create account: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to create account" })),
        )
    })?;

    Ok((StatusCode::CREATED, Json(account)))
}

/// Updates an existing account.
///
/// Returns `404` if the account does not exist, `400` for invalid payloads.
#[utoipa::path(
    put,
    path = "/api/accounts/{id}",
    tag = "Accounts",
    params(
        ("id" = Uuid, Path, description = "Account UUID"),
    ),
    request_body = UpdateAccountRequest,
    responses(
        (status = 200, description = "Account updated", body = Account),
        (status = 400, description = "Invalid account payload"),
        (status = 404, description = "Account not found"),
    ),
)]
pub async fn update_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAccountRequest>,
) -> Result<Json<Account>, (StatusCode, Json<serde_json::Value>)> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "name must not be empty" })),
        ));
    }

    if !is_valid_account_type(&payload.r#type) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "type must be one of: asset, liability, equity, income, expense"
            })),
        ));
    }

    validate_parent(&state, payload.parent_id, Some(id)).await?;

    let result = sqlx::query_as::<_, Account>(
        "UPDATE accounts SET name = $1, type = $2, parent_id = $3 WHERE id = $4
         RETURNING id, name, type, parent_id, created_at",
    )
    .bind(name)
    .bind(&payload.r#type)
    .bind(payload.parent_id)
    .bind(id)
    .fetch_optional(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to update account: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to update account" })),
        )
    })?;

    match result {
        Some(acc) => Ok(Json(acc)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Account not found" })),
        )),
    }
}

/// Deletes an account.
///
/// Returns `409` if ledger entries or sub-accounts reference it,
/// `404` if the account does not exist.
#[utoipa::path(
    delete,
    path = "/api/accounts/{id}",
    tag = "Accounts",
    params(
        ("id" = Uuid, Path, description = "Account UUID"),
    ),
    responses(
        (status = 204, description = "Account deleted"),
        (status = 404, description = "Account not found"),
        (status = 409, description = "Account is in use"),
    ),
)]
pub async fn delete_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Refuse to delete if ledger entries reference it.
    let entry_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM ledger_entries WHERE account_id = $1")
            .bind(id)
            .fetch_one(&state.pg_pool)
            .await
            .map_err(|e| {
                error!("Failed to check ledger references: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Failed to check account usage" })),
                )
            })?;

    if entry_count.0 > 0 {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({
                "error": format!(
                    "Account is used by {} ledger entr{}. Reassign or delete them first.",
                    entry_count.0,
                    if entry_count.0 == 1 { "y" } else { "ies" }
                )
            })),
        ));
    }

    // Refuse to delete if it is a parent of other accounts.
    let child_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM accounts WHERE parent_id = $1")
        .bind(id)
        .fetch_one(&state.pg_pool)
        .await
        .map_err(|e| {
            error!("Failed to check sub-account references: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to check account usage" })),
            )
        })?;

    if child_count.0 > 0 {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({
                "error": format!(
                    "Account has {} sub-account{} that depend on it. Remove them first.",
                    child_count.0,
                    if child_count.0 == 1 { "" } else { "s" }
                )
            })),
        ));
    }

    let result = sqlx::query("DELETE FROM accounts WHERE id = $1")
        .bind(id)
        .execute(&state.pg_pool)
        .await
        .map_err(|e| {
            error!("Failed to delete account: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to delete account" })),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Account not found" })),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
