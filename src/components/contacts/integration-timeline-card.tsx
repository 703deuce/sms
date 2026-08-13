"use client";

import { StatusChip } from "@/components/ui/status-chip";
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
    return <p className="mt-3 text-sm text-muted-foreground">Loading integration timeline…</p>;
  }
  if (error) {
    return <p className="mt-3 text-sm text-rose-600">{error}</p>;
  }
  if (!events.length) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        No CRM or Calendly events recorded for this contact yet.
      </p>
    );
  }

  return (
    <ol className="mt-4 space-y-0">
      {events.map((e, idx) => (
        <li key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dotColor(e.kind)}`} />
            {idx < events.length - 1 ? (
              <span className="w-px flex-1 bg-border min-h-[1rem]" />
            ) : null}
          </div>
          <div className="pb-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">
                {e.eventType.replace(/[._]/g, " ")}
              </p>
              <StatusChip status={e.sourceLabel || e.provider} />
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                {e.kind === "appointment"
                  ? "Calendar"
                  : e.kind === "webhook"
                    ? "CRM webhook"
                    : "CRM sync"}
              </span>
              {e.status ? (
                <span className="text-xs text-muted-foreground">{e.status}</span>
              ) : null}
            </div>
            {e.name ? (
              <p className="text-sm text-muted-foreground">{e.name}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">{formatWhen(e.createdAt)}</p>
              {e.externalUrl ? (
                <a
                  href={e.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline"
                >
                  Open in CRM
                </a>
              ) : null}
            </div>
            {e.lastError ? (
              <p className="text-xs text-amber-700 mt-0.5">{e.lastError}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
