"use client";

import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import {
  blocksForLayer,
  getVoiceFlowBlock,
  isBranchingBlock,
  type VoiceFlowBlock,
} from "@/lib/voice/flow/catalog";
import {
  VOICE_FLOW_TEMPLATES,
  defaultFlowBundleForAgentType,
  getVoiceFlowTemplate,
} from "@/lib/voice/flow/templates";
import {
  createEdgeId,
  createNodeId,
  parseVoiceFlowBundle,
  type VoiceFlowBundle,
  type VoiceFlowGraph,
  type VoiceFlowLayer,
  type VoiceFlowNode,
  type VoiceGlobalRule,
} from "@/lib/voice/flow/types";
import {
  hasBlockingFlowErrors,
  validateVoiceFlowBundle,
  type FlowIssue,
} from "@/lib/voice/flow/validation";
import { cn } from "@/lib/utils";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VoiceFlowSidebar } from "./voice-flow-sidebar";
import { VoiceNodeConfigPanel } from "./voice-node-config-panel";
import { voiceFlowNodeTypes } from "./voice-flow-node";

function toFlowNodes(
  graph: VoiceFlowGraph,
  selectedId: string | null,
  errorIds: Set<string>,
): Node[] {
  return graph.nodes.map((n) => ({
    id: n.id,
    type: "voiceFlow",
    position: n.position,
    data: {
      blockType: n.data.blockType,
      label: n.data.label,
      config: n.data.config,
      category: n.type,
      selected: n.id === selectedId,
      hasError: errorIds.has(n.id),
    },
    selected: n.id === selectedId,
  }));
}

function toFlowEdges(graph: VoiceFlowGraph): Edge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || "default",
    targetHandle: e.targetHandle || undefined,
    animated: true,
    style: { strokeWidth: 2 },
    label:
      e.sourceHandle === "yes"
        ? "Yes"
        : e.sourceHandle === "no"
          ? "No"
          : e.sourceHandle && e.sourceHandle !== "default"
            ? e.sourceHandle
            : undefined,
  }));
}

function fromFlowState(nodes: Node[], edges: Edge[], viewport: VoiceFlowGraph["viewport"]): VoiceFlowGraph {
  return {
    version: 1,
    viewport,
    nodes: nodes.map((n) => {
      const blockType = String((n.data as { blockType?: string }).blockType || "");
      const block = getVoiceFlowBlock(blockType);
      return {
        id: n.id,
        type: block?.category || "conversation",
        position: n.position,
        data: {
          blockType,
          label: String((n.data as { label?: string }).label || block?.label || blockType),
          config: ((n.data as { config?: Record<string, unknown> }).config || {}) as Record<
            string,
            unknown
          >,
        },
      } satisfies VoiceFlowNode;
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || "default",
      targetHandle: e.targetHandle || null,
    })),
  };
}

