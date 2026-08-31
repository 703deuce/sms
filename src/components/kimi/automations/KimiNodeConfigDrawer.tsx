"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getBlock } from "@/lib/automations/catalog";
import { nodeSummary, type AutomationCanvasNode } from "@/lib/automations/types";
import { ParityNodeConfig } from "@/components/automations/builder/parity-node-config";
import { blockTypeForKimiId } from "./block-bridge";
import type { CanvasNodeData } from "./WorkflowBuilder";

type Props = {
  flowId: string;
  node: CanvasNodeData;
  existingConfig?: Record<string, unknown>;
  onClose: () => void;
  onSave: (nodeId: string, config: Record<string, unknown>, subtitle: string) => void;
};

export default function KimiNodeConfigDrawer({ flowId, node, existingConfig, onClose, onSave }: Props) {
  const blockType = blockTypeForKimiId(node.itemId);
  const block = getBlock(blockType);

  const canvasNode: AutomationCanvasNode = useMemo(
    () => ({
      id: node.id,
      type:
        node.kind === "trigger"
          ? "trigger"
          : node.kind === "condition"
            ? "logic"
            : node.kind === "wait"
              ? "logic"
              : "action",
      position: { x: node.x, y: node.y },
      data: {
        blockType,
        label: block?.label || node.label,
        config: { ...(block?.defaultConfig ?? {}), ...(existingConfig ?? {}), ...(node.config ?? {}) },
      },
    }),
    [block, blockType, existingConfig, node],
  );

  const [draft, setDraft] = useState(canvasNode);

  useEffect(() => {
    setDraft(canvasNode);
  }, [canvasNode]);

  const handleSave = () => {
    const subtitle = nodeSummary(draft);
    onSave(node.id, draft.data.config || {}, subtitle === block?.label ? "Not configured" : subtitle);
  };

  return (
    <div className="overlay-enter fixed inset-0 z-50 flex justify-start bg-black/30 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div
        className="drawer-enter flex h-full w-[480px] flex-col bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div className="pr-4">
            <h2 className="text-[16px] font-bold" style={{ color: "var(--navy, #1e2a5a)" }}>
              {block?.label || node.label}
            </h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              Configure this step. Required fields must be set before activation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 panel-scroll">
          <ParityNodeConfig
            flowId={flowId}
            node={draft}
            onUpdate={(patch) => {
              setDraft((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  ...patch,
                  config: patch.config ? { ...prev.data.config, ...patch.config } : prev.data.config,
                },
              }));
            }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-[12px] font-semibold text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-[12px] font-semibold text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
