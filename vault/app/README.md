# Vault App Source

## Technical Decision Log

**Status:** Accepted.

**Decision:** Vault application code separates Pydantic schemas, simulated attestation verification, deterministic audit rules, telemetry, and FastAPI routes.

## Pros

- Audit logic is testable without HTTP.
- Attestation rejection remains independent from semantic rejection.
- Future LLM evaluator integration has a clear insertion point.

## Cons

- Deterministic rules are intentionally conservative and incomplete.

## Production Alternatives Not Chosen

- **Prompt-only evaluator:** hard to test and unsafe for v1.
- **Inline route logic:** makes it harder to prove attestation and audit failure modes separately.

## I/O Schemas

Pydantic models in `schemas.py` define attestation envelopes and audit request/response contracts.

## Observability

FastAPI routes create audit spans with policy and verdict metadata.

## Why This Matters

The vault is the most sensitive trust boundary. Its implementation has to be small enough to reason about.
