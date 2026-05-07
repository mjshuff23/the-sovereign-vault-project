import type { Node } from "@xyflow/react";
import type { PipelineEvent, StatusNodeData } from "./types";

export const statusClass: Record<StatusNodeData["status"], string> = {
  idle: "nodeIdle",
  running: "nodeRunning",
  green: "nodeGreen",
  red: "nodeRed"
};

export function applyPipelineEvent(
  nodes: Array<Node<StatusNodeData>>,
  event: PipelineEvent
): Array<Node<StatusNodeData>> {
  return nodes.map((node) => {
    if (node.id !== event.node) return node;

    return {
      ...node,
      data: {
        ...node.data,
        status: event.status,
        latency:
          event.latencyMs === undefined ? node.data.latency : `${event.latencyMs.toFixed(1)} ms`,
        detail: event.message
      }
    };
  });
}

export function resetNodes(nodes: Array<Node<StatusNodeData>>): Array<Node<StatusNodeData>> {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      status: "idle",
      latency: undefined,
      detail: "Awaiting request"
    }
  }));
}
