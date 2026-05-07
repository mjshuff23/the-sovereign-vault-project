export type PipelineNodeId =
  | "ingest"
  | "scrub"
  | "attestation"
  | "vault"
  | "redis"
  | "response";

export type PipelineStatus = "idle" | "running" | "green" | "red";

export type PipelineEvent = {
  requestId: string;
  node: PipelineNodeId;
  status: PipelineStatus;
  message: string;
  traceId?: string;
  latencyMs?: number;
  timestamp: string;
};

export type StatusNodeData = {
  label: string;
  role: string;
  status: PipelineStatus;
  latency?: string;
  detail: string;
};
