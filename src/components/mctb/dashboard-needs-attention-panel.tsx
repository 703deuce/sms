"use client";

import type { NeedsAttentionItem } from "@/lib/platform/needs-attention-types";
import { fmtRelativeTime } from "@/lib/smart-routing/display";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/** Compact needs-attention strip embedded on the MCTB dashboard. */
export function DashboardNeedsAttentionPanel() {
  const [items, setItems] = useState<NeedsAttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/voice/needs-attention?filter=all", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setItems((json.data?.items ?? []).slice(0, 6));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
        <h2 className="text-[15px] font-semibold text-[#111827]">Needs attention</h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-amber-950">Needs attention</h2>
        <Link
          href="/voice/needs-attention"
          className="text-xs font-medium text-amber-900 hover:underline"
        >
          View all
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 text-[13px]">
            <div>
              <p className="font-medium text-[#111827]">{item.title}</p>
              {item.subtitle ? (
                <p className="text-muted-foreground">{item.subtitle}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {fmtRelativeTime(item.latestAt)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Link
          href="/voice/needs-attention"
          className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
        >
          Open attention queue
        </Link>
      </div>
    </div>
  );
}
