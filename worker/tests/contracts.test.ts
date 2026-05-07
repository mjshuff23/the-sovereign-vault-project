import { describe, expect, it } from "vitest";
import { ingestRequestSchema } from "../src/contracts.js";

describe("ingestRequestSchema", () => {
  it("accepts the public ingest contract", () => {
    const parsed = ingestRequestSchema.parse({
      patientQuestion: "Can I disclose minimum necessary context?",
      modelAnswer: "Consult a clinician and follow policy.",
      actor: "clinician"
    });

    expect(parsed.actor).toBe("clinician");
  });

  it("rejects unknown actors", () => {
    expect(() =>
      ingestRequestSchema.parse({
        patientQuestion: "Question",
        modelAnswer: "Answer",
        actor: "root"
      })
    ).toThrow();
  });
});
