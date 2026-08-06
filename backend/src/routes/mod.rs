//! HTTP route handler
//!
//! Group handlers by resource (categories, transactions, summary)

pub mod budgets;
pub mod categories;
pub mod reports;
pub mod summary;
pub mod transactions;

use axum::Router;

use crate::state::AppState;

/// Builds the `/api` sub-router
pub fn api_router() -> Router<AppState> {
    Router::new()
        .merge(categories::router())
        .merge(transactions::router())
        .merge(summary::router())
        .merge(budgets::router())
        .merge(reports::router())
}
