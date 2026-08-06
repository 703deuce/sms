"use client";

import Link from "next/link";
import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import { cn } from "@/lib/utils";

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800"
        : tone === "bad"
          ? "bg-rose-50 text-rose-700"
          : "bg-slate-100 text-slate-700";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", cls)}>
      {children}
    </span>
  );
}

export function AmyHomePanel({
  agent,
  attentionOpenCount,
  recommendations,
  latestActivity,
  pendingProposalCount,
  onTalk,
  onTest,
  onPauseResume,
  onEditSetup,
  onDuplicate,
  onOpenWork,
  onOpenAttention,
}: {
  agent: AppointmentBookingAgentView;
  attentionOpenCount: number;
  recommendations: string[];
  latestActivity: Array<{ callId: string; summary: string; outcome: string; startedAt: string }>;
  pendingProposalCount: number;
  onTalk: () => void;
  onTest: () => void;
  onPauseResume: () => void;
  onEditSetup: () => void;
  onDuplicate: () => void;
  onOpenWork: () => void;
  onOpenAttention: () => void;
}) {
  const today = agent.metrics.today;
  const statusTone =
    agent.identity.status === "active"
      ? "ok"
      : agent.identity.status === "degraded" || agent.identity.status === "needs_attention"
        ? "warn"
        : agent.identity.status === "paused" || agent.identity.status === "failed"
          ? "bad"
          : "neutral";

  const stats: Array<[string, string | number]> = [
    ["Calls answered", today?.callsAnswered ?? 0],
    ["Booking conversations", today?.bookingConversationsStarted ?? 0],
    ["Appointments booked", today?.appointmentsBooked ?? 0],
    ["Conversion", `${today?.bookingConversionRate ?? 0}%`],
    ["Transfers", today?.transfers ?? 0],
    ["Unresolved / abandoned", today?.abandonedBookingConversations ?? 0],
    ["Pending approvals", pendingProposalCount],
    ["Needs attention", attentionOpenCount],
  ];

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Operational headquarters</h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Live records for the last 24 hours · 7-day context in Results
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone={statusTone}>{agent.identity.status}</Pill>
          <Pill tone={agent.health.overall === "healthy" ? "ok" : "warn"}>
            Health: {agent.health.overall}
          </Pill>
          <Pill>{agent.autonomyMode || "balanced"} autonomy</Pill>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[11px] uppercase text-slate-400">Number</dt>
          <dd className="mt-1 font-semibold">{agent.resources.numberLabel}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[11px] uppercase text-slate-400">Calendar</dt>
          <dd className="mt-1 font-semibold">{agent.resources.calendarLabel}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[11px] uppercase text-slate-400">Location</dt>
          <dd className="mt-1 font-semibold">{agent.resources.locationLabel}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[11px] uppercase text-slate-400">Live version</dt>
          <dd className="mt-1 font-semibold">
            {agent.versions.find((v) => v.id === agent.currentVersionId)
              ? `v${agent.versions.find((v) => v.id === agent.currentVersionId)!.version}`
              : "—"}
          </dd>
        </div>
      </dl>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Today</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([l, v]) => (
            <div key={l} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{l}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTalk}
          className="min-h-10 rounded-lg bg-violet-600 px-3 py-2 text-[12px] font-semibold text-white"
        >
          Talk to {agent.identity.displayName}
        </button>
        <button
          type="button"
          onClick={onTest}
          className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold"
        >
          Test Amy
        </button>
        <button
          type="button"
          onClick={onPauseResume}
          className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold"
        >
          {agent.identity.status === "paused" ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={onEditSetup}
          className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold"
        >
          Edit setup
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold"
        >
          Duplicate Amy
        </button>
      </div>

      {(agent.readiness?.blockers || []).length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Warnings & failures</h3>
          {(agent.readiness?.blockers || []).slice(0, 6).map((b) => (
            <div
              key={b.code}
              className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm"
            >
              <p className="font-medium">{b.message}</p>
              <p className="mt-1 text-[12px] text-slate-600">
                Impact: {b.affectedFunctionality}. {b.recommendedAction}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          No readiness blockers — {agent.readiness?.label || agent.health.overall}.
        </p>
      )}

      {recommendations.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Recommendations</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {recommendations.map((r) => (
              <li key={r} className="rounded-xl bg-slate-50 px-4 py-3">
                {r}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Latest activity</h3>
          <button
            type="button"
            onClick={onOpenWork}
            className="text-[12px] font-semibold text-violet-700"
          >
            Open Work
          </button>
        </div>
        {latestActivity.length === 0 ? (
          <p className="text-sm text-slate-500">No calls yet.</p>
        ) : (
          latestActivity.slice(0, 5).map((t) => (
            <div
              key={t.callId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{t.summary}</p>
                <p className="text-[12px] text-slate-500">
                  {new Date(t.startedAt).toLocaleString()} · {t.outcome.replaceAll("_", " ")}
                </p>
              </div>
              <Link href={`/voice/calls/${t.callId}`} className="font-semibold text-violet-700">
                Evidence
              </Link>
            </div>
          ))
        )}
        {attentionOpenCount > 0 ? (
          <button
            type="button"
            onClick={onOpenAttention}
            className="text-[12px] font-semibold text-amber-800"
          >
            {attentionOpenCount} attention item(s) →
          </button>
        ) : null}
      </div>
    </div>
  );
}
