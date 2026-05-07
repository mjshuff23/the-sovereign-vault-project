# Vault Tests

## Technical Decision Log

**Status:** Accepted.

**Decision:** Pytest covers certified answers, hallucination rejection, deceptive-alignment rejection, HIPAA leak rejection, bad attestation, and expired attestation.

## Pros

- Tests map directly to the adversarial protocol.
- No network or external LLM provider is required.

## Cons

- Deterministic tests do not prove semantic generalization.

## Production Alternatives Not Chosen

- **LLM judge-only tests:** non-deterministic and provider-dependent.
- **Manual prompt trials:** useful for demos, not enough for CI.

## I/O Schemas

Tests instantiate Pydantic `AuditRequest` objects with signed attestation envelopes.

## Observability

Failure reasons use the same noisy security log language shown in the UI.

## Why This Matters

The vault must prove it can say no before anyone trusts its yes.
