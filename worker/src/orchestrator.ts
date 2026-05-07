import { context, propagation, trace } from "@opentelemetry/api";
import { randomUUID } from "node:crypto";
import {
  ingestRequestSchema,
  type IngestRequest,
  type IngestResponse,
  type PipelineEvent,
  sanitizerResponseSchema,
  vaultResponseSchema
} from "./contracts.js";
import { loadAttestation, verifyAttestation, type AttestationEnvelope } from "./attestation.js";
import { fetchPolicyIds } from "./policy.js";
import type { CircuitStore } from "./store.js";

type EventSink = (event: PipelineEvent) => void | Promise<void>;

type OrchestratorOptions = {
  sanitizerUrl?: string;
  vaultUrl?: string;
  qdrantUrl?: string;
  store: CircuitStore;
  eventSink?: EventSink;
  fetcher?: typeof fetch;
  attestationLoader?: () => Promise<AttestationEnvelope>;
};

const tracer = trace.getTracer("sovereign-worker");

export class SovereignOrchestrator {
  private readonly sanitizerUrl: string;
  private readonly vaultUrl: string;
  private readonly qdrantUrl: string;
  private readonly store: CircuitStore;
  private readonly eventSink?: EventSink;
  private readonly fetcher: typeof fetch;
  private readonly attestationLoader: () => Promise<AttestationEnvelope>;

  constructor(options: OrchestratorOptions) {
    this.sanitizerUrl = options.sanitizerUrl ?? process.env.SANITIZER_URL ?? "http://localhost:8080";
    this.vaultUrl = options.vaultUrl ?? process.env.VAULT_URL ?? "http://localhost:8000";
    this.qdrantUrl = options.qdrantUrl ?? process.env.QDRANT_URL ?? "http://localhost:6333";
    this.store = options.store;
    this.eventSink = options.eventSink;
    this.fetcher = options.fetcher ?? fetch;
    this.attestationLoader = options.attestationLoader ?? loadAttestation;
  }

  async ingest(raw: unknown): Promise<IngestResponse> {
    const input = ingestRequestSchema.parse(raw);
    return tracer.startActiveSpan("worker.ingest", async (span) => {
      const requestId = input.requestId ?? randomUUID();
      const traceId = span.spanContext().traceId;
      span.setAttribute("request.id", requestId);
      span.setAttribute("actor", input.actor);

      const headerCarrier: Record<string, string> = {};
      propagation.inject(context.active(), headerCarrier);

      await this.emit({
        requestId,
        traceId,
        node: "ingest",
        status: "running",
        message: `Worker [Ingest]: accepted ${input.actor} request`
      });

      await this.emit({
        requestId,
        traceId,
        node: "scrub",
        status: "running",
        message: "Rust [Scrub]: scanning border payload for direct identifiers"
      });

      const scrubStarted = performance.now();
      const scrub = await this.callSanitizer(requestId, input.patientQuestion, headerCarrier);
      const scrubLatencyMs = performance.now() - scrubStarted;

      if (scrub.decision === "blocked") {
        const reasons = scrub.findings.map(
          (finding) => `Rust [Scrub]: ${finding.reason} at byte ${finding.start}`
        );
        await this.red(requestId, traceId, "scrub", reasons, scrubLatencyMs);
        span.setAttribute("sovereign.status", "red");
        span.end();
        return { requestId, status: "red" as const, traceId, reasons };
      }

      await this.emit({
        requestId,
        traceId,
        node: "scrub",
        status: "green" as const,
        latencyMs: scrubLatencyMs,
        message: `Rust [Scrub]: no direct identifiers found in ${Math.round(scrubLatencyMs * 1000)}us`
      });

      const attestation = await this.attestationLoader();
      const attestationVerification = verifyAttestation(attestation);
      if (!attestationVerification.ok) {
        await this.red(requestId, traceId, "attestation", attestationVerification.reasons);
        span.setAttribute("sovereign.status", "red");
        span.end();
        return {
          requestId,
          status: "red" as const,
          traceId,
          reasons: attestationVerification.reasons
        };
      }

      await this.emit({
        requestId,
        traceId,
        node: "attestation",
        status: "green",
        message: "Worker [Attestation]: enclave identity proof accepted"
      });

      const policyIds = await this.safePolicyIds(traceId, requestId);

      await this.emit({
        requestId,
        traceId,
        node: "vault",
        status: "running",
        message: "Vault [Audit]: entering simulated Nitro enclave boundary"
      });

      const vaultStarted = performance.now();
      const audit = await this.callVault(input, requestId, scrub.sanitized_text, attestation, policyIds, headerCarrier);
      const vaultLatencyMs = performance.now() - vaultStarted;

      if (audit.verdict === "rejected") {
        await this.red(requestId, traceId, "vault", audit.reasons, vaultLatencyMs);
        span.setAttribute("sovereign.status", "red");
        span.end();
        return { requestId, status: "red" as const, traceId, reasons: audit.reasons };
      }

      await this.emit({
        requestId,
        traceId,
        node: "vault",
        status: "green" as const,
        latencyMs: vaultLatencyMs,
        message: "Vault [Audit]: Certified Truth allowed to leave enclave"
      });

      await this.green(requestId, traceId, input.modelAnswer, audit.reasons);
      span.setAttribute("sovereign.status", "green");
      span.end();

      return {
        requestId,
        status: "green" as const,
        traceId,
        certifiedAnswer: input.modelAnswer,
        reasons: audit.reasons
      };
    });
  }

