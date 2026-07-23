mod config;
mod db;
mod health;
mod metrics;
mod openapi;
mod state;
mod telemetry;

use axum::{routing::get, Router};
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
use crate::state::AppState;

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
    let pg_pool = init_pool(&config.database_url).await;

    // Build shared application state
    let app_state = AppState { pg_pool };

    // Build router
    let app = Router::new()
        .route("/health", get(health_handler))
        // Serve OpenAPI spec as JSON
        .route(
            "/api-docs/openapi.json",
            get(|| async { axum::Json(ApiDoc::openapi()) }),
        )
        // Serve Swagger UI
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

    // Give OpenTelemetry time to flush remaining spans
    opentelemetry::global::shutdown_tracer_provider();
    info!("OpenTelemetry tracer provider shut down");
}
