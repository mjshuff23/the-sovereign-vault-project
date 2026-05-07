import express from "express";
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { ZodError } from "zod";
import { SovereignOrchestrator } from "./orchestrator.js";
import { RedisCircuitStore } from "./store.js";
import type { PipelineEvent } from "./contracts.js";
import { startTelemetry, shutdownTelemetry } from "./telemetry.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const app = express();
const server = http.createServer(app);
const sockets = new Set<WebSocket>();
const recentEvents: PipelineEvent[] = [];

const store = new RedisCircuitStore();
const orchestrator = new SovereignOrchestrator({
  store,
  eventSink: async (event) => {
    recentEvents.push(event);
    if (recentEvents.length > 100) recentEvents.shift();
    const serialized = JSON.stringify(event);
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) {
        socket.send(serialized);
      }
    }
  }
});

app.use(express.json({ limit: "256kb" }));
app.use((_, response, next) => {
  response.header("access-control-allow-origin", "*");
  response.header("access-control-allow-headers", "content-type,traceparent");
  response.header("access-control-allow-methods", "GET,POST,OPTIONS");
  next();
});
app.options(/.*/, (_, response) => response.sendStatus(204));

app.get("/health", (_, response) => {
  response.json({ service: "sovereign-worker", status: "ok" });
});

app.get("/v1/events", (_, response) => {
  response.json({ events: recentEvents });
});

app.post("/v1/ingest", async (request, response) => {
  try {
    const result = await orchestrator.ingest(request.body);
    response.status(result.status === "green" ? 200 : 422).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "invalid_request", details: error.issues });
      return;
    }
    response.status(500).json({
      error: "worker_failure",
      message: error instanceof Error ? error.message : "Unknown worker failure"
    });
  }
});

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (socket) => {
  sockets.add(socket);
  for (const event of recentEvents) {
    socket.send(JSON.stringify(event));
  }
  socket.on("close", () => sockets.delete(socket));
});

await startTelemetry();

server.listen(port, () => {
  console.log(`sovereign worker listening on :${port}`);
});

async function shutdown() {
  await store.close();
  await shutdownTelemetry();
  server.close();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
