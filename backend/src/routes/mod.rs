//! HTTP route handlers for the Layer 1 transaction tracker.
//!
//! Each submodule groups handlers by resource (categories, transactions, summary)
//! and is registered into the main [`axum::Router`] in `crate::main`.

pub mod categories;
pub mod summary;
pub mod transactions;

use axum::Router;

use crate::state::AppState;

/// Builds the `/api` sub-router with all Layer 1 resource routes.
pub fn api_router() -> Router<AppState> {
    Router::new()
        .merge(categories::router())
        .merge(transactions::router())
        .merge(summary::router())
}
