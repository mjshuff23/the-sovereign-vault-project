# Frontend Components

## Technical Decision Log

**Status:** Accepted.

**Decision:** React components are split into pipeline state helpers, React Flow node rendering, and the main console shell.

## Pros

- Keeps visual state updates testable outside the browser.
- Keeps node rendering reusable and easy to audit.
- Avoids one huge page component.

## Cons

- Adds a small amount of indirection for a one-screen app.

## Production Alternatives Not Chosen

- **Global state library:** unnecessary for v1.
- **Canvas-only visualization:** less accessible and harder to test.

## I/O Schemas

Components consume `PipelineEvent` and `StatusNodeData` TypeScript types.

## Observability

State helpers preserve event messages, latency, and status color at the node where the failure occurred.

## Why This Matters

The UI is part of the audit evidence. If it cannot show exactly where a kill switch fired, it is only decoration.
