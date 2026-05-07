import { createHmac, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "enclave-attestation.json");
const secret = process.env.ATTESTATION_SECRET;
if (!secret) {
  console.error(
    "ATTESTATION_SECRET is required to generate attestation artifacts. " +
      "Set it explicitly (e.g. via Makefile or your secret store) and re-run."
  );
  process.exit(1);
}

const hash = (value) => createHash("sha256").update(value).digest("hex");
const issuedAt = new Date();
const expiresAt = new Date(issuedAt.getTime() + 10 * 60 * 1000);

const document = {
  enclaveImage: "sovereign-vault-python-fastapi",
  enclaveVersion: "2026.05.local",
  pcrs: {
    PCR0: hash("vault-fastapi-image:2026.05.local").slice(0, 64),
    PCR1: hash("vault-runtime-python3.12").slice(0, 64),
    PCR2: hash("sovereign-vault-policy-bundle").slice(0, 64)
  },
  publicKey: hash("local-vault-public-key").slice(0, 64),
  issuedAt: issuedAt.toISOString(),
  expiresAt: expiresAt.toISOString()
};

const canonicalDocument = JSON.stringify(document);
const signature = createHmac("sha256", secret).update(canonicalDocument).digest("hex");

await mkdir(__dirname, { recursive: true });
await writeFile(outPath, `${JSON.stringify({ document, canonicalDocument, signature }, null, 2)}\n`);

console.log(`Generated simulated Nitro attestation: ${outPath}`);
console.log(`Expires at: ${document.expiresAt}`);
