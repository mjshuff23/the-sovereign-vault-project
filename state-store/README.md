# State Store

## Technical Decision Log

**Status:** Accepted.

**Decision:** Redis is the distributed circuit-breaker and event-state store.

## Pros

- Low-latency reads and writes for request status.
- Native streams support append-only security/audit events.
- Operationally common, easy to run locally, and credible for production incident response flows.

## Cons

- Redis is not an immutable audit ledger by itself.
- Requires explicit persistence and retention choices in production.
- Misconfigured key TTLs can hide incident state too quickly.

## Production Alternatives Not Chosen

- **Postgres:** better for relational audit reports, slower for hot circuit-breaker state.
- **Kafka:** stronger streaming backbone, too much operational load for v1.
- **DynamoDB:** credible managed production option, but less local and less transparent for the POC.

## I/O Schemas

- `sv:req:{requestId}` stores the JSON request payload.
- `sv:req:{requestId}:status` stores `green` or `red` for a single request outcome (per-request flag).
- `sv:circuit:{resource}` stores `green` or `red` for a downstream resource (e.g. `sv:circuit:vault`, `sv:circuit:sanitizer`). This is a true breaker keyed on the guarded resource so repeated failures accumulate against the same key.
- `sv:events` is a single append-only Redis Stream. POC convenience: in production prefer per-pipeline or per-session streams to avoid fan-out bottlenecks, and bound the stream length with `MAXLEN ~`.

## Observability

Worker spans annotate Redis circuit writes and event-stream appends.

## Why This Matters

Healthcare AI systems need fast revocation when an audit fails. Redis gives the UI and orchestrator one fast source of operational truth.
