"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import { AMY_CAPABILITY_SHORTCUTS } from "@/lib/agents/appointment-booking/intelligence/capability-catalog";
import { cn } from "@/lib/utils";

type PrimarySection = "home" | "talk" | "work" | "build" | "settings";
type WorkSub = "activity" | "results" | "attention";
type BuildSub = "workflow" | "tests" | "versions";
type SettingsSub =
  | "general"
  | "booking"
  | "fields"
  | "knowledge"
  | "connections"
  | "voice"
  | "health"
  | "autonomy";

const PRIMARY: Array<{ id: PrimarySection; label: string }> = [
  { id: "home", label: "Home" },
  { id: "talk", label: "Talk to Amy" },
  { id: "work", label: "Work" },
  { id: "build", label: "Build & Test" },
  { id: "settings", label: "Settings" },
];

const SUGGESTED = [
  "How did today go?",
  "Why didn’t the last caller book?",
  "Add a required question",
  "Change the minimum notice to four hours",
  "Stop offering same-day appointments after 3 PM",
  "Test yourself",
  "Create another Amy",
];

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "bad" | "neutral" | "brand";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800"
        : tone === "bad"
          ? "bg-rose-50 text-rose-700"
          : tone === "brand"
            ? "bg-violet-600 text-white"
            : "bg-slate-100 text-slate-700";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", cls)}>
      {children}
    </span>
  );
}