function VoiceFlowCanvas({
  layer,
  graph,
  selectedNodeId,
  errorIds,
  onSelect,
  onGraphChange,
  onAddBlock,
}: {
  layer: VoiceFlowLayer;
  graph: VoiceFlowGraph;
  selectedNodeId: string | null;
  errorIds: Set<string>;
  onSelect: (id: string | null) => void;
  onGraphChange: (graph: VoiceFlowGraph) => void;
  onAddBlock: (block: VoiceFlowBlock, position?: { x: number; y: number }) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toFlowNodes(graph, selectedNodeId, errorIds),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(graph));
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const viewportRef = useRef(graph.viewport);

  useEffect(() => {
    setNodes(toFlowNodes(graph, selectedNodeId, errorIds));
    setEdges(toFlowEdges(graph));
  }, [graph, selectedNodeId, errorIds, setNodes, setEdges]);

  const commit = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onGraphChange(fromFlowState(nextNodes, nextEdges, viewportRef.current));
    },
    [onGraphChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const edge: Edge = {
        id: createEdgeId(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || "default",
        targetHandle: connection.targetHandle || undefined,
        animated: true,
        style: { strokeWidth: 2 },
      };
      const nextEdges = [...edges, edge];
      setEdges(nextEdges);
      commit(nodes, nextEdges);
    },
    [edges, nodes, setEdges, commit],
  );

  return (
    <div
      className="h-full w-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const blockType = e.dataTransfer.getData("voiceBlockType");
        const block = getVoiceFlowBlock(blockType);
        if (!block || !rfRef.current) return;
        if (block.layer !== layer && block.layer !== "both") return;
        const position = rfRef.current.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        onAddBlock(block, position);
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={voiceFlowNodeTypes}
        onNodesChange={(chs) => {
          onNodesChange(chs);
          // Persist position changes after drag
          const moved = chs.some((c) => c.type === "position" && "dragging" in c && c.dragging === false);
          if (moved) {
            // nodes state updates async; use timeout microtask
            queueMicrotask(() => {
              setNodes((curr) => {
                commit(curr, edges);
                return curr;
              });
            });
          }
        }}
        onEdgesChange={(chs) => {
          onEdgesChange(chs);
          queueMicrotask(() => {
            setEdges((curr) => {
              commit(nodes, curr);
              return curr;
            });
          });
        }}
        onConnect={onConnect}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        onInit={(instance) => {
          rfRef.current = instance;
        }}
        onMoveEnd={(_, viewport) => {
          viewportRef.current = viewport;
        }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} size={1} />
        <Controls />
        <MiniMap pannable zoomable className="!bg-card" />
      </ReactFlow>
    </div>
  );
}

