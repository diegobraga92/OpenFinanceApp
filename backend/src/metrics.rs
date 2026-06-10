use axum::{routing::get, Router};
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use std::net::SocketAddr;
use tokio::net::TcpListener;

pub fn init_metrics_recorder() -> PrometheusHandle {
    let recorder_handle = PrometheusBuilder::new()
        .install_recorder()
        .expect("Failed to install Prometheus recorder");

    tracing::info!("Prometheus metrics recorder initialized");
    recorder_handle
}

#[allow(dead_code)]
pub fn metrics_handler(recorder: PrometheusHandle) -> Router {
    Router::new().route(
        "/metrics",
        get(move || {
            let recorder = recorder.clone();
            async move {
                axum::response::Response::builder()
                    .header("Content-Type", "text/plain; charset=utf-8")
                    .body(axum::body::Body::from(recorder.render()))
                    .unwrap()
            }
        }),
    )
}

/// Start a dedicated metrics HTTP server on a separate port (e.g. 3001)
/// This keeps the main API port clean from Prometheus scrapes
#[allow(dead_code)]
pub async fn start_metrics_server(recorder: PrometheusHandle, port: u16) {
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let router = metrics_handler(recorder);

    tracing::info!("Metrics server starting on {}", addr);

    let listener = TcpListener::bind(addr)
        .await
        .expect("Failed to bind metrics server");

    axum::serve(listener, router)
        .await
        .expect("Metrics server failed");
}
