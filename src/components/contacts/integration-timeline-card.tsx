"use client";

import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type TimelineEvent = {
  id: string;
  kind: "webhook" | "mapping" | "appointment";
  provider: string;
  sourceLabel?: string;
  eventType: string;
  status: string | null;
  createdAt: string;
  lastError?: string | null;
  objectType?: string;
  name?: string | null;
  externalUrl?: string | null;
};

function dotColor(kind: TimelineEvent["kind"]) {
  if (kind === "webhook") return "bg-indigo-500";
  if (kind === "appointment") return "bg-violet-500";
  return "bg-primary";
}

function kindLabel(kind: TimelineEvent["kind"]) {
  if (kind === "appointment") return "Calendar";
  if (kind === "webhook") return "CRM webhook";
  return "CRM sync";
}

function formatWhen(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function IntegrationTimelineCard({ contactId }: { contactId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/contacts/${contactId}/crm-context`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) throw new Error(j.error);
        setEvents(j.data?.events || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  if (loading) {
    return (
      <div className="mt-4 space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2 py-0.5">
              <div className="h-2.5 w-40 animate-pulse rounded-full bg-muted" />
              <div className="h-2.5 w-24 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
        {error}
      </p>
    );
  }
  if (!events.length) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
        <p className="text-[13px] text-muted-foreground">
          No CRM or Calendly events recorded for this contact yet.
        </p>
      </div>
    );
  }

  return (
    <ol className="mt-4 space-y-0">
      {events.map((e, idx) => (
        <li key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-card",
                dotColor(e.kind),
              )}
            />
            {idx < events.length - 1 ? (
              <span className="min-h-[1rem] w-px flex-1 bg-border" />
            ) : null}
          </div>
          <div className="min-w-0 pb-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium capitalize text-foreground">
                {e.eventType.replace(/[._]/g, " ")}
              </p>
              <StatusChip status={e.sourceLabel || e.provider} />
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {kindLabel(e.kind)}
              </span>
              {e.status ? (
                <span className="text-xs text-muted-foreground">{e.status}</span>
              ) : null}
            </div>
            {e.name ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{e.name}</p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <p className="text-xs tabular-nums text-muted-foreground">{formatWhen(e.createdAt)}</p>
              {e.externalUrl ? (
                <a
                  href={e.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                >
                  Open in CRM
                </a>
              ) : null}
            </div>
            {e.lastError ? (
              <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 ring-1 ring-inset ring-amber-600/20">
                {e.lastError}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
