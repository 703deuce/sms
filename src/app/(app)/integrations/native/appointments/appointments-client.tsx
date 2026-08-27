"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DealLink = {
  provider: string;
  externalId: string;
  externalUrl: string | null;
  name: string | null;
  stage: string | null;
  stageId: string | null;
  pipelineId: string | null;
  value: number | null;
  currency: string | null;
};

type CrmLink = {
  provider: string | null;
  providerDisplay: string | null;
  objectType: string | null;
  recordUrl: string | null;
  leadUrl: string | null;
  company: string | null;
  companyUrl: string | null;
  deal: DealLink | null;
};

type Appt = {
  id: string;
  callId: string | null;
  serviceName: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  status: string;
  contactId: string | null;
  externalId: string | null;
  provider: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  cancelUrl: string | null;
  rescheduleUrl: string | null;
  eventTypeId: string | null;
  eventTypeName: string | null;
  hostName: string | null;
  hostEmail: string | null;
  cancelReason: string | null;
  canceledBy: string | null;
  cancelerType: string | null;
  noShow: boolean;
  rescheduled: boolean;
  inviteeAnswers: Array<{ question: string; answer: string }>;
  tracking: Record<string, unknown> | null;
  reminderStatus: string | null;
  crm: CrmLink | null;
};

type StageOption = { id: string; name: string; pipelineId?: string };

function formatMoney(value: number | null, currency: string | null) {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(value);
  }
}

function reminderMessage(appt: Appt) {
  const when = new Date(appt.startsAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const service = appt.serviceName || "your appointment";
  let msg = `Reminder: ${service} on ${when}.`;
  if (appt.rescheduleUrl) msg += ` Reschedule: ${appt.rescheduleUrl}`;
  return msg;
}

function draftHref(contactId: string, message: string) {
  return `/conversations?contactId=${encodeURIComponent(contactId)}&draft=${encodeURIComponent(message)}`;
}

const trackingKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "salesforce_uuid",
];

