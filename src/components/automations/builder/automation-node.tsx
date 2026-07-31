"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { nodeSummary } from "@/lib/automations/types";
import {
  Clock,
  GitBranch,
  MessageSquare,
  Square,
  Zap,
} from "lucide-react";

export type AutomationNodeData = {
  blockType: string;
  label: string;
  config: Record<string, unknown>;
  category?: string;
  selected?: boolean;
};

function NodeIcon({ blockType }: { blockType: string }) {
  if (blockType === "wait") return <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  if (blockType === "condition" || blockType.startsWith("condition_"))
    return <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  if (blockType.includes("send") || blockType.includes("sms"))
    return <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  if (blockType === "end_automation")
    return <Square className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  return <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
}

export function AutomationFlowNode({ id, data, selected }: NodeProps) {
  const d = data as AutomationNodeData;
  const summary = nodeSummary({
    id,
    type: "action",
    position: { x: 0, y: 0 },
    data: d,
  });

  const isTrigger = d.blockType === "customer_added" || d.blockType === "manual_enrollment" || d.blockType === "tag_added" || d.blockType === "form_submitted";
  const isCondition = d.blockType === "condition" || d.blockType.startsWith("condition_");
  const isEnd = d.blockType === "end_automation";

  const color = isTrigger
    ? "border-primary bg-primary/5"
    : isCondition
      ? "border-violet-300 bg-violet-50"
      : d.blockType === "wait"
        ? "border-amber-300 bg-amber-50"
        : isEnd
          ? "border-border bg-muted/40"
          : "border-sky-300 bg-sky-50";

  return (
    <div
      className={cn(
        "relative min-w-[200px] max-w-[240px] rounded-xl border-2 px-3 py-2.5 shadow-sm transition select-none",
        color,
        selected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3.5 !w-3.5 md:!h-2 md:!w-2 !bg-primary touch-manipulation"
        />
      )}

      <div className="flex items-start gap-2">
        <NodeIcon blockType={d.blockType} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{d.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{summary}</p>
        </div>
      </div>

      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Left}
            id="yes"
            className="!h-4 !w-4 md:!h-2.5 md:!w-2.5 !bg-emerald-500 touch-manipulation"
            style={{ top: "70%" }}
          />
          <span className="absolute -left-6 top-[65%] text-[10px] font-medium text-emerald-600 max-md:hidden">Yes</span>
          <Handle
            type="source"
            position={Position.Right}
            id="no"
            className="!h-4 !w-4 md:!h-2.5 md:!w-2.5 !bg-rose-500 touch-manipulation"
            style={{ top: "70%" }}
          />
          <span className="absolute -right-5 top-[65%] text-[10px] font-medium text-rose-600 max-md:hidden">No</span>
        </>
      ) : !isEnd ? (
        <Handle type="source" position={Position.Bottom} id="default" className="!h-3.5 !w-3.5 md:!h-2 md:!w-2 !bg-primary touch-manipulation" />
      ) : null}
    </div>
  );
}

export const automationNodeTypes = {
  automation: AutomationFlowNode,
};
