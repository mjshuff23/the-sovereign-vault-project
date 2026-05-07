# Frontend

## Technical Decision Log

**Status:** Accepted.

**Decision:** The frontend is a Next.js App Router TypeScript operations console using React Flow to visualize the live adversarial pipeline.

## Pros

- Next.js provides a production-grade React foundation and straightforward Docker build path.
- React Flow is purpose-built for node/edge service visualization.
- TypeScript keeps event payloads aligned with the worker WebSocket contract.

## Cons

- Next.js is more framework than a static dashboard needs.
- React Flow adds a specialized dependency that must be kept accessible and responsive.
- UI correctness depends on the worker WebSocket and backend services being healthy.

## Production Alternatives Not Chosen

- **Vite SPA:** lighter, but the prompt requires Next.js 14+ and App Router is credible for a portfolio-grade app.
- **Grafana-only dashboard:** strong observability tool, but it would not show the product-specific adversarial workflow.
- **Server-rendered table UI:** simpler, but weaker for visually proving service-level kill switches.

## I/O Schemas

The console sends the worker Zod `/v1/ingest` request and consumes worker WebSocket events:

```json
{
  "requestId": "string",
  "node": "ingest|scrub|attestation|vault|redis|response",
  "status": "idle|running|green|red",
  "message": "string",
  "traceId": "string",
  "latencyMs": 1.2,
  "timestamp": "ISO-8601"
}
```

## Observability

The console displays trace IDs, node latencies, and noisy security log reasons so reviewers can see exactly where a request turned red.

## Why This Matters

Security controls that are invisible during demos are easy to underfund. This console makes the architecture legible to engineers, recruiters, and non-specialist risk owners.
