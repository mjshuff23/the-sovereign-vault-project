import { describe, expect, it } from "vitest";
import { expectedImage, expectedPcrs, signDocument, verifyAttestation } from "../src/attestation.js";

function validEnvelope() {
  const document = {
    enclaveImage: expectedImage,
    enclaveVersion: "2026.05.local",
    pcrs: expectedPcrs,
    publicKey: "dev-key",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  };

  return { document, signature: signDocument(document) };
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
});
