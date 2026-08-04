//! PudimFinance backend binary — HTTP API server.
//!
//! Serves the REST API, Swagger UI, and health endpoints.
//! Configuration is loaded from environment variables (see [`config::Config`]).

mod config;
mod db;
mod health;
mod metrics;
mod models;
mod openapi;
mod routes;
mod state;
mod telemetry;

use axum::Router;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio::signal;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::config::Config;
use crate::db::init_pool;
use crate::health::health_handler;
use crate::metrics::init_metrics_recorder;
use crate::openapi::ApiDoc;
use crate::routes::api_router;
use crate::state::AppState;

/// Entry point: loads configuration, initializes telemetry/database,
/// and serves the HTTP API until a shutdown signal is received.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file
    dotenvy::dotenv().ok();

    // Load configuration
    let config = Config::from_env();

    // Initialize logging and tracing
    telemetry::init_logging(&config.otel_endpoint, "pudimfinance-backend");

    // Initialize metrics recorder
    let _metrics_recorder = init_metrics_recorder();

    // Initialize database pool
    let pg_pool = init_pool(
        &config.database_url,
        config.database_pool_max_connections,
        config.database_pool_acquire_timeout_secs,
    )
    .await;

    // Build shared application state
    let app_state = AppState { pg_pool };

    // Build main application router
    let app = Router::new()
        .route("/health", axum::routing::get(health_handler))
        // Layer 1 API routes
        .merge(api_router())
        // Serve OpenAPI spec as JSON and Swagger UI
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Bind and serve
    let addr: SocketAddr = config
        .server_addr()
        .parse()
        .expect("Invalid server address");
    info!("Starting server on {}", addr);

    let listener = TcpListener::bind(addr).await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Server shutdown complete");
    Ok(())
}

/// Waits for either Ctrl+C (SIGINT) or SIGTERM to trigger graceful shutdown.
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C, starting graceful shutdown");
        }
        _ = terminate => {
            info!("Received SIGTERM, starting graceful shutdown");
        }
    }

    // OpenTelemetry tracer provider will be flushed and shut down automatically
    // when the provider is dropped at program exit.
    info!("Shutdown signal received, OpenTelemetry will flush on drop");
}
