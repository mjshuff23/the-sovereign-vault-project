# Policies

## Technical Decision Log

**Status:** Accepted.

**Decision:** Local JSON policy files are the canonical seed material for Qdrant.

## Pros

- Reviewable in git.
- Deterministic across developer machines.
- Keeps policy source data separate from service code.

## Cons

- JSON files are not a production policy management system.
- Versioning and approval workflow are manual in v1.

## Production Alternatives Not Chosen

- **GRC platform export:** realistic later, unnecessary for a runnable lab.
- **Database-backed policy CMS:** useful at scale, too much surface area for v1.
- **Embedding provider-managed corpus:** risks hiding the policy provenance reviewers need to see.

## I/O Schemas

Each policy file contains:

```json
{
  "policy_id": "string",
  "title": "string",
  "text": "string",
  "risk_tags": ["string"]
}
```

## Observability

Seed scripts log inserted policy IDs and Qdrant collection status.

## Why This Matters

A truth audit cannot be credible if the source of truth is invisible. These files keep the policy baseline inspectable.
