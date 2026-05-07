# Attestation Scripts

## Technical Decision Log

**Status:** Accepted.

**Decision:** This folder generates the local signed attestation document consumed by the worker and vault.

## Pros

- Models enclave identity before audit work is accepted.
- Provides a concrete artifact reviewers can inspect.
- Supports failure-mode testing for bad signatures and expired documents.

## Cons

- Uses HMAC instead of AWS-signed attestation.
- Does not provide actual memory isolation.

## Production Alternatives Not Chosen

- **Nitro CLI EIF attestation:** deferred until AWS deployment.
- **KMS Decrypt with PCR conditions:** production target, simulated locally.
- **mTLS-only identity:** useful for services, insufficient as an enclave identity proof.

## I/O Schemas

See `docs/nitro-attestation.md` for the JSON document contract. The generated envelope includes both the structured `document` and the exact `canonicalDocument` bytes used for the HMAC signature.

## Observability

The worker emits `attestation` node events before the vault call. The vault includes attestation rejection reasons in red responses.

## Why This Matters

Confidential computing without identity proof is theater. Even in a simulation, the audit path must reject unknown vault identity.
