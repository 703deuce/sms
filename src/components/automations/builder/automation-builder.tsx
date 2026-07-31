"use client";

import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getBlock, isConditionBlock } from "@/lib/automations/catalog";
import {
  createEdgeId,
  createNodeId,
  nodeSummary,
  type AutomationDefinition,
} from "@/lib/automations/types";
import {
  hasBlockingErrors,
  validateAutomationForPublish,
} from "@/lib/automations/validation";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { automationNodeTypes } from "./automation-node";
import { BlockSidebar } from "./block-sidebar";
import { NodeConfigPanel } from "./node-config-panel";
import { useAutomationBuilder } from "./use-automation-builder";

function toFlowNodes(
  def: AutomationDefinition,
  selectedId: string | null,
  errorIds: Set<string>,
): Node[] {
  return def.nodes.map((n) => ({
    id: n.id,
    type: "automation",
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
    className: errorIds.has(n.id) ? "!ring-2 !ring-rose-500 rounded-xl" : undefined,
  }));
}

function toFlowEdges(def: AutomationDefinition): Edge[] {
  return def.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || "default",
    targetHandle: e.targetHandle || undefined,
    animated: true,
    style: { strokeWidth: 2 },
    label: e.sourceHandle === "yes" ? "Yes" : e.sourceHandle === "no" ? "No" : undefined,
  }));
}

function fromFlowState(
  nodes: Node[],
  edges: Edge[],
  viewport: AutomationDefinition["viewport"],
): AutomationDefinition {
  return {
    version: 1,
    viewport,
    nodes: nodes.map((n) => ({
      id: n.id,
      type:
        (n.data as { blockType?: string }).blockType === "end_automation"
          ? "end"
          : getBlock(String((n.data as { blockType?: string }).blockType || ""))?.category === "trigger"
            ? "trigger"
            : getBlock(String((n.data as { blockType?: string }).blockType || ""))?.category === "logic" ||
                isConditionBlock(String((n.data as { blockType?: string }).blockType || ""))
              ? "logic"
              : getBlock(String((n.data as { blockType?: string }).blockType || ""))?.category === "end"
                ? "end"
                : "action",
      position: n.position,
      data: {
        blockType: String((n.data as { blockType?: string }).blockType || ""),
        label: String((n.data as { label?: string }).label || ""),
        config: ((n.data as { config?: Record<string, unknown> }).config || {}) as Record<string, unknown>,
      },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || "default",
      targetHandle: e.targetHandle || null,
    })),
  };
}

