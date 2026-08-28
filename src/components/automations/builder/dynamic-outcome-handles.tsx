"use client";

import { getBlockOutcomes, isTerminalBlock } from "@/lib/automations/block-registry";
import { Handle, Position } from "@xyflow/react";

const HANDLE_COLORS = [
  "bg-violet-500",
  "bg-indigo-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-slate-500",
];

export function DynamicOutcomeHandles({
  blockType,
  config,
  isCondition,
}: {
  blockType: string;
  config: Record<string, unknown>;
  isCondition?: boolean;
}) {
  if (isTerminalBlock(blockType)) return null;

  const outcomes = getBlockOutcomes(blockType, config);
  if (outcomes.length <= 1) return null;

  // Legacy yes/no layout for simple conditions.
  if (isCondition && outcomes.length === 2 && outcomes[0].id === "yes") {
    return (
      <>
        <Handle
          type="source"
          position={Position.Left}
          id="yes"
          className="!h-4 !w-4 md:!h-2.5 md:!w-2.5 !bg-violet-500 touch-manipulation"
          style={{ top: "70%" }}
        />
        <span className="absolute -left-6 top-[65%] text-[10px] font-medium text-violet-600 max-md:hidden">
          Yes
        </span>
        <Handle
          type="source"
          position={Position.Right}
          id="no"
          className="!h-4 !w-4 md:!h-2.5 md:!w-2.5 !bg-rose-500 touch-manipulation"
          style={{ top: "70%" }}
        />
        <span className="absolute -right-5 top-[65%] text-[10px] font-medium text-rose-600 max-md:hidden">
          No
        </span>
      </>
    );
  }

  return (
    <>
      {outcomes.map((outcome, index) => {
        const total = outcomes.length;
        const leftPct = ((index + 1) / (total + 1)) * 100;
        const color = HANDLE_COLORS[index % HANDLE_COLORS.length];
        return (
          <Handle
            key={outcome.id}
            type="source"
            position={Position.Bottom}
            id={outcome.id}
            className={`!h-3 !w-3 ${color}`}
            style={{ left: `${leftPct}%` }}
          />
        );
      })}
      <div className="mt-2 flex flex-wrap gap-1 text-[9px] text-muted-foreground">
        {outcomes.slice(0, 6).map((o) => (
          <span key={o.id}>
            {o.hint ? `${o.label} (${o.hint})` : o.label}
          </span>
        ))}
        {outcomes.length > 6 ? <span>+{outcomes.length - 6} more</span> : null}
      </div>
    </>
  );
}
