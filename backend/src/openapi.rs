use utoipa::OpenApi;

use crate::health;

/// Root OpenAPI document for the PudimFinance API.
///
/// Aggregates utoipa path/schema annotations from the backend handlers
/// and is used by both the Swagger UI at runtime and the `gen-openapi` binary.
#[derive(OpenApi)]
#[openapi(
    paths(
        health::health_handler,
        health::metrics_handler_doc,
    ),
    components(schemas(
        health::HealthResponse,
        health::HealthError,
    )),
    info(
        title = "PudimFinance API",
        version = env!("CARGO_PKG_VERSION"),
        description = "Personal finance application API. Immutable double-entry ledger, \
                       event sourcing, real-time reporting, receipt scanning and price tracking.",
    ),
    servers(
        (url = "http://localhost:3000", description = "Local development"),
    ),
    tags(
        (name = "Health", description = "Health check and observability endpoints"),
    ),
    // Public API: no authentication required. Empty security requirement
    // documents that explicitly (satisfies OpenAPI `security-defined`).
    security(
        (),
    ),
)]
pub struct ApiDoc;
