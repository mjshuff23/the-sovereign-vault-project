import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { applyPipelineEvent, resetNodes } from "../components/pipelineState";
import type { StatusNodeData } from "../components/types";

const nodes: Array<Node<StatusNodeData>> = [
  {
    id: "vault",
    position: { x: 0, y: 0 },
    data: {
      label: "Vault",
      role: "Python/FastAPI semantic referee",
      status: "idle",
      detail: "Awaiting request"
    }
  }
];

describe("pipeline state helpers", () => {
  it("applies service events to the matching React Flow node", () => {
    const next = applyPipelineEvent(nodes, {
      requestId: "req-1",
      node: "vault",
      status: "red",
      message: "Vault [Audit]: Potential HIPAA leak detected inside TEE; process terminated",
      latencyMs: 12.345,
      timestamp: new Date().toISOString()
    });

    expect(next[0].data.status).toBe("red");
    expect(next[0].data.detail).toContain("HIPAA leak");
    expect(next[0].data.latency).toBe("12.3 ms");
  });

  it("returns the original array when the event node id does not match any node", () => {
    const result = applyPipelineEvent(nodes, {
      requestId: "req-2",
      node: "response",
      status: "green",
      message: "No-op event for a node outside this test fixture",
      latencyMs: 1.23,
      timestamp: new Date().toISOString()
    });

    expect(result).toBe(nodes);
  });

  it("preserves existing node latency when an event has no latency measurement", () => {
    const withLatency = [
      {
        ...nodes[0],
        data: {
          ...nodes[0].data,
          latency: "42.0 ms"
        }
      }
    ];

    const next = applyPipelineEvent(withLatency, {
      requestId: "req-3",
      node: "vault",
      status: "green",
      message: "Vault handled request without a new latency measurement",
      timestamp: new Date().toISOString()
    });

    expect(next[0].data.status).toBe("green");
    expect(next[0].data.detail).toContain("Vault handled request");
    expect(next[0].data.latency).toBe("42.0 ms");
  });

  it("resets nodes before a new audit run", () => {
    const reset = resetNodes([
      {
        ...nodes[0],
        data: { ...nodes[0].data, status: "red", latency: "10.0 ms", detail: "Rejected" }
      }
    ]);

    expect(reset[0].data.status).toBe("idle");
    expect(reset[0].data.latency).toBeUndefined();
    expect(reset[0].data.detail).toBe("Awaiting request");
  });
});
