//! PudimFinance Backend — Library crate root.
//!
//! This file exists to allow other binaries in the same package (e.g., gen-openapi)
//! to reference types via `backend::ApiDoc`, `backend::health`, etc.

#![warn(missing_docs)]
#![warn(rustdoc::broken_intra_doc_links)]

/// Environment-based application configuration.
pub mod config;
/// PostgreSQL connection pool and migration helpers.
pub mod db;
/// Health check endpoint and response types.
pub mod health;
/// Prometheus metrics collection and serving.
pub mod metrics;
/// OpenAPI 3.1 spec generation via utoipa.
pub mod openapi;
/// Shared application state for axum handlers.
pub mod state;
/// Logging and OpenTelemetry tracing initialization.
pub mod telemetry;

pub use openapi::ApiDoc;
