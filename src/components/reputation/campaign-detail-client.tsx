"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pause, Play, UserPlus, Webhook, X } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import { attributionDisplayLabel, type AttributionLevel } from "@/lib/reputation/contacts-normalize";
import {
  parseTriggerConfig,
  triggerLabel,
  triggerTimelineLabel,
  type CampaignTriggerType,
} from "@/lib/reputation/campaign-triggers";

type Metrics = {
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  clicked: number;
  failed: number;
  opted_out: number;
  replied: number;
};

type Recipient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  workflow_status: string | null;
  replied_at: string | null;
  review_detected_at: string | null;
  review_attribution: string | null;
  latest_message: {
    status: string;
    channel: string;
    sent_at: string | null;
    scheduled_for: string;
    clicked_at: string | null;
  } | null;
};

type Activity = { at: string; type: string; label: string; meta?: string };

const FILTERS = [
  { id: "", label: "All" },
  { id: "ready", label: "Pending" },
  { id: "opted_out", label: "Opted out" },
  { id: "replied", label: "Replied" },
  { id: "reviewed", label: "Reviewed" },
  { id: "skipped", label: "Skipped" },
] as const;

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[calc(50%-0.25rem)] flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 sm:min-w-[6.5rem] sm:flex-none">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

export function CampaignDetailClient({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [attribution, setAttribution] = useState({ confirmed: 0, likely: 0, unattributed: 0 });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Record<string, unknown> | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [enrollResult, setEnrollResult] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { append?: boolean; cursor?: string | null; status?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ businessId, limit: "50" });
        if (opts?.cursor) params.set("cursor", opts.cursor);
        const status = opts?.status ?? filter;
        if (status) params.set("recipientStatus", status);
        const res = await fetch(
          `/api/reputation/review-requests/campaigns/${campaignId}?${params}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setCampaign(json.campaign);
        setMetrics(json.metrics);
        setAttribution(json.attribution ?? { confirmed: 0, likely: 0, unattributed: 0 });
        setActivity(json.activity ?? []);
        setRecipients((prev) =>
          opts?.append ? [...prev, ...(json.recipients?.items ?? [])] : json.recipients?.items ?? []
        );
        setNextCursor(json.recipients?.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [businessId, campaignId, filter]
  );

  useEffect(() => {
    void load({ status: filter });
  }, [load, filter]);

  async function openDrawer(recipientId: string) {
    setDrawerId(recipientId);
    setDrawerLoading(true);
    try {
      const res = await fetch(
        `/api/reputation/review-requests/campaigns/${campaignId}?businessId=${businessId}&recipientId=${recipientId}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setDrawer(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setDrawerLoading(false);
    }
  }

  async function action(act: string) {
    setError(null);
    const res = await fetch(`/api/reputation/review-requests/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, action: act }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : `Failed to ${act}`);
      return;
    }
    await load();
  }

  async function enrollManual() {
    setEnrollBusy(true);
    setEnrollResult(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/reputation/review-requests/campaigns/${campaignId}/enroll`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            firstName: enrollForm.firstName || undefined,
            lastName: enrollForm.lastName || undefined,
            phone: enrollForm.phone || undefined,
            email: enrollForm.email || undefined,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Enroll failed");
      if (json.skipped) {
        setEnrollResult(`Skipped: ${json.skipReason ?? "not eligible"}`);
      } else if (json.alreadyEnrolled) {
        setEnrollResult("Already enrolled (duplicate protection).");
      } else {
        setEnrollResult("Enrolled — first step scheduled.");
        setEnrollForm({ firstName: "", lastName: "", phone: "", email: "" });
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enroll failed");
    } finally {
      setEnrollBusy(false);
    }
  }

  const status = String(campaign?.status ?? "");
  const name = String(campaign?.name ?? "Campaign");
  const autoPause = campaign?.auto_pause_reason ? String(campaign.auto_pause_reason) : null;
  const triggerType = (String(campaign?.trigger_type ?? "manual") || "manual") as CampaignTriggerType;
  const triggerConfig = parseTriggerConfig(campaign?.trigger_config);
  const enrollmentsPaused = Boolean(campaign?.enrollments_paused);
  const isAutomatic = triggerType === "webhook" || triggerType === "api";
  const sequenceJson = Array.isArray(campaign?.sequence_json)
    ? (campaign?.sequence_json as Array<{ step_key?: string; step_type?: string }>)
    : [];
  const timelineBits = [
    triggerTimelineLabel(triggerType, triggerConfig),
    ...sequenceJson.map((s) => {
      if (s.step_type === "wait") return "Wait";
      if (s.step_type === "send_sms") return "SMS";
      if (s.step_type === "send_email") return "Email";
      if (s.step_type === "condition") return "Check";
      if (s.step_type === "end") return "End";
      return s.step_key || "Step";
    }),
  ];

  return (
    <ModulePage>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/businesses/${businessId}/reputation/campaigns`}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All campaigns
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">{name}</h1>
          <p className="mt-0.5 text-[13px] text-zinc-600">
            Status: <span className="font-medium capitalize text-zinc-800">{status || "—"}</span>
            {enrollmentsPaused ? " · New enrollments paused" : ""}
            {autoPause ? ` · Sending paused: ${autoPause}` : ""}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-700">
            {isAutomatic ? <Webhook className="h-3.5 w-3.5 text-emerald-600" /> : <UserPlus className="h-3.5 w-3.5 text-emerald-600" />}
            Trigger: {triggerLabel(triggerType, triggerConfig)}
          </p>
          <p
            className="mt-1 max-w-2xl truncate text-[10px] text-zinc-500"
            title={timelineBits.join(" → ")}
          >
            {timelineBits.join(" → ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isAutomatic && (
            <Link
              href={`/businesses/${businessId}/integrations`}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium"
            >
              <Webhook className="h-3.5 w-3.5" /> View integration
            </Link>
          )}
          {(status === "active" || status === "scheduled") &&
            (triggerConfig.allowManualEnrollment !== false) && (
              <button
                type="button"
                onClick={() => {
                  setShowEnroll(true);
                  setEnrollResult(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add contact
              </button>
            )}
          {status === "active" && (
            <button
              type="button"
              onClick={() =>
                void action(enrollmentsPaused ? "resume_enrollments" : "pause_enrollments")
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium"
            >
              {enrollmentsPaused ? "Resume enrollments" : "Pause new enrollments"}
            </button>
          )}
          {status === "active" && (
            <button
              type="button"
              onClick={() => void action("pause")}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium"
            >
              <Pause className="h-3.5 w-3.5" /> Pause all sending
            </button>
          )}
          {(status === "paused" || status === "draft") && (
            <button
              type="button"
              onClick={() => void action(status === "draft" ? "start" : "resume")}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white"
            >
              <Play className="h-3.5 w-3.5" /> {status === "draft" ? "Activate / Launch" : "Resume sending"}
            </button>
          )}
          {!["completed", "cancelled", "archived"].includes(status) && (
            <button
              type="button"
              onClick={() => void action("cancel")}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-[12px] font-medium text-red-700"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          )}
        </div>
      </div>

      {isAutomatic ? (
        <p className="mt-2 rounded-md border border-sky-100 bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-900">
          Automatic campaigns stay <strong>active</strong> after current recipients finish so new webhook
          events can keep enrolling. Use “Pause new enrollments” to stop intake without cancelling
          in-flight sequences.
        </p>
      ) : null}

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {metrics ? (
          <>
            <MicroStat label="Sent" value={String(metrics.sent)} />
            <MicroStat label="Delivered" value={String(metrics.delivered)} />
            <MicroStat label="Clicked" value={String(metrics.clicked)} />
            <MicroStat label="Replied" value={String(metrics.replied)} />
            <MicroStat label="Opted out" value={String(metrics.opted_out)} />
            <MicroStat label="Failed" value={String(metrics.failed)} />
            <MicroStat label="Queued" value={String(metrics.queued + metrics.sending)} />
          </>
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-600">
        <span>
          {attributionDisplayLabel("confirmed")}:{" "}
          <strong className="text-zinc-900">{attribution.confirmed}</strong>
        </span>
        <span>
          {attributionDisplayLabel("likely")}:{" "}
          <strong className="text-zinc-900">{attribution.likely}</strong>
        </span>
        <span>
          {attributionDisplayLabel("unattributed")}:{" "}
          <strong className="text-zinc-900">{attribution.unattributed}</strong>
        </span>
      </div>

      {metrics && metrics.sent > 0 && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Funnel</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            {[
              { label: "Sent", n: metrics.sent },
              { label: "Delivered", n: metrics.delivered },
              { label: "Clicked", n: metrics.clicked },
              { label: "Replied", n: metrics.replied },
            ].map((step) => {
              const pct = Math.max(8, Math.round((step.n / metrics.sent) * 100));
              return (
                <div key={step.label} className="min-w-[4.5rem] flex-1">
                  <div
                    className="rounded-sm bg-emerald-500/80"
                    style={{ height: `${Math.min(56, pct * 0.5)}px` }}
                  />
                  <p className="mt-1 text-[11px] font-medium text-zinc-800">
                    {step.n} <span className="font-normal text-zinc-500">{step.label}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_16rem]">
        <div>
          <div className="mb-2 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id || "all"}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium",
                  filter === f.id
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-[12px]">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2.5 py-2 font-medium">Customer</th>
                  <th className="px-2.5 py-2 font-medium">Channel</th>
                  <th className="px-2.5 py-2 font-medium">Status</th>
                  <th className="px-2.5 py-2 font-medium">Next</th>
                  <th className="px-2.5 py-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => {
                  const label =
                    r.full_name ||
                    [r.first_name, r.last_name].filter(Boolean).join(" ") ||
                    r.phone ||
                    r.email ||
                    "—";
                  const msg = r.latest_message;
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-zinc-50 hover:bg-zinc-50/80"
                      onClick={() => void openDrawer(r.id)}
                    >
                      <td className="px-2.5 py-1.5 font-medium text-zinc-900">{label}</td>
                      <td className="px-2.5 py-1.5 capitalize text-zinc-600">
                        {msg?.channel ?? "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-zinc-700">{msg?.status ?? r.status}</td>
                      <td className="px-2.5 py-1.5 text-[11px] text-zinc-500">
                        {msg?.status === "queued"
                          ? new Date(msg.scheduled_for).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-[11px] text-zinc-600">
                        {[
                          msg?.clicked_at ? "clicked" : null,
                          r.replied_at ? "replied" : null,
                          r.review_attribution
                            ? attributionDisplayLabel(r.review_attribution as AttributionLevel)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  );
                })}
                {!loading && recipients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2.5 py-8 text-center text-zinc-500">
                      No recipients for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-emerald-700 hover:underline"
              onClick={() => void load({ append: true, cursor: nextCursor })}
            >
              Load more
            </button>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Activity
          </p>
          <ul className="mt-2 max-h-[28rem] space-y-2 overflow-y-auto">
            {activity.map((a, i) => (
              <li key={`${a.at}-${a.type}-${i}`} className="text-[11px]">
                <p className="font-medium text-zinc-800">{a.label}</p>
                <p className="text-zinc-500">{new Date(a.at).toLocaleString()}</p>
                {a.meta && <p className="truncate text-zinc-400">{a.meta}</p>}
              </li>
            ))}
            {!activity.length && (
              <li className="text-[11px] text-zinc-500">No activity yet.</li>
            )}
          </ul>
        </div>
      </div>

      {showEnroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-zinc-900">Add contact manually</h2>
              <button
                type="button"
                className="text-[12px] text-zinc-500"
                onClick={() => setShowEnroll(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Uses the same enrollment engine as CSV and webhooks (consent, suppression, cooldown,
              duplicates).
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["firstName", "First name"],
                  ["lastName", "Last name"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-[12px] font-medium text-zinc-700">
                  {label}
                  <input
                    className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-[13px]"
                    value={enrollForm[key]}
                    onChange={(e) =>
                      setEnrollForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            {enrollResult ? (
              <p className="mt-2 text-[12px] text-emerald-700">{enrollResult}</p>
            ) : null}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px]"
                onClick={() => setShowEnroll(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  enrollBusy || (!enrollForm.phone.trim() && !enrollForm.email.trim())
                }
                onClick={() => void enrollManual()}
                className="inline-flex items-center gap-1 rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {enrollBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Enroll
              </button>
            </div>
          </div>
        </div>
      )}

      {drawerId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <button
            type="button"
            className="h-full flex-1"
            aria-label="Close"
            onClick={() => {
              setDrawerId(null);
              setDrawer(null);
            }}
          />
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-zinc-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-zinc-900">Recipient history</h2>
              <button
                type="button"
                className="text-[12px] text-zinc-500"
                onClick={() => {
                  setDrawerId(null);
                  setDrawer(null);
                }}
              >
                Close
              </button>
            </div>
            {drawerLoading && (
              <div className="mt-6 flex items-center gap-2 text-[12px] text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            )}
            {drawer && (
              <div className="mt-3 space-y-3 text-[12px]">
                {drawer.nextAction ? (
                  <p className="rounded-md bg-amber-50 px-2 py-1.5 text-amber-900">
                    Next: {String((drawer.nextAction as { channel: string }).channel)} ·{" "}
                    {new Date(
                      String((drawer.nextAction as { at: string }).at)
                    ).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-zinc-500">No next scheduled action.</p>
                )}
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">Messages</p>
                  <ul className="mt-1 space-y-2">
                    {(
                      (drawer.messages as Array<Record<string, unknown>>) ?? []
                    ).map((m) => (
                      <li key={String(m.id)} className="rounded border border-zinc-100 p-2">
                        <p className="font-medium capitalize text-zinc-800">
                          {String(m.channel)} · {String(m.status)}
                        </p>
                        {m.failed_reason ? (
                          <p
                            className={
                              String(m.failed_reason).startsWith("stopped:")
                                ? "text-zinc-500"
                                : "text-red-600"
                            }
                          >
                            {String(m.failed_reason).startsWith("stopped:")
                              ? `Stopped: ${String(m.failed_reason).replace(/^stopped:/, "").replace(/_/g, " ")}`
                              : `Failure: ${String(m.failed_reason)}`}
                          </p>
                        ) : null}
                        <p className="mt-1 whitespace-pre-wrap text-zinc-600">
                          {String(m.message_body ?? "").slice(0, 280)}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-400">
                          scheduled {m.scheduled_for ? new Date(String(m.scheduled_for)).toLocaleString() : "—"}
                          {m.sent_at ? ` · sent ${new Date(String(m.sent_at)).toLocaleString()}` : ""}
                          {m.delivered_at
                            ? ` · delivered ${new Date(String(m.delivered_at)).toLocaleString()}`
                            : ""}
                          {m.clicked_at
                            ? ` · clicked ${new Date(String(m.clicked_at)).toLocaleString()}`
                            : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">Clicks</p>
                  <ul className="mt-1 space-y-1">
                    {((drawer.clicks as Array<Record<string, unknown>>) ?? []).map((c) => (
                      <li key={String(c.id)} className="text-zinc-600">
                        {new Date(String(c.clicked_at)).toLocaleString()}
                      </li>
                    ))}
                    {!((drawer.clicks as unknown[]) ?? []).length && (
                      <li className="text-zinc-400">None</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">Replies</p>
                  <ul className="mt-1 space-y-2">
                    {(
                      (drawer.replies as Array<Record<string, unknown>>) ?? []
                    ).map((r) => (
                      <li key={String(r.id)} className="rounded border border-zinc-100 p-2">
                        <p className="font-medium capitalize text-zinc-800">
                          {String(r.channel)} ·{" "}
                          {r.created_at
                            ? new Date(String(r.created_at)).toLocaleString()
                            : "—"}
                        </p>
                        {r.from_address ? (
                          <p className="text-[10px] text-zinc-400">{String(r.from_address)}</p>
                        ) : null}
                        <p className="mt-1 whitespace-pre-wrap text-zinc-600">
                          {String(r.body ?? "").trim() || "(empty)"}
                        </p>
                      </li>
                    ))}
                    {!((drawer.replies as unknown[]) ?? []).length && (
                      <li className="text-zinc-400">
                        {(drawer.recipient as { replied_at?: string | null } | null)?.replied_at
                          ? "Reply recorded (body unavailable for this older event)."
                          : "None"}
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">
                    Review attribution
                  </p>
                  <ul className="mt-1 space-y-1">
                    {(
                      (drawer.attributions as Array<{ attribution_level: string; detected_at: string }>) ??
                      []
                    ).map((a, i) => (
                      <li key={i}>
                        {attributionDisplayLabel(a.attribution_level as AttributionLevel)} ·{" "}
                        {new Date(a.detected_at).toLocaleString()}
                      </li>
                    ))}
                    {!((drawer.attributions as unknown[]) ?? []).length && (
                      <li className="text-zinc-400">None detected</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ModulePage>
  );
}
