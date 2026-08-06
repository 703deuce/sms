"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import { cn } from "@/lib/utils";

type TabId =
  | "overview"
  | "talk"
  | "setup"
  | "workflows"
  | "test"
  | "activity"
  | "results"
  | "health"
  | "versions";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "talk", label: "Talk to Randy" },
  { id: "setup", label: "Setup" },
  { id: "workflows", label: "Workflows" },
  { id: "test", label: "Test" },
  { id: "activity", label: "Activity" },
  { id: "results", label: "Results" },
  { id: "health", label: "Health" },
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
  const [tab, setTab] = useState<TabId>("overview");
  const [activity, setActivity] = useState<unknown[]>([]);
  const [proposals, setProposals] = useState<unknown[]>([]);
  const [workflowDrafts, setWorkflowDrafts] = useState<unknown[]>([]);
  const [chat, setChat] = useState<Array<{ role: "user" | "agent"; text: string }>>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);

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
    if ((tab !== "versions" && tab !== "workflows") || !agent) return;
    void (async () => {
      try {
        if (tab === "versions") {
          const data = await runCommand("list_change_proposals");
          setProposals(data.proposals || []);
        }
        if (tab === "workflows") {
          const data = await runCommand("list_workflow_drafts");
          setWorkflowDrafts(data.drafts || []);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [tab, agent, runCommand]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setChat((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    try {
      const data = await runCommand("owner_ask", { question: q });
      setChat((prev) => [
        ...prev,
        { role: "agent", text: String(data.answer || "No answer returned.") },
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
        <Link href="/systems" className="text-sm font-medium text-blue-600">
          Back to My Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
              Appointment Booking Agent
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {displayName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {agent.identity.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={agent.identity.status} />
              <HealthBadge overall={agent.health.overall} />
              <span className="text-[12px] text-slate-500">
                {agent.resources.numberLabel} · {agent.resources.locationLabel}
              </span>
              {agent.currentVersionId ? (
                <span className="text-[12px] text-slate-500">
                  Version{" "}
                  {agent.versions.find((v) => v.id === agent.currentVersionId)?.version ??
                    "active"}
                </span>
              ) : null}
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
              className="rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
            >
              Talk to Randy
            </button>
            <button
              type="button"
              onClick={() => setTab("test")}
              className="rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-500"
            >
              Test
            </button>
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-t-lg px-3 py-2 text-[12px] font-semibold",
              tab === t.id
                ? "bg-white text-slate-900 ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {tab === "overview" ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">What Randy does</h2>
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
              Ask Randy about his live setup, logs, health, and metrics. Answers use tools —
              he will not invent missing data.
            </p>
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
                    {m.text}
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
                placeholder="Ask Randy…"
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
              Live audio stays on Telnyx. The Workflow Architect can draft approved
              node graphs only — never arbitrary code. Drafts stay inactive until
              you confirm after tests.
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
                  No drafts yet. Ask Randy: “Create an after-hours emergency workflow draft”.
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
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {tab === "test" ? (
          <div className="space-y-3 text-sm">
            <p>
              Use a live WebRTC test against the Telnyx assistant. Tests must prove tool
              outcomes — completing a call alone is not a pass.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-slate-600">
              <li>New caller books an available appointment</li>
              <li>Caller says “tomorrow at five”</li>
              <li>Requested slot unavailable</li>
              <li>Calendar failure / booking timeout</li>
              <li>Transfer requested and transfer failure</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
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
          <div className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-slate-500">No recent call traces yet.</p>
            ) : (
              (activity as Array<{ callId: string; summary: string; outcome: string; startedAt: string }>).map(
                (t) => (
                  <Link
                    key={t.callId}
                    href={`/voice/calls/${t.callId}`}
                    className="block rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{t.summary}</p>
                      <span className="text-[11px] capitalize text-slate-500">
                        {t.outcome.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {new Date(t.startedAt).toLocaleString()}
                    </p>
                  </Link>
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
              ["Conversion", `${agent.metrics.bookingConversionRate}%`],
              ["Transfers", agent.metrics.transfers],
              ["Messages taken", agent.metrics.messagesTaken],
              ["Booking failures", agent.metrics.bookingFailures],
              ["Calendar failures", agent.metrics.calendarFailures],
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
            <p className="text-[11px] text-slate-400">
              Last checked {new Date(agent.health.lastCheckedAt).toLocaleString()}
            </p>
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
                  No pending proposals. Ask Randy to change a booking rule, then confirm here.
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
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white"
                        >
                          Apply to draft
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
                                  publish: true,
                                });
                                await load();
                                const data = await runCommand("list_change_proposals");
                                setProposals(data.proposals || []);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : String(err));
                              } finally {
                                setBusy(false);
                              }
                            })()
                          }
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white"
                        >
                          Apply + publish
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
