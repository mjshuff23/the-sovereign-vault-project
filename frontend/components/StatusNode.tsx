"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Activity, Ban, CheckCircle2, CircleDashed } from "lucide-react";
import type { StatusNodeData } from "./types";
import { statusClass } from "./pipelineState";

const icons = {
  idle: CircleDashed,
  running: Activity,
  green: CheckCircle2,
  red: Ban
};

export function StatusNode({ data }: NodeProps) {
  const nodeData = data as StatusNodeData;
  const Icon = icons[nodeData.status];

  return (
    <div className={`statusNode ${statusClass[nodeData.status]}`}>
      <Handle type="target" position={Position.Left} />
      <div className="nodeHeader">
        <span className="nodeIcon">
          <Icon size={16} strokeWidth={2.4} />
        </span>
        <span>{nodeData.label}</span>
      </div>
      <div className="nodeRole">{nodeData.role}</div>
      <div className="nodeDetail">{nodeData.detail}</div>
      {nodeData.latency != null ? <div className="nodeLatency">{nodeData.latency}</div> : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
