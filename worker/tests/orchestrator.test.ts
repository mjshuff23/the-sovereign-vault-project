import { describe, expect, it } from "vitest";
import { SovereignOrchestrator } from "../src/orchestrator.js";
import { expectedImage, expectedPcrs, signDocument } from "../src/attestation.js";
import { MemoryCircuitStore } from "../src/store.js";

function validAttestation() {
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("SovereignOrchestrator", () => {
  it("certifies clean requests and emits green pipeline events", async () => {
    const store = new MemoryCircuitStore();
    const fetcher = async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/v1/scrub")) {
        return jsonResponse({
          request_id: "req-clean",
          sanitized_text: "Can this answer use policy context?",
          findings: [],
          decision: "clean",
          latency_us: 300
        });
      }
      if (href.includes("/points/scroll")) {
        return jsonResponse({
          result: {
            points: [{ payload: { policy_id: "HIPAA-MINIMUM-NECESSARY" } }]
          }
        });
      }
      if (href.includes("/v1/audit")) {
        return jsonResponse({
          request_id: "req-clean",
          verdict: "certified",
          coherent_claims: ["policy-limited"],
          rejected_claims: [],
          reasons: ["Vault [Audit]: Certified Truth"],
          policy_ids: ["HIPAA-MINIMUM-NECESSARY"]
        });
      }
      throw new Error(`unexpected URL ${href}`);
    };

    const orchestrator = new SovereignOrchestrator({
      store,
      fetcher: fetcher as typeof fetch,
      attestationLoader: async () => validAttestation()
    });

    const result = await orchestrator.ingest({
      requestId: "req-clean",
      patientQuestion: "Can this answer use policy context?",
      modelAnswer: "Use minimum necessary policy and consult a clinician.",
      actor: "clinician"
    });

    expect(result.status).toBe("green");
    expect(result.certifiedAnswer).toContain("minimum necessary");
    expect(store.circuits.get("req-clean")).toBe("green");
    expect(store.events.some((event) => event.node === "response" && event.status === "green")).toBe(true);
  });

  it("opens the kill switch when Rust scrub blocks direct identifiers", async () => {
    const store = new MemoryCircuitStore();
    let vaultCalled = false;
    const fetcher = async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/v1/scrub")) {
        return jsonResponse({
          request_id: "req-red",
          sanitized_text: "SSN [REDACTED:SSN]",
          findings: [
            {
              kind: "ssn",
              start: 4,
              end: 15,
              replacement: "[REDACTED:SSN]",
              reason: "SSN-like direct identifier cannot cross the border guard"
            }
          ],
          decision: "blocked",
          latency_us: 250
        });
      }
      if (href.includes("/v1/audit")) {
        vaultCalled = true;
      }
      return jsonResponse({});
    };

    const orchestrator = new SovereignOrchestrator({
      store,
      fetcher: fetcher as typeof fetch,
      attestationLoader: async () => validAttestation()
    });

    const result = await orchestrator.ingest({
      requestId: "req-red",
      patientQuestion: "SSN 123-45-6789",
      modelAnswer: "Consult a clinician.",
      actor: "patient"
    });

    expect(result.status).toBe("red");
    expect(vaultCalled).toBe(false);
    expect(store.circuits.get("req-red")).toBe("red");
    expect(store.events.some((event) => event.node === "response" && event.status === "red")).toBe(true);
  });
});
