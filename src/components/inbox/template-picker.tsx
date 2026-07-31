"use client";

import { Button } from "@/components/ui/button";
import type { Template } from "@/lib/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function TemplatePicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (body: string) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"inbox" | "all">("inbox");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setTemplates(json?.data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    if (filter === "all") return templates;
    return templates.filter((t) => t.type === "Inbox reply");
  }, [templates, filter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-[16px] border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Saved replies</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={() => setFilter("inbox")}
            className={cn(
              "rounded-[8px] px-3 py-1 text-[12px] font-medium",
              filter === "inbox" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Inbox replies
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-[8px] px-3 py-1 text-[12px] font-medium",
              filter === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            All templates
          </button>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {loading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Loading templates…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No templates found. Create saved replies under Templates.
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(t.body);
                      onClose();
                    }}
                    className="w-full rounded-[10px] px-3 py-2.5 text-left hover:bg-muted/60"
                  >
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{t.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
