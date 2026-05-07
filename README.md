# Sovereign Vault

## Technical Decision Log

**Status:** Accepted for the runnable POC.

**Decision:** This repository is a polyglot adversarial AI security lab for high-stakes healthcare/search workflows. It uses a Next.js operations console, a Node.js TypeScript orchestrator, a Rust Axum sanitizer, a Python FastAPI vault, Redis for circuit state, Qdrant for policy context, and OpenTelemetry for trace continuity.

**Why:** The point is not to show that one service can call another. The point is to make the trust boundaries visible: public orchestration, fast edge sanitization, isolated semantic auditing, stateful kill-switching, and traceable rejection evidence. In regulated healthcare systems, an underbuilt version of this architecture is not a cost optimization; it is a latent liability.

## Local Commands

```bash
make build
make seed
make up
```

After `make up`, open:

- Frontend: http://localhost:3000
- Worker API: http://localhost:4000/health
- Qdrant: http://localhost:6333/dashboard
- Jaeger: http://localhost:16686

If port `3000` is already in use, run Compose with `FRONTEND_PORT=3001 make up` and open http://localhost:3001.

## Pros

- Keeps each bottleneck in the runtime that best fits it: TypeScript for orchestration, Rust for CPU-bound PII scanning, Python for policy/audit expressiveness.
- Uses real operational dependencies rather than in-memory stand-ins: Redis, Qdrant, Docker Compose, and OpenTelemetry.
- Makes Nitro Enclaves explicit without pretending Docker Compose is a TEE.
- Produces visible evidence for portfolio/recruiter review and technical interviews.

## Cons

- Polyglot repos demand more build discipline and stronger contracts.
- Local Nitro attestation is only a simulation; real deployment needs EIF builds, vsock transport, parent-instance proxying, PCR governance, and KMS policy wiring.
- Deterministic v1 auditing is safer and reproducible, but less semantically rich than a production LLM evaluator.

## Production Alternatives Not Chosen

- **Single Next.js full-stack app:** faster to demo, but collapses the trust boundary.
- **All Python:** easy for audit logic, but weaker for a low-latency edge sanitizer and less persuasive as a systems architecture proof.
- **Managed vector search only:** useful in production, but this POC needs local, inspectable policy storage.
- **Real Nitro Enclave deployment in v1:** correct long-term, but too infrastructure-heavy for a local runnable lab.

## I/O Schemas

- Worker: Zod validates `/v1/ingest`.
- Sanitizer: Serde validates `/v1/scrub`.
- Vault: Pydantic validates `/v1/audit`.
- Redis: stores `sv:req:{requestId}`, `sv:circuit:{requestId}`, and stream events in `sv:events`.
- Qdrant: stores seeded `policy_context` points with deterministic local vectors.

## Observability

The worker creates root request spans and propagates W3C `traceparent` headers into the sanitizer and vault. Each service emits spans or span-shaped structured events to the OpenTelemetry Collector, with Jaeger available locally for inspection.

## Healthcare Risk Note

This POC is deliberately “no-anxiety” for learning, but the threat model is real: PHI leakage, hallucinated clinical certainty, bypass phrasing, and operator visibility into sensitive audit memory. The docs preserve the distinction between local simulation and Nitro Enclave production boundaries so reviewers can evaluate both the demo and the migration path.
