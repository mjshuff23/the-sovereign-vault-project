"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node
} from "@xyflow/react";
import { Radio, ShieldCheck, Siren, Stethoscope } from "lucide-react";
import { StatusNode } from "./StatusNode";
import { applyPipelineEvent, resetNodes } from "./pipelineState";
import type { PipelineEvent, StatusNodeData } from "./types";

const workerHttpUrl = process.env.NEXT_PUBLIC_WORKER_HTTP_URL ?? "http://localhost:4000";
const workerWsUrl = process.env.NEXT_PUBLIC_WORKER_WS_URL ?? "ws://localhost:4000/ws";

const initialNodes: Array<Node<StatusNodeData>> = [
  {
    id: "ingest",
    type: "statusNode",
    position: { x: 0, y: 120 },
    data: {
      label: "Ingest",
      role: "Node.js public orchestrator",
      status: "idle",
      detail: "Awaiting request"
    }
  },
  {
    id: "scrub",
    type: "statusNode",
    position: { x: 280, y: 40 },
    data: {
      label: "Scrub",
      role: "Rust/Axum PII border guard",
      status: "idle",
      detail: "Awaiting request"
    }
  },
  {
    id: "attestation",
    type: "statusNode",
    position: { x: 280, y: 220 },
    data: {
      label: "Attestation",
      role: "Simulated Nitro identity proof",
      status: "idle",
      detail: "Awaiting request"
    }
  },
  {
    id: "vault",
    type: "statusNode",
    position: { x: 590, y: 120 },
    data: {
      label: "Vault",
      role: "Python/FastAPI semantic referee",
      status: "idle",
      detail: "Awaiting request"
    }
  },
  {
    id: "redis",
    type: "statusNode",
    position: { x: 900, y: 40 },
    data: {
      label: "Circuit",
      role: "Redis distributed state",
      status: "idle",
      detail: "Awaiting request"
    }
  },
  {
    id: "response",
    type: "statusNode",
    position: { x: 900, y: 220 },
    data: {
      label: "Response",
      role: "Certified output gate",
      status: "idle",
      detail: "Awaiting request"
    }
  }
];

const edges: Edge[] = [
  { id: "ingest-scrub", source: "ingest", target: "scrub", animated: true },
  { id: "scrub-vault", source: "scrub", target: "vault", animated: true },
  { id: "ingest-attestation", source: "ingest", target: "attestation", animated: true },
  { id: "attestation-vault", source: "attestation", target: "vault", animated: true },
  { id: "vault-redis", source: "vault", target: "redis", animated: true },
  { id: "vault-response", source: "vault", target: "response", animated: true },
  { id: "redis-response", source: "redis", target: "response", animated: true }
];

const examples = {
  clean: {
    patientQuestion: "Can the assistant explain minimum necessary disclosure for a care team update?",
    modelAnswer:
      "Use the minimum necessary policy, avoid direct identifiers, and consult a clinician for care decisions.",
    actor: "clinician"
  },
  pii: {
    patientQuestion: "Patient: Jane Doe has SSN 123-45-6789 and email jane@example.com. Can I share it?",
    modelAnswer: "Consult a clinician.",
    actor: "admin"
  },
  hallucination: {
    patientQuestion: "Can the answer promise this treatment is safe?",
    modelAnswer: "This treatment is a guaranteed cure, 100% safe, and cannot be wrong.",
    actor: "patient"
  }
} as const;

