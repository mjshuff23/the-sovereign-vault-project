# Frontend Tests

## Technical Decision Log

**Status:** Accepted.

**Decision:** Frontend tests combine fast Vitest state-helper coverage with Playwright smoke coverage for the rendered console.

## Pros

- Unit tests validate event-to-node behavior without a browser.
- Playwright verifies the actual dashboard surface loads.

## Cons

- Full end-to-end clean/red audit checks require the whole Docker stack.

## Production Alternatives Not Chosen

- **Snapshot-only tests:** too brittle for an interactive operations console.
- **Manual demo-only validation:** not enough evidence for a risk-focused project.

## I/O Schemas

Tests construct worker-compatible `PipelineEvent` objects.

## Observability

Rendered tests assert the presence of the noisy security log and service flow regions.

## Why This Matters

A visual security tool must prove that status changes are not fake static labels.