export function AppointmentsClient() {
  const [rows, setRows] = useState<Appt[]>([]);
  const [stagesByProvider, setStagesByProvider] = useState<Record<string, StageOption[]>>({});
  const [moveDealProviders, setMoveDealProviders] = useState<Record<string, boolean>>({});
  const [permissions, setPermissions] = useState<{
    editCrmRecords: boolean;
    useCrmQuickActions: boolean;
  }>({ editCrmRecords: false, useCrmQuickActions: false });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [now] = useState(() => Date.now());

  function load() {
    fetch("/api/integrations/native/appointments")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else {
          setRows(j.data?.appointments || []);
          setStagesByProvider(j.data?.stagesByProvider || {});
          setMoveDealProviders(j.data?.moveDealProviders || {});
          setPermissions(
            j.data?.permissions || {
              editCrmRecords: false,
              useCrmQuickActions: false,
            },
          );
        }
      })
      .catch(() => setError("Failed to load appointments"));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((a) => {
      const t = new Date(a.startsAt).getTime();
      if (filter === "upcoming") return t >= now && !/cancel/i.test(a.status);
      if (filter === "past") return t < now || /cancel|complete/i.test(a.status);
      return true;
    });
  }, [rows, filter, now]);

  async function crmAction(
    contactId: string,
    payload: Record<string, unknown>,
    apptId: string,
  ) {
    setBusy(apptId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/integrations/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) setError(j.error || "Action failed");
      else {
        setNotice("Action completed");
        load();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Calendly bookings with full invitee, host, CRM, and tracking context. Send SMS, log CRM notes/tasks, and move linked deals — where permitted."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/integrations/native/calendly" className="underline">
          Calendly connection
        </Link>
        <Link href="/automations/templates" className="underline">
          Booking automation templates
        </Link>
        <div className="ml-auto flex gap-2">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`rounded-lg border px-2.5 py-1 text-xs capitalize ${
                filter === f ? "border-primary bg-muted" : "border-border"
              }`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-violet-600">{notice}</p> : null}
      <div className="space-y-3">
        {filtered.map((a) => {
          const crm = a.crm;
          const deal = crm?.deal || null;
          const canMoveDeal =
            deal != null && Boolean(moveDealProviders[deal.provider]);
          const dealStages = deal
            ? (stagesByProvider[deal.provider] || []).filter(
                (s) => !s.pipelineId || s.pipelineId === deal.pipelineId,
              )
            : [];
          const openCalendlyUrl = a.rescheduleUrl || a.cancelUrl;
          const openCrmUrl = crm?.recordUrl || crm?.leadUrl || deal?.externalUrl || null;
          const trackingEntries = a.tracking
            ? trackingKeys
                .map((k) => [k, a.tracking?.[k]] as const)
                .filter(([, v]) => v != null && v !== "")
            : [];

          return (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {a.serviceName || a.eventTypeName || "Appointment"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {a.provider || "calendly"} ·{" "}
                    {new Date(a.startsAt).toLocaleString()}
                    {a.endsAt ? ` – ${new Date(a.endsAt).toLocaleTimeString()}` : ""}
                    {a.timezone ? ` (${a.timezone})` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip status={a.status} />
                  {a.noShow ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                      No-show
                    </span>
                  ) : null}
                  {a.rescheduled ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Rescheduled
                    </span>
                  ) : null}
                </div>
              </div>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Contact</dt>
                  <dd>
                    {a.contactId ? (
                      <Link href={`/contacts/${a.contactId}`} className="underline">
                        {a.inviteeName || "Contact"}
                      </Link>
                    ) : (
                      a.inviteeName || "—"
                    )}
                    {a.inviteeEmail ? (
                      <span className="text-muted-foreground"> · {a.inviteeEmail}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">CRM {crm?.objectType || "record"}</dt>
                  <dd>
                    {crm?.provider ? (
                      openCrmUrl ? (
                        <a
                          href={openCrmUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {crm.providerDisplay} {crm.objectType}
                        </a>
                      ) : (
                        `${crm.providerDisplay} ${crm.objectType}`
                      )
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Company</dt>
                  <dd>
                    {crm?.companyUrl ? (
                      <a
                        href={crm.companyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {crm.company}
                      </a>
                    ) : (
                      crm?.company || "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Related deal</dt>
                  <dd>
                    {deal ? (
                      <>
                        {deal.externalUrl ? (
                          <a
                            href={deal.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            {deal.name}
                          </a>
                        ) : (
                          deal.name
                        )}
                        {deal.stage ? ` · ${deal.stage}` : ""}
                        {formatMoney(deal.value, deal.currency)
                          ? ` · ${formatMoney(deal.value, deal.currency)}`
                          : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Host</dt>
                  <dd>
                    {a.hostName || "—"}
                    {a.hostEmail ? (
                      <span className="text-muted-foreground"> · {a.hostEmail}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Event type</dt>
                  <dd>{a.eventTypeName || a.eventTypeId || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reminder</dt>
                  <dd>{a.reminderStatus || "—"}</dd>
                </div>
                {a.cancelReason || a.canceledBy ? (
                  <div>
                    <dt className="text-muted-foreground">Cancellation</dt>
                    <dd>
                      {a.cancelReason || "Canceled"}
                      {a.canceledBy ? ` · by ${a.canceledBy}` : ""}
                      {a.cancelerType ? ` (${a.cancelerType})` : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {a.inviteeAnswers.length ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Invitee answers
                  </p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {a.inviteeAnswers.map((qa, i) => (
                      <li key={i}>
                        <span className="text-muted-foreground">{qa.question}: </span>
                        {qa.answer}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {trackingEntries.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {trackingEntries.map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                    >
                      {k.replace(/^utm_/, "")}: {String(v)}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {a.contactId ? (
                  <Link href={`/conversations?contactId=${a.contactId}`} className="underline">
                    SMS history
                  </Link>
                ) : null}
                {a.callId ? (
                  <Link href={`/phone/calls/${a.callId}`} className="underline">
                    Call history
                  </Link>
                ) : null}
                {openCalendlyUrl ? (
                  <a
                    href={openCalendlyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Open Calendly
                  </a>
                ) : null}
                {openCrmUrl ? (
                  <a
                    href={openCrmUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Open CRM
                  </a>
                ) : null}
                {a.contactId ? (
                  <Link
                    href={draftHref(a.contactId, reminderMessage(a))}
                    className="underline"
                  >
                    Send reminder SMS
                  </Link>
                ) : null}
                {a.contactId && a.rescheduleUrl ? (
                  <Link
                    href={draftHref(
                      a.contactId,
                      `Need a different time? Reschedule here: ${a.rescheduleUrl}`,
                    )}
                    className="underline"
                  >
                    Send reschedule link
                  </Link>
                ) : null}
                {a.contactId && a.cancelUrl ? (
                  <Link
                    href={draftHref(
                      a.contactId,
                      `Cancel your appointment here: ${a.cancelUrl}`,
                    )}
                    className="underline"
                  >
                    Send cancel link
                  </Link>
                ) : null}
              </div>

              {a.contactId && crm?.provider ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm">
                  <button
                    type="button"
                    className="underline disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!permissions.useCrmQuickActions || busy === a.id}
                    title={
                      permissions.useCrmQuickActions
                        ? "Add a note to the CRM record"
                        : "Your role cannot use CRM quick actions"
                    }
                    onClick={() => {
                      const body = window.prompt("CRM note");
                      if (!body) return;
                      crmAction(
                        a.contactId!,
                        { action: "note.create", provider: crm.provider, body },
                        a.id,
                      );
                    }}
                  >
                    Add CRM note
                  </button>
                  <button
                    type="button"
                    className="underline disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!permissions.useCrmQuickActions || busy === a.id}
                    title={
                      permissions.useCrmQuickActions
                        ? "Create a follow-up task in the CRM"
                        : "Your role cannot use CRM quick actions"
                    }
                    onClick={() => {
                      const title = window.prompt(
                        "CRM task title",
                        `Follow up: ${a.serviceName || "appointment"}`,
                      );
                      if (!title) return;
                      crmAction(
                        a.contactId!,
                        { action: "task.create", provider: crm.provider, title },
                        a.id,
                      );
                    }}
                  >
                    Create CRM task
                  </button>
                  {deal ? (
                    canMoveDeal && dealStages.length ? (
                      <label className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">Move deal to</span>
                        <select
                          className="rounded border border-border bg-background px-1.5 py-0.5"
                          defaultValue=""
                          disabled={busy === a.id}
                          onChange={(e) => {
                            const stageId = e.target.value;
                            if (!stageId) return;
                            crmAction(
                              a.contactId!,
                              {
                                action: "deal.stage_update",
                                provider: deal.provider,
                                externalId: deal.externalId,
                                stageId,
                                pipelineId: deal.pipelineId || undefined,
                              },
                              a.id,
                            );
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>
                            Stage…
                          </option>
                          {dealStages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <span
                        className="text-xs text-muted-foreground"
                        title="Stage moves require deal write support and permission — open the deal in CRM instead"
                      >
                        Move deal stage (open in CRM)
                      </span>
                    )
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
        {!filtered.length && !error ? (
          <p className="text-sm text-muted-foreground">
            No appointments in this view. Connect Calendly, sync, or create a booking.
          </p>
        ) : null}
      </div>
    </div>
  );
}