export function VoiceFlowBuilder({
  agentId,
  agentType,
  initialBundle,
  onSaved,
}: {
  agentId: string;
  agentType?: string;
  initialBundle?: unknown;
  onSaved?: (bundle: VoiceFlowBundle) => void;
}) {
  const [layer, setLayer] = useState<VoiceFlowLayer>("conversation");
  const [bundle, setBundle] = useState<VoiceFlowBundle>(() => {
    const parsed = parseVoiceFlowBundle(initialBundle);
    if (parsed.routing.nodes.length || parsed.conversation.nodes.length) return parsed;
    return defaultFlowBundleForAgentType(agentType);
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [issues, setIssues] = useState<FlowIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [templateId, setTemplateId] = useState("");

  const graph = layer === "routing" ? bundle.routing : bundle.conversation;
  const errorIds = useMemo(
    () => new Set(issues.filter((i) => i.nodeId).map((i) => i.nodeId!)),
    [issues],
  );

  const selectedNode =
    graph.nodes.find((n) => n.id === selectedNodeId) ||
    bundle.routing.nodes.find((n) => n.id === selectedNodeId) ||
    bundle.conversation.nodes.find((n) => n.id === selectedNodeId) ||
    null;

  const setGraph = useCallback(
    (next: VoiceFlowGraph) => {
      setBundle((prev) => ({
        ...prev,
        [layer]: next,
      }));
    },
    [layer],
  );

  const addBlock = useCallback(
    (block: VoiceFlowBlock, position?: { x: number; y: number }) => {
      if (block.layer !== layer && block.layer !== "both") return;
      if (block.blockType === "incoming_call" && graph.nodes.some((n) => n.data.blockType === "incoming_call")) {
        return;
      }
      const node: VoiceFlowNode = {
        id: createNodeId(),
        type: block.category,
        position: position || {
          x: 80 + graph.nodes.length * 24,
          y: 40 + graph.nodes.length * 40,
        },
        data: {
          blockType: block.blockType,
          label: block.label,
          config: { ...(block.defaultConfig || {}) },
        },
      };
      setGraph({
        ...graph,
        nodes: [...graph.nodes, node],
      });
      setSelectedNodeId(node.id);
    },
    [graph, layer, setGraph],
  );

  function updateSelected(patch: { label?: string; config?: Record<string, unknown> }) {
    if (!selectedNodeId) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === selectedNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label: patch.label ?? n.data.label,
                config: patch.config ?? n.data.config,
              },
            }
          : n,
      ),
    });
  }

  function deleteSelected() {
    if (!selectedNodeId) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.filter((n) => n.id !== selectedNodeId),
      edges: graph.edges.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
      ),
    });
    setSelectedNodeId(null);
  }

  function validate() {
    const next = validateVoiceFlowBundle(bundle);
    setIssues(next);
    setMessage(
      next.length
        ? `${next.filter((i) => i.severity === "error").length} errors, ${next.filter((i) => i.severity === "warning").length} warnings`
        : "Flow looks good",
    );
    return next;
  }

  async function save(publishHint = false) {
    setSaving(true);
    setMessage("");
    try {
      const nextIssues = validate();
      if (publishHint && hasBlockingFlowErrors(nextIssues)) {
        setMessage("Fix validation errors before publishing");
        return;
      }
      const res = await fetch(`/api/voice/agents/${agentId}/flows`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flows: bundle, apply: publishHint }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setMessage(publishHint ? "Flow saved and compiled for publish" : "Draft flow saved");
      onSaved?.(bundle);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(id: string) {
    const t = getVoiceFlowTemplate(id);
    if (!t) return;
    setBundle(structuredClone(t.bundle));
    setTemplateId(id);
    setSelectedNodeId(null);
    setMessage(`Loaded template: ${t.name}`);
  }

  function toggleGlobalRule(id: string) {
    setBundle((prev) => ({
      ...prev,
      globalRules: prev.globalRules.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r,
      ),
    }));
  }

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex rounded-lg border border-border p-0.5 text-xs">
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              layer === "routing" ? "bg-muted" : "text-muted-foreground",
            )}
            onClick={() => {
              setLayer("routing");
              setSelectedNodeId(null);
            }}
          >
            Call Routing
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              layer === "conversation" ? "bg-muted" : "text-muted-foreground",
            )}
            onClick={() => {
              setLayer("conversation");
              setSelectedNodeId(null);
            }}
          >
            AI Conversation
          </button>
        </div>

        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={templateId}
          onChange={(e) => {
            if (e.target.value) applyTemplate(e.target.value);
          }}
        >
          <option value="">Load template…</option>
          {VOICE_FLOW_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => validate()}>
            Validate
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => save(true)}>
            {saving ? "Saving…" : "Save & compile"}
          </Button>
        </div>
      </div>

      {message ? (
        <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs">{message}</div>
      ) : null}

      {issues.length ? (
        <div className="max-h-24 overflow-y-auto border-b border-border bg-rose-50 px-3 py-1.5 text-[11px] text-rose-800">
          {issues.slice(0, 8).map((i, idx) => (
            <p key={idx}>
              [{i.severity}] {i.layer ? `${i.layer}: ` : ""}
              {i.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_260px]">
        <VoiceFlowSidebar
          layer={layer}
          onAdd={(b) => addBlock(b)}
        />
        <ReactFlowProvider>
          <VoiceFlowCanvas
            layer={layer}
            graph={graph}
            selectedNodeId={selectedNodeId}
            errorIds={errorIds}
            onSelect={setSelectedNodeId}
            onGraphChange={setGraph}
            onAddBlock={addBlock}
          />
        </ReactFlowProvider>
        <div className="flex min-h-0 flex-col">
          <VoiceNodeConfigPanel
            node={selectedNode}
            onChange={updateSelected}
            onDelete={deleteSelected}
          />
          <div className="border-t border-border p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Global rules
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {bundle.globalRules.map((r: VoiceGlobalRule) => (
                <label key={r.id} className="flex items-start gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={r.enabled}
                    onChange={() => toggleGlobalRule(r.id)}
                  />
                  <span>
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-muted-foreground">{r.trigger}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// silence unused import lint in some bundlers
void blocksForLayer;
void isBranchingBlock;
