# Scripts

## Technical Decision Log

**Status:** Accepted.

**Decision:** `scripts/` contains deterministic local bootstrap utilities for attestation and Qdrant seeding.

## Pros

- Keeps bootstrapping repeatable.
- Avoids hidden manual setup.
- Makes local simulation boundaries inspectable.

## Cons

- Scripts can drift from production infrastructure if not documented.
- Local deterministic embeddings are not semantic embeddings.

## Production Alternatives Not Chosen

- **Terraform-only bootstrap:** better for cloud, worse for a laptop demo.
- **Ad hoc shell commands:** fast once, hard to review.
- **Provider embeddings during seed:** useful later, but requires keys and adds data-governance risk.

## I/O Schemas

Attestation scripts write `scripts/attestation/enclave-attestation.json`. Qdrant seed scripts read `policies/*.json`.

## Observability

Scripts print policy IDs, collection readiness, and attestation expiry.

## Why This Matters

The bootstrap path proves whether the architecture can be reproduced by someone other than the original author.
