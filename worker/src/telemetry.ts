import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { resourceFromAttributes } from "@opentelemetry/resources";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

export const sdk = new NodeSDK({
  resource: resourceFromAttributes({ "service.name": "sovereign-worker" }),
  traceExporter: endpoint ? new OTLPTraceExporter({ url: endpoint }) : undefined,
  instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()]
});

export async function startTelemetry(): Promise<void> {
  await sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  await sdk.shutdown();
}
