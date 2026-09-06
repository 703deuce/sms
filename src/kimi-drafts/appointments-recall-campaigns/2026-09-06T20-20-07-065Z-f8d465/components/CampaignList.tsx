"use client";

import { Mail, MessageSquareText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { RecallCampaign } from "../mock-data";

export function CampaignList({
  campaigns,
  selectedId,
  onSelect,
}: {
  campaigns: RecallCampaign[];
  selectedId: string | null;
  onSelect: (c: RecallCampaign) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.channel.includes(q) ||
        c.segment?.appointmentTypeName?.toLowerCase().includes(q),
    );
  }, [campaigns, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search campaigns"
          aria-label="Search campaigns"
          className="flex h-9 w-full rounded-[10px] border border-border bg-card pl-9 pr-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--ring))]/30"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="surface rounded-xl bg-card px-4 py-8 text-center">
          <p className="text-sm font-medium">No campaigns match “{query.trim()}”</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different name, channel, or appointment type.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 text-[13px] font-semibold text-[hsl(var(--primary))] hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Recall campaigns">
          {filtered.map((c) => {
            const ChannelIcon = c.channel === "sms" ? MessageSquareText : Mail;
            return (
              <button
                key={c.id}
                type="button"
                role="listitem"
                aria-current={selectedId === c.id ? "true" : undefined}
                className={`rc-campaign-item ${selectedId === c.id ? "selected" : ""}`}
                onClick={() => onSelect(c)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold tracking-tight">{c.name}</p>
                  <span className={`rc-chip ${c.active ? "rc-chip-active" : "rc-chip-paused"}`}>
                    {c.active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <ChannelIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="capitalize">{c.channel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{c.segment?.lastVisitDaysAgo ?? 90}+ days since visit</span>
                </div>
                {c.lastRunAt && (
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    Last run {formatRelative(c.lastRunAt)}
                    {typeof c.lastRunSent === "number" ? ` · ${c.lastRunSent} sent` : ""}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
