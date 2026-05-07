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
  canonicalDocument: string;
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

export function canonicalizeDocument(document: AttestationEnvelope["document"]): string {
  return JSON.stringify(document);
}

export function signCanonicalDocument(
  canonicalDocument: string,
  secret = process.env.ATTESTATION_SECRET ?? "local-dev-attestation-secret"
): string {
  return createHmac("sha256", secret).update(canonicalDocument).digest("hex");
}

export function signDocument(
  document: AttestationEnvelope["document"],
  secret = process.env.ATTESTATION_SECRET ?? "local-dev-attestation-secret"
): string {
  return signCanonicalDocument(canonicalizeDocument(document), secret);
}

export function verifyAttestation(
  envelope: AttestationEnvelope,
  secret = process.env.ATTESTATION_SECRET ?? "local-dev-attestation-secret"
): AttestationVerification {
  const reasons: string[] = [];
  const canonicalDocument =
    typeof envelope.canonicalDocument === "string" ? envelope.canonicalDocument : "";
  if (!canonicalDocument) {
    reasons.push("Worker [Attestation]: canonical document missing");
  }
  const expectedSignature = signCanonicalDocument(canonicalDocument, secret);
  const actual = Buffer.from(envelope.signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    reasons.push("Worker [Attestation]: signature mismatch; refusing to send audit task");
  }

  if (!canonicalDocumentMatchesEnvelope(canonicalDocument, envelope.document)) {
    reasons.push("Worker [Attestation]: canonical document does not match structured envelope");
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

function canonicalDocumentMatchesEnvelope(
  canonicalDocument: string,
  document: AttestationEnvelope["document"]
): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalDocument);
  } catch {
    return false;
  }

  if (!isAttestationDocument(parsed)) return false;
  const parsedPcrs = parsed.pcrs;
  const documentPcrs = document.pcrs;

  return (
    parsed.enclaveImage === document.enclaveImage &&
    parsed.enclaveVersion === document.enclaveVersion &&
    parsed.publicKey === document.publicKey &&
    parsed.issuedAt === document.issuedAt &&
    parsed.expiresAt === document.expiresAt &&
    Object.keys(parsedPcrs).length === Object.keys(documentPcrs).length &&
    Object.entries(documentPcrs).every(([key, value]) => parsedPcrs[key] === value)
  );
}

function isAttestationDocument(value: unknown): value is AttestationEnvelope["document"] {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AttestationEnvelope["document"]>;
  return (
    typeof candidate.enclaveImage === "string" &&
    typeof candidate.enclaveVersion === "string" &&
    typeof candidate.publicKey === "string" &&
    typeof candidate.issuedAt === "string" &&
    typeof candidate.expiresAt === "string" &&
    Boolean(candidate.pcrs) &&
    typeof candidate.pcrs === "object"
  );
}
