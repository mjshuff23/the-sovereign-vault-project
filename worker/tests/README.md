# Worker Tests

## Technical Decision Log

**Status:** Accepted.

**Decision:** Vitest covers Zod validation, attestation checks, Redis circuit behavior through an in-memory store, and pipeline event emission.

## Pros

- Fast tests catch contract drift.
- In-memory store avoids requiring Redis for unit tests.
- Fetch injection makes red/green audit branches deterministic.

## Cons

- Docker-stack integration tests are still needed to prove real Redis/Qdrant service wiring.

## Production Alternatives Not Chosen

- **Only E2E tests:** too slow for contract iteration.
- **Mock every dependency globally:** hides orchestration behavior.

## I/O Schemas

Tests exercise the same Zod request/response schemas used by the server.

## Observability

Tests assert emitted pipeline events include red and green response transitions.

## Why This Matters

The kill switch must be a tested behavior, not a UI promise.
