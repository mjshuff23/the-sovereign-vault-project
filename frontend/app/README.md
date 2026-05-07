# Frontend App Routes

## Technical Decision Log

**Status:** Accepted.

**Decision:** The Next.js App Router owns the single ops-console route and global styling imports.

## Pros

- Keeps routing minimal and reviewable.
- Allows framework-native metadata and layout boundaries.
- Avoids a marketing shell around the real tool.

## Cons

- A single route does not yet model multi-tenant dashboards or historical incident review.

## Production Alternatives Not Chosen

- **Pages Router:** older pattern, less aligned with modern Next.js.
- **Static HTML:** simpler, but weaker for live WebSocket and typed React state.

## I/O Schemas

This folder renders typed React components that consume worker WebSocket events and submit worker ingest requests.

## Observability

The page exposes the current trace ID and node-level audit state.

## Why This Matters

The first screen must be the actual security workflow, because stakeholders need to see the control plane working.
