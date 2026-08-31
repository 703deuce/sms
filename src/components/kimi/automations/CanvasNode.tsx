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
  GripVertical,
} from "lucide-react";
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
  onStartConnect: (outputLabel: string, outputKind: "yes" | "no" | "neutral") => void;
}

function PieHandle({
  outputs,
  onStartConnect,
}: {
  outputs: { label: string; kind: "yes" | "no" | "neutral" }[];
  onStartConnect: (label: string, kind: "yes" | "no" | "neutral") => void;
}) {
  const n = outputs.length;
  const colors: Record<string, string> = { yes: "#2dd4bf", no: "#fb923c", neutral: "#818cf8" };
  const size = 44;
  const r = size / 2;
  const segments = outputs.map((o, i) => {
    const start = (i / n) * Math.PI * 2 - Math.PI / 2;
    const end = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const x1 = r + r * Math.cos(start);
    const y1 = r + r * Math.sin(start);
    const x2 = r + r * Math.cos(end);
    const y2 = r + r * Math.sin(end);
    const large = n > 2 ? 0 : 0;
    return (
      <path
        key={o.label}
        d={`M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={colors[o.kind]}
        stroke="white"
        strokeWidth={1.5}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect(o.label, o.kind);
        }}
      >
        <title>{o.label}</title>
      </path>
    );
  });
  return (
    <svg className="pie-handle" width={size} height={size} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>
      {segments}
    </svg>
  );
}

export default function CanvasNode({ node, selected, onSelect, onConfigure, onDelete, onStartDrag, onStartConnect }: Props) {
  const style = kindStyles[node.kind] || kindStyles.action;
  const Icon = iconMap[node.icon] || MessageSquare;

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
      <div className={`node-card relative w-[168px] rounded-xl border border-border bg-card shadow-sm ${selected ? "selected" : ""}`}>
        {/* header controls */}
        <div className="flex items-center justify-between px-2 pt-1.5">
          <button
            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
          <GripVertical size={12} className="text-muted-foreground/40" />
          <button
            className="rounded p-1 text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onConfigure}
            title="Configure"
          >
            <Settings size={12} />
          </button>
        </div>

        <div className="flex flex-col items-center px-3 pb-3 pt-1">
          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${style.iconBg}`}>
            <Icon size={19} className={style.iconColor} />
          </div>
          <p className="mt-2 text-center text-[12px] font-semibold leading-tight text-foreground">{node.label}</p>
          <p className="mt-0.5 text-center text-[10.5px] leading-tight text-muted-foreground">
            {node.configured ? node.subtitle : "Not configured"}
          </p>
        </div>

        {/* input handle */}
        <div className="absolute -left-[7px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-gray-300 bg-white" />

        {/* output */}
        {node.outputs.length === 1 && !node.outputs[0].pie ? (
          <button
            className="absolute -right-[11px] top-1/2 flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white shadow-sm text-indigo-600 hover:bg-indigo-50"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.outputs[0].label, node.outputs[0].kind);
            }}
            title={node.outputs[0].label || "Connect"}
          >
            <ArrowRight size={11} />
          </button>
        ) : (
          <div className="absolute -right-[24px] top-1/2 -translate-y-1/2">
            <PieHandle outputs={node.outputs} onStartConnect={onStartConnect} />
          </div>
        )}
      </div>
    </div>
  );
}
