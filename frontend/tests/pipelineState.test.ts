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
