from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AttestationDocument(BaseModel):
    enclaveImage: str
    enclaveVersion: str
    pcrs: dict[str, str]
    publicKey: str
    issuedAt: str
    expiresAt: str


class AttestationEnvelope(BaseModel):
    document: AttestationDocument
    canonicalDocument: str = Field(min_length=1)
    signature: str


class AuditRequest(BaseModel):
    request_id: str = Field(min_length=1)
    scrubbed_question: str = Field(min_length=1)
    model_answer: str = Field(min_length=1)
    attestation: AttestationEnvelope
    policy_collection: str = Field(default="policy_context", min_length=1)
    policy_ids: list[str] = Field(default_factory=list)


class AuditResponse(BaseModel):
    request_id: str
    verdict: Literal["certified", "rejected"]
    coherent_claims: list[str]
    rejected_claims: list[str]
    reasons: list[str]
    policy_ids: list[str]
