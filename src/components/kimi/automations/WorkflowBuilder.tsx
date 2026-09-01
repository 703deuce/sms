"use client";

import React, { useRef, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { Map as MapIcon, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, CheckCircle2 } from "lucide-react";
import BuilderPanel from "./BuilderPanel";
import CanvasNode from "./CanvasNode";
import ConfigModal from "./ConfigModal";
import KimiNodeConfigDrawer from "./KimiNodeConfigDrawer";
import { paletteItems, type PaletteKind } from "./palette-data";

export interface NodeOutput {
  outcomeId: string;
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
  config?: Record<string, unknown>;
  outputs: NodeOutput[];
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "yes" | "no" | "neutral";
  outcomeId: string;
}

const initialNodes: CanvasNodeData[] = [
  {
    id: "n1", itemId: "t-contact-created", label: "Contact Created", kind: "trigger", icon: "UserPlus",
    x: 60, y: 220, configured: true, subtitle: "Via keyword", config: { sources: ["Keyword"] },
    outputs: [{ outcomeId: "default", label: "", kind: "neutral" }],
  },
  {
    id: "n2", itemId: "c-field-matches", label: "Contact Field Matches", kind: "condition", icon: "FileCheck",
    x: 300, y: 220, configured: true, subtitle: "Email has no value", config: { field: "email", operator: "is_empty" },
    outputs: [
      { outcomeId: "yes", label: "Yes", kind: "yes", pie: true },
      { outcomeId: "no", label: "No", kind: "no", pie: true },
    ],
  },
  {
    id: "n3", itemId: "a-send-message", label: "Send Message", kind: "action", icon: "MessageSquare",
    x: 540, y: 220, configured: true, subtitle: "Email Request", config: { body: "Reply with your email" },
    outputs: [{ outcomeId: "default", label: "Next", kind: "neutral" }],
  },
  {
    id: "n4", itemId: "w-msg-received", label: "Message Received", kind: "wait", icon: "MessageSquare",
    x: 800, y: 220, configured: true, subtitle: "Look for an email", config: { extractData: true, dataType: "email" },
    outputs: [
      { outcomeId: "email_found", label: "Email Found", kind: "yes", pie: true },
      { outcomeId: "reply_no_email", label: "Email Not Found", kind: "no", pie: true },
      { outcomeId: "no_reply", label: "Message Not Received", kind: "neutral", pie: true },
    ],
  },
  {
    id: "n5", itemId: "a-send-message", label: "Send Message", kind: "action", icon: "MessageSquare",
    x: 1080, y: 90, configured: true, subtitle: "Thanks", config: { body: "Thanks!" },
    outputs: [{ outcomeId: "default", label: "Next", kind: "neutral" }],
  },
  {
    id: "n6", itemId: "a-assign", label: "Assign Inbox Conversation", kind: "action", icon: "UserCheck",
    x: 1080, y: 360, configured: true, subtitle: "Chris Jones", config: { assigneeName: "Chris Jones" },
    outputs: [
      { outcomeId: "assigned", label: "Assigned", kind: "yes", pie: true },
      { outcomeId: "conversation_not_found", label: "Conversation Doesn't Exist", kind: "no", pie: true },
      { outcomeId: "failed", label: "Failed", kind: "neutral", pie: true },
    ],
  },
];

const initialEdges: CanvasEdge[] = [
  { id: "e1", from: "n1", to: "n2", label: "", kind: "neutral", outcomeId: "default" },
  { id: "e2", from: "n2", to: "n3", label: "Yes", kind: "yes", outcomeId: "yes" },
  { id: "e3", from: "n3", to: "n4", label: "", kind: "neutral", outcomeId: "default" },
  { id: "e4", from: "n4", to: "n5", label: "Email Found", kind: "yes", outcomeId: "email_found" },
  { id: "e5", from: "n4", to: "n6", label: "Email Not Found", kind: "no", outcomeId: "reply_no_email" },
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
  startInSetup?: boolean;
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
  onSaveConfig: (nodeId: string, config: Record<string, unknown>, subtitle: string) => void;
  onSave: () => void | Promise<void>;
  flowId?: string;
};

export default function WorkflowBuilder({
  onBack,
  controlled,
}: {
  onBack: () => void;
  controlled?: WorkflowBuilderControlledProps;
}) {
  const [phase, setPhase] = useState<"setup" | "build">(
    controlled?.startInSetup ? "setup" : "build",
  );
  const [toast, setToast] = useState(false);
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

  const [pending, setPending] = useState<{ from: string; label: string; kind: "yes" | "no" | "neutral"; outcomeId: string; x: number; y: number } | null>(null);
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
        ? [
            { outcomeId: "yes", label: "Yes", kind: "yes", pie: true },
            { outcomeId: "no", label: "No", kind: "no", pie: true },
          ]
        : item.kind === "wait"
          ? [
              { outcomeId: "reply_received", label: "Found", kind: "yes", pie: true },
              { outcomeId: "no_reply", label: "Not Found", kind: "no", pie: true },
            ]
          : [{ outcomeId: "default", label: "", kind: "neutral" }];
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

  const startConnect = (fromId: string, label: string, kind: "yes" | "no" | "neutral", outcomeId: string) => (e: React.MouseEvent) => {
    const from = nodes.find((n) => n.id === fromId)!;
    const sx = from.x + NODE_W + 10;
    const sy = from.y + NODE_H / 2;
    setPending({ from: fromId, label, kind, outcomeId, x: sx, y: sy });
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
      setEdges((prev) => [
        ...prev.filter((e) => !(e.from === pending.from && e.outcomeId === pending.outcomeId)),
        { id: `e${idCounter.current}`, from: pending.from, to: targetId, label: pending.label, kind: pending.kind, outcomeId: pending.outcomeId },
      ]);
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

  const saveConfig = (nodeId: string, config: Record<string, unknown>, subtitle: string) => {
    if (controlled) {
      controlled.onSaveConfig(nodeId, config, subtitle);
      return;
    }
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, configured: subtitle !== "Not configured", subtitle, config } : n)));
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

  const pageTitle = name.trim() || "Untitled workflow";
  const canAdvanceSetup = name.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {toast && (
        <div className="toast-enter absolute right-6 top-5 z-50 flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          <CheckCircle2 size={16} /> Workflow Successfully Saved
        </div>
      )}

      {phase === "setup" ? (
        <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
          <div className="border-b border-border bg-card px-5 py-3">
            <p className="text-[11px] text-muted-foreground">
              <button onClick={onBack} className="hover:text-indigo-600 hover:underline">Automations</button>
              {" / "}
              <span className="text-foreground">New workflow</span>
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
            <div className="w-full max-w-lg rounded-[16px] border border-border bg-card p-6 shadow-sm">
              <h1 className="text-[22px] font-bold" style={{ color: "var(--navy)" }}>Set up your workflow</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Name your workflow and choose how contacts can enter it. You&apos;ll build the flow on the next screen.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-foreground">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Welcome series"
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-foreground">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this workflow do?"
                    className="h-24 w-full resize-none rounded-lg border border-border bg-card p-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-foreground">
                    Contacts can be in this workflow…
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-[13px] outline-none focus:border-indigo-400"
                  >
                    <option>Once at a Time</option>
                    <option>Only Once Ever</option>
                    <option>Multiple Times</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="h-9 rounded-lg px-4 text-[13px] font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canAdvanceSetup}
                  onClick={() => setPhase("build")}
                  className="h-9 rounded-lg bg-indigo-600 px-5 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 shrink-0 items-center justify-between border-b border-border bg-card px-5 py-2.5">
            <div className="min-w-0 flex-1 pr-4">
              <p className="text-[11px] text-muted-foreground">
                <button onClick={onBack} className="hover:text-indigo-600 hover:underline">Automations</button>
                {" / "}
                <span className="text-foreground">{pageTitle}</span>
              </p>
              <h1 className="truncate text-[16px] font-bold" style={{ color: "var(--navy)" }}>{pageTitle}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setPhase("setup")}
                className="hidden h-8 rounded-lg px-3 text-[12px] font-medium text-muted-foreground hover:bg-muted sm:inline-flex"
              >
                Edit setup
              </button>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${active ? "bg-indigo-600" : "bg-gray-300"}`}
                aria-label="Toggle active"
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${active ? "left-[18px]" : "left-0.5"}`} />
              </button>
              <span className="text-[12px] font-semibold text-foreground">Active</span>
              <button
                type="button"
                onClick={() => void handleSaveWorkflow()}
                disabled={controlled?.saving}
                className="h-8 rounded-lg bg-indigo-600 px-4 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {controlled?.saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="flex min-h-0 w-full flex-1 overflow-hidden">
            <BuilderPanel onAddItem={handleAddItem} />

            {/* Canvas */}
            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
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
                  onStartConnect={(label, kind, outcomeId) => {
                    const handler = startConnect(n.id, label, kind, outcomeId);
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
        </>
      )}

      {configNode && controlled?.flowId ? (
        <KimiNodeConfigDrawer
          flowId={controlled.flowId}
          node={configNode}
          onClose={() => setConfigNode(null)}
          onSave={saveConfig}
        />
      ) : configNode ? (
        <ConfigModal node={configNode} onClose={() => setConfigNode(null)} onSave={(id, subtitle) => saveConfig(id, {}, subtitle)} />
      ) : null}
    </div>
  );
}
