"use client";

import React, { useState } from "react";
import {
  UserPlus, FileEdit, Link2, ListPlus, ListMinus, MessageSquare, MessagesSquare, Tag,
  UserCheck, UserMinus, ShoppingCart, Clock, GitFork, Eye, FileCheck as FileCheckIcon,
  ListChecks, Target, MousePointerClick, Tags, MailOpen, ShieldCheck, DollarSign, ChevronDown,
} from "lucide-react";
import { paletteItems, paletteDescriptions, type PaletteKind } from "./palette-data";

const iconMap: Record<string, React.ElementType> = {
  UserPlus, FileEdit, Link2, ListPlus, ListMinus, MessageSquare, MessagesSquare, Tag,
  UserCheck, UserMinus, ShoppingCart, Clock, GitFork, Eye, FileCheck: FileCheckIcon,
  ListChecks, Target, MousePointerClick, Tags, MailOpen, ShieldCheck, DollarSign,
};

const kindColors: Record<PaletteKind, { bg: string; text: string }> = {
  trigger: { bg: "bg-teal-100", text: "text-teal-600" },
  action: { bg: "bg-indigo-100", text: "text-indigo-600" },
  condition: { bg: "bg-orange-100", text: "text-orange-500" },
  wait: { bg: "bg-violet-100", text: "text-violet-600" },
};

const tabs: { key: PaletteKind; label: string }[] = [
  { key: "trigger", label: "Triggers" },
  { key: "action", label: "Actions" },
  { key: "condition", label: "Conditions" },
  { key: "wait", label: "Waits" },
];

export default function BuilderPanel({ onAddItem }: { onAddItem: (itemId: string) => void }) {
  const [tab, setTab] = useState<PaletteKind>("trigger");
  const [open, setOpen] = useState(true);
  const colors = kindColors[tab];

  return (
    <div className="flex w-[268px] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex border-b border-border px-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`palette-tab flex-1 px-1 py-3 text-[11.5px] font-semibold tracking-wide transition-colors ${
              tab === t.key
                ? "active text-indigo-700"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between px-4 pt-4 text-left"
        >
          <h3 className="text-[13px] font-bold" style={{ color: "var(--navy, #1e2a5a)" }}>
            {tabs.find((t) => t.key === tab)?.label}
          </h3>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        {open && (
          <>
            <p className="px-4 pt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {paletteDescriptions[tab]}
            </p>
            <div className="grid grid-cols-3 gap-2 px-4 py-4">
              {paletteItems[tab].map((item) => {
                const Icon = iconMap[item.icon] || MessageSquare;
                return (
                  <button
                    key={item.id}
                    onClick={() => onAddItem(item.id)}
                    className="palette-tile flex flex-col items-center gap-1.5 border border-border bg-card px-1 pb-2 pt-2.5"
                    title={`Add ${item.label} to canvas`}
                  >
                    <span className={`node-icon flex h-8 w-8 items-center justify-center rounded-full ${colors.bg}`}>
                      <Icon size={14} className={colors.text} />
                    </span>
                    <span className="text-center text-[9.5px] font-medium leading-tight text-foreground/90">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
