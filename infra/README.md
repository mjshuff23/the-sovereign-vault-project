# Infra

## Technical Decision Log

**Status:** Accepted.

**Decision:** Docker Compose and OpenTelemetry Collector configuration live in `infra/`.

## Pros

- Makes the local platform reproducible.
- Centralizes trace routing instead of hardcoding exporter behavior in every service.
- Keeps production migration notes close to local infrastructure decisions.

## Cons

- Docker Compose networking is not a production service mesh.
- `latest` image tags are convenient for a POC but should be pinned for regulated production deployments.

## Production Alternatives Not Chosen

- **Terraform ECS/EKS:** correct later, too slow for a local learning lab.
- **Kubernetes manifests:** more portable, but adds operational noise before the service contracts are proven.
- **AWS CDK:** strong for Nitro rollout, deferred until the simulated vault path is stable.

## I/O Schemas

The collector accepts OTLP over HTTP and gRPC and exports traces to Jaeger plus debug logs.

## Observability

Jaeger at `localhost:16686` is the local visual trace explorer.

## Why This Matters

Without trace continuity, a failed audit becomes a finger-pointing exercise between services. The collector is the neutral evidence layer.