  private async callSanitizer(
    requestId: string,
    text: string,
    headers: Record<string, string>
  ) {
    const response = await this.fetcher(`${this.sanitizerUrl}/v1/scrub`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ request_id: requestId, text })
    });

    if (!response.ok) {
      throw new Error(`Sanitizer failed: ${response.status}`);
    }

    return sanitizerResponseSchema.parse(await response.json());
  }

  private async callVault(
    input: IngestRequest,
    requestId: string,
    scrubbedQuestion: string,
    attestation: AttestationEnvelope,
    policyIds: string[],
    headers: Record<string, string>
  ) {
    const response = await this.fetcher(`${this.vaultUrl}/v1/audit`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        request_id: requestId,
        scrubbed_question: scrubbedQuestion,
        model_answer: input.modelAnswer,
        attestation,
        policy_collection: "policy_context",
        policy_ids: policyIds
      })
    });

    if (!response.ok) {
      throw new Error(`Vault failed: ${response.status}`);
    }

    return vaultResponseSchema.parse(await response.json());
  }

  private async safePolicyIds(traceId: string, requestId: string): Promise<string[]> {
    try {
      const policyIds = await fetchPolicyIds(this.qdrantUrl, "policy_context", this.fetcher);
      await this.emit({
        requestId,
        traceId,
        node: "redis",
        status: "running",
        message: `Qdrant [Policy]: retrieved ${policyIds.length} policy context records`
      });
      return policyIds;
    } catch (error) {
      await this.emit({
        requestId,
        traceId,
        node: "redis",
        status: "running",
        message: `Qdrant [Policy]: lookup degraded; ${error instanceof Error ? error.message : "unknown error"}`
      });
      return [];
    }
  }

  private async red(
    requestId: string,
    traceId: string,
    node: PipelineEvent["node"],
    reasons: string[],
    latencyMs?: number
  ): Promise<void> {
    await this.store.setCircuit(requestId, "red");
    await this.store.saveRequest({
      requestId,
      traceId,
      status: "red",
      reasons,
      updatedAt: new Date().toISOString()
    });
    await this.emit({
      requestId,
      traceId,
      node,
      status: "red",
      latencyMs,
      message: reasons[0] ?? "Circuit opened red"
    });
    await this.emit({
      requestId,
      traceId,
      node: "response",
      status: "red",
      message: "Response [Kill Switch]: request invalidated; no answer leaves the system"
    });
  }

  private async green(
    requestId: string,
    traceId: string,
    certifiedAnswer: string,
    reasons: string[]
  ): Promise<void> {
    await this.store.setCircuit(requestId, "green");
    await this.store.saveRequest({
      requestId,
      traceId,
      status: "green",
      reasons,
      updatedAt: new Date().toISOString()
    });
    await this.emit({
      requestId,
      traceId,
      node: "redis",
      status: "green",
      message: "Redis [Circuit]: green status committed"
    });
    await this.emit({
      requestId,
      traceId,
      node: "response",
      status: "green",
      message: `Response [Certified Truth]: ${certifiedAnswer.slice(0, 140)}`
    });
  }

  private async emit(
    event: Omit<PipelineEvent, "timestamp"> & { timestamp?: string }
  ): Promise<void> {
    const fullEvent: PipelineEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString()
    };
    await this.store.appendEvent(fullEvent);
    await this.eventSink?.(fullEvent);
  }
}
