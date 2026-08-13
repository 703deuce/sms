"use client";

import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type CrmContextLink = {
  id: string;
  provider: string;
  displayName: string;
  objectType: string;
  name: string | null;
  externalId: string;
  externalUrl: string | null;
  owner: string | null;
  status: string | null;
  company: string | null;
  pipeline: string | null;
  stage: string | null;
  dealValue: number | null;
  currency: string | null;
  source: string | null;
  leadStatus: string | null;
  contactStatus: string | null;
  lastSyncedAt: string | null;
  lastCrmModifiedAt: string | null;
  syncStatus: string;
  pendingSync: boolean;
  syncFailure: boolean;
  conflict: boolean;
  parentExternalId: string | null;
  metadata: Record<string, unknown>;
};

type CrmContextAppointment = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  provider: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  cancelUrl?: string | null;
  rescheduleUrl?: string | null;
  meetingUrl?: string | null;
  eventTypeName?: string | null;
  hostName?: string | null;
  isPast: boolean;
  isUpcoming: boolean;
};

type CrmContextNote = {
  id: string;
  provider: string;
  displayName: string;
  externalId: string;
  externalUrl: string | null;
  body: string | null;
  author: string | null;
  createdAt: string | null;
  relatedType: string | null;
};

type CrmContextConflict = {
  id: string;
  provider: string;
  displayName: string;
  externalId: string;
  message: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
};

type CrmContextProvider = {
  provider: string;
  displayName: string;
  status: string;
  syncStatus: string;
  lastError: string | null;
  schedulingUrl: string | null;
};

type CrmContextData = {
  providers: CrmContextProvider[];
  links: CrmContextLink[];
  deals: CrmContextLink[];
  leads: CrmContextLink[];
  companies: CrmContextLink[];
  notes: CrmContextNote[];
  conflicts: CrmContextConflict[];
  upcomingAppointments: CrmContextAppointment[];
  pastAppointments: CrmContextAppointment[];
  openTasks: Array<{
    id: string;
    provider: string;
    title: string;
    status: string;
    dueAt: string | null;
    ownerName: string | null;
    externalUrl: string | null;
  }>;
  syncStatus: string;
  lastSyncErrors: Array<{ provider: string; displayName: string; error: string }>;
};

type StageOption = { id: string; name: string; pipelineId?: string | null };
type OwnerOption = { id: string; name: string; email?: string | null };

const CRM_PROVIDERS = ["salesforce", "zoho", "pipedrive"];
const PRODUCT_PROVIDERS = ["salesforce", "zoho", "pipedrive", "calendly"];

