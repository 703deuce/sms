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
    return (
      <path
        key={o.label}
        d={`M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
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
    <svg className="pie-handle" width={size} height={size} style={{ filter: "drop-shadow(0 2px 5px rgba(30,42,90,0.2))" }}>
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
      <div className={`node-card group relative w-[152px] border bg-card ${selected ? "selected" : "border-border"}`}>
        {/* hover controls */}
        <div
          className={`pointer-events-none absolute -top-2.5 left-0 right-0 flex items-center justify-between px-1 transition-opacity duration-150 ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <button
            className="node-ctl pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
          <button
            className="node-ctl pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onConfigure}
            title="Configure"
          >
            <Settings size={11} />
          </button>
        </div>

        <div className="flex flex-col items-center px-3 pb-3.5 pt-4">
          <div className={`node-icon flex h-11 w-11 items-center justify-center rounded-full ${style.iconBg}`}>
            <Icon size={19} className={style.iconColor} />
          </div>
          <p className="mt-2 text-center text-[12px] font-semibold leading-tight text-foreground">{node.label}</p>
          <p className={`mt-0.5 text-center text-[10.5px] leading-tight ${node.configured ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
            {node.configured ? node.subtitle : "Not configured"}
          </p>
        </div>

        {/* input handle */}
        {node.kind !== "trigger" && <div className="node-handle-in" />}

        {/* output */}
        {node.outputs.length === 1 && !node.outputs[0].pie ? (
          <button
            className="node-out-btn absolute -right-[11px] top-1/2 flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm"
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
