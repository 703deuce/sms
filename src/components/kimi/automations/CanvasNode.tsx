"use client";

import React from "react";
import {
  UserPlus,
  FileCheck,
  MessageSquare,
  UserCheck,
  Trash2,
  Settings,
  ArrowRight,
} from "lucide-react";
import { kimiOutputColor } from "@/lib/automations/outcome-ui";
import type { CanvasNodeData } from "./WorkflowBuilder";

const iconMap: Record<string, React.ElementType> = {
  UserPlus,
  FileCheck,
  MessageSquare,
  UserCheck,
};

const kindStyles: Record<string, { iconBg: string; iconColor: string }> = {
  trigger: { iconBg: "bg-teal-100", iconColor: "text-teal-600" },
  condition: { iconBg: "bg-orange-100", iconColor: "text-orange-500" },
  action: { iconBg: "bg-indigo-100", iconColor: "text-indigo-600" },
  wait: { iconBg: "bg-violet-100", iconColor: "text-violet-600" },
};

interface Props {
  node: CanvasNodeData;
  selected: boolean;
  onSelect: () => void;
  onConfigure: () => void;
  onDelete: () => void;
  onStartDrag: (e: React.MouseEvent) => void;
  onStartConnect: (outputLabel: string, outputKind: "yes" | "no" | "neutral", outcomeId: string) => void;
}

function PieHandle({
  outputs,
  onStartConnect,
}: {
  outputs: CanvasNodeData["outputs"];
  onStartConnect: (label: string, kind: "yes" | "no" | "neutral", outcomeId: string) => void;
}) {
  const n = outputs.length;
  const size = 44;
  const r = size / 2;
  const segments = outputs.map((o, i) => {
    const start = (i / n) * Math.PI * 2 - Math.PI / 2;
    const end = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const x1 = r + r * Math.cos(start);
    const y1 = r + r * Math.sin(start);
    const x2 = r + r * Math.cos(end);
    const y2 = r + r * Math.sin(end);
    const fill = kimiOutputColor(i);
    return (
      <path
        key={o.outcomeId}
        d={`M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
        fill={fill}
        stroke="white"
        strokeWidth={1.5}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect(o.label, o.kind, o.outcomeId);
        }}
      >
        <title>{o.label || o.outcomeId}</title>
      </path>
    );
  });
  return (
    <svg className="pie-handle" width={size} height={size} style={{ filter: "drop-shadow(0 2px 5px rgba(30,42,90,0.2))" }}>
      {segments}
    </svg>
  );
}

export default function CanvasNode({ node, selected, onSelect, onConfigure, onDelete, onStartDrag, onStartConnect }: Props) {
  const style = kindStyles[node.kind] || kindStyles.action;
  const Icon = iconMap[node.icon] || MessageSquare;
  const multiOut = node.outputs.length > 1;

  return (
    <div
      className="absolute"
      style={{ left: node.x, top: node.y, zIndex: selected ? 20 : 10 }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
        onStartDrag(e);
      }}
    >
      <div className={`node-card group relative w-[152px] border bg-card ${selected ? "selected" : "border-border"}`}>
        <div
          className={`pointer-events-none absolute -top-2.5 left-0 right-0 flex items-center justify-between px-1 transition-opacity duration-150 ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <button
            className="pointer-events-auto rounded bg-card p-1 text-muted-foreground shadow-sm hover:text-red-500"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={11} />
          </button>
          <button
            className="pointer-events-auto rounded bg-card p-1 text-muted-foreground shadow-sm hover:text-indigo-600"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
          >
            <Settings size={11} />
          </button>
        </div>

        <div className="flex items-start gap-2 p-2.5">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${style.iconBg}`}>
            <Icon size={14} className={style.iconColor} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{node.kind}</div>
            <div className="truncate text-[11px] font-semibold text-foreground">{node.label}</div>
            <div className="truncate text-[10px] text-muted-foreground">{node.subtitle || "Not configured"}</div>
          </div>
        </div>

        {multiOut ? (
          <div className="absolute -right-5 top-1/2 -translate-y-1/2">
            <PieHandle outputs={node.outputs} onStartConnect={onStartConnect} />
          </div>
        ) : (
          <button
            className="absolute -right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:border-indigo-400 hover:text-indigo-600"
            onMouseDown={(e) => {
              e.stopPropagation();
              const out = node.outputs[0] || { outcomeId: "default", label: "", kind: "neutral" as const };
              onStartConnect(out.label, out.kind, out.outcomeId);
            }}
          >
            <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
