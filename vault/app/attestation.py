from __future__ import annotations

import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone

from .schemas import AttestationEnvelope


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


EXPECTED_IMAGE = "sovereign-vault-python-fastapi"
EXPECTED_PCRS = {
    "PCR0": _sha256("vault-fastapi-image:2026.05.local")[:64],
    "PCR1": _sha256("vault-runtime-python3.12")[:64],
    "PCR2": _sha256("sovereign-vault-policy-bundle")[:64],
}


@dataclass(frozen=True)
class AttestationResult:
    ok: bool
    reasons: list[str]


def verify_attestation(envelope: AttestationEnvelope) -> AttestationResult:
    secret = os.getenv("ATTESTATION_SECRET", "local-dev-attestation-secret")
    document = envelope.document.model_dump()
    canonical = json.dumps(document, separators=(",", ":"))
    expected_signature = hmac.new(
        secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    reasons: list[str] = []

    if not hmac.compare_digest(expected_signature, envelope.signature):
        reasons.append("Vault [Attestation]: signature mismatch; refusing audit task")

    if document["enclaveImage"] != EXPECTED_IMAGE:
        reasons.append("Vault [Attestation]: enclave image identity mismatch")

    for pcr, expected in EXPECTED_PCRS.items():
        if document["pcrs"].get(pcr) != expected:
            reasons.append(f"Vault [Attestation]: {pcr} measurement mismatch")

    expires_at = _parse_iso(document["expiresAt"])
    if expires_at <= datetime.now(timezone.utc):
        reasons.append("Vault [Attestation]: identity proof expired")

    return AttestationResult(ok=not reasons, reasons=reasons)


def _parse_iso(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
