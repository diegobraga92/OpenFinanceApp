//! Offline sync endpoints for the mobile app.
//!
//! `POST /api/sync/pull` returns entities changed since the client's last sync.
//! `POST /api/sync/push` applies a batch of client mutations (create/update/
//! delete) idempotently using client-generated UUIDs as idempotency keys.

use axum::extract::State;
use axum::http::StatusCode;
use axum::{Json, Router};
use chrono::Utc;
use serde_json::json;
use tracing::error;
use uuid::Uuid;

use crate::models::{
    Category, SyncOpResult, SyncOperation, SyncPullRequest, SyncPullResponse, SyncPushRequest,
    SyncPushResponse, Transaction,
};
use crate::state::AppState;

/// Sync sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/sync/pull", axum::routing::post(pull))
        .route("/api/sync/push", axum::routing::post(push))
}

/// Pulls entities changed since `last_synced_at`.
#[utoipa::path(
    post,
    path = "/api/sync/pull",
    tag = "Sync",
    request_body = SyncPullRequest,
    responses(
        (status = 200, description = "Changed entities since last sync", body = SyncPullResponse),
    ),
)]
pub async fn pull(
    State(state): State<AppState>,
    Json(payload): Json<SyncPullRequest>,
) -> Result<Json<SyncPullResponse>, (StatusCode, Json<serde_json::Value>)> {
    let categories: Vec<Category> = sqlx::query_as(
        "SELECT id, name, type, parent_id, icon, color, created_at, updated_at
         FROM categories
         WHERE updated_at > $1 OR created_at > $1
         ORDER BY name",
    )
    .bind(payload.last_synced_at)
    .fetch_all(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Sync pull categories failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to pull categories" })),
        )
    })?;

    let transactions: Vec<Transaction> = sqlx::query_as(
        "SELECT id, description, amount, type, category_id, date, notes,
                installment_plan_id, account_id, created_at, updated_at
         FROM transactions
         WHERE updated_at > $1 OR created_at > $1
         ORDER BY updated_at",
    )
    .bind(payload.last_synced_at)
    .fetch_all(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Sync pull transactions failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to pull transactions" })),
        )
    })?;

    Ok(Json(SyncPullResponse {
        categories,
        transactions,
        server_time: Utc::now(),
    }))
}

/// Applies a batch of client mutations.
#[utoipa::path(
    post,
    path = "/api/sync/push",
    tag = "Sync",
    request_body = SyncPushRequest,
    responses(
        (status = 200, description = "Per-operation results", body = SyncPushResponse),
    ),
)]
pub async fn push(
    State(state): State<AppState>,
    Json(payload): Json<SyncPushRequest>,
) -> Result<Json<SyncPushResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut results = Vec::with_capacity(payload.operations.len());

    for op in payload.operations {
        let result = match apply_operation(&state, &op).await {
            Ok(server_id) => SyncOpResult {
                client_id: op.client_id.clone(),
                status: "ok".to_string(),
                server_id,
                error: None,
            },
            Err((code, msg)) => SyncOpResult {
                client_id: op.client_id.clone(),
                status: if code == StatusCode::CONFLICT {
                    "conflict".to_string()
                } else {
                    "error".to_string()
                },
                server_id: None,
                error: Some(msg),
            },
        };
        results.push(result);
    }

    Ok(Json(SyncPushResponse { results }))
}

/// Applies a single operation, returning the server UUID on success.
async fn apply_operation(
    state: &AppState,
    op: &SyncOperation,
) -> Result<Option<Uuid>, (StatusCode, String)> {
    match (op.entity_type.as_str(), op.operation_type.as_str()) {
        ("transaction", "create") => apply_transaction_create(state, op).await,
        ("transaction", "update") => apply_transaction_update(state, op).await,
        ("transaction", "delete") => apply_transaction_delete(state, op).await,
        ("category", "create") => apply_category_create(state, op).await,
        ("category", "update") => apply_category_update(state, op).await,
        ("category", "delete") => apply_category_delete(state, op).await,
        _ => Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Unsupported sync operation: {}/{}",
                op.entity_type, op.operation_type
            ),
        )),
    }
}

async fn apply_transaction_create(
    state: &AppState,
    op: &SyncOperation,
) -> Result<Option<Uuid>, (StatusCode, String)> {
    // Idempotency: a previous attempt may have already created this transaction.
    let existing: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM transactions WHERE idempotency_key = $1")
            .bind(&op.client_id)
            .fetch_optional(&state.pg_pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Idempotency check failed: {e}"),
                )
            })?;

    if let Some(id) = existing {
        return Ok(Some(id));
    }

    let description = op
        .payload
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("Synced transaction")
        .to_string();
    let amount = op
        .payload
        .get("amount")
        .and_then(|v| v.as_str())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "amount is required".to_string()))?
        .parse::<rust_decimal::Decimal>()
        .map_err(|_| (StatusCode::BAD_REQUEST, "invalid amount".to_string()))?;
    let ttype = op
        .payload
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("expense")
        .to_string();
    let category_id: Option<Uuid> = op
        .payload
        .get("category_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let date = op
        .payload
        .get("date")
        .and_then(|v| v.as_str())
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .unwrap_or_else(|| Utc::now().date_naive());
    let notes = op
        .payload
        .get("notes")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let account_id: Option<Uuid> = op
        .payload
        .get("account_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let installment_plan_id: Option<Uuid> = op
        .payload
        .get("installment_plan_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    let tx: Transaction = sqlx::query_as(
        "INSERT INTO transactions
            (id, description, amount, type, category_id, date, notes, account_id, installment_plan_id, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, description, amount, type, category_id, date, notes,
                   installment_plan_id, account_id, created_at, updated_at",
    )
    .bind(Uuid::parse_str(&op.client_id).unwrap_or_else(|_| Uuid::new_v4()))
    .bind(&description)
    .bind(amount)
    .bind(&ttype)
    .bind(category_id)
    .bind(date)
    .bind(notes)
    .bind(account_id)
    .bind(installment_plan_id)
    .bind(&op.client_id)
    .fetch_one(&state.pg_pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Create transaction failed: {e}"),
        )
    })?;

    Ok(Some(tx.id))
}

