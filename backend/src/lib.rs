//! PudimFinance Backend — Library crate root.
//!
//! This file exists to allow other binaries in the same package (e.g., gen-openapi)
//! to reference types via `backend::ApiDoc`, `backend::health`, etc.

#![warn(missing_docs)]
#![warn(rustdoc::broken_intra_doc_links)]

/// Authentication: JWT creation/verification, password hashing, and RBAC claims.
pub mod auth;
/// Environment-based application configuration.
pub mod config;
/// PostgreSQL connection pool and migration helpers.
pub mod db;
/// RabbitMQ event publishing for the ledger.
pub mod events;
/// Health check endpoint and response types.
pub mod health;
/// Double-entry ledger logic (balance validation, account mapping).
pub mod ledger;
/// Prometheus metrics collection and serving.
pub mod metrics;
/// Data models across all layers.
pub mod models;
/// OpenAPI 3.1 spec generation via utoipa.
pub mod openapi;
/// HTTP route handlers for categories, transactions, summary, budgets, reports, and ledger.
pub mod routes;
/// Shared application state for axum handlers.
pub mod state;
/// Logging and OpenTelemetry tracing initialization.
pub mod telemetry;

pub use openapi::ApiDoc;
