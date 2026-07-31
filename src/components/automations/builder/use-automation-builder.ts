"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AutomationCanvasEdge,
  AutomationCanvasNode,
  AutomationDefinition,
} from "@/lib/automations/types";
import {
  createEdgeId,
  createNodeId,
  nodeSummary,
  parseAutomationDefinition,
} from "@/lib/automations/types";
import { getBlock, isConditionBlock, type BlockDefinition } from "@/lib/automations/catalog";

type BuilderSnapshot = {
  definition: AutomationDefinition;
  name: string;
  description: string;
};

export function useAutomationBuilder(initial: {
  name: string;
  description?: string;
  definition: unknown;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description || "");
  const [definition, setDefinition] = useState<AutomationDefinition>(() =>
    parseAutomationDefinition(initial.definition),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    Array<{ nodeId?: string; message: string; severity: string }>
  >([]);

  const historyRef = useRef<BuilderSnapshot[]>([]);
  const futureRef = useRef<BuilderSnapshot[]>([]);
  const MAX_HISTORY = 40;

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      definition: structuredClone(definition),
      name,
      description,
    });
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    futureRef.current = [];
  }, [definition, name, description]);

  const updateDefinition = useCallback(
    (next: AutomationDefinition, recordHistory = true) => {
      if (recordHistory) pushHistory();
      setDefinition(next);
      setDirty(true);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push({ definition, name, description });
    setDefinition(prev.definition);
    setName(prev.name);
    setDescription(prev.description);
    setDirty(true);
  }, [definition, name, description]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push({ definition, name, description });
    setDefinition(next.definition);
    setName(next.name);
    setDescription(next.description);
    setDirty(true);
  }, [definition, name, description]);

  const addBlock = useCallback(
    (block: BlockDefinition, position?: { x: number; y: number }) => {
      if (block.category === "trigger") {
        const hasTrigger = definition.nodes.some((n) => n.type === "trigger");
        if (hasTrigger) return;
      }

      const id = createNodeId();
      const category = block.category;
      const node: AutomationCanvasNode = {
        id,
        type:
          category === "end"
            ? "end"
            : category === "trigger"
              ? "trigger"
              : category === "logic" || isConditionBlock(block.blockType)
                ? "logic"
                : "action",
        position: position ?? {
          x: 200 + definition.nodes.length * 20,
          y: 100 + definition.nodes.length * 40,
        },
        data: {
          blockType: block.blockType,
          label: block.label,
          config: { ...block.defaultConfig },
        },
      };

      updateDefinition({
        ...definition,
        nodes: [...definition.nodes, node],
      });
      setSelectedNodeId(id);
    },
    [definition, updateDefinition],
  );

  const updateNode = useCallback(
    (nodeId: string, patch: Partial<AutomationCanvasNode["data"]>) => {
      const nodes = definition.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const merged = {
          ...n,
          data: {
            ...n.data,
            ...patch,
            config: patch.config ? { ...n.data.config, ...patch.config } : n.data.config,
          },
        };
        merged.data.label = nodeSummary(merged);
        return merged;
      });
      updateDefinition({ ...definition, nodes });
    },
    [definition, updateDefinition],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      updateDefinition({
        ...definition,
        nodes: definition.nodes.filter((n) => n.id !== nodeId),
        edges: definition.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      });
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [definition, selectedNodeId, updateDefinition],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const source = definition.nodes.find((n) => n.id === nodeId);
      if (!source || source.type === "trigger") return;
      const id = createNodeId();
      const copy: AutomationCanvasNode = {
        ...structuredClone(source),
        id,
        position: { x: source.position.x + 40, y: source.position.y + 40 },
      };
      updateDefinition({ ...definition, nodes: [...definition.nodes, copy] });
      setSelectedNodeId(id);
    },
    [definition, updateDefinition],
  );

  const connectNodes = useCallback(
    (source: string, target: string, sourceHandle?: string) => {
      const id = createEdgeId();
      const edge: AutomationCanvasEdge = {
        id,
        source,
        target,
        sourceHandle: sourceHandle || "default",
      };
      updateDefinition({
        ...definition,
        edges: [
          ...definition.edges.filter(
            (e) => e.source !== source || (e.sourceHandle || "default") !== (sourceHandle || "default"),
          ),
          edge,
        ],
      });
    },
    [definition, updateDefinition],
  );

  const disconnectEdge = useCallback(
    (edgeId: string) => {
      updateDefinition({
        ...definition,
        edges: definition.edges.filter((e) => e.id !== edgeId),
      });
    },
    [definition, updateDefinition],
  );

  const moveNode = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      const nodes = definition.nodes.map((n) =>
        n.id === nodeId ? { ...n, position } : n,
      );
      setDefinition((d) => ({ ...d, nodes }));
      setDirty(true);
    },
    [],
  );

  const selectedNode = definition.nodes.find((n) => n.id === selectedNodeId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" && e.shiftKey || e.key === "y")) {
        e.preventDefault();
        redo();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
        e.preventDefault();
        deleteNode(selectedNodeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteNode, selectedNodeId]);

  return {
    name,
    setName,
    description,
    setDescription,
    definition,
    setDefinition: updateDefinition,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    dirty,
    setDirty,
    saving,
    setSaving,
    publishing,
    setPublishing,
    lastSaved,
    setLastSaved,
    validationIssues,
    setValidationIssues,
    addBlock,
    updateNode,
    deleteNode,
    duplicateNode,
    connectNodes,
    disconnectEdge,
    moveNode,
    undo,
    redo,
    getBlock,
  };
}
