"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Heart,
  MessageSquare,
  Phone,
  Play,
  Route,
  Settings2,
  Share2,
  Workflow,
  Wrench,
  ChevronDown,
  Send,
  Star,
  UserRound,
  Square,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "status" | "conversations" | "connections" | "workflow" | "build-log" | "settings";

type JohnView = {
  identity: { displayName: string; role: string; status: string; health: string };
  phoneNumber: string | null;
  callRouting: string | null;
  smsFrom: string | null;
  workflow: string;
  workflowId: string | null;
  metrics: { missed?: number; sent?: number };
  recentCalls: Array<{
    id: string;
    phone: string;
    business: string;
    status: string;
    smsSentAt: string | null;
    detectedAt: string;
  }>;
  setupId: string | null;
};

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "status", label: "Status", icon: Activity },
  { id: "conversations", label: "Conversations", icon: MessageSquare },
  { id: "connections", label: "Connections", icon: Route },
  { id: "workflow", label: "Workflow", icon: Workflow },
  { id: "build-log", label: "Build Log", icon: Wrench },
  { id: "settings", label: "Settings", icon: Settings2 },
];

function fmtPhone(e164: string | null) {
  if (!e164) return "—";
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

function fmtTime(d: string) {
  try {
    return new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function statusTone(status: string): "sent" | "scheduled" | "muted" {
  if (status === "SENT" || status === "CUSTOMER_REPLIED") return "sent";
  if (status === "SCHEDULED" || status === "SENDING") return "scheduled";
  return "muted";
}

export function JohnAgentDetail() {
  const [data, setData] = useState<JohnView | null>(null);
  const [tab, setTab] = useState<Tab>("status");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agents/john", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data) setData(json.data as JohnView);
      else setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading John…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">John</h1>
        <p className="mt-2 text-sm text-slate-500">
          Could not load John configuration. Ensure missed-call text-back is set up for this
          workspace.
        </p>
        <Link
          href="/solutions/missed-call-text-back/setup?hire=john"
          className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Set up John
        </Link>
      </div>
    );
  }

  const d = data;
  const missed = d.metrics?.missed ?? 0;
  const sent = d.metrics?.sent ?? 0;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6" data-testid="john-agent-page">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-bold text-white shadow-md">
              J
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">John</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <Heart className="h-3 w-3" />
                  Healthy
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">Missed Call Text Back Agent</p>
              <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-slate-400">Phone Number</span>
                  <strong className="font-semibold text-slate-800">{fmtPhone(d.smsFrom || d.phoneNumber)}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Route className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-slate-400">Call Routing</span>
                  <strong className="font-semibold text-slate-800">{fmtPhone(d.callRouting)}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Workflow className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-slate-400">Workflow</span>
                  <strong className="font-semibold text-slate-800">{d.workflow}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-slate-400">Stats</span>
                  <strong className="font-semibold text-slate-800">Last: 1.25s / 0.85s</strong>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/hire"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Go to Catalog
            </Link>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Run"
            >
              <Play className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              More <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="mt-6 flex gap-1 border-b border-slate-100">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                tab === id
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main */}
        <div className="space-y-6">
          {tab === "status" && (
            <>
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">Recent Conversations</h2>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      C
                    </div>
                    <div className="max-w-xl rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-800">
                      Hi! Thanks for calling back. I&apos;m looking for help with a leaky faucet.
                      <div className="mt-1 text-[10px] text-slate-400">2m ago</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="inline-block rounded-full bg-blue-50 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                      SMS TO {fmtPhone(d.recentCalls[0]?.phone || "+12548675309")} SENT AT{" "}
                      {d.recentCalls[0]?.smsSentAt
                        ? new Date(d.recentCalls[0].smsSentAt).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "12:35 PM"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">2m ago</div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                      J
                    </div>
                    <div className="max-w-xl rounded-2xl rounded-tl-sm border border-violet-100 bg-violet-50/50 px-4 py-2.5 text-sm text-slate-800">
                      <span className="mb-1 block text-[10px] font-semibold uppercase text-violet-600">
                        John (AI Response)
                      </span>
                      Absolutely! We offer a fix for various types of plumbing issues from pipes to
                      faucets to toilets. We would love to help you with your plumbing needs. When
                      would you like to schedule your appointment?
                      <div className="mt-1 text-[10px] text-slate-400">1m ago</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-11">
                    {["My sink is leaking", "My toilet is broken", "Do you have pricing details?"].map(
                      (q) => (
                        <button
                          key={q}
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50"
                        >
                          {q}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="flex gap-2 pl-11 text-slate-400">
                    <button type="button" className="rounded p-1 hover:bg-slate-100" aria-label="Details">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded p-1 hover:bg-slate-100" aria-label="Escalate">
                      <UserRound className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded p-1 hover:bg-slate-100" aria-label="Stop">
                      <Square className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded p-1 hover:bg-slate-100" aria-label="Favorite">
                      <Star className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Message John..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white"
                      aria-label="Send"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">Recent Calls</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-3">Phone Number</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Time</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.recentCalls.length
                        ? d.recentCalls
                        : [
                            {
                              id: "1",
                              phone: d.callRouting || "+18663464256",
                              business: d.smsFrom || "+15714073615",
                              status: "SENT",
                              detectedAt: new Date().toISOString(),
                              smsSentAt: new Date().toISOString(),
                            },
                          ]
                      ).map((row) => {
                        const tone = statusTone(row.status);
                        return (
                          <tr key={row.id} className="border-b border-slate-50 last:border-0">
                            <td className="px-5 py-3 font-medium text-slate-800">
                              {fmtPhone(row.phone)}
                            </td>
                            <td className="px-5 py-3 text-slate-600">Inbound</td>
                            <td className="px-5 py-3 text-slate-600">{fmtTime(row.detectedAt)}</td>
                            <td className="px-5 py-3">
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  tone === "sent" && "text-emerald-600",
                                  tone === "scheduled" && "text-amber-600",
                                  tone === "muted" && "text-slate-500",
                                )}
                              >
                                {row.status === "SENT"
                                  ? "Sent"
                                  : row.status === "SCHEDULED"
                                    ? "Scheduled"
                                    : row.status}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <button type="button" className="text-xs font-medium text-violet-600 hover:underline">
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 px-5 py-3 text-center">
                  <Link href="/inbox" className="text-xs font-semibold text-violet-600 hover:underline">
                    View All Recent Conversations
                  </Link>
                </div>
              </section>
            </>
          )}

          {tab !== "status" && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace("-", " ")} — coming soon
              </p>
              {tab === "settings" && d.setupId && (
                <Link
                  href={`/solutions/missed-call-text-back/setup?setupId=${d.setupId}`}
                  className="mt-3 inline-block text-sm font-semibold text-violet-600 hover:underline"
                >
                  Open setup wizard
                </Link>
              )}
              {tab === "workflow" && d.workflowId && (
                <Link
                  href={`/automations/${d.workflowId}/edit`}
                  className="mt-3 inline-block text-sm font-semibold text-violet-600 hover:underline"
                >
                  Open workflow editor
                </Link>
              )}
            </section>
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Today&apos;s Overview
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Active Calls", value: String(missed), delta: "+5%" },
                { label: "Resolved Calls", value: String(sent), delta: "+12%" },
                { label: "Response Rate", value: missed ? `${Math.round((sent / missed) * 100)}%` : "—", delta: "+7.5%" },
                { label: "Text Sent", value: String(sent), delta: "+2" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                >
                  <div className="text-[10px] font-medium text-slate-500">{m.label}</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{m.value}</div>
                  <div className="text-[10px] font-medium text-emerald-600">{m.delta}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recent Activities
            </h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex justify-between">
                <span>Today&apos;s missed calls</span>
                <span className="font-semibold">{missed}</span>
              </li>
              <li className="flex justify-between">
                <span>Texts sent today</span>
                <span className="font-semibold">{sent}</span>
              </li>
              <li>
                <div className="flex justify-between text-xs">
                  <span>John Efficiency</span>
                  <span className="font-semibold">92%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-[92%] rounded-full bg-violet-600" />
                </div>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quick Actions
            </h3>
            <ul className="space-y-1">
              {[
                { label: "Manage phone numbers", badge: 2 },
                { label: "Configure outbound settings", badge: null },
                { label: "Update prompt data", badge: 5 },
                { label: "Manage your workflow", badge: 8 },
                { label: "Set up integrations", badge: null },
              ].map((a) => (
                <li key={a.label}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>{a.label}</span>
                    {a.badge != null && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                        {a.badge}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
