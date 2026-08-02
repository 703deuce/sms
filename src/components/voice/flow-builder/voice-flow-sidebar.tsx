"use client";

import {
  SIDEBAR_GROUPS,
  blocksForLayer,
  type VoiceFlowBlock,
} from "@/lib/voice/flow/catalog";
import type { VoiceFlowLayer } from "@/lib/voice/flow/types";
import { cn } from "@/lib/utils";

export function VoiceFlowSidebar({
  layer,
  onAdd,
}: {
  layer: VoiceFlowLayer;
  onAdd: (block: VoiceFlowBlock) => void;
}) {
  const blocks = blocksForLayer(layer);
  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {layer === "routing" ? "Call Routing" : "AI Conversation"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Drag or click to add nodes
        </p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-2">
        {SIDEBAR_GROUPS.map((group) => {
          const items = blocks.filter((b) => group.categories.includes(b.category));
          if (!items.length) return null;
          return (
            <div key={group.id}>
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {items.map((block) => (
                  <button
                    key={block.blockType}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("voiceBlockType", block.blockType);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onAdd(block)}
                    className={cn(
                      "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <p className="text-xs font-medium">{block.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {block.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
