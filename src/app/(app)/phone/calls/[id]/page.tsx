"use client";

import { ConnectedRecordsPanel } from "@/components/contacts/connected-records-panel";
import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CallRow = {
  id: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  disposition?: string | null;
  notes?: string | null;
  mediaMode?: string | null;
  onHold?: boolean;
  agentUserId?: string | null;
  contactId?: string | null;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  recordingUrl?: string | null;
  transcriptText?: string | null;
  aiSummary?: string | null;
};

type EventRow = {
  id: string;
  eventType: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

type CallActivity = {
  id: string;
  provider: string;
  displayName: string;
  externalId: string;
  externalUrl: string | null;
  syncStatus: string;
  lastSyncedAt: string | null;
};

type CallCrmSync = {
  contactId: string | null;
  disposition: string | null;
  hasRecording: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
  synced: boolean;
  callActivities: CallActivity[];
  relatedTasks: Array<{
    id: string;
    provider: string;
    title: string;
    status: string;
    dueAt: string | null;
    externalUrl: string | null;
  }>;
};

const DISPOSITION_OPTIONS = [
  "connected",
  "no_answer",
  "voicemail",
  "busy",
  "wrong_number",
  "callback_requested",
  "not_interested",
  "interested",
  "appointment_set",
  "sale",
  "do_not_call",
];

function SyncBadge({ status }: { status: string }) {
  const cls =
    status === "error"
      ? "bg-red-100 text-red-800"
      : status === "pending"
        ? "bg-sky-100 text-sky-800"
        : "bg-emerald-100 text-emerald-800";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function PhoneCallDetailPage() {
  const params = useParams<{ id: string }>();
  const [call, setCall] = useState<CallRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [crm, setCrm] = useState<CallCrmSync | null>(null);
  const [dispositionBusy, setDispositionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [error, setError] = useState("");

  const callId = params?.id;

  const loadCrm = useCallback(() => {
    if (!callId) return;
    fetch(`/api/phone/calls/${callId}/crm`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.error) setCrm(j.data || null);
      })
      .catch(() => undefined);
  }, [callId]);

  useEffect(() => {
    if (!callId) return;
    fetch(`/api/phone/calls/${callId}/events`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setCall(j.data?.call || null);
        setEvents(j.data?.events || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    loadCrm();
  }, [callId, loadCrm]);

  async function changeDisposition(disposition: string) {
    if (!callId || !disposition) return;
    setDispositionBusy(true);
    setActionMsg("");
    try {
      const res = await fetch(`/api/phone/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update disposition");
      if (json.data) setCall((prev) => (prev ? { ...prev, ...json.data } : json.data));
      setActionMsg("Disposition updated");
      loadCrm();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Failed to update disposition");
    } finally {
      setDispositionBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Call diagnostics"
        description="Support visibility: inbound path, hold/transfer steps, and media lifecycle for this softphone call."
      />
      <PhoneSubNav />
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {call ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="space-y-3">
            <CardTitle>Call path timeline</CardTitle>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No diagnostic events recorded yet for this call. New softphone actions
                (dial, answer, hold, transfer, hangup) will appear here.
              </p>
            ) : (
              <ol className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{e.eventType}</p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {e.payload && Object.keys(e.payload).length > 0 ? (
                      <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="space-y-3">
            <CardTitle>Call summary</CardTitle>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">From</span> {call.from}
              </p>
              <p>
                <span className="text-muted-foreground">To</span> {call.to}
              </p>
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">Status</span>
                <StatusChip status={call.status} />
              </p>
              <p>
                <span className="text-muted-foreground">Direction</span> {call.direction}
              </p>
              <p>
                <span className="text-muted-foreground">Media</span> {call.mediaMode || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Started</span>{" "}
                {new Date(call.startedAt).toLocaleString()}
              </p>
              {call.answeredAt ? (
                <p>
                  <span className="text-muted-foreground">Answered</span>{" "}
                  {new Date(call.answeredAt).toLocaleString()}
                </p>
              ) : null}
              {call.endedAt ? (
                <p>
                  <span className="text-muted-foreground">Ended</span>{" "}
                  {new Date(call.endedAt).toLocaleString()}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-muted-foreground">Disposition</span>
                <select
                  className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
                  value={call.disposition || ""}
                  disabled={dispositionBusy}
                  onChange={(e) => changeDisposition(e.target.value)}
                >
                  <option value="" disabled>
                    Set disposition
                  </option>
                  {DISPOSITION_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              {call.aiSummary ? (
                <p className="pt-2 text-sm">
                  <span className="font-medium">AI notes:</span> {call.aiSummary}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/phone/calls"
                className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
              >
                Back to history
              </Link>
              <Link
                href={`/phone?dial=${encodeURIComponent(call.direction === "inbound" ? call.from : call.to)}`}
                className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
              >
                Return call
              </Link>
            </div>
          </Card>

          <Card className="space-y-3 lg:col-span-2">
            <CardTitle>CRM call activity &amp; sync</CardTitle>
            {actionMsg ? (
              <p className="text-xs text-muted-foreground">{actionMsg}</p>
            ) : null}
            {crm?.callActivities.length ? (
              <div className="space-y-2">
                {crm.callActivities.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusChip status={a.displayName} />
                        <SyncBadge status={a.syncStatus} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Activity ID: {a.externalId}
                        {a.lastSyncedAt
                          ? ` · Synced ${new Date(a.lastSyncedAt).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                    {a.externalUrl ? (
                      <a
                        href={a.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline"
                      >
                        Open in CRM
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This call has not been logged to a CRM yet. It will sync automatically
                when a CRM with call logging is connected.
              </p>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                  crm?.hasRecording ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
                }`}
              >
                Recording {crm?.hasRecording ? (crm.synced ? "· synced" : "· local") : "· none"}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                  crm?.hasTranscript ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
                }`}
              >
                Transcript {crm?.hasTranscript ? (crm.synced ? "· synced" : "· local") : "· none"}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                  crm?.hasSummary ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
                }`}
              >
                AI summary {crm?.hasSummary ? (crm.synced ? "· synced" : "· local") : "· none"}
              </span>
            </div>

            {crm?.relatedTasks.length ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Related CRM tasks</p>
                {crm.relatedTasks.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{t.title}</span>
                    <span className="text-xs text-muted-foreground">{t.provider}</span>
                    {t.dueAt ? (
                      <span className="text-xs text-muted-foreground">
                        Due {new Date(t.dueAt).toLocaleDateString()}
                      </span>
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
          </Card>

          {call.contactId ? (
            <Card className="space-y-2 lg:col-span-2">
              <CardTitle>CRM &amp; calendar</CardTitle>
              <p className="text-sm text-muted-foreground">
                Connected Salesforce / Zoho / Pipedrive / Calendly context for this caller.
                Add notes, create tasks, move deal stages, change owner, and send a
                Calendly follow-up link.
              </p>
              <ConnectedRecordsPanel contactId={call.contactId} />
              <Link
                href={`/contacts/${call.contactId}`}
                className="inline-block text-sm underline"
              >
                Open contact
              </Link>
            </Card>
          ) : (
            <Card className="space-y-2 lg:col-span-2">
              <CardTitle>CRM &amp; calendar</CardTitle>
              <p className="text-sm text-muted-foreground">
                No Transovo contact is linked to this call yet, so CRM contact / lead /
                company / deal context is unavailable. Link a contact to enable CRM
                quick actions.
              </p>
            </Card>
          )}
        </div>
      ) : !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
    </div>
  );
}
