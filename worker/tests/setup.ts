// Worker tests assume an HMAC-able attestation secret is wired into the env.
// Production refuses to start without ATTESTATION_SECRET (see resolveSecret in
// src/attestation.ts); the test harness sets a known dev value so the suite
// exercises the real signing/verifying paths.
if (!process.env.ATTESTATION_SECRET) {
  process.env.ATTESTATION_SECRET = "local-dev-attestation-secret";
}
