use opentelemetry::KeyValue;
use opentelemetry::trace::TracerProvider;
use opentelemetry_otlp::SpanExporter;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::trace::SdkTracerProvider;
use opentelemetry_sdk::Resource;
use tracing_subscriber::prelude::*;
use tracing_subscriber::EnvFilter;

pub fn init_logging(otel_endpoint: &str, service_name: &str) {
    // Build OTLP span exporter (gRPC/tonic transport)
    let exporter = SpanExporter::builder()
        .with_tonic()
        .with_endpoint(otel_endpoint)
        .build()
        .expect("Failed to create OTLP span exporter");

    // Build the tracer provider with batch export
    let tracer_provider = SdkTracerProvider::builder()
        .with_resource(
            Resource::builder()
                .with_attributes([
                    KeyValue::new("service.name", service_name.to_string()),
                    KeyValue::new("service.version", env!("CARGO_PKG_VERSION").to_string()),
                ])
                .build(),
        )
        .with_batch_exporter(exporter)
        .build();

    // Get a named tracer
    let tracer = tracer_provider.tracer("pudimfinance-backend");

    // Set the global tracer provider for the shutdown hook
    opentelemetry::global::set_tracer_provider(tracer_provider);

    // Create OpenTelemetry tracing-subscriber layer
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