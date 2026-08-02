"use client";

import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ContactIntegrationsPanel } from "./contact-integrations-panel";

type LinkRow = {
  provider: string;
  displayName: string;
  objectType: string;
  externalId: string;
  externalUrl: string | null;
  lastSyncedAt: string | null;
  syncStatus: string | null;
};

/**
 * Connected Records — CRM + Calendly context with quick actions.
 * Wraps the existing integrations context loader and adds Sync / Note / Task.
 */
export function ConnectedRecordsPanel({
  contactId,
  compact = false,
}: {
  contactId: string;
  compact?: boolean;
}) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function loadLinks() {
    fetch(`/api/contacts/${contactId}/integrations`)
      .then((r) => r.json())
      .then((j) => setLinks(j.data?.links || []))
      .catch(() => undefined);
  }

  useEffect(() => {
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const crmLinks = links.filter((l) =>
    ["salesforce", "zoho", "pipedrive"].includes(l.provider),
  );

  async function runAction(
    provider: string,
    action: "sync_now" | "note.create" | "task.create",
  ) {
    setBusy(`${provider}:${action}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/integrations/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          action,
          body: action === "note.create" ? "Note added from Transovo contact page" : undefined,
          title: action === "task.create" ? "Follow up from Transovo" : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) setMessage(json.error || "Action failed");
      else {
        setMessage(
          action === "sync_now" ? "Sync queued" : `${action} succeeded`,
        );
        loadLinks();
      }
    } catch {
      setMessage("Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <ContactIntegrationsPanel contactId={contactId} compact={compact} />

      {crmLinks.length ? (
        <div className="space-y-2 border-t pt-2">
          <p className="text-xs font-medium text-muted-foreground">CRM quick actions</p>
          {crmLinks.map((l) => (
            <div
              key={`${l.provider}-${l.objectType}-${l.externalId}`}
              className="space-y-1.5 rounded-lg border border-border p-2"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StatusChip status={l.displayName} />
                <span className="text-muted-foreground">
                  {l.objectType} · sync {l.syncStatus || "—"}
                </span>
                {l.externalUrl ? (
                  <a
                    href={l.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-xs"
                  >
                    Open in CRM
                  </a>
                ) : null}
              </div>
              {!compact ? (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === `${l.provider}:sync_now`}
                    onClick={() => runAction(l.provider, "sync_now")}
                  >
                    Sync now
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === `${l.provider}:note.create`}
                    onClick={() => runAction(l.provider, "note.create")}
                  >
                    Add CRM note
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === `${l.provider}:task.create`}
                    onClick={() => runAction(l.provider, "task.create")}
                  >
                    Create CRM task
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      ) : (
        !compact ? (
          <p className="text-xs text-muted-foreground">
            Connect Salesforce, Zoho, or Pipedrive in{" "}
            <Link href="/integrations/crm" className="underline">
              CRM integrations
            </Link>{" "}
            to enable quick actions.
          </p>
        ) : null
      )}

      {!compact ? (
        <p className="text-xs text-muted-foreground">
          Appointments:{" "}
          <Link href="/integrations/native/appointments" className="underline">
            View all
          </Link>
        </p>
      ) : null}
    </div>
  );
}
