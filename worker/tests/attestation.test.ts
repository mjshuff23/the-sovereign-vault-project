import { describe, expect, it } from "vitest";
import {
  canonicalizeDocument,
  expectedImage,
  expectedPcrs,
  signDocument,
  verifyAttestation
} from "../src/attestation.js";

function validEnvelope() {
  const document = {
    enclaveImage: expectedImage,
    enclaveVersion: "2026.05.local",
    pcrs: expectedPcrs,
    publicKey: "dev-key",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  };

  return { document, canonicalDocument: canonicalizeDocument(document), signature: signDocument(document) };
}

describe("attestation verification", () => {
  it("accepts the simulated enclave identity proof", () => {
    expect(verifyAttestation(validEnvelope()).ok).toBe(true);
  });

  it("rejects tampered signatures", () => {
    const envelope = validEnvelope();
    envelope.signature = "00";

    const result = verifyAttestation(envelope);

    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain("signature mismatch");
  });

  it("rejects enclave image mismatches", () => {
    const envelope = validEnvelope();
    envelope.document.enclaveImage = "unexpected-vault-image";
    envelope.canonicalDocument = canonicalizeDocument(envelope.document);
    envelope.signature = signDocument(envelope.document);

    const result = verifyAttestation(envelope);

    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("Worker [Attestation]: enclave image identity mismatch");
  });

  it("rejects PCR measurement mismatches", () => {
    const envelope = validEnvelope();
    envelope.document.pcrs = { ...envelope.document.pcrs, PCR1: "bad-measurement" };
    envelope.canonicalDocument = canonicalizeDocument(envelope.document);
    envelope.signature = signDocument(envelope.document);

    const result = verifyAttestation(envelope);

    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("Worker [Attestation]: PCR1 measurement mismatch");
  });

  it("rejects expired identity proofs", () => {
    const envelope = validEnvelope();
    envelope.document.expiresAt = new Date(Date.now() - 60_000).toISOString();
    envelope.canonicalDocument = canonicalizeDocument(envelope.document);
    envelope.signature = signDocument(envelope.document);

    const result = verifyAttestation(envelope);

    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("Worker [Attestation]: identity proof expired");
  });

  it("rejects signatures over a different canonical document", () => {
    const envelope = validEnvelope();
    const differentDocument = { ...envelope.document, publicKey: "other-key" };
    envelope.canonicalDocument = canonicalizeDocument(differentDocument);
    envelope.signature = signDocument(differentDocument);

    const result = verifyAttestation(envelope);

    expect(result.ok).toBe(false);
    expect(result.reasons).toContain(
      "Worker [Attestation]: canonical document does not match structured envelope"
    );
  });

  it("rejects legacy envelopes without canonical bytes", () => {
    const envelope = validEnvelope() as Partial<ReturnType<typeof validEnvelope>>;
    delete envelope.canonicalDocument;

    const result = verifyAttestation(envelope as ReturnType<typeof validEnvelope>);

    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("Worker [Attestation]: canonical document missing");
  });
});