function BuilderCanvas({
  flowId,
  initialName,
  initialDescription,
  initialDefinition,
  initialStatus,
}: {
  flowId: string;
  initialName: string;
  initialDescription?: string;
  initialDefinition: unknown;
  initialStatus: string;
}) {
  const router = useRouter();
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const builder = useAutomationBuilder({
    name: initialName,
    description: initialDescription,
    definition: initialDefinition,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const syncRef = useRef(false);

  const errorNodeIds = new Set(
    builder.validationIssues.filter((i) => i.nodeId && i.severity === "error").map((i) => i.nodeId!),
  );

  useEffect(() => {
    if (syncRef.current) {
      syncRef.current = false;
      return;
    }
    setNodes(toFlowNodes(builder.definition, builder.selectedNodeId, errorNodeIds));
    setEdges(toFlowEdges(builder.definition));
  }, [builder.definition, builder.selectedNodeId, builder.validationIssues, setNodes, setEdges]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (builder.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [builder.dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && builder.selectedNodeId) {
        e.preventDefault();
        builder.duplicateNode(builder.selectedNodeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [builder]);

  const syncFromCanvas = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      const def = fromFlowState(nextNodes, nextEdges, builder.definition.viewport);
      syncRef.current = true;
      builder.setDefinition(def, false);
    },
    [builder],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const id = createEdgeId();
      const newEdges = [
        ...edges.filter(
          (e) =>
            e.source !== connection.source ||
            (e.sourceHandle || "default") !== (connection.sourceHandle || "default"),
        ),
        {
          id,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || "default",
          targetHandle: connection.targetHandle,
          animated: true,
          style: { strokeWidth: 2 },
        },
      ];
      setEdges(newEdges);
      syncFromCanvas(nodes, newEdges);
    },
    [edges, nodes, setEdges, syncFromCanvas],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const nextNodes = nodes.map((n) => (n.id === node.id ? { ...n, position: node.position } : n));
      setNodes(nextNodes);
      syncFromCanvas(nextNodes, edges);
    },
    [nodes, edges, setNodes, syncFromCanvas],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const blockType = event.dataTransfer.getData("blockType");
      const block = getBlock(blockType);
      if (!block) return;
      const flow = flowInstanceRef.current;
      const position = flow
        ? flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: 200, y: 120 };
      builder.addBlock(block, {
        x: position.x - 100,
        y: position.y - 40,
      });
    },
    [builder],
  );

  async function saveDraft() {
    builder.setSaving(true);
    try {
      const res = await fetch(`/api/automations/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: builder.name,
          description: builder.description,
          definition: builder.definition,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      builder.setDirty(false);
      builder.setLastSaved(new Date());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      builder.setSaving(false);
    }
  }

  async function publish() {
    const issues = validateAutomationForPublish(builder.name, builder.definition);
    builder.setValidationIssues(issues);
    if (hasBlockingErrors(issues)) return;

    builder.setPublishing(true);
    try {
      await saveDraft();
      const res = await fetch(`/api/automations/${flowId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: builder.name, definition: builder.definition }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (json.issues ? "Validation failed" : "Publish failed"));
      builder.setDirty(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Publish failed");
    } finally {
      builder.setPublishing(false);
    }
  }

  async function deleteFlow() {
    if (!confirm("Delete this automation permanently?")) return;
    await fetch(`/api/automations/${flowId}`, { method: "DELETE" });
    router.push("/automations");
  }

  async function duplicateFlow() {
    const res = await fetch(`/api/automations/${flowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate" }),
    });
    const json = await res.json();
    if (json?.data?.id) router.push(`/automations/${json.data.id}/edit`);
  }

  async function runTest(contactId: string) {
    const res = await fetch(`/api/automations/${flowId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Test failed");
    alert("Test run started. Check execution history on the automation detail page.");
  }

  async function testSms(body: string, contactId: string, nodeId?: string, fromNumber?: string) {
    const res = await fetch(`/api/automations/${flowId}/test-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        body,
        nodeId,
        fromNumber,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Send failed");
    }
    return json.data;
  }

  const [contacts, setContacts] = useState<Array<{ id: string; phone: string }>>([]);
  useEffect(() => {
    fetch("/api/contacts?status=subscribed")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setContacts(j?.data || []))
      .catch(() => undefined);
  }, []);

  async function pauseOrResume() {
    const action = initialStatus === "Paused" || initialStatus === "PAUSED" ? "resume" : "pause";
    await fetch(`/api/automations/${flowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  const hasTrigger = builder.definition.nodes.some((n) => n.type === "trigger");

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[520px] flex-col rounded-xl border border-border bg-background overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="flow-name" className="text-xs text-muted-foreground">Automation name</Label>
          <Input
            id="flow-name"
            value={builder.name}
            onChange={(e) => {
              builder.setName(e.target.value);
              builder.setDirty(true);
            }}
            className="mt-0.5 h-9 max-w-md font-medium"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {builder.dirty ? <span className="text-amber-600">Unsaved changes</span> : null}
          {builder.lastSaved ? <span>Saved {builder.lastSaved.toLocaleTimeString()}</span> : null}
          {builder.saving ? <span>Saving…</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={duplicateFlow}>Duplicate</Button>
          <Button variant="outline" size="sm" onClick={deleteFlow} className="text-rose-600">Delete</Button>
          <Button variant="outline" size="sm" onClick={() => {
            const id = contacts[0]?.id;
            if (id) runTest(id).catch((e) => alert(e.message));
            else alert("Add a subscribed contact to run a test.");
          }}>
            Run test
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/automations/${flowId}`)}>
            Exit
          </Button>
          {initialStatus === "Active" || initialStatus === "ACTIVE" ? (
            <Button variant="outline" size="sm" onClick={pauseOrResume}>Pause</Button>
          ) : initialStatus === "Paused" || initialStatus === "PAUSED" ? (
            <Button variant="outline" size="sm" onClick={pauseOrResume}>Resume</Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={builder.saving}>
            Save draft
          </Button>
          <Button size="sm" onClick={publish} disabled={builder.publishing}>
            {builder.publishing ? "Publishing…" : "Publish / Activate"}
          </Button>
        </div>
      </div>

      {builder.validationIssues.length > 0 && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {builder.validationIssues.map((i, idx) => (
            <p key={idx}>{i.message}</p>
          ))}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="w-[220px] shrink-0 hidden md:block">
          <BlockSidebar
            hasTrigger={hasTrigger}
            onAddBlock={(block) => builder.addBlock(block)}
          />
        </div>

        <div
          className="flex-1 min-w-0 relative select-none"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {builder.definition.nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
              Drag a trigger block from the sidebar or click a block to start
            </div>
          ) : null}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onInit={(instance) => {
              flowInstanceRef.current = instance;
            }}
            onMoveEnd={(_, viewport) => {
              builder.setDefinition(
                { ...builder.definition, viewport },
                false,
              );
            }}
            onNodesChange={onNodesChange}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              const removed = changes.filter((c) => c.type === "remove");
              if (removed.length) {
                const nextEdges = edges.filter(
                  (e) => !removed.some((r) => r.type === "remove" && r.id === e.id),
                );
                syncFromCanvas(nodes, nextEdges);
              }
            }}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_, node) => builder.setSelectedNodeId(node.id)}
            onPaneClick={() => builder.setSelectedNodeId(null)}
            nodeTypes={automationNodeTypes}
            fitView
            minZoom={0.3}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {builder.selectedNode ? (
          <div className="w-[300px] shrink-0 hidden lg:block">
            <NodeConfigPanel
              flowId={flowId}
              node={builder.selectedNode}
              onUpdate={(patch) => builder.updateNode(builder.selectedNode!.id, patch)}
              onDelete={() => builder.deleteNode(builder.selectedNode!.id)}
              onDuplicate={() => builder.duplicateNode(builder.selectedNode!.id)}
              onClose={() => builder.setSelectedNodeId(null)}
              onTestSms={testSms}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AutomationBuilder(props: {
  flowId: string;
  initialName: string;
  initialDescription?: string;
  initialDefinition: unknown;
  initialStatus: string;
}) {
  return (
    <ReactFlowProvider>
      <BuilderCanvas {...props} />
    </ReactFlowProvider>
  );
}
