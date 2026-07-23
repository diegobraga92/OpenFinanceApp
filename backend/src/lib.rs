//! PudimFinance Backend — Library crate root.
//!
//! This file exists to allow other binaries in the same package (e.g., gen-openapi)
//! to reference types via `backend::ApiDoc`, `backend::health`, etc.

pub mod config;
pub mod db;
pub mod health;
pub mod metrics;
pub mod openapi;
pub mod state;
pub mod telemetry;

pub use openapi::ApiDoc;
