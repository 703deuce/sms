"use client";

import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useState } from "react";

type Context = {
  links: Array<{
    provider: string;
    displayName: string;
    objectType: string;
    externalId: string;
    externalUrl: string | null;
    lastSyncedAt: string | null;
    syncStatus: string | null;
  }>;
  events: Array<{
    id: string;
    provider: string | null;
    eventType: string;
    createdAt: string;
  }>;
  appointments: Array<{
    id: string;
    serviceName: string | null;
    startsAt: string;
    status: string;
  }>;
  formSubmissions: Array<{
    id: string;
    formName: string;
    createdAt: string;
  }>;
  providerBadges: Array<{ provider: string; displayName: string; native: boolean }>;
  refreshedAt?: string;
  stale?: boolean;
  lastError?: string | null;
  source?: string;
};

export function ContactIntegrationsPanel({
  contactId,
  compact = false,
}: {
  contactId: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<Context | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(refresh = false) {
    fetch(`/api/contacts/${contactId}/integrations${refresh ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else {
          setError(null);
          setData(j.data || null);
        }
      })
      .catch(() => setError("Failed to load integrations"));
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  if (error) {
    return <p className="text-xs text-muted-foreground">{error}</p>;
  }
  if (!data) {
    return <p className="text-xs text-muted-foreground">Loading connected apps…</p>;
  }

  if (
    !data.providerBadges.length &&
    !data.appointments.length &&
    !data.formSubmissions.length &&
    !data.links.length
  ) {
    return (
      <p className="text-xs text-muted-foreground">
        No connected app records.{" "}
        <Link href="/integrations/native" className="underline">
          Connect integrations
        </Link>
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>
          {data.stale ? "Stale local cache" : "Local cache"}
          {data.refreshedAt ? ` · ${new Date(data.refreshedAt).toLocaleString()}` : ""}
        </span>
        <button type="button" className="underline" onClick={() => load(true)}>
          Refresh
        </button>
        {data.lastError ? <span className="text-amber-700">Provider health: {data.lastError}</span> : null}
      </div>
      {data.providerBadges.length ? (
        <div className="flex flex-wrap gap-1.5">
          {data.providerBadges.map((b) => (
            <StatusChip key={b.provider} status={b.displayName} />
          ))}
        </div>
      ) : null}

      {!compact && data.appointments[0] ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Upcoming / recent appointment</p>
          <p className="text-sm">
            {data.appointments[0].serviceName || "Appointment"} ·{" "}
            {new Date(data.appointments[0].startsAt).toLocaleString()} ·{" "}
            {data.appointments[0].status}
          </p>
        </div>
      ) : null}

      {!compact && data.formSubmissions[0] ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Latest form submission</p>
          <p className="text-sm">
            {data.formSubmissions[0].formName} ·{" "}
            {new Date(data.formSubmissions[0].createdAt).toLocaleString()}
          </p>
        </div>
      ) : null}

      {data.links.length ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">External records</p>
          <ul className="space-y-1 text-sm">
            {data.links.slice(0, compact ? 4 : 12).map((l) => (
              <li key={`${l.provider}-${l.objectType}-${l.externalId}`} className="flex gap-2">
                <span className="text-muted-foreground">{l.displayName}</span>
                <span>
                  {l.objectType} · {l.externalId.slice(0, 24)}
                  {l.externalId.length > 24 ? "…" : ""}
                </span>
                {l.externalUrl ? (
                  <a href={l.externalUrl} target="_blank" rel="noreferrer" className="underline">
                    Open
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && data.events.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Recent integration events</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {data.events.slice(0, 5).map((e) => (
              <li key={e.id}>
                {e.provider} · {e.eventType} · {new Date(e.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
