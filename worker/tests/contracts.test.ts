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

  it.each(["clinician", "patient", "admin"] as const)("accepts the %s actor", (actor) => {
    const parsed = ingestRequestSchema.parse({
      patientQuestion: "Question",
      modelAnswer: "Answer",
      actor
    });
    expect(parsed.actor).toBe(actor);
  });

  it("rejects an empty actor string", () => {
    expect(() =>
      ingestRequestSchema.parse({
        patientQuestion: "Question",
        modelAnswer: "Answer",
        actor: ""
      })
    ).toThrow();
  });

  it("rejects payloads missing patientQuestion", () => {
    expect(() =>
      ingestRequestSchema.parse({
        modelAnswer: "Answer",
        actor: "clinician"
      })
    ).toThrow();
  });

  it("rejects payloads missing modelAnswer", () => {
    expect(() =>
      ingestRequestSchema.parse({
        patientQuestion: "Question",
        actor: "clinician"
      })
    ).toThrow();
  });

  it("rejects empty-string patientQuestion / modelAnswer", () => {
    expect(() =>
      ingestRequestSchema.parse({
        patientQuestion: "",
        modelAnswer: "Answer",
        actor: "clinician"
      })
    ).toThrow();
    expect(() =>
      ingestRequestSchema.parse({
        patientQuestion: "Question",
        modelAnswer: "",
        actor: "clinician"
      })
    ).toThrow();
  });
});
