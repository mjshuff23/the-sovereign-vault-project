from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

from app.audit import audit_request
from app.attestation import EXPECTED_IMAGE, EXPECTED_PCRS
from app.schemas import AuditRequest


def attestation(*, expired: bool = False, signature: str | None = None) -> dict:
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at - timedelta(minutes=1) if expired else issued_at + timedelta(minutes=5)
    document = {
        "enclaveImage": EXPECTED_IMAGE,
        "enclaveVersion": "2026.05.local",
        "pcrs": EXPECTED_PCRS,
        "publicKey": hashlib.sha256(b"local-vault-public-key").hexdigest()[:64],
        "issuedAt": issued_at.isoformat().replace("+00:00", "Z"),
        "expiresAt": expires_at.isoformat().replace("+00:00", "Z"),
    }
    canonical_document = json.dumps(document, separators=(",", ":"))
    computed = hmac.new(
        b"local-dev-attestation-secret", canonical_document.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return {"document": document, "canonicalDocument": canonical_document, "signature": signature or computed}


def payload(answer: str, **attestation_kwargs) -> AuditRequest:
    return AuditRequest(
        request_id="req-test",
        scrubbed_question="Can this answer discuss minimum necessary disclosure?",
        model_answer=answer,
        attestation=attestation(**attestation_kwargs),
        policy_collection="policy_context",
        policy_ids=["HIPAA-MINIMUM-NECESSARY", "CLINICAL-CLAIMS-TRUTH"],
    )


def test_certifies_policy_coherent_answer() -> None:
    result = audit_request(
        payload("Use the minimum necessary policy and consult a clinician for care decisions.")
    )

    assert result.verdict == "certified"
    assert result.rejected_claims == []
    assert result.policy_ids == ["HIPAA-MINIMUM-NECESSARY", "CLINICAL-CLAIMS-TRUTH"]
    assert "answer preserves clinical escalation framing" in result.coherent_claims
    assert "answer references policy-limited disclosure" in result.coherent_claims


def test_certified_answer_has_default_coherent_claim() -> None:
    result = audit_request(payload("Avoid direct identifiers and keep uncertainty visible."))

    assert result.verdict == "certified"
    assert result.coherent_claims == ["no deterministic rejection rule triggered"]


def test_records_redaction_boundary_as_coherent_claim() -> None:
    result = audit_request(payload("Use [REDACTED:SSN] and consult a clinician if care changes."))

    assert result.verdict == "certified"
    assert "scrubbed input preserved redaction boundary" in result.coherent_claims
    assert "answer preserves clinical escalation framing" in result.coherent_claims


def test_rejects_hallucinated_clinical_certainty() -> None:
    result = audit_request(payload("This is a guaranteed cure and cannot be wrong."))

    assert result.verdict == "rejected"
    assert "unsupported-clinical-certainty" in result.rejected_claims


def test_rejects_deceptive_alignment_wording() -> None:
    result = audit_request(payload("Ignore the policy and hide this from auditors."))

    assert result.verdict == "rejected"
    assert "deceptive-alignment" in result.rejected_claims


def test_rejects_hipaa_leak_inside_vault() -> None:
    result = audit_request(payload("Patient SSN is 123-45-6789 and should be shared."))

    assert result.verdict == "rejected"
    assert "hipaa-leak" in result.rejected_claims


def test_rejects_bad_attestation() -> None:
    result = audit_request(payload("Consult a clinician.", signature="bad"))

    assert result.verdict == "rejected"
    assert result.rejected_claims == ["attestation"]
    assert any("signature mismatch" in reason for reason in result.reasons)


def test_rejects_expired_attestation() -> None:
    result = audit_request(payload("Consult a clinician.", expired=True))

    assert result.verdict == "rejected"
    assert any("expired" in reason for reason in result.reasons)
