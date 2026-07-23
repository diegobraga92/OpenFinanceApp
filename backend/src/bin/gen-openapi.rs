//! Generates the OpenAPI specification for PudimFinance.
//!
//! Usage:
//!   cargo run --bin gen-openapi > ../api/openapi/openapi.json
//!
//! This binary is a build-time tool that outputs the full OpenAPI 3.1 spec
//! derived from utoipa annotations on the backend's handlers and schemas.

use utoipa::OpenApi;

fn main() {
    let spec = backend::ApiDoc::openapi();
    println!(
        "{}",
        serde_json::to_string_pretty(&spec).expect("Failed to serialize OpenAPI spec")
    );
}
