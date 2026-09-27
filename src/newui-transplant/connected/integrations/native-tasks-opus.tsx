"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";

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

function stateBadge(t: Task): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (t.completed) {
    const inCrm =
      t.completedVia === "crm" ||
      (t.origin === "crm" && t.syncStatus === "synced" && Boolean(t.externalId));
    return {
      label: inCrm ? "Completed in CRM" : "Completed in Transovo",
      tone: "success",
    };
  }
  if (t.syncStatus === "failed" || t.syncStatus === "error") {
    return { label: "Failed sync", tone: "danger" };
  }
  if (t.syncStatus === "pending") {
    return { label: "Pending sync", tone: "warning" };
  }
  if (t.externalId && t.syncStatus === "synced") {
    return t.origin === "crm"
      ? { label: "Created from CRM", tone: "neutral" }
      : { label: "Synced to CRM", tone: "neutral" };
  }
  return { label: "Transovo-only", tone: "neutral" };
}

export function NativeTasksOpus() {
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
    <div className="space-y-4">
      <Panel
        title="Unified tasks"
        description="Salesforce, Zoho, Pipedrive, and framework provider tasks in one view."
      >
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/integrations/native" variant="outline">← Native integrations</ButtonLink>
          <ButtonLink href="/integrations/crm/pipeline" variant="ghost">CRM pipeline</ButtonLink>
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => load(true)}>
            Refresh + pull CRM tasks
          </Button>
        </div>
      </Panel>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      {tasks.map((t) => {
        const badge = stateBadge(t);
        const isCrm = CRM_PROVIDERS.includes(t.provider);
        const openLabel = isCrm ? "Open in CRM" : "Open in provider";
        return (
          <Panel key={t.id} title={t.title} description={`${t.provider} · ${t.externalId || "no external id"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={badge.tone}>{badge.label}</Pill>
              {t.priority ? <Pill tone="neutral">{t.priority}</Pill> : null}
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
                <dd>{t.lastSyncedAt ? new Date(t.lastSyncedAt).toLocaleString() : "—"}</dd>
              </div>
            </dl>
            {t.description ? <p className="mt-2 text-sm text-muted-foreground">{t.description}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {t.contactId ? (
                <ButtonLink href={`/contacts/${t.contactId}`} variant="ghost" size="sm">Contact</ButtonLink>
              ) : null}
              {t.capabilities.openInProvider && t.providerUrl ? (
                <a href={t.providerUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  {openLabel}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">{openLabel} (unavailable)</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={t.completed || busy === t.id}
                onClick={() => post({ action: "complete", taskId: t.id }, t.id)}
              >
                {t.completed ? "Completed" : t.capabilities.completeInCrm ? "Complete in CRM" : "Complete"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!t.capabilities.addNote || busy === t.id}
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
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={!t.capabilities.reassign}>
                Reassign
              </Button>
              {t.capabilities.retrySync ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy === t.id}
                  onClick={() => post({ action: "retry_sync", taskId: t.id }, t.id)}
                >
                  Retry
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">Retry</span>
              )}
            </div>
          </Panel>
        );
      })}
      {!tasks.length && !error ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            No synced tasks yet. Connect Close/HighLevel or sync Salesforce/Zoho/Pipedrive tasks.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
