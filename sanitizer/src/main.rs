use axum::{
    extract::Request,
    http::{HeaderMap, HeaderValue, StatusCode},
    middleware::{self, Next},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use opentelemetry::{
    global,
    propagation::Extractor,
    trace::{Span, Tracer},
    KeyValue,
};
use opentelemetry_sdk::{propagation::TraceContextPropagator, trace::SdkTracerProvider, Resource};
use sovereign_sanitizer::{scrub_text, warm_up_patterns, ScrubDecision, ScrubRequest, ScrubResponse};
use std::{env, net::SocketAddr};
use tower_http::trace::TraceLayer;
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[tokio::main]
async fn main() {
    init_tracing();
    warm_up_patterns();

    let app = app();
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr: SocketAddr = format!("0.0.0.0:{port}")
        .parse()
        .expect("valid listen address");

    info!(%addr, "sovereign sanitizer listening");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind sanitizer listener");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("serve sanitizer");
}

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/scrub", post(scrub))
        .layer(middleware::from_fn(traceparent_echo))
        .layer(TraceLayer::new_for_http())
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "service": "sovereign-sanitizer",
        "status": "ok"
    }))
}

async fn scrub(headers: HeaderMap, Json(payload): Json<ScrubRequest>) -> impl IntoResponse {
    let parent_context = global::get_text_map_propagator(|propagator| {
        propagator.extract(&HeaderExtractor(&headers))
    });
    let tracer = global::tracer("sovereign-sanitizer");
    let mut span = tracer.start_with_context("sanitizer.scrub", &parent_context);
    span.set_attribute(KeyValue::new("request.id", payload.request_id.clone()));

    let response = scrub_text(&payload);
    span.set_attribute(KeyValue::new("sanitizer.decision", format!("{:?}", response.decision)));
    span.set_attribute(KeyValue::new("sanitizer.finding_count", response.findings.len() as i64));
    span.set_attribute(KeyValue::new("sanitizer.latency_us", response.latency_us as i64));
    span.end();

    match response.decision {
        ScrubDecision::Clean => info!(
            request_id = %response.request_id,
            latency_us = response.latency_us,
            "scrub clean"
        ),
        ScrubDecision::Blocked => warn!(
            request_id = %response.request_id,
            latency_us = response.latency_us,
            findings = response.findings.len(),
            "scrub blocked direct identifiers"
        ),
    }

    (StatusCode::OK, Json::<ScrubResponse>(response))
}

async fn traceparent_echo(mut request: Request, next: Next) -> impl IntoResponse {
    let traceparent = request
        .headers()
        .get("traceparent")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    if let Some(value) = &traceparent {
        request.extensions_mut().insert(value.clone());
    }
    let mut response = next.run(request).await;
    if let Some(value) = traceparent {
        if let Ok(header) = HeaderValue::from_str(&value) {
            response.headers_mut().insert("traceparent", header);
        }
    }
    response
}

fn init_tracing() {
    global::set_text_map_propagator(TraceContextPropagator::new());
    if env::var("OTEL_EXPORTER_OTLP_ENDPOINT").is_ok() {
        match opentelemetry_otlp::SpanExporter::builder()
            .with_tonic()
            .build()
        {
            Ok(exporter) => {
                let provider = SdkTracerProvider::builder()
                    .with_resource(
                        Resource::builder()
                            .with_service_name("sovereign-sanitizer")
                            .build(),
                    )
                    .with_batch_exporter(exporter)
                    .build();
                global::set_tracer_provider(provider);
            }
            Err(error) => {
                eprintln!("failed to configure sanitizer OTLP exporter: {error}");
            }
        }
    }

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().json())
        .init();
}

struct HeaderExtractor<'a>(&'a HeaderMap);

impl Extractor for HeaderExtractor<'_> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|value| value.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0.keys().map(|name| name.as_str()).collect()
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    #[tokio::test]
    async fn scrub_endpoint_returns_contract_shape() {
        let response = app()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/scrub")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"request_id":"req-api","text":"SSN 123-45-6789"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
