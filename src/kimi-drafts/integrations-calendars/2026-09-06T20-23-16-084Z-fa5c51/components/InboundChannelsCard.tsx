"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Inbox, Webhook } from "lucide-react";
import { Button } from "./ui/Button";
import type { InboundChannel } from "../mock-data";

function formatEvent(iso?: string | null) {
  if (!iso) return "No events received yet";
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.round(diff / 3600000);
  if (hrs < 1) return "Last event just now";
  if (hrs < 24) return `Last event ${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `Last event ${days} day${days === 1 ? "" : "s"} ago`;
}

const statusMeta = {
  active: { chip: "sb-chip sb-chip-success", label: "Active" },
  inactive: { chip: "sb-chip sb-chip-neutral", label: "Inactive" },
  degraded: { chip: "sb-chip sb-chip-warning", label: "Needs attention" },
} as const;

export function InboundChannelsCard({ channels }: { channels: InboundChannel[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyEndpoint(channel: InboundChannel) {
    // Copy endpoint so the workspace can register it with the provider
    navigator.clipboard?.writeText(channel.endpointLabel).catch(() => undefined);
    setCopiedId(channel.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <section aria-labelledby="inbound-heading">
      <h2 id="inbound-heading" className="text-[13px] font-semibold text-[var(--foreground)]">
        Inbound booking channels
      </h2>
      <p className="mt-0.5 text-[12.5px] text-[var(--muted-foreground)]">
        Other ways appointments enter Transovo besides direct calendar sync.
      </p>
      <div className="mt-2.5 space-y-3">
        {channels.map((channel) => {
          const meta = statusMeta[channel.status];
          const Icon = channel.id === "calendly" ? Webhook : Inbox;
          return (
            <div
              key={channel.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-start gap-3.5">
                <span
                  aria-hidden
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[var(--info-bg)] text-[var(--info-text)]"
                >
                  <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-[var(--foreground)]">
                      {channel.label}
                    </p>
                    <span className={meta.chip}>
                      {channel.status === "degraded" ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : null}
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--muted-foreground)]">
                    {channel.description}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <code className="rounded-md bg-[var(--muted)] px-2 py-1 text-[11.5px] font-medium text-[var(--foreground)]">
                      {channel.endpointLabel}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[12px]"
                      onClick={() => copyEndpoint(channel)}
                    >
                      {copiedId === channel.id ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </>
                      )}
                    </Button>
                  </div>

                  <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
                    {formatEvent(channel.lastEventAt)} · {channel.eventsLast7d} event
                    {channel.eventsLast7d === 1 ? "" : "s"} in the last 7 days
                  </p>
                  {channel.status === "degraded" && channel.lastEventSummary ? (
                    <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[12px] font-medium text-[var(--warning)]">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                      {channel.lastEventSummary}
                    </p>
                  ) : channel.lastEventSummary ? (
                    <p className="mt-1.5 text-[12px] text-[var(--muted-foreground)]">
                      {channel.lastEventSummary}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
