"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useState } from "react";

type Task = {
  id: string;
  provider: string;
  externalId: string;
  contactId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueAt: string | null;
  ownerName: string | null;
  relatedDealId: string | null;
  relatedCompanyId: string | null;
  relatedTicketId: string | null;
  syncStatus: string;
  providerUrl: string | null;
  lastSyncedAt: string | null;
  capabilities: {
    create: boolean;
    note: boolean;
    openInProvider: boolean;
    complete: boolean;
    reassign: boolean;
    reschedule: boolean;
    addNote: boolean;
    retrySync: boolean;
  };
};

export function TasksClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load(syncCrm = false) {
    fetch(`/api/integrations/native/tasks${syncCrm ? "?syncCrm=1" : ""}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setTasks(j.data?.tasks || []);
      })
      .catch(() => setError("Failed to load tasks"));
  }

  useEffect(() => {
    load(true);
  }, []);

  async function runAction(provider: string, action: string, params: Record<string, unknown>, contactId?: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/native/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action, params, contactId }),
      });
      const j = await res.json();
      if (!res.ok) setError(j.error || "Action failed");
      else load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Unified tasks"
        description="Transovo, Zoho, Pipedrive, Close, HighLevel, and other provider tasks from the normalized task contract. Unsupported actions stay disabled."
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/integrations/native" className="underline">
          ← Native integrations
        </Link>
        <button type="button" className="underline" onClick={() => load(true)} disabled={busy}>
          Refresh + pull CRM tasks
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        {tasks.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{t.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t.provider} · {t.externalId}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StatusChip status={t.provider} />
                <StatusChip status={t.status} />
                <StatusChip status={t.syncStatus} />
              </div>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd>{t.ownerName || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Due</dt>
                <dd>{t.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Priority</dt>
                <dd>{t.priority || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Related</dt>
                <dd>
                  {[t.relatedDealId && `deal:${t.relatedDealId}`, t.relatedCompanyId && `company:${t.relatedCompanyId}`, t.relatedTicketId && `ticket:${t.relatedTicketId}`]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last sync</dt>
                <dd>{t.lastSyncedAt ? new Date(t.lastSyncedAt).toLocaleString() : "—"}</dd>
              </div>
            </dl>
            {t.description ? <p className="mt-2 text-sm text-muted-foreground">{t.description}</p> : null}
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {t.contactId ? (
                <Link href={`/contacts/${t.contactId}`} className="underline">
                  Contact
                </Link>
              ) : null}
              {t.capabilities.openInProvider && t.providerUrl ? (
                <a href={t.providerUrl} target="_blank" rel="noreferrer" className="underline">
                  Open in provider
                </a>
              ) : (
                <span className="text-muted-foreground" title="Provider link unavailable">
                  Open in provider (unavailable)
                </span>
              )}
              <button
                type="button"
                className="underline disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!t.capabilities.complete || busy}
                title={t.capabilities.complete ? "Complete via provider" : "Not supported for this provider"}
                onClick={() =>
                  runAction(
                    t.provider,
                    "task.create",
                    { title: t.title, description: "Completed in Transovo", contactId: t.externalId },
                    t.contactId,
                  )
                }
              >
                Complete
              </button>
              <button
                type="button"
                className="underline disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!t.capabilities.addNote || busy}
                title={t.capabilities.addNote ? "Add note" : "Not supported"}
                onClick={() => {
                  const body = window.prompt("Note");
                  if (!body) return;
                  runAction(t.provider, "note.create", { body, contactId: t.externalId }, t.contactId);
                }}
              >
                Add note
              </button>
              <button
                type="button"
                className="underline disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!t.capabilities.reassign}
                title="Reassign is not supported for this connection"
              >
                Reassign
              </button>
              <button
                type="button"
                className="underline disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!t.capabilities.retrySync || busy}
                onClick={async () => {
                  await fetch("/api/integrations/native/tasks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "retry_sync", taskId: t.id }),
                  });
                  load();
                }}
              >
                Retry sync
              </button>
            </div>
          </Card>
        ))}
        {!tasks.length && !error ? (
          <p className="text-sm text-muted-foreground">No synced tasks yet. Connect Close, HighLevel, or sync Zoho/Pipedrive tasks.</p>
        ) : null}
      </div>
    </div>
  );
}
