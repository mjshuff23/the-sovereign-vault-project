# Sanitizer Source

## Technical Decision Log

**Status:** Accepted.

**Decision:** Sanitizer source separates deterministic scrub logic in `lib.rs` from HTTP serving in `main.rs`.

## Pros

- Core PII detection can be unit-tested without network overhead.
- Axum handler remains a thin contract adapter.
- Latency budget is measured close to the CPU-bound code.

## Cons

- Regex patterns must be governed carefully as risk coverage expands.

## Production Alternatives Not Chosen

- **Inline handler logic:** easy to start, harder to benchmark.
- **Generated DLP rules:** later possibility, but deterministic hand-authored rules are more transparent for v1.

## I/O Schemas

Serde structs define scrub request, findings, decision, and response latency.

## Observability

HTTP handlers log clean/blocked outcomes with request ID and latency.

## Why This Matters

Healthcare data should be rejected before it reaches semantic audit memory whenever direct identifiers are obvious.
