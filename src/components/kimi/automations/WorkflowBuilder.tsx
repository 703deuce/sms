"use client";

import React, { useRef, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, Map as MapIcon, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, CheckCircle2 } from "lucide-react";
import BuilderPanel from "./BuilderPanel";
import CanvasNode from "./CanvasNode";
import ConfigModal from "./ConfigModal";
import { paletteItems, type PaletteKind } from "./palette-data";

export interface NodeOutput {
  label: string;
  kind: "yes" | "no" | "neutral";
  pie?: boolean;
}

export interface CanvasNodeData {
  id: string;
  itemId: string;
  label: string;
  kind: PaletteKind;
  icon: string;
  x: number;
  y: number;
  configured: boolean;
  subtitle: string;
  outputs: NodeOutput[];
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "yes" | "no" | "neutral";
}

const initialNodes: CanvasNodeData[] = [
  {
    id: "n1", itemId: "t-contact-created", label: "Contact Created", kind: "trigger", icon: "UserPlus",
    x: 60, y: 220, configured: true, subtitle: "Via keyword",
    outputs: [{ label: "", kind: "neutral" }],
  },
  {
    id: "n2", itemId: "c-field-matches", label: "Contact Field Matches", kind: "condition", icon: "FileCheck",
    x: 300, y: 220, configured: true, subtitle: "Email has no value",
    outputs: [
      { label: "Yes", kind: "yes", pie: true },
      { label: "No", kind: "no", pie: true },
    ],
  },
  {
    id: "n3", itemId: "a-send-message", label: "Send Message", kind: "action", icon: "MessageSquare",
    x: 540, y: 220, configured: true, subtitle: "Email Request",
    outputs: [
      { label: "Message Sent", kind: "yes", pie: true },
      { label: "Contact Not Subscribed", kind: "no", pie: true },
      { label: "Not Enough Messages", kind: "neutral", pie: true },
    ],
  },
  {
    id: "n4", itemId: "w-msg-received", label: "Message Received", kind: "wait", icon: "MessageSquare",
    x: 800, y: 220, configured: true, subtitle: "Look for an email",
    outputs: [
      { label: "Email Found", kind: "yes", pie: true },
      { label: "Message Wasn't Received", kind: "neutral", pie: true },
      { label: "Email Not Found", kind: "no", pie: true },
    ],
  },
  {
    id: "n5", itemId: "a-send-message", label: "Send Message", kind: "action", icon: "MessageSquare",
    x: 1080, y: 90, configured: true, subtitle: "Thanks",
    outputs: [{ label: "Message Sent", kind: "yes", pie: true }, { label: "Failed", kind: "no", pie: true }],
  },
  {
    id: "n6", itemId: "a-assign", label: "Assign Inbox Conversation", kind: "action", icon: "UserCheck",
    x: 1080, y: 360, configured: true, subtitle: "Chris Jones",
    outputs: [{ label: "", kind: "neutral" }],
  },
];

const initialEdges: CanvasEdge[] = [
  { id: "e1", from: "n1", to: "n2", label: "", kind: "neutral" },
  { id: "e2", from: "n2", to: "n3", label: "Yes", kind: "yes" },
  { id: "e3", from: "n3", to: "n4", label: "Message Sent", kind: "neutral" },
  { id: "e4", from: "n4", to: "n5", label: "Email Found", kind: "yes" },
  { id: "e5", from: "n4", to: "n6", label: "Email Not Found", kind: "no" },
];

const NODE_W = 168;
const NODE_H = 140;

export type WorkflowBuilderControlledProps = {
  name: string;
  description: string;
  frequency: string;
  active: boolean;
  nodes: CanvasNodeData[];
  edges: CanvasEdge[];
  selectedId: string | null;
  configNode: CanvasNodeData | null;
  saving?: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onFrequencyChange: (v: string) => void;
  onActiveChange: (v: boolean) => void;
  onNodesChange: Dispatch<SetStateAction<CanvasNodeData[]>>;
  onEdgesChange: Dispatch<SetStateAction<CanvasEdge[]>>;
  onSelectedIdChange: (id: string | null) => void;
  onConfigNodeChange: (node: CanvasNodeData | null) => void;
  onAddItem: (itemId: string) => void;
  onDeleteNode: (id: string) => void;
  onSaveConfig: (nodeId: string, subtitle: string) => void;
  onSave: () => void | Promise<void>;
};

