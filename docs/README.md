# Docs

## Technical Decision Log

**Status:** Accepted.

**Decision:** `docs/` holds cross-cutting threat-model and deployment documentation that should not live inside one service folder.

**Pros:** Keeps architecture evidence reviewable; separates system decisions from implementation details; gives recruiters and Staff-level reviewers a direct reading path.

**Cons:** Documentation can drift unless tests and ADRs point back to executable contracts.

**Production Alternatives Not Chosen:** A wiki was not chosen because repo-local docs version with code. Generated architecture diagrams were not chosen because the first priority is runnable behavior.

## I/O Schemas

Docs describe, but do not own, the Zod, Serde, and Pydantic schemas. The source of truth remains in each service.

## Observability

This folder documents the trace path: worker root span, sanitizer child span, vault child span, Redis circuit write, and Qdrant policy lookup.

## Why This Matters

In healthcare AI, a verbal claim of “we have guardrails” is weak. A documented trust boundary, supported by runnable services and tests, is much harder to dismiss.
