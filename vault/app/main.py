from __future__ import annotations

from fastapi import FastAPI, Request
from opentelemetry import trace
from opentelemetry.context import attach, detach
from opentelemetry.propagate import extract

from .audit import audit_request
from .schemas import AuditRequest, AuditResponse
from .telemetry import configure_tracing

configure_tracing()
tracer = trace.get_tracer("sovereign-vault")

app = FastAPI(
    title="Sovereign Vault",
    description="FastAPI reasoning auditor designed for Nitro Enclave isolation.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "sovereign-vault", "status": "ok"}


@app.post("/v1/audit", response_model=AuditResponse)
def audit(payload: AuditRequest, request: Request) -> AuditResponse:
    token = attach(extract(dict(request.headers)))
    try:
        with tracer.start_as_current_span("vault.semantic_truth_audit") as span:
            span.set_attribute("request.id", payload.request_id)
            span.set_attribute("policy.collection", payload.policy_collection)
            span.set_attribute("policy.ids", ",".join(payload.policy_ids))
            result = audit_request(payload)
            span.set_attribute("vault.verdict", result.verdict)
            span.set_attribute("vault.rejected_claim_count", len(result.rejected_claims))
            return result
    finally:
        detach(token)