async fn apply_transaction_update(
    state: &AppState,
    op: &SyncOperation,
) -> Result<Option<Uuid>, (StatusCode, String)> {
    let server_id = op.server_id.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "server_id required for update".to_string(),
        )
    })?;

    let description = op
        .payload
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("Synced transaction")
        .to_string();
    let amount = op
        .payload
        .get("amount")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<rust_decimal::Decimal>().ok())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "invalid amount".to_string()))?;
    let ttype = op
        .payload
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("expense")
        .to_string();
    let category_id: Option<Uuid> = op
        .payload
        .get("category_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let date = op
        .payload
        .get("date")
        .and_then(|v| v.as_str())
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .unwrap_or_else(|| Utc::now().date_naive());
    let notes = op
        .payload
        .get("notes")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let account_id: Option<Uuid> = op
        .payload
        .get("account_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let installment_plan_id: Option<Uuid> = op
        .payload
        .get("installment_plan_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    let result = sqlx::query(
        "UPDATE transactions
         SET description = $1, amount = $2, type = $3, category_id = $4,
             date = $5, notes = $6, account_id = $7, installment_plan_id = $8, updated_at = NOW()
         WHERE id = $9",
    )
    .bind(&description)
    .bind(amount)
    .bind(&ttype)
    .bind(category_id)
    .bind(date)
    .bind(notes)
    .bind(account_id)
    .bind(installment_plan_id)
    .bind(server_id)
    .execute(&state.pg_pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Update transaction failed: {e}"),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Transaction not found".to_string()));
    }
    Ok(Some(server_id))
}

async fn apply_transaction_delete(
    state: &AppState,
    op: &SyncOperation,
) -> Result<Option<Uuid>, (StatusCode, String)> {
    let server_id = op.server_id.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "server_id required for delete".to_string(),
        )
    })?;

    let result = sqlx::query("DELETE FROM transactions WHERE id = $1")
        .bind(server_id)
        .execute(&state.pg_pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Delete transaction failed: {e}"),
            )
        })?;

    if result.rows_affected() == 0 {
        // Deleting an already-deleted row is idempotent for sync purposes.
        return Ok(Some(server_id));
    }
    Ok(Some(server_id))
}

async fn apply_category_create(
    state: &AppState,
    op: &SyncOperation,
) -> Result<Option<Uuid>, (StatusCode, String)> {
    let name = op
        .payload
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("New Category")
        .to_string();
    let ctype = op
        .payload
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("expense")
        .to_string();
    let icon = op
        .payload
        .get("icon")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let color = op
        .payload
        .get("color")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let cat: Category = sqlx::query_as(
        "INSERT INTO categories (id, name, type, icon, color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, type, parent_id, icon, color, created_at, updated_at",
    )
    .bind(Uuid::parse_str(&op.client_id).unwrap_or_else(|_| Uuid::new_v4()))
    .bind(&name)
    .bind(&ctype)
    .bind(icon)
    .bind(color)
    .fetch_one(&state.pg_pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Create category failed: {e}"),
        )
    })?;

    Ok(Some(cat.id))
}

async fn apply_category_update(
    state: &AppState,
    op: &SyncOperation,
) -> Result<Option<Uuid>, (StatusCode, String)> {
    let server_id = op.server_id.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "server_id required for update".to_string(),
        )
    })?;

    let name = op
        .payload
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Category")
        .to_string();
    let ctype = op
        .payload
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("expense")
        .to_string();
    let icon = op
        .payload
        .get("icon")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let color = op
        .payload
        .get("color")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let result = sqlx::query(
        "UPDATE categories
         SET name = $1, type = $2, icon = $3, color = $4, updated_at = NOW()
         WHERE id = $5",
    )
    .bind(&name)
    .bind(&ctype)
    .bind(icon)
    .bind(color)
    .bind(server_id)
    .execute(&state.pg_pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Update category failed: {e}"),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Category not found".to_string()));
    }
    Ok(Some(server_id))
}

async fn apply_category_delete(
    state: &AppState,
    op: &SyncOperation,
) -> Result<Option<Uuid>, (StatusCode, String)> {
    let server_id = op.server_id.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "server_id required for delete".to_string(),
        )
    })?;

    let result = sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(server_id)
        .execute(&state.pg_pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Delete category failed: {e}"),
            )
        })?;

    if result.rows_affected() == 0 {
        // Idempotent — the category is already gone.
        return Ok(Some(server_id));
    }
    Ok(Some(server_id))
}
