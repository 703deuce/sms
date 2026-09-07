"use client";
import React from "react";
import { Bell, CheckCircle2, DollarSign, Heart, RotateCcw, Sparkles } from "lucide-react";
import type { PrebuiltTemplate, WorkflowRecord } from "../types";
import { triggerLabel } from "../types";
import { Button, ChannelBadge, StatusChip, cn } from "./ui";

const CATEGORY_ICON: Record<PrebuiltTemplate["category"], React.ReactNode> = {
  Reminders: <Bell className="h-4 w-4" />,
  Confirmations: <CheckCircle2 className="h-4 w-4" />,
  "Follow-up": <Heart className="h-4 w-4" />,
  Recovery: <RotateCcw className="h-4 w-4" />,
  Payments: <DollarSign className="h-4 w-4" />,
};

export function PrebuiltWorkflowCard({ template, installed, onSetup }: {
  template: PrebuiltTemplate; installed?: WorkflowRecord; onSetup: () => void;
}) {
  return (
    <div className={cn(
      "surface group flex flex-col rounded-xl bg-white p-5 transition-all duration-150 hover:border-[#2547e066] hover:shadow-md",
      installed && "border-[#2547e033]"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--info-bg)] text-[var(--info)]">
          {CATEGORY_ICON[template.category]}
        </div>
        {installed ? (
          <StatusChip tone={installed.active ? "success" : "neutral"} dot>{installed.active ? "Active" : "Paused"}</StatusChip>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[11px] font-semibold text-[#475467]">
            <Sparkles className="h-3 w-3" /> Template
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display text-[15px] font-semibold tracking-tight">{template.name}</h3>
      <p className="mt-1 flex-1 text-[13px] leading-relaxed text-[var(--muted-foreground)]">{template.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {template.channels.map((c) => <ChannelBadge key={c} channel={c} />)}
        <span className="text-xs text-[var(--muted-foreground)]">· {triggerLabel(template.trigger)} · {template.stepCount} steps</span>
      </div>
      <div className="mt-4 border-t border-[var(--border)] pt-3.5">
        <Button variant={installed ? "outline" : "primary"} size="sm" className="w-full" onClick={onSetup}>
          {installed ? "Manage workflow" : "Set up"}
        </Button>
      </div>
    </div>
  );
}
