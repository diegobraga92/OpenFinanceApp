use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::Resource;
use tracing_subscriber::prelude::*;
use tracing_subscriber::EnvFilter;

pub fn init_logging(otel_endpoint: &str, service_name: &str) {
    // Configure OpenTelemetry OTLP exporter
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(otel_endpoint),
        )
        .with_trace_config(opentelemetry_sdk::trace::Config::default().with_resource(
            Resource::new(vec![
                KeyValue::new("service.name", service_name.to_string()),
                KeyValue::new("service.version", env!("CARGO_PKG_VERSION").to_string()),
            ]),
        ))
        .install_batch(opentelemetry_sdk::runtime::Tokio)
        .expect("Failed to install OpenTelemetry tracer");

    // Create OpenTelemetry layer
    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer);

    // Create stdout JSON logging layer
    let stdout_layer = tracing_subscriber::fmt::layer()
        .json()
        .with_target(true)
        .with_current_span(true)
        .with_span_list(true);

    // Combine layers with env filter
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(telemetry_layer)
        .with(stdout_layer)
        .init();

    tracing::info!("Logging and tracing initialized");
}
