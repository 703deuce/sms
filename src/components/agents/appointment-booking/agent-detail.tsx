"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import { cn } from "@/lib/utils";

type TabId =
  | "home"
  | "overview"
  | "talk"
  | "setup"
  | "workflows"
  | "test"
  | "activity"
  | "results"
  | "health"
  | "memory"
  | "attention"
  | "autonomy"
  | "versions";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "overview", label: "Overview" },
  { id: "talk", label: "Talk" },
  { id: "setup", label: "Setup" },
  { id: "workflows", label: "Workflows" },
  { id: "test", label: "Test" },
  { id: "activity", label: "Activity" },
  { id: "results", label: "Results" },
  { id: "health", label: "Health" },
  { id: "memory", label: "Memory" },
  { id: "attention", label: "Attention" },
  { id: "autonomy", label: "Autonomy" },
  { id: "versions", label: "Versions" },
];

const SUGGESTED = [
  "Explain your setup",
  "Which number are you assigned to?",
  "Which calendar do you use?",
  "How many appointments did you book this week?",
  "Show recent failures",
  "Change the minimum notice to four hours",
  "Create an after-hours emergency workflow draft",
  "What is your health status?",
];

function HealthBadge({ overall }: { overall: string }) {
  const tone =
    overall === "healthy"
      ? "bg-emerald-50 text-emerald-700"
      : overall === "degraded" || overall === "warning"
        ? "bg-amber-50 text-amber-800"
        : overall === "failed"
          ? "bg-rose-50 text-rose-700"
          : "bg-slate-100 text-slate-600";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize", tone)}>
      {overall.replaceAll("_", " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-700">
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function AppointmentAgentDetail({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<AppointmentBookingAgentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("home");
  const [activity, setActivity] = useState<unknown[]>([]);
  const [proposals, setProposals] = useState<unknown[]>([]);
  const [workflowDrafts, setWorkflowDrafts] = useState<unknown[]>([]);
  const [chat, setChat] = useState<
    Array<{
      role: "user" | "agent";
      text: string;
      evidence?: Array<{ label: string; href?: string; kind: string }>;
      workingStatus?: string;
    }>
  >([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);
  const [attention, setAttention] = useState<{ items?: unknown[]; openCount?: number } | null>(null);
  const [memory, setMemory] = useState<Record<string, unknown> | null>(null);
  const [autonomy, setAutonomy] = useState<Record<string, unknown> | null>(null);
  const [timeline, setTimeline] = useState<unknown[] | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [testSuite, setTestSuite] = useState<{
    results?: Array<{
      scenarioId: string;
      name: string;
      status: string;
      expectedTools?: string[];
      callerScript?: string[];
      note?: string;
      failureReason?: string | null;
    }>;
    summary?: { total: number; passed: number; pending: number; failed: number };
  } | null>(null);
  const [mctbHandoff, setMctbHandoff] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setAgent(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runCommand = useCallback(
    async (command: string, payload?: Record<string, unknown>) => {
      const res = await fetch(`/api/agents/${agentId}/control`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command, payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Command failed (${res.status})`);
      return json.data;
    },
    [agentId],
  );

  useEffect(() => {
    if (tab !== "activity" || !agent) return;
    void (async () => {
      try {
        const data = await runCommand("search_agent_activity", { limit: 20 });
        setActivity(data.traces || []);
      } catch {
        setActivity([]);
      }
    })();
  }, [tab, agent, runCommand]);

  useEffect(() => {
    if (
      tab !== "versions" &&
      tab !== "workflows" &&
      tab !== "setup" &&
      tab !== "test" &&
      tab !== "attention" &&
      tab !== "memory" &&
      tab !== "autonomy" &&
      tab !== "home" &&
      tab !== "activity"
    ) {
      return;
    }
    if (!agent) return;
    void (async () => {
      try {
        if (tab === "versions" || tab === "workflows" || tab === "home") {
          const data = await runCommand("list_change_proposals");
          setProposals(data.proposals || []);
        }
        if (tab === "workflows") {
          const data = await runCommand("list_workflow_drafts");
          setWorkflowDrafts(data.drafts || []);
        }
        if (tab === "setup") {
          const data = await runCommand("get_missed_call_handoff");
          setMctbHandoff((data.handoff as Record<string, unknown>) || null);
        }
        if (tab === "test") {
          const data = await runCommand("run_agent_test_suite");
          setTestSuite(data);
        }
        if (tab === "attention" || tab === "home") {
          const data = await runCommand("get_attention_inbox");
          setAttention(data);
        }
        if (tab === "memory") {
          const data = await runCommand("get_memory_view");
          setMemory(data);
        }
        if (tab === "autonomy") {
          const data = await runCommand("get_autonomy_policy");
          setAutonomy(data);
        }
        if (tab === "activity") {
          const data = await runCommand("search_agent_activity", { limit: 20 });
          setActivity(data.traces || []);
        }
      } catch {
        /* ignore load errors for optional panels */
      }
    })();
  }, [tab, agent, runCommand]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setChatStatus("Searching configuration, activity, and tools…");
    setChat((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    try {
      const data = await runCommand("owner_ask", { question: q });
      setChat((prev) => [
        ...prev,
        {
          role: "agent",
          text: String(data.answer || "No answer returned."),
          evidence: Array.isArray(data.evidence) ? data.evidence : undefined,
          workingStatus: data.workingStatus ? String(data.workingStatus) : undefined,
        },
      ]);
      if (data.proposalId) setPendingProposalId(String(data.proposalId));
      if (data.requiresConfirmation) setTab("versions");
    } catch (err) {
      setChat((prev) => [
        ...prev,
        {
          role: "agent",
          text: err instanceof Error ? err.message : "Request failed",
        },
      ]);
    } finally {
      setChatStatus(null);
      setBusy(false);
    }
  };

  const pauseOrResume = async () => {
    if (!agent) return;
    setBusy(true);
    try {
      const command =
        agent.identity.status === "paused" ? "resume_agent" : "pause_agent";
      await runCommand(command);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const displayName = useMemo(
    () => agent?.identity.displayName || "Appointment Booking Agent",
    [agent],
  );

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading agent…</div>;
  }
  if (error || !agent) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-rose-600">{error || "Agent not found"}</p>
        <Link href="/agents" className="text-sm font-medium text-blue-600">
          Back to Your Team
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
              {agent.identity.roleLabel || "Appointment Booking Agent"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {agent.identity.name}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{displayName}</p>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {agent.identity.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={agent.identity.status} />
              <HealthBadge overall={agent.health.overall} />
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {agent.readiness?.label || agent.health.overall}
              </span>
              <span className="text-[12px] text-slate-500">
                Main number: {agent.resources.numberLabel}
              </span>
              <span className="text-[12px] text-slate-500">
                Location: {agent.resources.locationLabel}
              </span>
              <span className="text-[12px] text-slate-500">
                Calendar: {agent.resources.calendarLabel}
              </span>
              {agent.currentVersionId ? (
                <span className="text-[12px] text-slate-500">
                  Current version: v
                  {agent.versions.find((v) => v.id === agent.currentVersionId)?.version ??
                    "—"}
                </span>
              ) : null}
              <span className="text-[12px] text-slate-500 capitalize">
                Autonomy: {agent.autonomyMode || "balanced"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void pauseOrResume()}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              {agent.identity.status === "paused" ? "Resume" : "Pause"}
            </button>
            <Link
              href={`/voice/agents/${agent.voiceAgentId}`}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open builder
            </Link>
            <button
              type="button"
              onClick={() => setTab("talk")}
              className="min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
            >
              Talk to {agent.identity.name}
            </button>
            <button
              type="button"
              onClick={() => setTab("test")}
              className="min-h-10 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-500"
            >
              Test {agent.identity.name}
            </button>
            <button
              type="button"
              onClick={() => setTab("setup")}
              className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit setup
            </button>
            <button
              type="button"
              onClick={() => setTab("workflows")}
              className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              View current workflow
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    const result = await runCommand("duplicate_agent", {
                      confirm: true,
                      name: `${agent.identity.name} — copy`,
                    });
                    if (result?.href) window.location.href = String(result.href);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy(false);
                  }
                })()
              }
              className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Create another {agent.identity.name}
            </button>
          </div>
        </div>
      </header>

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-t-lg px-3 py-2 text-[12px] font-semibold",
              tab === t.id
                ? "bg-white text-slate-900 ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {tab === "home" ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Operational summary</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {[
                  ["Calls answered today", agent.metrics.callsAnswered],
                  ["Booking conversations", agent.metrics.bookingConversationsStarted],
                  ["Appointments booked", agent.metrics.appointmentsBooked],
                  ["Booking conversion", `${agent.metrics.bookingConversionRate}%`],
                  ["Transfers", agent.metrics.transfers],
                  ["Unresolved failures", agent.metrics.bookingFailures + agent.metrics.calendarFailures],
                  ["Pending approvals", attention?.openCount ?? "—"],
                  ["Health warnings", (agent.readiness?.blockers || []).length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            {(agent.readiness?.blockers || []).length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
                {(agent.readiness?.blockers || []).map((b) => (
                  <div
                    key={b.code}
                    className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-slate-900">{b.message}</p>
                    <p className="mt-1 text-[12px] text-slate-600">
                      {b.affectedFunctionality}. {b.recommendedAction}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                No readiness blockers — {agent.readiness?.label || "status unknown"}.
              </p>
            )}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Recommended actions</h2>
              {(attention?.items as Array<{ id: string; title: string; recommendedAction: string; href?: string; askAmyPrompt?: string }> | undefined)?.length ? (
                (attention!.items as Array<{ id: string; title: string; recommendedAction: string; href?: string; askAmyPrompt?: string }>).slice(0, 6).map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="text-[12px] text-slate-600">{item.recommendedAction}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.href ? (
                        <Link href={item.href} className="text-[12px] font-semibold text-blue-600">
                          Open
                        </Link>
                      ) : null}
                      {item.askAmyPrompt ? (
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-slate-700"
                          onClick={() => {
                            setTab("talk");
                            void ask(item.askAmyPrompt!);
                          }}
                        >
                          Ask {agent.identity.name}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No recommended actions right now.</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">How {agent.identity.name} runs after activation</p>
              <p className="mt-1 text-[12px] text-slate-600">
                Caller dials her number → Telnyx answers with the published assistant → booking
                tools hit your calendar (with slot holds) → outcomes and traces show here.
                Tell her what to change in Talk → confirm → she republishes to the live line.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Last deployment</h2>
              <p className="mt-1 text-sm text-slate-600">
                {agent.versions.find((v) => v.id === agent.currentVersionId)
                  ? `v${agent.versions.find((v) => v.id === agent.currentVersionId)!.version} · ${new Date(agent.versions.find((v) => v.id === agent.currentVersionId)!.publishedAt).toLocaleString()}`
                  : "No published version yet"}
              </p>
            </div>
          </div>
        ) : null}

        {tab === "overview" ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">What {agent.identity.name} does</h2>
              <p className="mt-2 text-sm text-slate-600">
                Answers calls, collects booking details, checks real availability, confirms
                with the caller, creates the appointment, and can send confirmation texts.
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Readiness</dt>
                  <dd className="font-medium capitalize">{agent.health.overall}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Number</dt>
                  <dd className="font-medium">{agent.resources.numberLabel}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Calendar</dt>
                  <dd className="font-medium">{agent.resources.calendarLabel}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Workflow</dt>
                  <dd className="font-medium">{agent.resources.workflowLabel}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">This week</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  ["Calls answered", agent.metrics.callsAnswered],
                  ["Appointments booked", agent.metrics.appointmentsBooked],
                  ["Conversion", `${agent.metrics.bookingConversionRate}%`],
                  ["Transfers", agent.metrics.transfers],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              {agent.health.overall !== "healthy" ? (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Warning: {agent.health.calendar.message}. Open the Health tab for full
                  dependency status.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "talk" ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Ask {agent.identity.name} about live setup, logs, health, and metrics. Answers use
              tools — {agent.identity.pronouns?.subject || "she"} will not invent missing data.
            </p>
            {chatStatus ? (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
                {chatStatus}
              </p>
            ) : null}
            {pendingProposalId ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  Draft change waiting — not on the phone line yet
                </p>
                <p className="mt-1 text-[12px] text-slate-600">
                  Proposal {pendingProposalId.slice(0, 10)}… Confirm to publish to callers, or say
                  “yes, put it live” in chat.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-[12px] font-semibold text-white"
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      try {
                        await runCommand("confirm_change_proposal", {
                          proposalId: pendingProposalId,
                          confirm: true,
                          publish: true,
                        });
                        setPendingProposalId(null);
                        setChat((prev) => [
                          ...prev,
                          {
                            role: "agent",
                            text: "Change is live on the phone line now.",
                          },
                        ]);
                        await load();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  Put change live
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(s)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4">
              {chat.length === 0 ? (
                <p className="text-sm text-slate-500">No messages yet.</p>
              ) : (
                chat.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={cn(
                      "max-w-[90%] rounded-xl px-3 py-2 text-sm",
                      m.role === "user"
                        ? "ml-auto bg-slate-900 text-white"
                        : "bg-white text-slate-800 ring-1 ring-slate-200",
                    )}
                  >
                    <p>{m.text}</p>
                    {m.evidence?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.evidence.map((ev) =>
                          ev.href ? (
                            <Link
                              key={`${ev.label}-${ev.href}`}
                              href={ev.href}
                              className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-blue-700"
                            >
                              {ev.label}
                            </Link>
                          ) : (
                            <span
                              key={ev.label}
                              className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
                            >
                              {ev.label}
                            </span>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`Ask ${agent.identity.name}…`}
                className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        ) : null}

        {tab === "setup" ? (
          <div className="grid gap-6 md:grid-cols-2">
            <SetupBlock title="Business" body={agent.businessBrain.businessName} />
            <SetupBlock title="Number" body={agent.resources.numberLabel} />
            <SetupBlock title="Voice" body={agent.profile.voiceSummary || "Configured in builder"} />
            <SetupBlock
              title="Hours / timezone"
              body={`${agent.profile.timezone}${agent.businessBrain.businessHoursSummary ? ` · ${agent.businessBrain.businessHoursSummary}` : ""}`}
            />
            <SetupBlock
              title="Services"
              body={
                agent.bookingPolicy.allowedServices.join(", ") ||
                agent.businessBrain.services.map((s) => s.name).join(", ") ||
                "None configured"
              }
            />
            <SetupBlock
              title="Booking rules"
              body={`Min notice ${agent.bookingPolicy.minimumNoticeMinutes}m · Duration ${agent.bookingPolicy.appointmentDurationMinutes}m · Mode ${agent.bookingPolicy.bookingMode} · Confirm ${agent.bookingPolicy.requireFinalConfirmation ? "required" : "optional"} · SMS ${agent.bookingPolicy.sendSmsConfirmation ? "on" : "off"}`}
            />
            <SetupBlock title="Calendar" body={agent.resources.calendarLabel} />
            <SetupBlock
              title="Transfers"
              body={agent.profile.transferPolicySummary || "Not configured"}
            />
            <SetupBlock
              title="Permissions"
              body={`Book ${agent.bookingPolicy.canBook ? "yes" : "no"} · Reschedule ${agent.bookingPolicy.canReschedule ? "yes" : "no"} · Cancel ${agent.bookingPolicy.canCancel ? "yes" : "no"}`}
            />
            <div className="md:col-span-2 space-y-3 rounded-xl border border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Shared business brain</p>
              <p className="text-[12px] text-slate-600">
                {agent.businessBrain.knowledgeFacts.length} approved fact(s). Website imports
                stay pending until you approve them.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      await runCommand("approve_knowledge_facts", {
                        approveAllPending: true,
                      });
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700"
              >
                Approve pending website imports
              </button>
            </div>
            <div className="md:col-span-2 space-y-3 rounded-xl border border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Missed-call text-back handoff</p>
              <p className="text-[12px] text-slate-600">
                {mctbHandoff
                  ? `Attached · flow ${String((mctbHandoff as { flowId?: string }).flowId || "—")}`
                  : "Not attached — missed calls will not get an SMS follow-up yet."}
              </p>
              <button
                type="button"
                disabled={busy || !agent.phoneNumberIds[0]}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      const data = await runCommand("attach_missed_call_text_back", {
                        activate: true,
                        phoneNumberId: agent.phoneNumberIds[0],
                      });
                      setMctbHandoff(data);
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                Attach missed-call text-back
              </button>
            </div>
            <div className="md:col-span-2">
              <Link
                href={
                  agent.solutionSetupId
                    ? `/solutions/ai-call-handling/appointment-assistant/setup?setupId=${agent.solutionSetupId}`
                    : `/voice/agents/${agent.voiceAgentId}`
                }
                className="text-sm font-semibold text-blue-600"
              >
                Edit in wizard / builder →
              </Link>
            </div>
          </div>
        ) : null}

        {tab === "workflows" ? (
          <div className="space-y-4 text-sm">
            <p>
              Primary workflow:{" "}
              <span className="font-semibold">{agent.resources.workflowLabel}</span>
            </p>
            <p className="text-slate-600">
              Live phone conversations run on Telnyx with Amy’s booking tools (availability,
              hold, book, verify). Automation workflows own inbound routing, post-call SMS,
              and around-the-call steps — they do not replace turn-by-turn speech.
              The Workflow Architect drafts approved node graphs only; promote after tests.
            </p>
            {agent.primaryFlowId ? (
              <Link
                href={`/automations/${agent.primaryFlowId}/edit`}
                className="inline-flex font-semibold text-blue-600"
              >
                Open live workflow builder →
              </Link>
            ) : (
              <p className="text-amber-700">No primary workflow linked.</p>
            )}
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-semibold text-slate-900">Architect drafts</h3>
              {workflowDrafts.length === 0 ? (
                <p className="text-slate-500">
                  No drafts yet. Ask {agent.identity.name}: “Create an after-hours emergency workflow draft”.
                </p>
              ) : (
                (
                  workflowDrafts as Array<{
                    id: string;
                    name: string;
                    validationStatus: string;
                    status: string;
                    validationErrors: Array<{ message: string }>;
                    nodes: unknown[];
                  }>
                ).map((d) => (
                  <div key={d.id} className="rounded-xl border border-slate-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{d.name}</p>
                      <span className="text-[11px] capitalize text-slate-500">
                        {d.validationStatus} · {d.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {d.nodes?.length || 0} nodes · id {d.id.slice(0, 10)}…
                    </p>
                    {d.validationErrors?.length ? (
                      <p className="mt-1 text-[12px] text-rose-600">
                        {d.validationErrors.map((e) => e.message).join("; ")}
                      </p>
                    ) : (
                      <p className="mt-1 text-[12px] text-emerald-700">Validation passed</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void (async () => {
                            setBusy(true);
                            try {
                              await runCommand("validate_workflow_draft", {
                                draftId: d.id,
                              });
                              const data = await runCommand("list_workflow_drafts");
                              setWorkflowDrafts(data.drafts || []);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err));
                            } finally {
                              setBusy(false);
                            }
                          })()
                        }
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700"
                      >
                        Re-validate
                      </button>
                      {d.status !== "activated" ? (
                        <button
                          type="button"
                          disabled={busy || d.validationStatus !== "valid"}
                          onClick={() =>
                            void (async () => {
                              setBusy(true);
                              try {
                                await runCommand("promote_workflow_draft", {
                                  draftId: d.id,
                                  confirm: true,
                                  activateTriggers: true,
                                  attachMissedCallTextBack: true,
                                });
                                await load();
                                const data = await runCommand("list_workflow_drafts");
                                setWorkflowDrafts(data.drafts || []);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : String(err));
                              } finally {
                                setBusy(false);
                              }
                            })()
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                        >
                          Promote to live workflow
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {tab === "test" ? (
          <div className="space-y-4 text-sm">
            <p>
              Tests must prove tool outcomes — completing a call alone is not a pass.
              Build a Telnyx test snapshot, then run live WebRTC scenarios and score traces.
            </p>
            {testSuite?.summary ? (
              <p className="text-[12px] text-slate-600">
                Suite: {testSuite.summary.passed} passed · {testSuite.summary.failed} failed ·{" "}
                {testSuite.summary.pending} pending / {testSuite.summary.total}
              </p>
            ) : null}
            <div className="space-y-2">
              {(testSuite?.results || []).map((r) => (
                <div key={r.scenarioId} className="rounded-xl border border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <span className="text-[11px] capitalize text-slate-500">{r.status}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Tools: {(r.expectedTools || []).join(", ")}
                  </p>
                  {r.callerScript?.length ? (
                    <p className="mt-1 text-[12px] text-slate-500">
                      Script: {r.callerScript.join(" → ")}
                    </p>
                  ) : null}
                  {r.note ? (
                    <p className="mt-1 text-[12px] text-amber-700">{r.note}</p>
                  ) : null}
                  {r.failureReason ? (
                    <p className="mt-1 text-[12px] text-rose-600">{r.failureReason}</p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      await runCommand("run_agent_test_snapshot");
                      const data = await runCommand("run_agent_test_suite");
                      setTestSuite(data);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
                className="rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white"
              >
                Build test snapshot + refresh suite
              </button>
              <Link
                href={`/voice/agents/${agent.voiceAgentId}`}
                className="rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white"
              >
                Open live test in builder
              </Link>
              <Link
                href="/voice/testing"
                className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700"
              >
                Voice testing lab
              </Link>
            </div>
          </div>
        ) : null}

        {tab === "activity" ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Employee-style timeline from real call events — not model chain-of-thought.
            </p>
            {activity.length === 0 ? (
              <p className="text-sm text-slate-500">No recent call activity yet.</p>
            ) : (
              (activity as Array<{ callId: string; summary: string; outcome: string; startedAt: string }>).map(
                (t) => (
                  <div key={t.callId} className="rounded-xl border border-slate-100 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{t.summary}</p>
                      <span className="text-[11px] capitalize text-slate-500">
                        {t.outcome.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {new Date(t.startedAt).toLocaleString()}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <Link
                        href={`/voice/calls/${t.callId}`}
                        className="text-[12px] font-semibold text-blue-600"
                      >
                        Open call
                      </Link>
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-slate-700"
                        onClick={() =>
                          void (async () => {
                            setSelectedCallId(t.callId);
                            try {
                              const data = await runCommand("get_employee_timeline", {
                                callId: t.callId,
                              });
                              setTimeline(data.timeline || []);
                            } catch {
                              setTimeline([]);
                            }
                          })()
                        }
                      >
                        Why this happened
                      </button>
                    </div>
                    {selectedCallId === t.callId && timeline ? (
                      <ol className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        {(timeline as Array<{ timeLabel: string; headline: string; detail?: string; status: string }>).map((item, idx) => (
                          <li key={`${item.timeLabel}-${idx}`} className="text-sm">
                            <span className="font-semibold text-slate-700">{item.timeLabel}</span>
                            {" — "}
                            <span className="text-slate-800">{item.headline}</span>
                            {item.detail ? (
                              <span className="mt-0.5 block text-[12px] text-slate-500">{item.detail}</span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ),
              )
            )}
          </div>
        ) : null}

        {tab === "results" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Calls answered", agent.metrics.callsAnswered],
              ["Booking conversations", agent.metrics.bookingConversationsStarted],
              ["Appointments booked", agent.metrics.appointmentsBooked],
              ["Abandoned bookings", agent.metrics.abandonedBookingConversations],
              ["Rescheduled", agent.metrics.appointmentsRescheduled],
              ["Cancelled", agent.metrics.appointmentsCancelled],
              ["Conversion", `${agent.metrics.bookingConversionRate}%`],
              [
                "Avg time to book",
                agent.metrics.averageTimeToBookingSeconds != null
                  ? `${agent.metrics.averageTimeToBookingSeconds}s`
                  : "—",
              ],
              ["Transfers", agent.metrics.transfers],
              ["Messages taken", agent.metrics.messagesTaken],
              ["Booking failures", agent.metrics.bookingFailures],
              ["Calendar failures", agent.metrics.calendarFailures],
              ["Confirmation SMS", agent.metrics.confirmationSmsSent],
              ["Confirmation email", agent.metrics.confirmationEmailsSent],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "health" ? (
          <div className="space-y-3">
            {(
              [
                ["Telnyx assistant", agent.health.telnyxAssistant],
                ["Assigned number", agent.health.assignedNumber],
                ["Calendar", agent.health.calendar],
                ["Booking tools", agent.health.bookingTools],
                ["SMS confirmation", agent.health.smsConfirmation],
                ["Webhook", agent.health.webhookEndpoint],
                ["Latest deployment", agent.health.latestDeployment],
                ["Primary workflow", agent.health.primaryWorkflow],
                ["Slot holds", agent.health.slotHolds],
                ["Transfer targets", agent.health.transferTargets],
              ] as const
            ).map(([label, check]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="mt-1 text-[12px] text-slate-600">{check.message}</p>
                </div>
                <HealthBadge overall={check.status} />
              </div>
            ))}
            {(agent.readiness?.blockers || []).length > 0 ? (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Exact readiness blockers</h3>
                {(agent.readiness?.blockers || []).map((b) => (
                  <div key={b.code} className="rounded-xl border border-rose-100 bg-rose-50/40 px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{b.message}</p>
                    <p className="mt-1 text-[12px] text-slate-600">
                      Affects: {b.affectedFunctionality}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-600">Do this: {b.recommendedAction}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="text-[11px] text-slate-400">
              Last checked {new Date(agent.health.lastCheckedAt).toLocaleString()}
            </p>
          </div>
        ) : null}

        {tab === "memory" ? (
          <div className="space-y-6 text-sm">
            <div>
              <h2 className="font-semibold text-slate-900">Shared company facts</h2>
              <div className="mt-2 space-y-2">
                {((memory?.sharedFacts as Array<{ id: string; summary: string; approvalState: string }> | undefined) || []).length === 0 ? (
                  <p className="text-slate-500">No shared facts yet.</p>
                ) : (
                  ((memory!.sharedFacts as Array<{ id: string; summary: string; approvalState: string }>)).map((f) => (
                    <div key={f.id} className="rounded-xl border border-slate-100 px-4 py-3">
                      <p className="text-slate-800">{f.summary}</p>
                      <p className="mt-1 text-[11px] capitalize text-slate-500">{f.approvalState}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Agent-specific booking rules</h2>
              <div className="mt-2 space-y-2">
                {((memory?.agentFacts as Array<{ id: string; summary: string }> | undefined) || []).map((f) => (
                  <div key={f.id} className="rounded-xl bg-slate-50 px-4 py-3 text-slate-800">
                    {f.summary}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Learning suggestions</h2>
              <div className="mt-2 space-y-2">
                {((memory?.learning as Array<{ id: string; pattern: string; suggestedAddition: string; sampleSize: number; confidence: string }> | undefined) || []).length === 0 ? (
                  <p className="text-slate-500">
                    No learning items yet. {agent.identity.name} will queue repeated unknowns for your review — never silent permanent teaching.
                  </p>
                ) : (
                  ((memory!.learning as Array<{ id: string; pattern: string; suggestedAddition: string; sampleSize: number; confidence: string }>)).map((l) => (
                    <div key={l.id} className="rounded-xl border border-slate-100 px-4 py-3">
                      <p className="font-medium text-slate-900">{l.pattern}</p>
                      <p className="mt-1 text-[12px] text-slate-600">{l.suggestedAddition}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Sample {l.sampleSize} · confidence {l.confidence}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-900">Teach {agent.identity.name}</p>
              <p className="mt-1 text-[12px] text-slate-600">
                Example: “Always transfer sewer backups” or “Stop offering same-day appointments after 3 PM.”
              </p>
              <button
                type="button"
                className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white"
                onClick={() => {
                  setTab("talk");
                  setQuestion("Always transfer sewer backups");
                }}
              >
                Open Talk with a teach example
              </button>
            </div>
          </div>
        ) : null}

        {tab === "attention" ? (
          <div className="space-y-3 text-sm">
            {(attention?.items as Array<{ id: string; title: string; summary: string; severity: string; recommendedAction: string; href?: string; askAmyPrompt?: string }> | undefined)?.length ? (
              (attention!.items as Array<{ id: string; title: string; summary: string; severity: string; recommendedAction: string; href?: string; askAmyPrompt?: string }>).map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">{item.severity}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-600">{item.summary}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{item.recommendedAction}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {item.href ? (
                      <Link href={item.href} className="text-[12px] font-semibold text-blue-600">
                        Resolve / open
                      </Link>
                    ) : null}
                    {item.askAmyPrompt ? (
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-slate-700"
                        onClick={() => {
                          setTab("talk");
                          void ask(item.askAmyPrompt!);
                        }}
                      >
                        Ask {agent.identity.name}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500">Inbox is clear — nothing needs attention.</p>
            )}
          </div>
        ) : null}

        {tab === "autonomy" ? (
          <div className="space-y-4 text-sm">
            <div>
              <h2 className="font-semibold text-slate-900">
                Mode: {String(autonomy?.label || agent.autonomyMode || "Balanced")}
              </h2>
              <p className="mt-1 text-[12px] text-slate-600">
                Stored budget: {String(autonomy?.storedBudget || "standard")}. Default for new agents is Balanced.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Allowed</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-700">
                  {((autonomy?.allowed as string[] | undefined) || []).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Never automatic</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-700">
                  {((autonomy?.forbidden as string[] | undefined) || []).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["conservative", "balanced", "autonomous"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      try {
                        const budget =
                          mode === "conservative"
                            ? "conservative"
                            : mode === "autonomous"
                              ? "high"
                              : "standard";
                        await runCommand("set_autonomy_budget", {
                          budget,
                          confirm: true,
                        });
                        const data = await runCommand("get_autonomy_policy");
                        setAutonomy(data);
                        await load();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                  className={cn(
                    "min-h-10 rounded-lg border px-3 py-2 text-[12px] font-semibold capitalize",
                    (agent.autonomyMode || "balanced") === mode
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-700",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Emergency policies</h3>
              <div className="mt-2 space-y-2">
                {((autonomy?.emergencyPolicies as Array<{ trigger: string; action: string }> | undefined) || []).map((p) => (
                  <div key={p.trigger} className="rounded-xl border border-slate-100 px-4 py-3">
                    <p className="font-medium text-slate-900">{p.trigger}</p>
                    <p className="mt-1 text-[12px] text-slate-600">{p.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "versions" ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Pending change proposals</h3>
              {proposals.filter(
                (p) => (p as { status?: string }).status === "pending",
              ).length === 0 ? (
                <p className="text-sm text-slate-500">
                  No pending proposals. Ask {agent.identity.name} to change a booking rule, then confirm here.
                </p>
              ) : (
                (
                  proposals as Array<{
                    id: string;
                    summary: string;
                    status: string;
                    riskLevel: string;
                    changes: Array<{ path: string; before: unknown; after: unknown }>;
                  }>
                )
                  .filter((p) => p.status === "pending")
                  .map((p) => (
                    <div key={p.id} className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{p.summary}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-amber-800">
                        {p.riskLevel} risk · requires confirmation
                      </p>
                      <ul className="mt-2 space-y-1 text-[12px] text-slate-700">
                        {p.changes.map((c) => (
                          <li key={c.path}>
                            {c.path}: {JSON.stringify(c.before)} → {JSON.stringify(c.after)}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void (async () => {
                              setBusy(true);
                              try {
                                await runCommand("confirm_change_proposal", {
                                  proposalId: p.id,
                                  confirm: true,
                                  publish: true,
                                });
                                await load();
                                const data = await runCommand("list_change_proposals");
                                setProposals(data.proposals || []);
                                setPendingProposalId(null);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : String(err));
                              } finally {
                                setBusy(false);
                              }
                            })()
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white"
                        >
                          Put change live
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void (async () => {
                              setBusy(true);
                              try {
                                await runCommand("confirm_change_proposal", {
                                  proposalId: p.id,
                                  confirm: true,
                                  publish: false,
                                });
                                await load();
                                const data = await runCommand("list_change_proposals");
                                setProposals(data.proposals || []);
                                setPendingProposalId(null);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : String(err));
                              } finally {
                                setBusy(false);
                              }
                            })()
                          }
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700"
                        >
                          Save draft only
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void (async () => {
                              setBusy(true);
                              try {
                                await runCommand("reject_change_proposal", {
                                  proposalId: p.id,
                                });
                                const data = await runCommand("list_change_proposals");
                                setProposals(data.proposals || []);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : String(err));
                              } finally {
                                setBusy(false);
                              }
                            })()
                          }
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
              )}
              {pendingProposalId ? (
                <p className="text-[12px] text-slate-500">
                  Latest chat proposal: {pendingProposalId}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      await runCommand("activate_agent_version", {
                        confirm: true,
                        changeLog: "Activated from agent detail",
                      });
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
                className="rounded-lg bg-emerald-600 px-3 py-2 text-[12px] font-semibold text-white"
              >
                Activate current draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      const result = await runCommand("duplicate_agent", {
                        confirm: true,
                        name: `${agent.identity.name} — copy`,
                      });
                      if (result?.href) window.location.href = String(result.href);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700"
              >
                Duplicate agent
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Published versions</h3>
              {agent.versions.length === 0 ? (
                <p className="text-sm text-slate-500">No published versions yet.</p>
              ) : (
                agent.versions.map((v) => (
                  <div
                    key={v.id}
                    className={cn(
                      "rounded-xl border px-4 py-3",
                      v.id === agent.currentVersionId
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-slate-100",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        v{v.version}
                        {v.id === agent.currentVersionId ? " · Current" : ""}
                        {v.isMain ? " · Main" : ""}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {new Date(v.publishedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-600">
                      {v.changeLog || "No changelog"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Deploy: {v.deploymentStatus || "—"} · Test: {v.testStatus || "—"}
                    </p>
                    {v.id !== agent.currentVersionId ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void (async () => {
                            setBusy(true);
                            try {
                              await runCommand("rollback_agent_version", {
                                versionId: v.id,
                                confirm: true,
                              });
                              await load();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err));
                            } finally {
                              setBusy(false);
                            }
                          })()
                        }
                        className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700"
                      >
                        Rollback to this version
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SetupBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-1 text-sm text-slate-800">{body}</p>
    </div>
  );
}
