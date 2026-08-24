"use client";

import { BusinessCallBackButton } from "@/components/smart-routing/business-call-back-button";
import {
  SrBackLink,
  SrOutlineButton,
  SrPageShell,
  SrStatusBadge,
  srCard,
} from "@/components/smart-routing/shared";
import { fmtDurationMmSs, fmtPhoneDisplay, fmtRelativeTime } from "@/lib/smart-routing/display";
import { formatRoutingOutcome } from "@/lib/smart-routing/outcome-labels";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Phone,
  Search,
  Voicemail,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductCrossSellBanner } from "@/components/products/product-cross-sell-banner";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";

type Session = {
  id: string;
  callerNumber: string;
  startedAt: string;
  menuSelection?: string | null;
  finalOutcome?: string | null;
  smsTriggered: boolean;
  isTest: boolean;
  recordingUrl?: string | null;
  completedAt?: string | null;
};

type TimelineEvent = {
  at: string;
  label: string;
  detail?: string;
  kind: string;
};

type Flow = {
  id: string;
  name: string;
  status: string;
};

const OUTCOME_FILTERS = [
  { id: "all", label: "All" },
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Outgoing" },
  { id: "connected", label: "Connected" },
  { id: "voicemail", label: "Voicemail" },
  { id: "text", label: "Text Requested" },
  { id: "ai", label: "AI Handoff" },
  { id: "failures", label: "Failures" },
] as const;

type OutboundCall = {
  id: string;
  employeePhoneE164: string;
  destinationE164: string;
  businessCallerIdE164: string | null;
  durationSeconds: number | null;
  result: string | null;
  createdAt: string;
  authorizedCaller?: { name: string } | null;
};

function outcomeBadge(outcome: string | null | undefined, sms: boolean) {
  if (sms) return { status: "text_requested", label: "Text Requested" };
  if (!outcome) return { status: "draft", label: "In progress" };
  if (outcome === "connected") return { status: "connected", label: "Connected" };
  if (outcome === "voicemail") return { status: "voicemail", label: "Voicemail" };
  if (outcome.includes("ai")) return { status: "ai_handoff", label: "AI Handoff" };
  if (outcome.includes("error") || outcome.includes("failed"))
    return { status: "needs_attention", label: "Failed" };
  return { status: "draft", label: formatRoutingOutcome(outcome) };
}

