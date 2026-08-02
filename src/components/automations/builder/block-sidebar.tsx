"use client";

import { AUTOMATION_BLOCKS, type BlockDefinition } from "@/lib/automations/catalog";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const CATEGORIES = [
  { key: "trigger", label: "Triggers" },
  { key: "integrations", label: "Integrations" },
  { key: "action", label: "Actions" },
  { key: "logic", label: "Logic" },
  { key: "end", label: "End" },
] as const;

export function BlockSidebar({
  onAddBlock,
  hasTrigger,
}: {
  onAddBlock: (block: BlockDefinition) => void;
  hasTrigger: boolean;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AUTOMATION_BLOCKS.filter(
      (b) =>
        !q ||
        b.label.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="p-3 border-b border-border">
        <Label htmlFor="block-search" className="text-xs text-muted-foreground">Search blocks</Label>
        <Input
          id="block-search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1 h-8 text-sm"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {CATEGORIES.map((cat) => {
          const blocks =
            cat.key === "integrations"
              ? filtered.filter((b) => Boolean(b.integrationGroup))
              : filtered.filter(
                  (b) =>
                    b.category === cat.key &&
                    // Keep Integrations group from double-listing CRM/Calendly triggers under Triggers
                    !(cat.key === "trigger" && b.integrationGroup),
                );
          if (!blocks.length) return null;
          const isCollapsed = collapsed[cat.key];
          return (
            <div key={cat.key}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                onClick={() => setCollapsed((c) => ({ ...c, [cat.key]: !c[cat.key] }))}
              >
                {cat.label}
                <span>{isCollapsed ? "+" : "−"}</span>
              </button>
              {!isCollapsed && (
                <div className="mt-1 space-y-1">
                  {blocks.map((block) => {
                    const isTrigger =
                      block.category === "trigger" || Boolean(block.integrationGroup && block.blockType.startsWith("integration_") && block.blockType !== "integration_action");
                    const disabled =
                      !block.enabled ||
                      (isTrigger && hasTrigger);
                    return (
                      <button
                        key={block.blockType}
                        type="button"
                        disabled={disabled}
                        draggable={!disabled}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("blockType", block.blockType);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => !disabled && onAddBlock(block)}
                        className={cn(
                          "w-full rounded-lg border border-border px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-muted/50",
                          disabled && "opacity-40 cursor-not-allowed",
                        )}
                      >
                        <p className="text-sm font-medium">{block.label}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {block.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
