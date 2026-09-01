"use client";

import { useAutomationBuilder } from "@/components/automations/builder/use-automation-builder";
import { getBlock } from "@/lib/automations/catalog";
import { createNodeId } from "@/lib/automations/types";
import {
  hasBlockingErrors,
  validateAutomationForPublish,
} from "@/lib/automations/validation";
import { outcomesToKimiOutputs } from "@/lib/automations/outcome-ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blockTypeForKimiId, paletteItemForKimiId } from "./block-bridge";
import { definitionToKimi, kimiToDefinition, refreshNodeOutputs } from "./definition-bridge";
import type { CanvasEdge, CanvasNodeData } from "./WorkflowBuilder";
import WorkflowBuilder from "./WorkflowBuilder";

type Props = {
  flowId: string;
  initialName: string;
  initialDescription?: string;
  initialDefinition: unknown;
  initialStatus: string;
  startInSetup?: boolean;
};

export default function KimiAutomationBuilder({
  flowId,
  initialName,
  initialDescription,
  initialDefinition,
  initialStatus,
  startInSetup = false,
}: Props) {
  const router = useRouter();
  const builder = useAutomationBuilder({
    name: initialName,
    description: initialDescription,
    definition: initialDefinition,
  });

  const [kimiNodes, setKimiNodes] = useState<CanvasNodeData[]>([]);
  const [kimiEdges, setKimiEdges] = useState<CanvasEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configNode, setConfigNode] = useState<CanvasNodeData | null>(null);
  const [frequency, setFrequency] = useState("Only Once Ever");
  const [active, setActive] = useState(
    initialStatus === "Active" || initialStatus === "ACTIVE",
  );
  const hydratedRef = useRef(false);
  const definitionRef = useRef(builder.definition);

  useEffect(() => {
    definitionRef.current = builder.definition;
  }, [builder.definition]);

  useEffect(() => {
    if (hydratedRef.current) return;
    const kimi = definitionToKimi(builder.definition);
    setKimiNodes(kimi.nodes);
    setKimiEdges(kimi.edges);
    hydratedRef.current = true;
  }, [builder.definition]);

  const pushKimiToBuilder = useCallback(
    (nodes: CanvasNodeData[], edges: CanvasEdge[]) => {
      const next = kimiToDefinition(nodes, edges, definitionRef.current);
      definitionRef.current = next;
      builder.setDefinition(next, false);
      builder.setDirty(true);
    },
    [builder],
  );

  const onNodesChange = useCallback(
    (value: React.SetStateAction<CanvasNodeData[]>) => {
      setKimiNodes((prev) => {
        const nodes = typeof value === "function" ? value(prev) : value;
        setKimiEdges((edgePrev) => {
          pushKimiToBuilder(nodes, edgePrev);
          return edgePrev;
        });
        return nodes;
      });
    },
    [pushKimiToBuilder],
  );

  const onEdgesChange = useCallback(
    (value: React.SetStateAction<CanvasEdge[]>) => {
      setKimiEdges((prev) => {
        const edges = typeof value === "function" ? value(prev) : value;
        setKimiNodes((nodePrev) => {
          pushKimiToBuilder(nodePrev, edges);
          return nodePrev;
        });
        return edges;
      });
    },
    [pushKimiToBuilder],
  );

  const onAddItem = useCallback(
    (itemId: string) => {
      const item = paletteItemForKimiId(itemId);
      if (!item) return;
      const blockType = blockTypeForKimiId(itemId);
      const block = getBlock(blockType);
      if (item.kind === "trigger" && kimiNodes.some((n) => n.kind === "trigger")) {
        return;
      }
      const id = createNodeId();
      const count = kimiNodes.length;
      const defaultConfig = { ...(block?.defaultConfig ?? {}) };
      const node: CanvasNodeData = {
        id,
        itemId: item.id,
        label: block?.label ?? item.label,
        kind: item.kind,
        icon: item.icon,
        x: 80 + (count % 4) * 220,
        y: 60 + Math.floor(count / 4) * 200,
        configured: false,
        subtitle: "",
        config: defaultConfig,
        outputs: outcomesToKimiOutputs(blockType, defaultConfig),
      };
      const nodes = [...kimiNodes, node];
      setKimiNodes(nodes);
      setSelectedId(id);
      pushKimiToBuilder(nodes, kimiEdges);
    },
    [kimiEdges, kimiNodes, pushKimiToBuilder],
  );

  const onDeleteNode = useCallback(
    (id: string) => {
      const nodes = kimiNodes.filter((n) => n.id !== id);
      const edges = kimiEdges.filter((e) => e.from !== id && e.to !== id);
      setKimiNodes(nodes);
      setKimiEdges(edges);
      if (selectedId === id) setSelectedId(null);
      pushKimiToBuilder(nodes, edges);
    },
    [kimiEdges, kimiNodes, pushKimiToBuilder, selectedId],
  );

  const onSaveConfig = useCallback(
    (nodeId: string, config: Record<string, unknown>, subtitle: string) => {
      const nodes = kimiNodes.map((n) => {
        if (n.id !== nodeId) return n;
        const updated = {
          ...n,
          configured: subtitle !== "Not configured",
          subtitle,
          config,
        };
        return refreshNodeOutputs(updated);
      });
      setKimiNodes(nodes);
      setConfigNode(null);
      pushKimiToBuilder(nodes, kimiEdges);

      const updatedNode = nodes.find((n) => n.id === nodeId);
      if (updatedNode) {
        const blockType = blockTypeForKimiId(updatedNode.itemId);
        const validOutcomes = new Set(
          outcomesToKimiOutputs(blockType, config).map((o) => o.outcomeId),
        );
        const prunedEdges = kimiEdges.filter(
          (e) => e.from !== nodeId || validOutcomes.has(e.outcomeId),
        );
        if (prunedEdges.length !== kimiEdges.length) {
          setKimiEdges(prunedEdges);
          pushKimiToBuilder(nodes, prunedEdges);
        }
      }
    },
    [builder, kimiEdges, kimiNodes, pushKimiToBuilder],
  );

  const openConfig = useCallback(
    (node: CanvasNodeData) => {
      const defNode = builder.definition.nodes.find((n) => n.id === node.id);
      setConfigNode({
        ...node,
        config: defNode?.data.config || node.config || {},
      });
    },
    [builder.definition.nodes],
  );

  async function saveDraft(publishAfter = false) {
    builder.setSaving(true);
    const definition = kimiToDefinition(kimiNodes, kimiEdges, definitionRef.current);
    try {
      const res = await fetch(`/api/automations/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: builder.name,
          description: builder.description,
          definition,
          status: active ? "Active" : "Draft",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      definitionRef.current = definition;
      builder.setDefinition(definition, false);
      builder.setDirty(false);
      builder.setLastSaved(new Date());

      if (publishAfter) {
        const issues = validateAutomationForPublish(builder.name, definition);
        builder.setValidationIssues(issues);
        if (hasBlockingErrors(issues)) return;
        builder.setPublishing(true);
        const pub = await fetch(`/api/automations/${flowId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: builder.name, definition }),
        });
        const pubJson = await pub.json();
        if (!pub.ok) throw new Error(pubJson.error || "Publish failed");
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      builder.setSaving(false);
      builder.setPublishing(false);
    }
  }

  const controlled = useMemo(
    () => ({
      flowId,
      name: builder.name,
      description: builder.description,
      frequency,
      active,
      nodes: kimiNodes,
      edges: kimiEdges,
      selectedId,
      configNode,
      saving: builder.saving,
      startInSetup,
      onNameChange: (v: string) => {
        builder.setName(v);
        builder.setDirty(true);
      },
      onDescriptionChange: (v: string) => {
        builder.setDescription(v);
        builder.setDirty(true);
      },
      onFrequencyChange: setFrequency,
      onActiveChange: (v: boolean) => {
        setActive(v);
        builder.setDirty(true);
      },
      onNodesChange,
      onEdgesChange,
      onSelectedIdChange: setSelectedId,
      onConfigNodeChange: (node: CanvasNodeData | null) => {
        if (node) openConfig(node);
        else setConfigNode(null);
      },
      onAddItem,
      onDeleteNode,
      onSaveConfig,
      onSave: async () => {
        if (active && (initialStatus === "Draft" || initialStatus === "DRAFT")) {
          await saveDraft(true);
        } else {
          await saveDraft(false);
        }
      },
    }),
    [
      active,
      builder,
      configNode,
      flowId,
      frequency,
      initialStatus,
      kimiEdges,
      kimiNodes,
      onAddItem,
      onDeleteNode,
      onEdgesChange,
      onNodesChange,
      onSaveConfig,
      openConfig,
      selectedId,
      startInSetup,
    ],
  );

  return (
    <div className="kimi-automations -mx-4 flex h-[calc(100dvh-4rem)] min-h-[640px] flex-col overflow-hidden md:-mx-6">
      <WorkflowBuilder
        onBack={() => router.push("/automations")}
        controlled={controlled}
      />
    </div>
  );
}