export function SovereignVaultConsole() {
  const [nodes, setNodes] = useState(initialNodes);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [patientQuestion, setPatientQuestion] = useState<string>(examples.clean.patientQuestion);
  const [modelAnswer, setModelAnswer] = useState<string>(examples.clean.modelAnswer);
  const [actor, setActor] = useState<"clinician" | "patient" | "admin">("clinician");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [traceId, setTraceId] = useState("not issued");
  const [status, setStatus] = useState<"idle" | "green" | "red">("idle");

  const nodeTypes = useMemo(() => ({ statusNode: StatusNode }), []);

  const applyEvent = useCallback((event: PipelineEvent) => {
    setNodes((current) => applyPipelineEvent(current, event));
    setEvents((current) => [event, ...current].slice(0, 40));
    if (event.traceId) setTraceId(event.traceId);
    if (event.node === "response" && (event.status === "green" || event.status === "red")) {
      setStatus(event.status);
      setIsSubmitting(false);
    }
  }, []);

  useEffect(() => {
    const socket = new WebSocket(workerWsUrl);
    socket.onmessage = (message) => {
      applyEvent(JSON.parse(message.data as string) as PipelineEvent);
    };
    socket.onerror = () => {
      const event: PipelineEvent = {
        requestId: "local-ui",
        node: "response",
        status: "red",
        message: "UI [Socket]: worker WebSocket unavailable; start make up",
        timestamp: new Date().toISOString()
      };
      setEvents((currentEvents) => [event, ...currentEvents].slice(0, 40));
    };
    return () => socket.close();
  }, [applyEvent]);

  function loadExample(kind: keyof typeof examples) {
    const example = examples[kind];
    setPatientQuestion(example.patientQuestion);
    setModelAnswer(example.modelAnswer);
    setActor(example.actor);
  }

  async function submit() {
    setIsSubmitting(true);
    setStatus("idle");
    setTraceId("pending");
    setNodes((current) => resetNodes(current));
    try {
      const response = await fetch(`${workerHttpUrl}/v1/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientQuestion, modelAnswer, actor })
      });
      const body = (await response.json().catch(() => ({}))) as {
        traceId?: string;
        status?: "green" | "red";
        reasons?: string[];
      };

      if (!response.ok) {
        throw new Error(body.reasons?.join("; ") || `worker returned HTTP ${response.status}`);
      }

      if (body.traceId) setTraceId(body.traceId);
      if (body.status) setStatus(body.status);
      const reasons = body.reasons ?? [];
      if (reasons.length) {
        setEvents((current) => [
          ...reasons.map((reason) => ({
            requestId: "http-response",
            node: "response" as const,
            status: body.status ?? "red",
            message: reason,
            traceId: body.traceId,
            timestamp: new Date().toISOString()
          })),
          ...current
        ].slice(0, 40));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown ingest failure";
      console.error("Sovereign Vault ingest failed", error);
      setStatus("red");
      const event: PipelineEvent = {
        requestId: "local-ui",
        node: "response",
        status: "red",
        message: `UI [HTTP]: ${message}`,
        timestamp: new Date().toISOString()
      };
      setEvents((current) => [event, ...current].slice(0, 40));
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusLabel =
    status === "green" ? "Certified Truth" : status === "red" ? "Circuit Red" : "Awaiting Audit";

  return (
    <main className="consoleShell">
      <header className="topBar">
        <div>
          <h1>Sovereign Vault</h1>
          <p>Confidential truth-audit lab for adversarial healthcare AI workflows</p>
        </div>
        <div className={`globalStatus ${status}`}>
          <ShieldCheck size={18} />
          <span>{statusLabel}</span>
        </div>
      </header>

      <section className="consoleGrid">
        <aside className="controlPanel" aria-label="Adversarial request controls">
          <div className="panelTitle">
            <Stethoscope size={18} />
            <span>Adversarial Request</span>
          </div>
          <label>
            Actor
            <select value={actor} onChange={(event) => setActor(event.target.value as typeof actor)}>
              <option value="clinician">Clinician</option>
              <option value="patient">Patient</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Patient question
            <textarea value={patientQuestion} onChange={(event) => setPatientQuestion(event.target.value)} />
          </label>
          <label>
            Candidate model answer
            <textarea value={modelAnswer} onChange={(event) => setModelAnswer(event.target.value)} />
          </label>
          <div className="exampleButtons">
            <button type="button" onClick={() => loadExample("clean")}>
              Clean
            </button>
            <button type="button" onClick={() => loadExample("pii")}>
              PHI Leak
            </button>
            <button type="button" onClick={() => loadExample("hallucination")}>
              Hallucination
            </button>
          </div>
          <button className="submitButton" type="button" onClick={() => void submit()} disabled={isSubmitting}>
            {isSubmitting ? "Auditing..." : "Run Audit"}
          </button>
        </aside>

        <section className="flowPanel" aria-label="Live service flow">
          <div className="flowMeta">
            <span>
              <Radio size={16} /> trace
            </span>
            <code>{traceId}</code>
          </div>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.55}>
            <Background gap={18} size={1} color="#31414b" />
            <MiniMap pannable zoomable />
            <Controls showInteractive={false} />
          </ReactFlow>
        </section>

        <aside className="logPanel" aria-label="Noisy security log">
          <div className="panelTitle">
            <Siren size={18} />
            <span>Noisy Security Log</span>
          </div>
          <div className="logList">
            {events.length === 0 ? (
              <p className="emptyLog">No audit events yet.</p>
            ) : (
              events.map((event, index) => (
                <article className={`logEntry ${event.status}`} key={`${event.timestamp}-${index}`}>
                  <div>
                    <strong>{event.node}</strong>
                    <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
                  </div>
                  <p>{event.message}</p>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
