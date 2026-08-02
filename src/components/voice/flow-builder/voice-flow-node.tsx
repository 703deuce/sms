"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { getVoiceFlowBlock, isBranchingBlock } from "@/lib/voice/flow/catalog";
import { nodeSummary, type VoiceFlowNode } from "@/lib/voice/flow/types";
import {
  Bot,
  GitBranch,
  MessageSquare,
  Phone,
  PhoneForwarded,
  Square,
  Wrench,
} from "lucide-react";

export type VoiceFlowNodeData = {
  blockType: string;
  label: string;
  config: Record<string, unknown>;
  category?: string;
  selected?: boolean;
  hasError?: boolean;
};

function NodeIcon({ blockType }: { blockType: string }) {
  if (blockType.includes("transfer") || blockType.includes("escalate") || blockType.includes("handoff"))
    return <PhoneForwarded className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  if (blockType.includes("sms") || blockType.includes("message"))
    return <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  if (blockType.includes("ai") || blockType === "greeting" || blockType === "conversation")
    return <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  if (isBranchingBlock(blockType) || blockType.includes("condition") || blockType.includes("hours"))
    return <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  if (blockType === "end_call")
    return <Square className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  if (blockType.includes("tool") || blockType.includes("crm"))
    return <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  return <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
}

export function VoiceFlowCanvasNode({ data, selected }: NodeProps) {
  const d = data as VoiceFlowNodeData;
  const block = getVoiceFlowBlock(d.blockType);
  const summary = nodeSummary({
    id: "x",
    type: (d.category as VoiceFlowNode["type"]) || "conversation",
    position: { x: 0, y: 0 },
    data: d,
  });
  const isEntry = d.blockType === "incoming_call";
  const isEnd = block?.category === "end";
  const branching = isBranchingBlock(d.blockType);
  const intentBranch = block?.branches === "intent";

  const color = isEntry
    ? "border-emerald-400 bg-emerald-50"
    : branching
      ? "border-violet-300 bg-violet-50"
      : isEnd
        ? "border-border bg-muted/40"
        : d.category === "crm"
          ? "border-amber-300 bg-amber-50"
          : d.category === "handoff"
            ? "border-rose-300 bg-rose-50"
            : d.category === "routing"
              ? "border-sky-300 bg-sky-50"
              : "border-primary/40 bg-primary/5";

  return (
    <div
      className={cn(
        "relative min-w-[200px] max-w-[250px] rounded-xl border-2 px-3 py-2.5 shadow-sm transition select-none",
        color,
        selected && "ring-2 ring-primary ring-offset-2",
        d.hasError && "ring-2 ring-rose-500",
      )}
    >
      {!isEntry && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3.5 !w-3.5 !bg-primary"
        />
      )}
      <div className="flex items-start gap-2">
        <NodeIcon blockType={d.blockType} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{d.label}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{summary}</p>
        </div>
      </div>

      {branching && !intentBranch ? (
        <>
          <Handle
            type="source"
            position={Position.Left}
            id="yes"
            className="!h-3.5 !w-3.5 !bg-emerald-500"
            style={{ top: "70%" }}
          />
          <span className="absolute -left-6 top-[65%] text-[10px] font-medium text-emerald-600">
            Yes
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id="no"
            className="!h-3.5 !w-3.5 !bg-rose-500"
            style={{ top: "70%" }}
          />
          <span className="absolute -right-5 top-[65%] text-[10px] font-medium text-rose-600">
            No
          </span>
        </>
      ) : intentBranch ? (
        <>
          {["faq", "sales", "billing", "appointment", "human", "other"].map((id, i) => (
            <Handle
              key={id}
              type="source"
              position={Position.Bottom}
              id={id}
              className="!h-2.5 !w-2.5 !bg-primary"
              style={{ left: `${12 + i * 15}%` }}
            />
          ))}
        </>
      ) : !isEnd ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          className="!h-3.5 !w-3.5 !bg-primary"
        />
      ) : null}
    </div>
  );
}

export const voiceFlowNodeTypes = { voiceFlow: VoiceFlowCanvasNode };