function formatMoney(value: number | null, currency: string | null) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency || ""}`.trim();
  }
}

function formatWhen(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function RecordRow({
  link,
  compact,
  stages,
  owners,
  busy,
  onAction,
  onStageChange,
  onOwnerChange,
  onStatusChange,
}: {
  link: CrmContextLink;
  compact: boolean;
  stages: StageOption[];
  owners: OwnerOption[];
  busy: string | null;
  onAction: (provider: string, action: string, extra?: Record<string, string>) => void;
  onStageChange: (link: CrmContextLink, stageId: string) => void;
  onOwnerChange: (link: CrmContextLink, ownerExternalId: string) => void;
  onStatusChange: (link: CrmContextLink) => void;
}) {
  const providerStages = stages.filter(
    (s) => !s.pipelineId || s.pipelineId === link.metadata?.pipeline,
  );
  const isCrm = CRM_PROVIDERS.includes(link.provider);
  const isDeal = link.objectType === "deal";
  const isLead = link.objectType === "lead";

  return (
    <div className="rounded-lg border border-border p-2.5 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={link.displayName} />
            <span className="text-xs text-muted-foreground capitalize">
              {link.objectType}
            </span>
            {link.name ? (
              <span className="text-sm font-medium truncate">{link.name}</span>
            ) : null}
            {link.conflict ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Conflict
              </span>
            ) : null}
            {link.pendingSync ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                Pending sync
              </span>
            ) : null}
            {link.syncFailure ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                Sync failed
              </span>
            ) : null}
          </div>
          {!compact ? (
            <dl className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
              {link.owner ? <Field label="Owner">{link.owner}</Field> : null}
              {link.leadStatus ? (
                <Field label="Lead status">{link.leadStatus}</Field>
              ) : null}
              {link.contactStatus ? (
                <Field label="Contact status">{link.contactStatus}</Field>
              ) : null}
              {!link.leadStatus && !link.contactStatus && link.status ? (
                <Field label="Status">{link.status}</Field>
              ) : null}
              {link.company ? <Field label="Company">{link.company}</Field> : null}
              {link.pipeline ? <Field label="Pipeline">{link.pipeline}</Field> : null}
              {link.stage ? <Field label="Stage">{link.stage}</Field> : null}
              {link.dealValue != null ? (
                <Field label="Deal value">
                  {formatMoney(link.dealValue, link.currency)}
                </Field>
              ) : null}
              {link.source ? <Field label="Lead source">{link.source}</Field> : null}
              <Field label="Last CRM update">{formatWhen(link.lastCrmModifiedAt)}</Field>
              <Field label="Last successful sync">{formatWhen(link.lastSyncedAt)}</Field>
              <Field label="Sync status">{link.syncStatus}</Field>
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">
              {[link.stage, link.leadStatus || link.contactStatus || link.status]
                .filter(Boolean)
                .join(" · ") || link.syncStatus}
            </p>
          )}
        </div>
        {link.externalUrl ? (
          <a
            href={link.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline shrink-0"
          >
            Open in CRM
          </a>
        ) : null}
      </div>

      {!compact && isCrm ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy === `${link.provider}:sync_now`}
            onClick={() => onAction(link.provider, "sync_now")}
          >
            Sync now
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy === `${link.provider}:note.create`}
            onClick={() =>
              onAction(link.provider, "note.create", {
                relatedType: link.objectType,
                relatedExternalId: link.externalId,
              })
            }
          >
            Add note
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy === `${link.provider}:task.create`}
            onClick={() => onAction(link.provider, "task.create")}
          >
            Create task
          </Button>
          {isLead || link.objectType === "contact" ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy === `${link.provider}:change_status:${link.externalId}`}
              onClick={() => onStatusChange(link)}
            >
              {isLead ? "Change lead status" : "Change status"}
            </Button>
          ) : null}
          {owners.length ? (
            <label className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Owner</span>
              <select
                className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                defaultValue=""
                disabled={busy === `${link.provider}:change_owner:${link.externalId}`}
                onChange={(e) => {
                  const ownerId = e.target.value;
                  if (ownerId) onOwnerChange(link, ownerId);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Change owner
                </option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {isDeal && providerStages.length ? (
            <label className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Move stage</span>
              <select
                className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                defaultValue=""
                disabled={busy === `${link.provider}:deal.stage_update:${link.externalId}`}
                onChange={(e) => {
                  const stageId = e.target.value;
                  if (stageId) onStageChange(link, stageId);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Select stage
                </option>
                {providerStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AppointmentBlock({
  appt,
  compact,
  contactId,
}: {
  appt: CrmContextAppointment;
  compact: boolean;
  contactId: string;
}) {
  return (
    <div className="rounded-lg border border-border p-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{appt.serviceName || appt.eventTypeName || "Appointment"}</p>
        <StatusChip status={appt.status} />
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {appt.provider || "calendly"} · {new Date(appt.startsAt).toLocaleString()}
      </p>
      {!compact ? (
        <p className="text-xs mt-1">
          {appt.inviteeName || "Invitee"}
          {appt.hostName ? ` · Host: ${appt.hostName}` : ""}
          {appt.eventTypeName ? ` · ${appt.eventTypeName}` : ""}
        </p>
      ) : null}
      {!compact ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Link href={`/contacts/${contactId}`} className="underline">
            Contact
          </Link>
          {appt.meetingUrl ? (
            <a href={appt.meetingUrl} target="_blank" rel="noreferrer" className="underline">
              Open appointment
            </a>
          ) : null}
          {appt.rescheduleUrl ? (
            <a href={appt.rescheduleUrl} target="_blank" rel="noreferrer" className="underline">
              Reschedule
            </a>
          ) : null}
          {appt.cancelUrl ? (
            <a href={appt.cancelUrl} target="_blank" rel="noreferrer" className="underline">
              Cancel
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Connected Records — CRM + Calendly context with quick actions.
 */
export function ConnectedRecordsPanel({
  contactId,
  compact = false,
}: {
  contactId: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<CrmContextData | null>(null);
  const [stagesByProvider, setStagesByProvider] = useState<Record<string, StageOption[]>>({});
  const [ownersByProvider, setOwnersByProvider] = useState<Record<string, OwnerOption[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/contacts/${contactId}/crm-context`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else {
          setError(null);
          setData(j.data || null);
        }
      })
      .catch(() => setError("Failed to load CRM context"));
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data?.providers?.length) return;
    const crmProviders = data.providers
      .filter((p) => CRM_PROVIDERS.includes(p.provider))
      .map((p) => p.provider);
    if (!crmProviders.length) return;

    Promise.all(
      crmProviders.map((provider) =>
        fetch(`/api/integrations/metadata?provider=${provider}`)
          .then((r) => r.json())
          .then((j) => ({
            provider,
            stages: (j.data?.stages || []) as StageOption[],
            owners: (j.data?.owners || []) as OwnerOption[],
          })),
      ),
    )
      .then((rows) => {
        const stageMap: Record<string, StageOption[]> = {};
        const ownerMap: Record<string, OwnerOption[]> = {};
        for (const row of rows) {
          stageMap[row.provider] = row.stages;
          ownerMap[row.provider] = row.owners;
        }
        setStagesByProvider(stageMap);
        setOwnersByProvider(ownerMap);
      })
      .catch(() => undefined);
  }, [data?.providers]);

  const schedulingUrl = useMemo(
    () => data?.providers.find((p) => p.provider === "calendly")?.schedulingUrl || null,
    [data?.providers],
  );

  const crmLinks = useMemo(
    () =>
      (data?.links || []).filter(
        (l) =>
          PRODUCT_PROVIDERS.includes(l.provider) &&
          ![
            "user",
            "pipeline",
            "pipeline_stage",
            "stage",
            "note",
            "call",
            "sms",
            "activity",
          ].includes(l.objectType),
      ),
    [data?.links],
  );

  async function runAction(
    provider: string,
    action: string,
    extra?: Record<string, string>,
  ) {
    setBusy(`${provider}:${action}${extra?.externalId ? `:${extra.externalId}` : ""}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/integrations/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) setMessage(json.error || "Action failed");
      else {
        setMessage(
          action === "sync_now"
            ? "Sync queued"
            : action === "resolve_conflict"
              ? "Conflict resolved"
              : action.includes("deal")
                ? "Deal updated"
                : `${action.replace(/[._]/g, " ")} succeeded`,
        );
        load();
      }
    } catch {
      setMessage("Action failed");
    } finally {
      setBusy(null);
    }
  }

  function changeStatus(link: CrmContextLink) {
    const label = link.objectType === "lead" ? "lead status" : "contact status";
    const next = window.prompt(
      `New ${label} for ${link.name || link.objectType}:`,
      link.leadStatus || link.contactStatus || link.status || "",
    );
    if (next == null || !next.trim()) return;
    runAction(link.provider, "change_status", {
      objectType: link.objectType,
      externalId: link.externalId,
      status: next.trim(),
    });
  }

  function sendCalendlyLink() {
    if (!schedulingUrl) return;
    const text = `Book a time with me: ${schedulingUrl}`;
    const href = `/inbox?contactId=${encodeURIComponent(contactId)}&draft=${encodeURIComponent(text)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  if (error) {
    return <p className="text-xs text-muted-foreground">{error}</p>;
  }
  if (!data) {
    return <p className="text-xs text-muted-foreground">Loading connected records…</p>;
  }

  const hasContent =
    crmLinks.length ||
    data.openTasks.length ||
    data.notes.length ||
    data.conflicts.length ||
    data.upcomingAppointments.length ||
    data.pastAppointments.length;

  if (!hasContent && data.syncStatus === "disconnected") {
    return (
      <p className="text-xs text-muted-foreground">
        Connect Salesforce, Zoho, Pipedrive, or Calendly in{" "}
        <Link href="/integrations/crm" className="underline">
          CRM integrations
        </Link>{" "}
        to see linked records.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={data.syncStatus} />
        {data.providers
          .filter((p) => p.status === "connected" || p.status === "syncing")
          .map((p) => (
            <span key={p.provider} className="text-[11px] text-muted-foreground">
              {p.displayName}: {p.syncStatus}
            </span>
          ))}
        {data.conflicts.length ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            {data.conflicts.length} conflict{data.conflicts.length > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {data.conflicts.length ? (
        <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <p className="font-semibold">Resolve sync conflicts</p>
          {data.conflicts.slice(0, compact ? 1 : 5).map((c) => (
            <div key={c.id} className="space-y-1 border-t border-amber-200 pt-1.5 first:border-t-0 first:pt-0">
              <p>
                <strong>{c.displayName}:</strong> {c.message}
              </p>
              {!compact ? (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === `${c.provider}:resolve_conflict:${c.id}`}
                    onClick={() =>
                      runAction(c.provider, "resolve_conflict", {
                        conflictId: c.id,
                        decision: "use_crm",
                        externalId: c.id,
                      })
                    }
                  >
                    Link to CRM
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === `${c.provider}:resolve_conflict:${c.id}`}
                    onClick={() =>
                      runAction(c.provider, "resolve_conflict", {
                        conflictId: c.id,
                        decision: "use_transovo",
                        externalId: c.id,
                      })
                    }
                  >
                    Keep Transovo
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === `${c.provider}:resolve_conflict:${c.id}`}
                    onClick={() =>
                      runAction(c.provider, "resolve_conflict", {
                        conflictId: c.id,
                        decision: "ignore",
                        externalId: c.id,
                      })
                    }
                  >
                    Ignore
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {data.lastSyncErrors.length && !compact ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          {data.lastSyncErrors.map((e) => (
            <p key={e.provider}>
              <strong>{e.displayName}:</strong> {e.error}
            </p>
          ))}
        </div>
      ) : null}

      {crmLinks.length ? (
        <div className="space-y-2">
          {!compact ? (
            <p className="text-xs font-medium text-muted-foreground">Linked CRM records</p>
          ) : null}
          {crmLinks.slice(0, compact ? 3 : 30).map((link) => (
            <RecordRow
              key={link.id}
              link={link}
              compact={compact}
              stages={stagesByProvider[link.provider] || []}
              owners={ownersByProvider[link.provider] || []}
              busy={busy}
              onAction={runAction}
              onStageChange={(l, stageId) =>
                runAction(l.provider, "deal.stage_update", {
                  externalId: l.externalId,
                  stageId,
                  pipelineId: String(l.metadata?.pipeline || ""),
                })
              }
              onOwnerChange={(l, ownerExternalId) =>
                runAction(l.provider, "change_owner", {
                  objectType: l.objectType,
                  externalId: l.externalId,
                  ownerExternalId,
                })
              }
              onStatusChange={changeStatus}
            />
          ))}
        </div>
      ) : null}

      {data.openTasks.length ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Open CRM tasks</p>
          {data.openTasks.slice(0, compact ? 2 : 8).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{t.title}</span>
              <span className="text-xs text-muted-foreground">{t.provider}</span>
              {t.dueAt ? (
                <span className="text-xs text-muted-foreground">Due {formatWhen(t.dueAt)}</span>
              ) : null}
              {t.externalUrl ? (
                <a href={t.externalUrl} target="_blank" rel="noreferrer" className="text-xs underline">
                  Open
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {!compact && data.notes.length ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">CRM notes</p>
          {data.notes.slice(0, 6).map((n) => (
            <div key={n.id} className="rounded-lg border border-border p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {n.displayName}
                  {n.author ? ` · ${n.author}` : ""}
                </span>
                <span className="text-muted-foreground">{formatWhen(n.createdAt)}</span>
              </div>
              {n.body ? <p className="mt-1 line-clamp-3">{n.body}</p> : null}
              {n.externalUrl ? (
                <a href={n.externalUrl} target="_blank" rel="noreferrer" className="underline">
                  Open note
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {data.upcomingAppointments.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Upcoming appointments</p>
          {data.upcomingAppointments.slice(0, compact ? 1 : 5).map((a) => (
            <AppointmentBlock key={a.id} appt={a} compact={compact} contactId={contactId} />
          ))}
        </div>
      ) : null}

      {!compact && data.pastAppointments.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Previous appointments</p>
          {data.pastAppointments.slice(0, 5).map((a) => (
            <AppointmentBlock key={a.id} appt={a} compact={false} contactId={contactId} />
          ))}
        </div>
      ) : null}

      {schedulingUrl ? (
        <Button size="sm" variant="outline" onClick={sendCalendlyLink}>
          Send Calendly link
        </Button>
      ) : null}

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

      {!compact ? (
        <p className="text-xs text-muted-foreground">
          <Link href="/integrations/native/appointments" className="underline">
            All appointments
          </Link>
          {" · "}
          <Link href="/integrations/crm/pipeline" className="underline">
            Pipeline board
          </Link>
        </p>
      ) : null}
    </div>
  );
}
