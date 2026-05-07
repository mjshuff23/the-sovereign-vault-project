# Worker Source

## Technical Decision Log

**Status:** Accepted.

**Decision:** Worker source is organized around contracts, attestation verification, policy lookup, Redis state, telemetry, and orchestration.

## Pros

- Contract-first modules keep public I/O stable.
- Dependency injection makes orchestration testable without Redis/Qdrant running.
- Attestation logic is isolated so the trust boundary is explicit.

## Cons

- More modules than a tiny Express app.
- Requires care to keep policy reasoning out of the public worker.

## Production Alternatives Not Chosen

- **Single server file:** faster initially, harder to review.
- **Shared schema package:** useful later, overkill before multiple consumers need versioned contracts.

## I/O Schemas

Zod schemas in `contracts.ts` define ingest, sanitizer, vault, and WebSocket event shapes.

## Observability

Telemetry starts in the worker and trace headers are propagated downstream.

## Why This Matters

The orchestrator is the public blast-radius boundary. Its code must make routing and revocation behavior obvious.
