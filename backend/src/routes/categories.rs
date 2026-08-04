//! Category CRUD endpoints.

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use tracing::error;
use utoipa::ToSchema;

use crate::models::{Category, CreateCategoryRequest};
use crate::state::AppState;

/// Query parameters for filtering the category list.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CategoryListParams {
    /// Filter by `income` or `expense`.
    pub r#type: Option<String>,
}

/// Returns a sub-router with all category routes mounted under `/api/categories`.
pub fn router() -> Router<AppState> {
    Router::new().route(
        "/api/categories",
        get(list_categories).post(create_category),
    )
}

/// Lists categories, optionally filtered by type.
///
/// Returns `400` if an invalid `type` filter is provided.
#[utoipa::path(
    get,
    path = "/api/categories",
    tag = "Categories",
    params(
        ("type" = Option<String>, Query, description = "Filter by 'income' or 'expense'"),
    ),
    responses(
        (status = 200, description = "List of categories", body = [Category]),
        (status = 400, description = "Invalid type filter"),
    ),
)]
pub async fn list_categories(
    State(state): State<AppState>,
    Query(params): Query<CategoryListParams>,
) -> Result<Json<Vec<Category>>, (StatusCode, Json<serde_json::Value>)> {
    if let Some(t) = &params.r#type {
        if t != "income" && t != "expense" {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "type must be 'income' or 'expense'" })),
            ));
        }
    }

    let categories = match &params.r#type {
        Some(t) => {
            sqlx::query_as::<_, Category>(
                "SELECT id, name, type, parent_id, icon, color, created_at, updated_at
                 FROM categories WHERE type = $1 ORDER BY name",
            )
            .bind(t)
            .fetch_all(&state.pg_pool)
            .await
        }
        None => {
            sqlx::query_as::<_, Category>(
                "SELECT id, name, type, parent_id, icon, color, created_at, updated_at
                 FROM categories ORDER BY name",
            )
            .fetch_all(&state.pg_pool)
            .await
        }
    };

    match categories {
        Ok(cats) => Ok(Json(cats)),
        Err(e) => {
            error!("Failed to list categories: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to fetch categories" })),
            ))
        }
    }
}

/// Creates a new category.
///
/// Returns `400` if the payload is invalid (missing name, invalid type,
/// non-existent parent category).
#[utoipa::path(
    post,
    path = "/api/categories",
    tag = "Categories",
    request_body = CreateCategoryRequest,
    responses(
        (status = 201, description = "Category created", body = Category),
        (status = 400, description = "Invalid category payload"),
    ),
)]
pub async fn create_category(
    State(state): State<AppState>,
    Json(payload): Json<CreateCategoryRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "name must not be empty" })),
        ));
    }

    if payload.r#type != "income" && payload.r#type != "expense" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "type must be 'income' or 'expense'" })),
        ));
    }

    // Validate parent_id if provided
    if let Some(pid) = payload.parent_id {
        let exists: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM categories WHERE id = $1")
                .bind(pid)
                .fetch_optional(&state.pg_pool)
                .await
                .map_err(|e| {
                    error!("Failed to check parent category: {}", e);
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": "Failed to validate parent category" })),
                    )
                })?;

        if exists.is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "parent_id does not reference an existing category" })),
            ));
        }
    }

    let category = sqlx::query_as::<_, Category>(
        "INSERT INTO categories (name, type, parent_id, icon, color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, type, parent_id, icon, color, created_at, updated_at",
    )
    .bind(name)
    .bind(&payload.r#type)
    .bind(payload.parent_id)
    .bind(&payload.icon)
    .bind(&payload.color)
    .fetch_one(&state.pg_pool)
    .await
    .map_err(|e| {
        error!("Failed to create category: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to create category" })),
        )
    })?;

    Ok((StatusCode::CREATED, Json(category)))
}
