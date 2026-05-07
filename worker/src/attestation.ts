import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type AttestationEnvelope = {
  document: {
    enclaveImage: string;
    enclaveVersion: string;
    pcrs: Record<string, string>;
    publicKey: string;
    issuedAt: string;
    expiresAt: string;
  };
  signature: string;
};

export type AttestationVerification = {
  ok: boolean;
  reasons: string[];
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const expectedImage = "sovereign-vault-python-fastapi";
export const expectedPcrs = {
  PCR0: sha256("vault-fastapi-image:2026.05.local").slice(0, 64),
  PCR1: sha256("vault-runtime-python3.12").slice(0, 64),
  PCR2: sha256("sovereign-vault-policy-bundle").slice(0, 64)
};

export function signDocument(
  document: AttestationEnvelope["document"],
  secret = process.env.ATTESTATION_SECRET ?? "local-dev-attestation-secret"
): string {
  return createHmac("sha256", secret).update(JSON.stringify(document)).digest("hex");
}

export function verifyAttestation(
  envelope: AttestationEnvelope,
  secret = process.env.ATTESTATION_SECRET ?? "local-dev-attestation-secret"
): AttestationVerification {
  const reasons: string[] = [];
  const expectedSignature = signDocument(envelope.document, secret);
  const actual = Buffer.from(envelope.signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    reasons.push("Worker [Attestation]: signature mismatch; refusing to send audit task");
  }

  if (envelope.document.enclaveImage !== expectedImage) {
    reasons.push("Worker [Attestation]: enclave image identity mismatch");
  }

  for (const [pcr, expectedPcr] of Object.entries(expectedPcrs)) {
    if (envelope.document.pcrs[pcr] !== expectedPcr) {
      reasons.push(`Worker [Attestation]: ${pcr} measurement mismatch`);
    }
  }

  if (new Date(envelope.document.expiresAt).getTime() <= Date.now()) {
    reasons.push("Worker [Attestation]: identity proof expired");
  }

  return { ok: reasons.length === 0, reasons };
}

export async function loadAttestation(path = defaultAttestationPath()): Promise<AttestationEnvelope> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as AttestationEnvelope;
}

export function defaultAttestationPath(): string {
  return resolve(process.env.ATTESTATION_DOC_PATH ?? "scripts/attestation/enclave-attestation.json");
}
