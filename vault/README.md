# Vault

## Technical Decision Log

**Status:** Accepted.

**Decision:** The vault is a Python FastAPI service that simulates the Nitro Enclave semantic truth audit.

## Pros

- Python is a strong fit for policy reasoning, evaluator code, and future LLM/model integrations.
- FastAPI and Pydantic provide explicit request/response contracts.
- Keeping the vault as its own service preserves the future TEE boundary.

## Cons

- Python is not the fastest runtime for CPU-bound scanning, so PII edge scanning belongs in Rust.
- Docker Compose does not provide Nitro memory isolation.
- Deterministic rules are explainable but less semantically rich than a mature evaluator stack.

## Production Alternatives Not Chosen

- **Rust vault:** stronger isolation/performance story, slower to iterate on semantic audit logic.
- **Node.js vault:** simpler monorepo, weaker separation from the public orchestrator.
- **External LLM provider:** useful later, but v1 avoids sending sensitive audit content outside the simulated enclave.
- **Real Nitro Enclave now:** correct production direction, but deferred until the local contract is proven.

## I/O Schemas

Pydantic request:

```json
{
  "request_id": "string",
  "scrubbed_question": "string",
  "model_answer": "string",
  "attestation": {
    "document": {
      "enclaveImage": "sovereign-vault-python-fastapi",
      "enclaveVersion": "2026.05.local",
      "pcrs": { "PCR0": "string", "PCR1": "string", "PCR2": "string" },
      "publicKey": "string",
      "issuedAt": "ISO-8601",
      "expiresAt": "ISO-8601"
    },
    "signature": "hex-hmac-sha256"
  },
  "policy_collection": "policy_context",
  "policy_ids": ["HIPAA-MINIMUM-NECESSARY"]
}
```

Pydantic response:

```json
{
  "request_id": "string",
  "verdict": "certified|rejected",
  "coherent_claims": ["string"],
  "rejected_claims": ["string"],
  "reasons": ["string"],
  "policy_ids": ["string"]
}
```

## Observability

The vault creates an OpenTelemetry span for each semantic truth audit and annotates request ID, policy collection, policy IDs, verdict, and rejected claim count.

## Why This Matters

The vault is where sensitive semantic evaluation happens. In the production target, root operators should not be able to inspect this memory; only certified or rejected outputs leave the enclave boundary.
