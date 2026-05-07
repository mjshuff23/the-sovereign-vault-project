# Worker

## Technical Decision Log

**Status:** Accepted.

**Decision:** The worker is a Node.js/TypeScript public orchestrator that owns `/v1/ingest`, WebSocket event fanout, Redis circuit writes, Qdrant policy lookup, and attestation verification before vault calls.

## Pros

- TypeScript and Zod make public API contracts explicit.
- Node handles concurrent I/O, WebSockets, Redis, and HTTP orchestration well.
- The worker is intentionally public-facing while the vault remains private.

## Cons

- Node is not the right place for CPU-bound PII scanning.
- Public orchestration code must avoid becoming a dumping ground for policy logic.
- WebSocket fanout requires careful lifecycle handling in production.

## Production Alternatives Not Chosen

- **Go worker:** excellent operations story, but TypeScript integrates faster with the frontend contract.
- **Python worker:** easy to share logic with the vault, but blurs trust boundaries.
- **Serverless functions:** good for scale-to-zero, less natural for long-lived WebSockets and local trace continuity.

## I/O Schemas

Zod ingest request:

```json
{
  "requestId": "optional string",
  "patientQuestion": "string",
  "modelAnswer": "string",
  "actor": "clinician|patient|admin"
}
```

Zod ingest response:

```json
{
  "requestId": "string",
  "status": "green|red",
  "traceId": "string",
  "certifiedAnswer": "optional string",
  "reasons": ["string"]
}
```

WebSocket event:

```json
{
  "requestId": "string",
  "node": "ingest|scrub|attestation|vault|redis|response",
  "status": "idle|running|green|red",
  "message": "string",
  "traceId": "string",
  "latencyMs": 1.23,
  "timestamp": "ISO-8601"
}
```

## Observability

The worker starts the root OpenTelemetry trace, propagates `traceparent` into Rust/Python services, and writes noisy security events to WebSocket clients plus Redis stream `sv:events`.

## Why This Matters

The public orchestrator is where high-risk systems most often cheat by mixing policy, logging, and transport concerns. This worker stays boring on purpose: validate, route, trace, circuit-break.
