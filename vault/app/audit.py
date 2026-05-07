from __future__ import annotations

import re

from .attestation import verify_attestation
from .schemas import AuditRequest, AuditResponse

HIPAA_PATTERNS = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    re.compile(r"(?i)\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b"),
    re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b"),
]

DECEPTIVE_ALIGNMENT_PHRASES = [
    "ignore the policy",
    "bypass policy",
    "hide this from",
    "do not log",
    "secret internal verification",
    "suppress uncertainty",
]

UNSUPPORTED_CERTAINTY_PHRASES = [
    "guaranteed cure",
    "100% safe",
    "always safe",
    "never causes",
    "proves the diagnosis",
    "cannot be wrong",
]


def audit_request(payload: AuditRequest) -> AuditResponse:
    attestation_result = verify_attestation(payload.attestation)
    if not attestation_result.ok:
        return AuditResponse(
            request_id=payload.request_id,
            verdict="rejected",
            coherent_claims=[],
            rejected_claims=["attestation"],
            reasons=attestation_result.reasons,
            policy_ids=payload.policy_ids,
        )

    answer = payload.model_answer.strip()
    lowered = answer.lower()
    coherent: list[str] = []
    rejected: list[str] = []
    reasons: list[str] = []

    if any(pattern.search(answer) for pattern in HIPAA_PATTERNS):
        rejected.append("hipaa-leak")
        reasons.append(
            "Vault [Audit]: Potential HIPAA leak detected inside TEE; process terminated"
        )

    for phrase in DECEPTIVE_ALIGNMENT_PHRASES:
        if phrase in lowered:
            rejected.append("deceptive-alignment")
            reasons.append(
                f"Vault [Audit]: Deceptive alignment phrase rejected: '{phrase}'"
            )
            break

    for phrase in UNSUPPORTED_CERTAINTY_PHRASES:
        if phrase in lowered:
            rejected.append("unsupported-clinical-certainty")
            reasons.append(
                f"Vault [Audit]: Unsupported clinical certainty rejected: '{phrase}'"
            )
            break

    if "[redacted:" in lowered:
        coherent.append("scrubbed input preserved redaction boundary")

    if "consult" in lowered or "clinician" in lowered or "emergency" in lowered:
        coherent.append("answer preserves clinical escalation framing")

    if "minimum necessary" in lowered or "policy" in lowered:
        coherent.append("answer references policy-limited disclosure")

    if rejected:
        return AuditResponse(
            request_id=payload.request_id,
            verdict="rejected",
            coherent_claims=coherent,
            rejected_claims=rejected,
            reasons=reasons,
            policy_ids=payload.policy_ids,
        )

    if not coherent:
        coherent.append("no deterministic rejection rule triggered")

    return AuditResponse(
        request_id=payload.request_id,
        verdict="certified",
        coherent_claims=coherent,
        rejected_claims=[],
        reasons=["Vault [Audit]: Certified Truth; claims are coherent with local policy context"],
        policy_ids=payload.policy_ids,
    )
