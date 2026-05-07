# Vector DB

## Technical Decision Log

**Status:** Accepted.

**Decision:** Qdrant stores standalone policy context for the vault audit path.

## Pros

- Purpose-built vector search with a real HTTP API.
- Runs cleanly in Docker Compose.
- Keeps policy retrieval separate from LLM or orchestration code.

## Cons

- Requires embedding/version governance in production.
- Local deterministic hash vectors are only for reproducible POC behavior.
- Qdrant is not the policy authoring system; it stores searchable copies.

## Production Alternatives Not Chosen

- **Chroma:** simpler for local notebooks, less persuasive for service-oriented operations.
- **OpenSearch vector search:** credible enterprise option, heavier for this POC.
- **Postgres pgvector:** strong consolidation story, but this project benefits from a dedicated policy service boundary.

## I/O Schemas

Collection: `policy_context`

Point payload:

```json
{
  "policy_id": "HIPAA-MINIMUM-NECESSARY",
  "title": "Minimum Necessary",
  "text": "Only disclose the minimum necessary protected health information..."
}
```

## Observability

The worker annotates Qdrant retrieval attempts and passes selected policy IDs into the vault audit request.

## Why This Matters

Hallucination defense needs a policy source that is not the model. A standalone vector database makes that dependency visible.
