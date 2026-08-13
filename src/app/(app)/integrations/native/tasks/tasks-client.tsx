"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
  completed: boolean;
  priority: string | null;
  dueAt: string | null;
  ownerExternalId: string | null;
  ownerName: string | null;
  relatedDealId: string | null;
  relatedCompanyId: string | null;
  relatedTicketId: string | null;
  syncStatus: string;
  providerUrl: string | null;
  lastSyncedAt: string | null;
  origin: string;
  completedVia: string | null;
  capabilities: {
    create: boolean;
    note: boolean;
    openInProvider: boolean;
    complete: boolean;
    completeInCrm: boolean;
    reassign: boolean;
    reschedule: boolean;
    addNote: boolean;
    retrySync: boolean;
  };
};

const CRM_PROVIDERS = ["salesforce", "zoho", "pipedrive"];

function stateBadge(t: Task): { label: string; tone: string } {
  if (t.completed) {
    const inCrm =
      t.completedVia === "crm" ||
      (t.origin === "crm" && t.syncStatus === "synced" && Boolean(t.externalId));
    return {
      label: inCrm ? "Completed in CRM" : "Completed in Transovo",
      tone: "bg-indigo-100 text-violet-800",
    };
  }
  if (t.syncStatus === "failed" || t.syncStatus === "error") {
    return { label: "Failed sync", tone: "bg-red-100 text-red-800" };
  }
  if (t.syncStatus === "pending") {
    return { label: "Pending sync", tone: "bg-amber-100 text-amber-800" };
  }
  if (t.externalId && t.syncStatus === "synced") {
    return t.origin === "crm"
      ? { label: "Created from CRM", tone: "bg-indigo-100 text-indigo-800" }
      : { label: "Synced to CRM", tone: "bg-indigo-100 text-indigo-800" };
  }
  return { label: "Transovo-only", tone: "bg-slate-100 text-slate-700" };
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

export function TasksClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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

  async function post(payload: Record<string, unknown>, taskId: string) {
    setBusy(taskId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/integrations/native/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) setError(j.error || "Action failed");
      else {
        if (j.data?.message) setNotice(j.data.message);
        load();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Unified tasks"
        description="Salesforce, Zoho, Pipedrive, and framework provider tasks in one view. Origin and sync state are shown per task; completing a synced task updates the mapped CRM record where permitted."
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/integrations/native" className="underline">
          ← Native integrations
        </Link>
        <Link href="/integrations/crm/pipeline" className="underline">
          CRM pipeline
        </Link>
        <button
          type="button"
          className="underline"
          onClick={() => load(true)}
          disabled={busy !== null}
        >
          Refresh + pull CRM tasks
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-violet-600">{notice}</p> : null}
      <div className="space-y-3">
        {tasks.map((t) => {
          const badge = stateBadge(t);
          const isCrm = CRM_PROVIDERS.includes(t.provider);
          const openLabel = isCrm ? "Open in CRM" : "Open in provider";
          return (
            <Card key={t.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">
                    {t.provider} · {t.externalId || "no external id"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge label={badge.label} tone={badge.tone} />
                  {t.priority ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                      {t.priority}
                    </span>
                  ) : null}
                </div>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">External owner</dt>
                  <dd>{t.ownerName || t.ownerExternalId || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">External due date</dt>
                  <dd>{t.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="capitalize">{t.status}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Related</dt>
                  <dd>
                    {[
                      t.relatedDealId && `deal:${t.relatedDealId}`,
                      t.relatedCompanyId && `company:${t.relatedCompanyId}`,
                      t.relatedTicketId && `ticket:${t.relatedTicketId}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last sync</dt>
                  <dd>
                    {t.lastSyncedAt
                      ? new Date(t.lastSyncedAt).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </dl>
              {t.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {t.contactId ? (
                  <Link href={`/contacts/${t.contactId}`} className="underline">
                    Contact
                  </Link>
                ) : null}
                {t.capabilities.openInProvider && t.providerUrl ? (
                  <a
                    href={t.providerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {openLabel}
                  </a>
                ) : (
                  <span
                    className="text-muted-foreground"
                    title="Provider link unavailable"
                  >
                    {openLabel} (unavailable)
                  </span>
                )}
                <button
                  type="button"
                  className="underline disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={t.completed || busy === t.id}
                  title={
                    t.capabilities.completeInCrm
                      ? "Complete and update the mapped CRM task"
                      : "Mark complete in Transovo"
                  }
                  onClick={() => post({ action: "complete", taskId: t.id }, t.id)}
                >
                  {t.completed
                    ? "Completed"
                    : t.capabilities.completeInCrm
                      ? "Complete in CRM"
                      : "Complete"}
                </button>
                <button
                  type="button"
                  className="underline disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!t.capabilities.addNote || busy === t.id}
                  title={
                    t.capabilities.addNote ? "Add note" : "Not supported for this provider"
                  }
                  onClick={() => {
                    const bodyText = window.prompt("Note");
                    if (!bodyText) return;
                    post(
                      {
                        action: "note.create",
                        provider: t.provider,
                        params: { body: bodyText },
                        contactId: t.contactId,
                      },
                      t.id,
                    );
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
                {t.capabilities.retrySync ? (
                  <button
                    type="button"
                    className="underline disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={busy === t.id}
                    onClick={() => post({ action: "retry_sync", taskId: t.id }, t.id)}
                  >
                    Retry
                  </button>
                ) : (
                  <span
                    className="text-muted-foreground"
                    title="Retry is available only for failed syncs"
                  >
                    Retry
                  </span>
                )}
              </div>
            </Card>
          );
        })}
        {!tasks.length && !error ? (
          <p className="text-sm text-muted-foreground">
            No synced tasks yet. Connect Close/HighLevel or sync
            Salesforce/Zoho/Pipedrive tasks.
          </p>
        ) : null}
      </div>
    </div>
  );
}