export function AppointmentAgentDetail({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<AppointmentBookingAgentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<PrimarySection>("talk");
  const [workSub, setWorkSub] = useState<WorkSub>("activity");
  const [buildSub, setBuildSub] = useState<BuildSub>("versions");
  const [settingsSub, setSettingsSub] = useState<SettingsSub>("booking");
  const [activity, setActivity] = useState<unknown[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<unknown[]>([]);
  const [workflowDrafts, setWorkflowDrafts] = useState<unknown[]>([]);
  const [attention, setAttention] = useState<{ items?: unknown[]; openCount?: number } | null>(
    null,
  );
  const [memory, setMemory] = useState<Record<string, unknown> | null>(null);
  const [autonomy, setAutonomy] = useState<Record<string, unknown> | null>(null);
  const [testSuite, setTestSuite] = useState<{
    results?: Array<{ scenarioId: string; name: string; status: string; failureReason?: string | null }>;
    summary?: { total: number; passed: number; pending: number; failed: number };
  } | null>(null);
  const [timeline, setTimeline] = useState<unknown[] | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [chat, setChat] = useState<
    Array<{
      role: "user" | "agent";
      text: string;
      evidence?: Array<{ label: string; href?: string }>;
      proposalId?: string;
    }>
  >([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  const [runtimeIndicator, setRuntimeIndicator] = useState<string | null>(null);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);

  // Settings draft editors (proposal pipeline — never direct Telnyx mutate)
  const [noticeHours, setNoticeHours] = useState("2");
  const [sameDayCutoff, setSameDayCutoff] = useState("15:00");
  const [requireAddress, setRequireAddress] = useState(false);
  const [greetingDraft, setGreetingDraft] = useState("");
  const [setupReadiness, setSetupReadiness] = useState<{
    completeCount?: number;
    totalCount?: number;
    interviewOpening?: string;
    sections?: Array<{ id: string; label: string; status: string; detail: string }>;
  } | null>(null);
  const [drift, setDrift] = useState<{
    message?: string;
    drifted?: boolean;
    expectedVersionNumber?: number | null;
  } | null>(null);
  const [talkSeeded, setTalkSeeded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      const data = json.data as AppointmentBookingAgentView;
      setAgent(data);
      setNoticeHours(String(Math.round((data.bookingPolicy.minimumNoticeMinutes || 120) / 60)));
      setSameDayCutoff(data.bookingPolicy.sameDayCutoff || "15:00");
      setRequireAddress(Boolean(data.bookingPolicy.requireServiceAddress));
      setGreetingDraft(
        `Thank you for calling ${data.businessBrain.businessName || "us"}. This is ${data.identity.displayName} — how can I help you today?`,
      );
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
    if (!agent || section !== "work" || workSub !== "activity") return;
    let cancelled = false;
    setActivityLoading(true);
    setActivityError(null);
    void (async () => {
      try {
        const data = await runCommand("search_agent_activity", {
          limit: 15,
          summariesOnly: true,
        });
        if (!cancelled) setActivity(data.traces || []);
      } catch (err) {
        if (!cancelled) {
          setActivity([]);
          setActivityError(err instanceof Error ? err.message : "Failed to load activity");
        }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent, section, workSub, runCommand]);

  useEffect(() => {
    if (!agent) return;
    void (async () => {
      try {
        if (section === "home" || section === "talk" || (section === "work" && workSub === "attention")) {
          setAttention(await runCommand("get_attention_inbox"));
        }
        if (section === "talk" || section === "home") {
          const readiness = await runCommand("get_setup_readiness");
          setSetupReadiness(readiness);
          if (
            section === "talk" &&
            !talkSeeded &&
            readiness?.interviewOpening
          ) {
            setChat([
              {
                role: "agent",
                text: String(readiness.interviewOpening),
              },
            ]);
            setTalkSeeded(true);
          }
        }
        if (section === "build") {
          const props = await runCommand("list_change_proposals");
          setProposals(props.proposals || []);
          if (buildSub === "workflow") {
            const drafts = await runCommand("list_workflow_drafts");
            setWorkflowDrafts(drafts.drafts || []);
          }
          if (buildSub === "tests") {
            setTestSuite(await runCommand("run_agent_test_suite"));
          }
        }
        if (section === "settings") {
          if (settingsSub === "knowledge") setMemory(await runCommand("get_memory_view"));
          if (settingsSub === "autonomy") setAutonomy(await runCommand("get_autonomy_policy"));
          if (settingsSub === "health") {
            setDrift(await runCommand("get_deployment_drift"));
          }
          if (
            settingsSub === "general" ||
            settingsSub === "booking" ||
            settingsSub === "fields" ||
            settingsSub === "voice"
          ) {
            const props = await runCommand("list_change_proposals");
            setProposals(props.proposals || []);
          }
        }
      } catch {
        /* optional panels */
      }
    })();
  }, [agent, section, workSub, buildSub, settingsSub, runCommand, talkSeeded]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setChatStatus("Working…");
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
          proposalId: data.proposalId ? String(data.proposalId) : undefined,
        },
      ]);
      if (data.proposalId) setPendingProposalId(String(data.proposalId));
      if (data.runtimeIndicator) setRuntimeIndicator(String(data.runtimeIndicator));
    } catch (err) {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: err instanceof Error ? err.message : "Request failed" },
      ]);
    } finally {
      setChatStatus(null);
      setBusy(false);
    }
  };

  const putLive = async (proposalId: string) => {
    setBusy(true);
    try {
      await runCommand("confirm_change_proposal", {
        proposalId,
        confirm: true,
        publish: true,
      });
      setPendingProposalId(null);
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "Change is live on the phone line now." },
      ]);
      await load();
      const props = await runCommand("list_change_proposals");
      setProposals(props.proposals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const proposeBookingPatch = async (summary: string, patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      const proposal = await runCommand("propose_setup_change", {
        summary,
        bookingPolicy: patch,
      });
      setPendingProposalId(String(proposal.id));
      setSection("talk");
      setChat((prev) => [
        ...prev,
        {
          role: "agent",
          text: `I drafted: ${summary}. Confirm to put it live on the phone line.`,
          proposalId: String(proposal.id),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const pauseOrResume = async () => {
    if (!agent) return;
    setBusy(true);
    try {
      await runCommand(agent.identity.status === "paused" ? "resume_agent" : "pause_agent");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const name = agent?.identity.name || "Amy";
  const versionLabel = useMemo(() => {
    if (!agent?.currentVersionId) return "—";
    const v = agent.versions.find((x) => x.id === agent.currentVersionId);
    return v ? `v${v.version}` : "active";
  }, [agent]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading {name}…</div>;
  }
  if (error || !agent) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-rose-600">{error || "Agent not found"}</p>
        <Link href="/agents" className="text-sm font-medium text-violet-600">
          Back to Your Team
        </Link>
      </div>
    );
  }

  const guidedHref = agent.solutionSetupId
    ? `/solutions/ai-call-handling/appointment-assistant/setup?setupId=${agent.solutionSetupId}&hire=amy`
    : `/solutions/ai-call-handling/appointment-assistant/setup?agentId=${agent.voiceAgentId}&hire=amy`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-lg font-bold text-violet-700">
              {name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">{name}</h1>
                <Pill tone="ok">
                  {agent.identity.status === "active" ? "Active" : agent.identity.status}
                </Pill>
                <Pill tone={agent.health.overall === "healthy" ? "ok" : "warn"}>
                  {agent.readiness?.label || agent.health.overall}
                </Pill>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {agent.identity.roleLabel || "Appointment Booking Agent"}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
                <span>Main line: {agent.resources.numberLabel}</span>
                <span>Calendar: {agent.resources.calendarLabel}</span>
                <span>Location: {agent.resources.locationLabel}</span>
                <span>Version: {versionLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSection("talk")}
              className="min-h-10 rounded-lg bg-violet-600 px-3 py-2 text-[12px] font-semibold text-white"
            >
              Talk to {name}
            </button>
            <button
              type="button"
              onClick={() => {
                setSection("build");
                setBuildSub("tests");
              }}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
            >
              Test
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void pauseOrResume()}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
            >
              {agent.identity.status === "paused" ? "Resume" : "Pause"}
            </button>
          </div>
        </div>

        <nav className="mx-auto mt-4 flex max-w-7xl gap-1 overflow-x-auto">
          {PRIMARY.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm font-semibold",
                section === t.id
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.id === "talk" ? `Talk to ${name}` : t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_300px] sm:p-6">
        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {section === "home" ? (
            <div className="space-y-6 p-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Today</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Calls answered", agent.metrics.callsAnswered],
                    ["Appointments booked", agent.metrics.appointmentsBooked],
                    ["Conversion", `${agent.metrics.bookingConversionRate}%`],
                    ["Needs attention", attention?.openCount ?? 0],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">{l}</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              {(agent.readiness?.blockers || []).length ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
                  {(agent.readiness?.blockers || []).slice(0, 5).map((b) => (
                    <div key={b.code} className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm">
                      <p className="font-medium">{b.message}</p>
                      <p className="mt-1 text-[12px] text-slate-600">{b.recommendedAction}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {name} is ready — no readiness blockers.
                </p>
              )}
              <p className="text-[12px] text-slate-500">
                Callers talk to the published Telnyx assistant. You manage {name} here — Talk,
                Settings, and Build & Test all use the same proposal → test → publish pipeline.
                Guided setup reuses the proven wizard engine without a second source of truth.
              </p>
            </div>
          ) : null}

          {section === "talk" ? (
            <div className="flex min-h-[28rem] flex-col">
              {runtimeIndicator ? (
                <p className="border-b border-slate-100 px-5 py-2 text-[11px] text-slate-500">
                  {runtimeIndicator}
                </p>
              ) : null}
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {chat.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <p className="font-medium">{name}</p>
                    <p className="mt-1">
                      I book appointments for {agent.businessBrain.businessName || "your business"}.
                      Ask how today went, why a call failed, or tell me what to change — I’ll draft
                      it and ask before it goes live.
                    </p>
                  </div>
                ) : null}
                {chat.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={cn(
                      "max-w-[92%] rounded-2xl px-4 py-3 text-sm",
                      m.role === "user"
                        ? "ml-auto bg-violet-600 text-white"
                        : "bg-slate-50 text-slate-800",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.proposalId ? (
                      <div className="mt-3 rounded-xl border border-violet-200 bg-white p-3 text-slate-800">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                          Proposed change
                        </p>
                        <p className="mt-1 text-[12px]">Requires your approval before callers see it.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void putLive(m.proposalId!)}
                            className="rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white"
                          >
                            Put change live
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSection("build");
                              setBuildSub("versions");
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold"
                          >
                            Review draft
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {m.evidence?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.evidence.map((ev) =>
                          ev.href ? (
                            <Link
                              key={ev.label}
                              href={ev.href}
                              className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-slate-200"
                            >
                              {ev.label}
                            </Link>
                          ) : null,
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
                {chatStatus ? (
                  <p className="text-[12px] text-violet-700">{chatStatus}</p>
                ) : null}
                {pendingProposalId ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm">
                    Draft waiting — not on the phone yet.
                    <button
                      type="button"
                      disabled={busy}
                      className="ml-3 font-semibold text-violet-700"
                      onClick={() => void putLive(pendingProposalId)}
                    >
                      Put change live
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="border-t border-slate-100 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  What {name} can do
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {AMY_CAPABILITY_SHORTCUTS.map((shortcut) => (
                    <button
                      key={shortcut.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void ask(shortcut.prompt)}
                      className="rounded-full border border-violet-200 bg-violet-50/50 px-3 py-1.5 text-[12px] font-medium text-violet-800 hover:bg-violet-100"
                      title={shortcut.capabilityId}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
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
                    placeholder={`Message ${name}…`}
                    className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {section === "work" ? (
            <div className="p-5">
              <SubNav
                items={[
                  ["activity", "Activity"],
                  ["results", "Results"],
                  ["attention", "Attention"],
                ]}
                current={workSub}
                onChange={(id) => setWorkSub(id as WorkSub)}
              />
              {workSub === "activity" ? (
                <div className="mt-4 space-y-3">
                  {activityLoading ? (
                    <p className="text-sm text-slate-500">Loading activity…</p>
                  ) : activityError ? (
                    <p className="text-sm text-rose-600">{activityError}</p>
                  ) : activity.length === 0 ? (
                    <p className="text-sm text-slate-500">No recent call activity yet.</p>
                  ) : (
                    (
                      activity as Array<{
                        callId: string;
                        summary: string;
                        outcome: string;
                        startedAt: string;
                      }>
                    ).map((t) => (
                      <div key={t.callId} className="rounded-xl border border-slate-100 px-4 py-3">
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="text-sm font-medium">{t.summary}</p>
                          <span className="text-[11px] capitalize text-slate-500">
                            {t.outcome.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-slate-500">
                          {new Date(t.startedAt).toLocaleString()}
                        </p>
                        <div className="mt-2 flex gap-3 text-[12px] font-semibold">
                          <Link href={`/voice/calls/${t.callId}`} className="text-violet-700">
                            Open call
                          </Link>
                          <button
                            type="button"
                            className="text-slate-700"
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
                          <ol className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                            {(
                              timeline as Array<{
                                timeLabel: string;
                                headline: string;
                                detail?: string;
                              }>
                            ).map((item, idx) => (
                              <li key={`${item.timeLabel}-${idx}`}>
                                <span className="font-semibold">{item.timeLabel}</span> —{" "}
                                {item.headline}
                                {item.detail ? (
                                  <span className="block text-[12px] text-slate-500">
                                    {item.detail}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              ) : null}
              {workSub === "results" ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["Calls", agent.metrics.callsAnswered],
                    ["Booked", agent.metrics.appointmentsBooked],
                    ["Conversion", `${agent.metrics.bookingConversionRate}%`],
                    ["Transfers", agent.metrics.transfers],
                    ["Failures", agent.metrics.bookingFailures],
                    ["SMS confirmations", agent.metrics.confirmationSmsSent],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] uppercase text-slate-400">{l}</p>
                      <p className="mt-1 text-xl font-semibold">{v}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {workSub === "attention" ? (
                <div className="mt-4 space-y-3">
                  {(attention?.items as Array<{
                    id: string;
                    title: string;
                    summary: string;
                    recommendedAction: string;
                    askAmyPrompt?: string;
                  }> | undefined)?.length ? (
                    (attention!.items as Array<{
                      id: string;
                      title: string;
                      summary: string;
                      recommendedAction: string;
                      askAmyPrompt?: string;
                    }>).map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-100 px-4 py-3">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-[12px] text-slate-600">{item.summary}</p>
                        <p className="mt-1 text-[12px] text-slate-500">{item.recommendedAction}</p>
                        {item.askAmyPrompt ? (
                          <button
                            type="button"
                            className="mt-2 text-[12px] font-semibold text-violet-700"
                            onClick={() => {
                              setSection("talk");
                              void ask(item.askAmyPrompt!);
                            }}
                          >
                            Ask {name}
                          </button>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Inbox clear.</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {section === "build" ? (
            <div className="p-5">
              <SubNav
                items={[
                  ["workflow", "Workflow"],
                  ["tests", "Tests"],
                  ["versions", "Versions"],
                ]}
                current={buildSub}
                onChange={(id) => setBuildSub(id as BuildSub)}
              />
              {buildSub === "workflow" ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p>
                    Live workflow:{" "}
                    <span className="font-semibold">{agent.resources.workflowLabel}</span>
                  </p>
                  <p className="text-slate-600">
                    Speech stays on Telnyx with booking tools. This workflow owns routing and
                    post-call steps. Architect drafts use approved blocks only.
                  </p>
                  {agent.primaryFlowId ? (
                    <Link
                      href={`/automations/${agent.primaryFlowId}/edit`}
                      className="inline-flex font-semibold text-violet-700"
                    >
                      Open workflow →
                    </Link>
                  ) : null}
                  {(workflowDrafts as Array<{ id: string; name: string; validationStatus: string }>).map(
                    (d) => (
                      <div key={d.id} className="rounded-xl border border-slate-100 px-4 py-3">
                        {d.name} · {d.validationStatus}
                      </div>
                    ),
                  )}
                </div>
              ) : null}
              {buildSub === "tests" ? (
                <div className="mt-4 space-y-3 text-sm">
                  {testSuite?.summary ? (
                    <p>
                      {testSuite.summary.passed} passed · {testSuite.summary.failed} failed ·{" "}
                      {testSuite.summary.pending} pending
                    </p>
                  ) : null}
                  {(testSuite?.results || []).map((r) => (
                    <div key={r.scenarioId} className="rounded-xl border border-slate-100 px-4 py-3">
                      <div className="flex justify-between gap-2">
                        <p className="font-medium">{r.name}</p>
                        <span className="text-[11px] capitalize">{r.status}</span>
                      </div>
                      {r.failureReason ? (
                        <p className="mt-1 text-[12px] text-rose-600">{r.failureReason}</p>
                      ) : null}
                    </div>
                  ))}
                  <Link
                    href={`/voice/agents/${agent.voiceAgentId}`}
                    className="inline-flex font-semibold text-violet-700"
                  >
                    Open live voice test →
                  </Link>
                </div>
              ) : null}
              {buildSub === "versions" ? (
                <div className="mt-4 space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Pending proposals</h3>
                    {proposals.filter((p) => (p as { status?: string }).status === "pending")
                      .length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No pending proposals. Change Settings or Talk to {name}.
                      </p>
                    ) : (
                      (
                        proposals as Array<{
                          id: string;
                          summary: string;
                          status: string;
                          changes: Array<{ path: string; before: unknown; after: unknown }>;
                        }>
                      )
                        .filter((p) => p.status === "pending")
                        .map((p) => (
                          <div
                            key={p.id}
                            className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3"
                          >
                            <p className="text-sm font-semibold">{p.summary}</p>
                            <ul className="mt-2 space-y-1 text-[12px]">
                              {p.changes.map((c) => (
                                <li key={c.path}>
                                  {c.path}: {JSON.stringify(c.before)} → {JSON.stringify(c.after)}
                                </li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              disabled={busy}
                              className="mt-3 rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white"
                              onClick={() => void putLive(p.id)}
                            >
                              Put change live
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Published versions</h3>
                    {agent.versions.map((v) => (
                      <div
                        key={v.id}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-sm",
                          v.id === agent.currentVersionId
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-slate-100",
                        )}
                      >
                        v{v.version}
                        {v.id === agent.currentVersionId ? " · Current" : ""} —{" "}
                        {v.changeLog || "No changelog"}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {section === "settings" ? (
            <div className="p-5">
              <SubNav
                items={[
                  ["general", "General"],
                  ["booking", "Booking rules"],
                  ["fields", "Information collected"],
                  ["knowledge", "Knowledge"],
                  ["connections", "Connections"],
                  ["voice", "Voice"],
                  ["health", "Health"],
                  ["autonomy", "Permissions"],
                ]}
                current={settingsSub}
                onChange={(id) => setSettingsSub(id as SettingsSub)}
              />

              {settingsSub === "general" ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p>
                    <span className="text-slate-500">Name:</span> {agent.identity.displayName}
                  </p>
                  <p>
                    <span className="text-slate-500">Role:</span>{" "}
                    {agent.identity.roleLabel} (fixed — books appointments)
                  </p>
                  <p>
                    <span className="text-slate-500">Autonomy:</span>{" "}
                    {agent.autonomyMode || "balanced"}
                  </p>
                  <Link href={guidedHref} className="inline-flex font-semibold text-violet-700">
                    Open guided setup →
                  </Link>
                  <p className="text-[12px] text-slate-500">
                    Guided setup is the same wizard engine writing Company Brain + Amy draft — not
                    a second configuration.
                  </p>
                </div>
              ) : null}

              {settingsSub === "booking" ? (
                <div className="mt-4 max-w-lg space-y-4">
                  <label className="block text-sm">
                    Minimum notice (hours)
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                      value={noticeHours}
                      onChange={(e) => setNoticeHours(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    Same-day cutoff (HH:MM local)
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                      value={sameDayCutoff}
                      onChange={(e) => setSameDayCutoff(e.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={requireAddress}
                      onChange={(e) => setRequireAddress(e.target.checked)}
                    />
                    Require service address
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() =>
                      void proposeBookingPatch("Update booking rules from Settings", {
                        minimumNoticeMinutes: Math.max(0, Number(noticeHours) || 0) * 60,
                        sameDayCutoff,
                        requireServiceAddress: requireAddress,
                      })
                    }
                  >
                    Propose change
                  </button>
                  <p className="text-[12px] text-slate-500">
                    Creates a draft proposal. You confirm in Talk or Versions before Telnyx updates.
                  </p>
                </div>
              ) : null}

              {settingsSub === "fields" ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p className="text-slate-600">
                    Custom fields use the same definition for live calls, appointments, tests, and
                    Talk proposals.
                  </p>
                  <ul className="space-y-2">
                    {(
                      [
                        ["Name", agent.bookingPolicy.requireCallerName],
                        ["Phone", agent.bookingPolicy.requirePhoneNumber],
                        ["Email", agent.bookingPolicy.requireEmail],
                        ["Service address", agent.bookingPolicy.requireServiceAddress],
                      ] as const
                    ).map(([label, on]) => (
                      <li
                        key={label}
                        className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
                      >
                        <span>{label}</span>
                        <Pill tone={on ? "ok" : "neutral"}>{on ? "Required" : "Optional"}</Pill>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white"
                    onClick={() =>
                      void proposeBookingPatch("Require email on bookings", {
                        requireEmail: true,
                      })
                    }
                  >
                    Require email (propose)
                  </button>
                  <button
                    type="button"
                    className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold"
                    onClick={() => {
                      setSection("talk");
                      void ask("Add vehicle year, make, and model for detailing appointments");
                    }}
                  >
                    Ask {name} to add a custom field
                  </button>
                  <Link href={guidedHref} className="block font-semibold text-violet-700">
                    Guided setup (same draft) →
                  </Link>
                </div>
              ) : null}

              {settingsSub === "knowledge" ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p>
                    Shared Company Brain facts:{" "}
                    {(memory?.sharedFacts as unknown[] | undefined)?.length ??
                      agent.businessBrain.knowledgeFacts.length}
                  </p>
                  <Link href="/company-brain" className="font-semibold text-violet-700">
                    Open Company Brain →
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    className="block rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold"
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
                  >
                    Approve pending website facts
                  </button>
                </div>
              ) : null}

              {settingsSub === "connections" ? (
                <div className="mt-4 space-y-2 text-sm">
                  <p>Number: {agent.resources.numberLabel}</p>
                  <p>Calendar: {agent.resources.calendarLabel}</p>
                  <p>Workflow: {agent.resources.workflowLabel}</p>
                  <Link href={guidedHref} className="font-semibold text-violet-700">
                    Change connections in guided setup →
                  </Link>
                </div>
              ) : null}

              {settingsSub === "voice" ? (
                <div className="mt-4 max-w-lg space-y-4 text-sm">
                  <p className="text-slate-600">
                    {agent.profile.voiceSummary || "Voice configured in guided setup"}
                  </p>
                  <label className="block">
                    Opening greeting
                    <textarea
                      className="mt-1 min-h-[88px] w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={greetingDraft}
                      onChange={(e) => setGreetingDraft(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !greetingDraft.trim()}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() =>
                      void (async () => {
                        setBusy(true);
                        try {
                          const proposal = await runCommand("propose_setup_change", {
                            summary: "Update opening greeting from Settings",
                            voice: { openingGreeting: greetingDraft.trim() },
                          });
                          setPendingProposalId(String(proposal.id));
                          setSection("talk");
                          setChat((prev) => [
                            ...prev,
                            {
                              role: "agent",
                              text: `Proposed greeting update. Review and Put change live when ready.`,
                              proposalId: String(proposal.id),
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
                    Propose greeting change
                  </button>
                  <Link href={guidedHref} className="block font-semibold text-violet-700">
                    Guided voice setup →
                  </Link>
                </div>
              ) : null}

              {settingsSub === "health" ? (
                <div className="mt-4 space-y-2">
                  {(
                    [
                      ["Telnyx", agent.health.telnyxAssistant],
                      ["Number", agent.health.assignedNumber],
                      ["Calendar", agent.health.calendar],
                      ["Booking tools", agent.health.bookingTools],
                      ["Slot holds", agent.health.slotHolds],
                      ["Workflow", agent.health.primaryWorkflow],
                      ["SMS", agent.health.smsConfirmation],
                      ["Deployment drift", agent.health.deploymentDrift],
                    ] as const
                  ).map(([label, check]) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-[12px] text-slate-600">{check?.message}</p>
                      </div>
                      <Pill tone={check?.status === "healthy" ? "ok" : "warn"}>
                        {check?.status || "unknown"}
                      </Pill>
                    </div>
                  ))}
                  {drift ? (
                    <p className="pt-2 text-[12px] text-slate-600">
                      {drift.message}
                      {drift.drifted
                        ? " — redeploy expected version, import external change, or pause Amy."
                        : ""}
                    </p>
                  ) : null}
                  {setupReadiness ? (
                    <p className="text-[12px] text-slate-500">
                      Setup checklist: {setupReadiness.completeCount}/{setupReadiness.totalCount}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {settingsSub === "autonomy" ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p className="font-semibold">
                    Mode: {String(autonomy?.label || agent.autonomyMode || "Balanced")}
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-slate-700">
                    {((autonomy?.allowed as string[] | undefined) || []).slice(0, 6).map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </main>

        {/* Right rail — matches mockup */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Today</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Calls answered</dt>
                <dd className="font-semibold">{agent.metrics.callsAnswered}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Appointments booked</dt>
                <dd className="font-semibold">{agent.metrics.appointmentsBooked}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Booking conversion</dt>
                <dd className="font-semibold">{agent.metrics.bookingConversionRate}%</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Transfers</dt>
                <dd className="font-semibold">{agent.metrics.transfers}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
              <Pill tone="warn">{attention?.openCount ?? 0}</Pill>
            </div>
            <ul className="mt-3 space-y-2 text-[12px] text-slate-600">
              {(attention?.items as Array<{ id: string; title: string }> | undefined)
                ?.slice(0, 4)
                .map((item) => (
                  <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    {item.title}
                  </li>
                )) || <li className="text-slate-500">Nothing urgent</li>}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
            <div className="mt-3 flex flex-col gap-2">
              {[
                ["Review failed bookings", () => { setSection("work"); setWorkSub("activity"); void ask("Show recent failures"); }],
                ["Add bookable service", () => { window.location.href = guidedHref; }],
                ["Change booking hours", () => { setSection("settings"); setSettingsSub("booking"); }],
                [
                  `Duplicate ${name}`,
                  () => {
                    setSection("talk");
                    void ask("Create another Amy for a new location");
                  },
                ],
              ].map(([label, fn]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => (fn as () => void)()}
                  className="rounded-lg px-2 py-2 text-left text-[12px] font-semibold text-violet-700 hover:bg-violet-50"
                >
                  {label as string}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SubNav({
  items,
  current,
  onChange,
}: {
  items: Array<[string, string]>;
  current: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
      {items.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[12px] font-semibold",
            current === id ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
