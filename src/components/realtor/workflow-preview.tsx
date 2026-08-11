"use client";

import "@xyflow/react/dist/style.css";
import type { AutomationDefinition } from "@/lib/automations/types";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { automationNodeTypes } from "@/components/automations/builder/automation-node";

function toPreviewNodes(def: AutomationDefinition): Node[] {
  return def.nodes.map((n) => ({
    id: n.id,
    type: "automation",
    position: n.position,
    data: {
      blockType: n.data.blockType,
      label: n.data.label,
      config: n.data.config,
      category: n.type,
      selected: false,
      hasError: false,
    },
    draggable: false,
    selectable: false,
  }));
}

function toPreviewEdges(def: AutomationDefinition): Edge[] {
  return def.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || "default",
    animated: true,
    style: { strokeWidth: 2 },
  }));
}

export function RealtorWorkflowPreview({
  definition,
  height = 420,
}: {
  definition: AutomationDefinition;
  height?: number;
}) {
  return (
    <div className="rounded-xl border bg-slate-50" style={{ height }}>
      <ReactFlow
        nodes={toPreviewNodes(definition)}
        edges={toPreviewEdges(definition)}
        nodeTypes={automationNodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