export function SmartRoutingActivityView({ flowId }: { flowId: string }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [outboundCalls, setOutboundCalls] = useState<OutboundCall[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<typeof OUTCOME_FILTERS[number]["id"]>("all");
  const [productFeatures, setProductFeatures] = useState<WorkspaceFeatureSnapshot | null>(null);

  const load = useCallback(() => {
    fetch(`/api/smart-routing/flows/${flowId}`)
      .then((r) => r.json())
      .then((j) => setFlow(j.data));
    fetch(`/api/smart-routing/flows/${flowId}/activity`)
      .then((r) => r.json())
      .then((j) => {
        const list = j.data ?? [];
        setSessions(list);
        setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      });
  }, [flowId]);

  useEffect(() => {
    load();
    fetch("/api/platform/features")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setProductFeatures(j.data as WorkspaceFeatureSnapshot);
          if (isActiveEntitlement(j.data.smart_routing)) {
            fetch("/api/smart-routing/outbound-calls?limit=30")
              .then((r) => r.json())
              .then((out) => setOutboundCalls(out.data ?? []))
              .catch(() => setOutboundCalls([]));
          } else {
            setOutboundCalls([]);
          }
        }
      })
      .catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/smart-routing/sessions/${selectedId}`)
      .then((r) => r.json())
      .then((j) => setTimeline(j.data?.timeline ?? []));
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (filter === "outgoing") return [];
    return sessions.filter((s) => {
      if (filter === "incoming" && s.isTest) return false;
      if (filter === "connected" && s.finalOutcome !== "connected") return false;
      if (filter === "voicemail" && s.finalOutcome !== "voicemail") return false;
      if (filter === "text" && !s.smsTriggered) return false;
      if (filter === "ai" && !s.finalOutcome?.includes("ai")) return false;
      if (
        filter === "failures" &&
        !["routing_error", "transfer_failed"].includes(s.finalOutcome ?? "")
      )
        return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.callerNumber.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, filter, search]);

  const filteredOutbound = useMemo(() => {
    if (filter !== "all" && filter !== "outgoing") return [];
    return outboundCalls.filter((o) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !o.destinationE164.includes(q) &&
          !o.employeePhoneE164.includes(q)
        )
          return false;
      }
      return true;
    });
  }, [outboundCalls, filter, search]);

  const metrics = useMemo(() => {
    const connected = sessions.filter((s) => s.finalOutcome === "connected").length;
    const vm = sessions.filter((s) => s.finalOutcome === "voicemail").length;
    const text = sessions.filter((s) => s.smsTriggered).length;
    const ai = sessions.filter((s) => s.finalOutcome?.includes("ai")).length;
    const failures = sessions.filter((s) =>
      ["routing_error", "transfer_failed"].includes(s.finalOutcome ?? ""),
    ).length;
    return {
      handled: sessions.length,
      connected,
      voicemails: vm,
      text,
      ai,
      failures,
    };
  }, [sessions]);

  const selected = sessions.find((s) => s.id === selectedId);
  const durationSec = selected?.completedAt
    ? Math.round(
        (new Date(selected.completedAt).getTime() -
          new Date(selected.startedAt).getTime()) /
          1000,
      )
    : null;

  return (
    <SrPageShell className="max-w-[1400px]">
      <SrBackLink />

      {productFeatures ? (
        <ProductCrossSellBanner
          feature="mctb"
          features={productFeatures}
          title="Recover unanswered routed calls with Missed Call Text Back"
          description="When a routed call goes unanswered, automatically text the caller back and start a two-way conversation."
          cta="Try Missed Call Text Back"
          href="/settings/billing"
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#111827]">Flow Activity & Diagnostics</h1>
          <p className="mt-1 text-[14px] text-[#6b7280]">
            See what happened on routed calls — menu selections, destinations, outcomes, and the full
            event timeline.
          </p>
          {flow ? (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#111827]">{flow.name}</span>
              <SrStatusBadge status={flow.status} />
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <SrOutlineButton>Export Activity</SrOutlineButton>
          <Link href={`/smart-routing/${flowId}`}>
            <SrOutlineButton>
              <ExternalLink className="h-4 w-4" />
              Open Call Flow
            </SrOutlineButton>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Calls Handled", value: metrics.handled, icon: Phone, color: "text-[#6366f1]" },
          { label: "Connected", value: metrics.connected, icon: CheckCircle, color: "text-emerald-600" },
          { label: "Voicemails", value: metrics.voicemails, icon: Voicemail, color: "text-violet-600" },
          { label: "Text Requested", value: metrics.text, icon: MessageSquare, color: "text-sky-600" },
          { label: "AI Handoffs", value: metrics.ai, icon: Bot, color: "text-[#6366f1]" },
          { label: "Failures", value: metrics.failures, icon: AlertTriangle, color: "text-red-600" },
        ].map((m) => (
          <div key={m.label} className={cn(srCard, "p-4")}>
            <m.icon className={cn("h-5 w-5", m.color)} />
            <p className="mt-2 text-[11px] font-medium text-[#6b7280]">{m.label}</p>
            <p className="text-[22px] font-bold text-[#111827]">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className={cn(srCard, "overflow-hidden")}>
          <div className="border-b border-[#e5e7eb] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#111827]">Recent Call Activity</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search caller, number, or destination…"
                  className="w-full rounded-lg border border-[#e5e7eb] py-2 pl-9 pr-3 text-[13px] focus:border-[#6366f1] focus:outline-none"
                />
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] px-3 py-2 text-[12px] text-[#6b7280]"
              >
                <Calendar className="h-3.5 w-3.5" />
                Last 7 Days
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {OUTCOME_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                    filter === f.id ? "bg-[#6366f1] text-white" : "text-[#6b7280] hover:bg-[#f3f4f6]",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-[12px]">
              <thead className="bg-[#f9fafb] text-[10px] font-semibold uppercase text-[#6b7280]">
                <tr>
                  <th className="px-5 py-3">Caller</th>
                  <th className="px-3 py-3">Date / Time</th>
                  <th className="px-3 py-3">Menu</th>
                  <th className="px-3 py-3">Outcome</th>
                  <th className="px-3 py-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {filteredOutbound.map((o) => (
                  <tr key={`out-${o.id}`} className="bg-[#fafafa]">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[#111827]">Business callback</p>
                      <p className="text-[11px] text-[#6b7280]">
                        {o.authorizedCaller?.name ?? fmtPhoneDisplay(o.employeePhoneE164)} →{" "}
                        {fmtPhoneDisplay(o.destinationE164)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-[#6b7280]">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-[#6b7280]">Outbound</td>
                    <td className="px-3 py-3">
                      <span className="text-[11px] text-[#6b7280]">
                        Caller ID: {fmtPhoneDisplay(o.businessCallerIdE164 || "")}
                      </span>
                    </td>
                    <td className="px-3 py-3">{fmtDurationMmSs(o.durationSeconds)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && filteredOutbound.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#6b7280]">
                      No calls yet for this flow.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const badge = outcomeBadge(s.finalOutcome, s.smsTriggered);
                    const dur = s.completedAt
                      ? Math.round(
                          (new Date(s.completedAt).getTime() -
                            new Date(s.startedAt).getTime()) /
                            1000,
                        )
                      : null;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedId(s.id)}
                        className={cn(
                          "cursor-pointer hover:bg-[#f9fafb]",
                          selectedId === s.id && "bg-[#eef2ff]/70",
                        )}
                      >
                        <td className="px-5 py-3 font-semibold text-[#111827]">
                          {fmtPhoneDisplay(s.callerNumber)}
                        </td>
                        <td className="px-3 py-3 text-[#6b7280]">
                          {new Date(s.startedAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-3">
                          {s.menuSelection ? `Press ${s.menuSelection}` : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <SrStatusBadge status={badge.status} />
                        </td>
                        <td className="px-3 py-3">{fmtDurationMmSs(dur)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <div className={cn(srCard, "p-5")}>
              <p className="text-[14px] font-bold text-[#111827]">
                {fmtPhoneDisplay(selected.callerNumber)}
              </p>
              <SrStatusBadge
                status={outcomeBadge(selected.finalOutcome, selected.smsTriggered).status}
                className="mt-2"
              />
              <dl className="mt-4 space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Menu Path</dt>
                  <dd>{selected.menuSelection ? `Press ${selected.menuSelection}` : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Connected</dt>
                  <dd>{selected.finalOutcome === "connected" ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">SMS Sent</dt>
                  <dd>{selected.smsTriggered ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Duration</dt>
                  <dd>{fmtDurationMmSs(durationSec)}</dd>
                </div>
              </dl>
              <div className="mt-4 space-y-3">
                <BusinessCallBackButton
                  destinationE164={selected.callerNumber}
                  contextType="last_call"
                  contextRefId={selected.id}
                />
                <button
                  type="button"
                  className="text-[12px] font-semibold text-red-700 hover:underline"
                  onClick={() =>
                    void fetch("/api/smart-routing/blocked-callers", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ callerE164: selected.callerNumber }),
                    })
                  }
                >
                  Block caller
                </button>
              </div>
              <Link
                href={`/voice/calls`}
                className="mt-4 block text-[12px] font-semibold text-[#6366f1] hover:underline"
              >
                Open full call log
              </Link>
            </div>
          ) : null}

          <div className={cn(srCard, "p-5")}>
            <h2 className="text-[14px] font-bold text-[#111827]">Event Timeline</h2>
            {!selectedId ? (
              <p className="mt-3 text-[12px] text-[#6b7280]">Select a call to view timeline.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {timeline.map((ev, i) => (
                  <li key={i} className="flex gap-3 text-[11px]">
                    <span className="shrink-0 text-[#9ca3af]">
                      {new Date(ev.at).toLocaleTimeString()}
                    </span>
                    <span className="text-[#374151]">{ev.label}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[15px] font-bold text-[#111827]">Activity Insights</h2>
          <ul className="mt-3 space-y-2 text-[12px] text-[#374151]">
            <li>{metrics.text} calls requested a text-back follow-up.</li>
            <li>{metrics.failures} calls hit routing failures this period.</li>
            <li>{metrics.connected} calls were answered by your team.</li>
          </ul>
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-[#6b7280]">Outcome Distribution</p>
            <div className="mt-2 space-y-2">
              {[
                { label: "Connected", value: metrics.connected, color: "bg-emerald-500" },
                { label: "Voicemail", value: metrics.voicemails, color: "bg-violet-500" },
                { label: "Text", value: metrics.text, color: "bg-sky-500" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="w-20 text-[11px] text-[#6b7280]">{row.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-[#f3f4f6]">
                    <div
                      className={cn("h-full rounded-full", row.color)}
                      style={{
                        width:
                          metrics.handled > 0
                            ? `${Math.round((row.value / metrics.handled) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-[#6b7280]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
          <Link
            href={`/smart-routing/${flowId}/activity`}
            className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[#6366f1]"
          >
            View detailed analytics <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[15px] font-bold text-[#111827]">Failure Diagnostics</h2>
          <ul className="mt-3 space-y-2 text-[12px] text-[#374151]">
            {metrics.failures > 0 ? (
              <li className="flex gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {metrics.failures} calls reached fallback or transfer failure.
              </li>
            ) : (
              <li className="flex gap-2 text-emerald-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                No provider outages detected.
              </li>
            )}
          </ul>
          <div className="mt-4 flex flex-wrap gap-4 text-[12px] font-semibold text-[#6366f1]">
            <Link href={`/smart-routing/${flowId}`}>Edit Fallback Rules</Link>
            <Link href={`/smart-routing/${flowId}`}>Review Destinations</Link>
            <Link href={`/smart-routing/${flowId}/test`}>Preview Call Flow</Link>
          </div>
        </div>
      </div>
    </SrPageShell>
  );
}
