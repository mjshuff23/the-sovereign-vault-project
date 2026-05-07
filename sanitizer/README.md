# Sanitizer

## Technical Decision Log

**Status:** Accepted.

**Decision:** The sanitizer is a Rust Axum service that performs CPU-bound direct-identifier scanning at the public/private border.

## Pros

- Rust provides memory safety without garbage collector pauses.
- Regex scanning is fast enough for the POC latency target and easy to test.
- Axum keeps the HTTP layer lightweight and explicit.

## Cons

- Regex-only PII detection cannot catch every real patient identifier.
- Rust adds a separate toolchain to the monorepo.
- The service must be kept narrowly scoped to avoid mixing policy reasoning with edge sanitization.

## Production Alternatives Not Chosen

- **Node.js sanitizer:** simpler repo, weaker CPU-bound isolation story.
- **Python sanitizer:** flexible, but less persuasive for sub-2ms border scanning.
- **Managed DLP API:** production-worthy, but would move sensitive input to an external service and require credentials.
- **ML named-entity recognition:** useful later, but not deterministic enough for a first trust-boundary POC.

## I/O Schemas

Serde request:

```json
{
  "request_id": "string",
  "text": "string"
}
```

Serde response:

```json
{
  "request_id": "string",
  "sanitized_text": "string",
  "findings": [
    {
      "kind": "ssn|email|phone|name",
      "start": 0,
      "end": 11,
      "replacement": "[REDACTED:SSN]",
      "reason": "string"
    }
  ],
  "decision": "clean|blocked",
  "latency_us": 900
}
```

## Observability

The service emits structured tracing logs and echoes incoming `traceparent` headers so worker-created traces can be correlated across logs and UI evidence.

## Why This Matters

The border guard blocks obvious PHI before semantic audit work. In healthcare, a fast rejection at the edge reduces both blast radius and compliance ambiguity.
