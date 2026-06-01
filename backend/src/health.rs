use axum::Json;
use serde::Serialize;
use tracing::info;

use crate::db;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: String,
    pub rabbitmq: String,
    pub version: String,
}

#[derive(Debug, Serialize)]
pub struct HealthError {
    pub status: String,
    pub database: String,
    pub rabbitmq: String,
    pub details: String,
}

pub async fn health_handler(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Result<Json<HealthResponse>, (axum::http::StatusCode, Json<HealthError>)> {
    let db_healthy = db::check_db_health(&state.pg_pool).await;

    if !db_healthy {
        info!("Health check failed: database unreachable");
        return Err((
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            Json(HealthError {
                status: "unhealthy".into(),
                database: "disconnected".into(),
                rabbitmq: "unknown".into(),
                details: "PostgreSQL connection failed".into(),
            }),
        ));
    }

    Ok(Json(HealthResponse {
        status: "ok".into(),
        database: "connected".into(),
        rabbitmq: "disabled".into(), // Phase 1 will enable full RabbitMQ health checks
        version: env!("CARGO_PKG_VERSION").into(),
    }))
}
