# Nitro Attestation Simulation

## Technical Decision Log

**Status:** Accepted for local POC, not production.

**Decision:** The local Vault uses a signed JSON attestation document that mimics Nitro Enclaves identity proof. The worker verifies the document before sending audit tasks, and the vault independently rejects missing, expired, or mismatched documents.

## Pros

- Makes the trust handshake visible in a laptop-friendly demo.
- Forces the orchestrator and vault to treat enclave identity as an input, not an assumption.
- Keeps the production migration path explicit.

## Cons

- HMAC-signed JSON is not a Nitro attestation document.
- The local envelope carries the exact `canonicalDocument` bytes that were signed so Node and Python do not independently recreate the HMAC input.
- Docker Compose does not prevent operator memory access.
- Local HTTP does not model parent-instance vsock proxying.

## Production Alternatives Not Chosen

- **Real Nitro Enclave EIF build:** correct for AWS deployment, too heavy for this local POC.
- **KMS-gated data key release:** required in production, simulated locally so the pipeline can run without AWS credentials.
- **vsock-only vault transport:** required in production, represented here by Docker internal networking and documentation.

## Production Mapping

- Local `pcrs.PCR0/PCR1/PCR2` maps to Nitro PCR measurements.
- Local `signature` maps to AWS-signed attestation documents.
- Local `ATTESTATION_SECRET` maps to AWS KMS policy conditions that verify PCR values before releasing keys.
- Local HTTP from worker to vault maps to parent-instance proxying over vsock.

References:

- AWS Nitro Enclaves attestation: https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html
- AWS Nitro Enclaves workflow: https://docs.aws.amazon.com/enclaves/latest/user/flow.html
- AWS Nitro Enclaves application development and vsock: https://docs.aws.amazon.com/enclaves/latest/user/developing-applications-linux.html

## I/O Schema

```json
{
  "document": {
    "enclaveImage": "sovereign-vault-python-fastapi",
    "enclaveVersion": "2026.05.local",
    "pcrs": { "PCR0": "...", "PCR1": "...", "PCR2": "..." },
    "publicKey": "...",
    "issuedAt": "2026-05-07T00:00:00.000Z",
    "expiresAt": "2026-05-07T00:10:00.000Z"
  },
  "canonicalDocument": "{\"enclaveImage\":\"sovereign-vault-python-fastapi\",...}",
  "signature": "hex-hmac-sha256"
}
```

## Observability

The worker emits attestation verification events before calling the vault. Vault failures are returned as red circuit decisions, not swallowed as infrastructure noise.

## Why This Matters

If a root admin can inspect the semantic audit memory, the architecture is not confidential computing. This simulation exists so the demo can teach that boundary before AWS-specific deployment work begins.
