use sqlx::PgPool;

/// Shared application state injected into axum handlers via [`axum::extract::State`].
#[derive(Clone)]
pub struct AppState {
    /// PostgreSQL connection pool shared across all request handlers.
    pub pg_pool: PgPool,
}
