import { z } from "zod";

export const ingestRequestSchema = z.object({
  requestId: z.string().min(1).optional(),
  patientQuestion: z.string().min(1),
  modelAnswer: z.string().min(1),
  actor: z.enum(["clinician", "patient", "admin"])
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;

export const ingestResponseSchema = z.object({
  requestId: z.string(),
  status: z.enum(["green", "red"]),
  traceId: z.string(),
  certifiedAnswer: z.string().optional(),
  reasons: z.array(z.string())
});

export type IngestResponse = z.infer<typeof ingestResponseSchema>;

export const sanitizerResponseSchema = z.object({
  request_id: z.string(),
  sanitized_text: z.string(),
  findings: z.array(
    z.object({
      kind: z.string(),
      start: z.number(),
      end: z.number(),
      replacement: z.string(),
      reason: z.string()
    })
  ),
  decision: z.enum(["clean", "blocked"]),
  latency_us: z.number()
});

export type SanitizerResponse = z.infer<typeof sanitizerResponseSchema>;

export const vaultResponseSchema = z.object({
  request_id: z.string(),
  verdict: z.enum(["certified", "rejected"]),
  coherent_claims: z.array(z.string()),
  rejected_claims: z.array(z.string()),
  reasons: z.array(z.string()),
  policy_ids: z.array(z.string())
});

export type VaultResponse = z.infer<typeof vaultResponseSchema>;

export const pipelineNodeSchema = z.enum([
  "ingest",
  "scrub",
  "attestation",
  "vault",
  "redis",
  "response"
]);

export type PipelineNode = z.infer<typeof pipelineNodeSchema>;

export const pipelineStatusSchema = z.enum(["idle", "running", "green", "red"]);

export type PipelineStatus = z.infer<typeof pipelineStatusSchema>;

export const pipelineEventSchema = z.object({
  requestId: z.string(),
  node: pipelineNodeSchema,
  status: pipelineStatusSchema,
  message: z.string(),
  traceId: z.string().optional(),
  latencyMs: z.number().optional(),
  timestamp: z.string()
});

export type PipelineEvent = z.infer<typeof pipelineEventSchema>;