export default function WorkflowBuilder({
  onBack,
  controlled,
}: {
  onBack: () => void;
  controlled?: WorkflowBuilderControlledProps;
}) {
  const [setupOpen, setSetupOpen] = useState(true);
  const [buildOpen, setBuildOpen] = useState(true);
  const [demoName, setDemoName] = useState("Email Collection");
  const [demoDescription, setDemoDescription] = useState("Asks new contacts for email");
  const [demoFrequency, setDemoFrequency] = useState("Only Once Ever");
  const [demoActive, setDemoActive] = useState(true);
  const [demoNodes, setDemoNodes] = useState<CanvasNodeData[]>(initialNodes);
  const [demoEdges, setDemoEdges] = useState<CanvasEdge[]>(initialEdges);
  const [demoSelectedId, setDemoSelectedId] = useState<string | null>(null);
  const [demoConfigNode, setDemoConfigNode] = useState<CanvasNodeData | null>(null);

  const name = controlled?.name ?? demoName;
  const setName = controlled?.onNameChange ?? setDemoName;
  const description = controlled?.description ?? demoDescription;
  const setDescription = controlled?.onDescriptionChange ?? setDemoDescription;
  const frequency = controlled?.frequency ?? demoFrequency;
  const setFrequency = controlled?.onFrequencyChange ?? setDemoFrequency;
  const active = controlled?.active ?? demoActive;
  const setActive = controlled?.onActiveChange ?? setDemoActive;
  const nodes = controlled?.nodes ?? demoNodes;
  const setNodes: Dispatch<SetStateAction<CanvasNodeData[]>> = controlled
    ? (value) => {
        controlled.onNodesChange((prev) =>
          typeof value === "function" ? value(prev) : value,
        );
      }
    : setDemoNodes;
  const edges = controlled?.edges ?? demoEdges;
  const setEdges: Dispatch<SetStateAction<CanvasEdge[]>> = controlled
    ? (value) => {
        controlled.onEdgesChange((prev) =>
          typeof value === "function" ? value(prev) : value,
        );
      }
    : setDemoEdges;
  const selectedId = controlled?.selectedId ?? demoSelectedId;
  const setSelectedId = controlled?.onSelectedIdChange ?? setDemoSelectedId;
  const configNode = controlled?.configNode ?? demoConfigNode;
  const setConfigNode = controlled?.onConfigNodeChange ?? setDemoConfigNode;

  const [toast, setToast] = useState(false);
  const [pending, setPending] = useState<{ from: string; label: string; kind: "yes" | "no" | "neutral"; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const idCounter = useRef(100);

  const getCanvasPos = (e: React.MouseEvent | MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleAddItem = (itemId: string) => {
    if (controlled) {
      controlled.onAddItem(itemId);
      return;
    }
    const item = Object.values(paletteItems).flat().find((i) => i.id === itemId);
    if (!item) return;
    idCounter.current += 1;
    const id = `n${idCounter.current}`;
    const outputs: NodeOutput[] =
      item.kind === "condition"
        ? [{ label: "Yes", kind: "yes", pie: true }, { label: "No", kind: "no", pie: true }]
        : item.kind === "wait"
        ? [{ label: "Found", kind: "yes", pie: true }, { label: "Not Found", kind: "no", pie: true }]
        : [{ label: "", kind: "neutral" }];
    const count = nodes.length;
    setNodes((prev) => [
      ...prev,
      {
        id, itemId: item.id, label: item.label, kind: item.kind, icon: item.icon,
        x: 80 + (count % 4) * 220, y: 60 + Math.floor(count / 4) * 200,
        configured: false, subtitle: "", outputs,
      },
    ]);
    setSelectedId(id);
  };

  const startDrag = (id: string, e: React.MouseEvent) => {
    const node = nodes.find((n) => n.id === id)!;
    const pos = getCanvasPos(e);
    dragRef.current = { id, dx: pos.x - node.x, dy: pos.y - node.y };

    const move = (ev: MouseEvent) => {
      const p = getCanvasPos(ev);
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, x: Math.max(0, p.x - dragRef.current!.dx), y: Math.max(0, p.y - dragRef.current!.dy) } : n))
      );
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const startConnect = (fromId: string, label: string, kind: "yes" | "no" | "neutral") => (e: React.MouseEvent) => {
    const from = nodes.find((n) => n.id === fromId)!;
    const sx = from.x + NODE_W + 10;
    const sy = from.y + NODE_H / 2;
    setPending({ from: fromId, label, kind, x: sx, y: sy });
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (pending) {
      const p = getCanvasPos(e);
      setPending({ ...pending, x: p.x, y: p.y });
    }
  };

  const onCanvasMouseUp = () => {
    setPending(null);
  };

  const onNodeMouseUp = (targetId: string) => {
    if (pending && pending.from !== targetId) {
      idCounter.current += 1;
      setEdges((prev) => [...prev, { id: `e${idCounter.current}`, from: pending.from, to: targetId, label: pending.label, kind: pending.kind }]);
    }
    setPending(null);
  };

  const deleteNode = (id: string) => {
    if (controlled) {
      controlled.onDeleteNode(id);
      return;
    }
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const saveConfig = (nodeId: string, subtitle: string) => {
    if (controlled) {
      controlled.onSaveConfig(nodeId, subtitle);
      return;
    }
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, configured: subtitle !== "Not configured", subtitle } : n)));
    setConfigNode(null);
  };

  const handleSaveWorkflow = async () => {
    if (controlled) {
      await controlled.onSave();
      setToast(true);
      setTimeout(() => setToast(false), 2600);
      return;
    }
    setToast(true);
    setTimeout(() => setToast(false), 2600);
  };

  const nodeCenter = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    return n ? { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 } : { x: 0, y: 0 };
  };

  const edgePath = (e: CanvasEdge) => {
    const from = nodes.find((n) => n.id === e.from);
    const to = nodes.find((n) => n.id === e.to);
    if (!from || !to) return { d: "", mx: 0, my: 0 };
    const x1 = from.x + NODE_W + 22;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x - 6;
    const y2 = to.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    return { d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, mx, my: (y1 + y2) / 2 - 6 };
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {toast && (
        <div className="toast-enter absolute right-6 top-5 z-50 flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          <CheckCircle2 size={16} /> Workflow Successfully Saved
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <div>
          <p className="text-[11px] text-muted-foreground">
            <button onClick={onBack} className="hover:text-indigo-600 hover:underline">Automations</button>
            {" / "}
            <span className="text-foreground">Create Workflow</span>
          </p>
          <h1 className="mt-0.5 text-[18px] font-bold" style={{ color: "var(--navy)" }}>Create Workflow</h1>
          <p className="text-[11.5px] text-muted-foreground">Build workflows by dragging objects onto the canvas and connecting them.</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left column: setup + build */}
        <div className="flex w-[520px] shrink-0">
          {/* Setup */}
          <div className="flex w-[252px] shrink-0 flex-col border-r border-border bg-card">
            <div className="flex-1 overflow-y-auto panel-scroll">
              <button
                onClick={() => setSetupOpen(!setupOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--navy)" }}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                  Setup
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${setupOpen ? "" : "-rotate-90"}`} />
              </button>
              {setupOpen && (
                <div className="space-y-3.5 px-4 pb-4">
                  <div>
                    <label className="mb-1 block text-[11.5px] font-semibold text-foreground">Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[12.5px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11.5px] font-semibold text-foreground">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="h-20 w-full resize-none rounded-lg border border-border bg-card p-2.5 text-[12.5px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11.5px] font-semibold text-foreground">Contacts Can Be In This Workflow...</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[12.5px] outline-none focus:border-indigo-400"
                    >
                      <option>Once at a Time</option>
                      <option>Only Once Ever</option>
                      <option>Multiple Times</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={() => setBuildOpen(!buildOpen)}
                className="flex w-full items-center justify-between border-t border-border px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--navy)" }}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-[10px] font-bold text-white">2</span>
                  Build
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${buildOpen ? "" : "-rotate-90"}`} />
              </button>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-4 py-3">
              <button
                onClick={() => setActive(!active)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${active ? "bg-indigo-600" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${active ? "left-[18px]" : "left-0.5"}`} />
              </button>
              <span className="text-[12px] font-semibold text-foreground">Active</span>
              <button
                onClick={() => void handleSaveWorkflow()}
                disabled={controlled?.saving}
                className="ml-auto h-8 rounded-lg bg-indigo-600 px-5 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {controlled?.saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {/* Build palette */}
          {buildOpen && <BuilderPanel onAddItem={handleAddItem} />}
        </div>

        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={canvasRef}
            className="canvas-dots absolute inset-0 overflow-hidden"
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseDown={() => setSelectedId(null)}
          >
            {/* edges */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 5 }}>
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#9ca3af" />
                </marker>
              </defs>
              {edges.map((e) => {
                const { d, mx, my } = edgePath(e);
                return (
                  <g key={e.id}>
                    <path d={d} fill="none" stroke="#9ca3af" strokeWidth={1.5} markerEnd="url(#arrow)" />
                    {e.label && (
                      <text x={mx} y={my} textAnchor="middle" className={`edge-label ${e.kind}`}>
                        {e.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {pending && (
                <path
                  d={`M ${nodeCenter(pending.from).x + NODE_W / 2 + 22} ${nodeCenter(pending.from).y} C ${(nodeCenter(pending.from).x + pending.x) / 2 + 60} ${nodeCenter(pending.from).y}, ${(nodeCenter(pending.from).x + pending.x) / 2 - 60} ${pending.y}, ${pending.x} ${pending.y}`}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
              )}
            </svg>

            {nodes.map((n) => (
              <div key={n.id} onMouseUp={() => onNodeMouseUp(n.id)}>
                <CanvasNode
                  node={n}
                  selected={selectedId === n.id}
                  onSelect={() => setSelectedId(n.id)}
                  onConfigure={() => setConfigNode(n)}
                  onDelete={() => deleteNode(n.id)}
                  onStartDrag={(e) => startDrag(n.id, e)}
                  onStartConnect={(label, kind) => {
                    const handler = startConnect(n.id, label, kind);
                    handler({} as React.MouseEvent);
                  }}
                />
              </div>
            ))}

            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <svg width="72" height="72" viewBox="0 0 32 32" fill="none" className="opacity-40">
                  <path d="M6 20c-2-4 0-9 5-11 4-1.6 8-0.5 10 2.5C18 10 13 12 12 16.5 11 21 8 22 6 20Z" fill="#14b8a6" />
                  <path d="M26 12c2 4 0 9-5 11-4 1.6-8 0.5-10-2.5 3 1.5 8-0.5 9-5 1-4.5 4-5.5 6-3.5Z" fill="#4f46e5" />
                </svg>
                <p className="mt-3 text-[15px] font-bold" style={{ color: "var(--navy)" }}>Create Workflow</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Drag objects onto this canvas to build your workflow.</p>
              </div>
            )}
          </div>

          {/* bottom canvas toolbar */}
          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-card px-2 py-1.5 shadow-md">
            <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted">
              <MapIcon size={13} /> Hide Map
            </button>
            <div className="mx-1 h-5 w-px bg-border" />
            <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><Undo2 size={14} /></button>
            <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><Redo2 size={14} /></button>
            <div className="mx-1 h-5 w-px bg-border" />
            <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><ZoomOut size={14} /></button>
            <button className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600 hover:bg-indigo-100"><ZoomIn size={14} /></button>
            <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><Maximize size={14} /></button>
          </div>

          {/* minimap */}
          <div className="absolute right-4 top-4 z-30 h-24 w-32 rounded-lg border border-border bg-card/90 shadow-sm">
            <div className="relative h-full w-full p-2">
              {nodes.map((n) => (
                <div
                  key={n.id}
                  className={`absolute rounded-sm ${n.kind === "trigger" ? "bg-teal-300" : n.kind === "condition" ? "bg-orange-300" : n.kind === "wait" ? "bg-violet-300" : "bg-indigo-300"}`}
                  style={{ left: 8 + n.x / 12, top: 8 + n.y / 10, width: 12, height: 8 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {configNode && (
        <ConfigModal node={configNode} onClose={() => setConfigNode(null)} onSave={saveConfig} />
      )}
    </div>
  );
}
