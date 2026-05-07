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

  const envelopeRecord =
    envelope && typeof envelope === "object" ? (envelope as Record<string, unknown>) : null;
  if (!envelopeRecord) {
    return {
      ok: false,
      reasons: ["Worker [Attestation]: envelope is missing or not an object"]
    };
  }

  const canonicalDocument =
    typeof envelopeRecord.canonicalDocument === "string" ? envelopeRecord.canonicalDocument : "";
  if (!canonicalDocument) {
    reasons.push("Worker [Attestation]: canonical document missing");
  }

  const signature = typeof envelopeRecord.signature === "string" ? envelopeRecord.signature : "";
  if (!signature) {
    reasons.push("Worker [Attestation]: signature missing");
  }

  const document = isAttestationDocument(envelopeRecord.document) ? envelopeRecord.document : null;
  if (!document) {
    reasons.push("Worker [Attestation]: structured document missing or malformed");
    return { ok: false, reasons };
  }

  if (signature && /^[0-9a-fA-F]*$/.test(signature) && signature.length % 2 === 0) {
    const expectedSignature = signCanonicalDocument(canonicalDocument, secret);
    const actual = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      reasons.push("Worker [Attestation]: signature mismatch; refusing to send audit task");
    }
  } else if (signature) {
    reasons.push("Worker [Attestation]: signature is not valid hex");
  }

  if (!canonicalDocumentMatchesEnvelope(canonicalDocument, document)) {
    reasons.push("Worker [Attestation]: canonical document does not match structured envelope");
  }

  if (document.enclaveImage !== expectedImage) {
    reasons.push("Worker [Attestation]: enclave image identity mismatch");
  }

  for (const [pcr, expectedPcr] of Object.entries(expectedPcrs)) {
    if (document.pcrs[pcr] !== expectedPcr) {
      reasons.push(`Worker [Attestation]: ${pcr} measurement mismatch`);
    }
  }

  const expiresAtMs = new Date(document.expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) {
    reasons.push("Worker [Attestation]: invalid or missing expiresAt");
  } else if (expiresAtMs <= Date.now()) {
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
