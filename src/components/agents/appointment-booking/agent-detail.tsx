"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import { cn } from "@/lib/utils";
import { AmyHomePanel } from "@/components/agents/appointment-booking/amy-home-panel";

type PrimarySection = "home" | "talk" | "work" | "build" | "settings";
type WorkSub = "activity" | "calls" | "appointments" | "attention" | "results";
type BuildSub = "workflow" | "tests" | "drafts" | "versions" | "deployments";
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
  "What happened on the last call?",
  "How did today go?",
  "What exactly do you do?",
  "Change the minimum notice to four hours",
  "Require an email for this service",
  "Test yourself",
  "Fix what you can safely fix",
  "Create another Amy for Richmond",
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
  const [panelError, setPanelError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<PrimarySection>("home");
  const [workSub, setWorkSub] = useState<WorkSub>("activity");
  const [buildSub, setBuildSub] = useState<BuildSub>("versions");
  const [settingsSub, setSettingsSub] = useState<SettingsSub>("booking");
  const [activity, setActivity] = useState<unknown[]>([]);
  const [appointments, setAppointments] = useState<unknown[]>([]);
  const [proposals, setProposals] = useState<unknown[]>([]);
  const [workflowDrafts, setWorkflowDrafts] = useState<unknown[]>([]);
  const [attention, setAttention] = useState<{ items?: unknown[]; openCount?: number } | null>(
    null,
  );
  const [memory, setMemory] = useState<Record<string, unknown> | null>(null);
  const [autonomy, setAutonomy] = useState<Record<string, unknown> | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [runtimes, setRuntimes] = useState<unknown[]>([]);
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

  // Deep links: ?tab=work&sub=calls | memory→settings/knowledge | health→settings/health
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = String(params.get("tab") || "").toLowerCase();
    const sub = String(params.get("sub") || "").toLowerCase();
    if (tab === "talk" || tab === "home" || tab === "work" || tab === "build" || tab === "settings") {
      setSection(tab as PrimarySection);
    }
    if (tab === "memory" || tab === "knowledge") {
      setSection("settings");
      setSettingsSub("knowledge");
    }
    if (tab === "health") {
      setSection("settings");
      setSettingsSub("health");
    }
    if (tab === "versions") {
      setSection("build");
      setBuildSub("versions");
    }
    if (tab === "activity") {
      setSection("work");
      setWorkSub("activity");
    }
    if (sub === "calls" || sub === "appointments" || sub === "attention" || sub === "results" || sub === "activity") {
      setWorkSub(sub as WorkSub);
    }
    if (sub === "tests" || sub === "workflow" || sub === "versions" || sub === "drafts" || sub === "deployments") {
      setBuildSub(sub as BuildSub);
    }
    if (
      sub === "booking" ||
      sub === "fields" ||
      sub === "knowledge" ||
      sub === "autonomy" ||
      sub === "health" ||
      sub === "voice" ||
      sub === "connections" ||
      sub === "general"
    ) {
      setSettingsSub(sub as SettingsSub);
    }
  }, []);

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
    if (!agent) return;
    void (async () => {
      setPanelError(null);
      try {
        if (section === "home" || section === "talk" || (section === "work" && workSub === "attention")) {
          setAttention(await runCommand("get_attention_inbox"));
        }
        if (section === "home") {
          const [act, props, report] = await Promise.all([
            runCommand("search_agent_activity", { limit: 8 }),
            runCommand("list_change_proposals"),
            runCommand("get_daily_report"),
          ]);
          setActivity(act.traces || []);
          setProposals(props.proposals || []);
          setRecommendations(
            Array.isArray(report?.recommendations) ? report.recommendations.map(String) : [],
          );
        }
        if (section === "talk" || section === "home") {
          const readiness = await runCommand("get_setup_readiness");
          setSetupReadiness(readiness);
          if (section === "talk" && !talkSeeded && readiness?.interviewOpening) {
            setChat([{ role: "agent", text: String(readiness.interviewOpening) }]);
            setTalkSeeded(true);
          }
        }
        if (section === "work") {
          if (workSub === "activity" || workSub === "calls") {
            const data = await runCommand("search_agent_activity", { limit: 25 });
            setActivity(data.traces || []);
          }
          if (workSub === "appointments") {
            const data = await runCommand("list_agent_appointments", { limit: 30 });
            setAppointments(data.appointments || []);
          }
        }
        if (section === "build") {
          const props = await runCommand("list_change_proposals");
          setProposals(props.proposals || []);
          if (buildSub === "workflow" || buildSub === "drafts") {
            const drafts = await runCommand("list_workflow_drafts");
            setWorkflowDrafts(drafts.drafts || []);
          }
          if (buildSub === "tests") {
            setTestSuite(await runCommand("run_agent_test_suite"));
          }
          if (buildSub === "deployments") {
            setDrift(await runCommand("get_deployment_drift"));
            const reg = await runCommand("get_runtime_registry");
            setRuntimes(reg.runtimes || []);
          }
        }
        if (section === "settings") {
          if (settingsSub === "knowledge") setMemory(await runCommand("get_memory_view"));
          if (settingsSub === "autonomy") {
            setAutonomy(await runCommand("get_autonomy_policy"));
            const reg = await runCommand("get_runtime_registry");
            setRuntimes(reg.runtimes || []);
          }
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
      } catch (err) {
        setPanelError(err instanceof Error ? err.message : String(err));
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
            <Link
              href={guidedHref}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
            >
              Edit setup
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSection("talk");
                void ask("Create another Amy for Richmond");
              }}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
            >
              Duplicate
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
          {panelError ? (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-[12px] text-amber-900">
              Panel load issue: {panelError}
            </div>
          ) : null}
          {section === "home" ? (
            <AmyHomePanel
              agent={agent}
              attentionOpenCount={attention?.openCount ?? 0}
              recommendations={recommendations}
              latestActivity={
                activity as Array<{
                  callId: string;
                  summary: string;
                  outcome: string;
                  startedAt: string;
                }>
              }
              pendingProposalCount={
                (proposals as Array<{ status?: string }>).filter(
                  (p) => !p.status || /pending|draft|proposed/i.test(String(p.status)),
                ).length
              }
              onTalk={() => setSection("talk")}
              onTest={() => {
                setSection("build");
                setBuildSub("tests");
              }}
              onPauseResume={() => void pauseOrResume()}
              onEditSetup={() => {
                window.location.href = guidedHref;
              }}
              onDuplicate={() => {
                setSection("talk");
                void ask("Create another Amy for Richmond");
              }}
              onOpenWork={() => {
                setSection("work");
                setWorkSub("activity");
              }}
              onOpenAttention={() => {
                setSection("work");
                setWorkSub("attention");
              }}
            />
          ) : null}

          {section === "talk" ? (
            <div className="flex min-h-[28rem] flex-col">
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
                  ["calls", "Calls"],
                  ["appointments", "Appointments"],
                  ["attention", "Attention"],
                  ["results", "Results"],
                ]}
                current={workSub}
                onChange={(id) => setWorkSub(id as WorkSub)}
              />
              {workSub === "activity" || workSub === "calls" ? (
                <div className="mt-4 space-y-3">
                  {activity.length === 0 ? (
                    <p className="text-sm text-slate-500">No recent call activity yet.</p>
                  ) : (
                    (
                      activity as Array<{
                        callId: string;
                        summary: string;
                        outcome: string;
                        startedAt: string;
                        agentVersionId?: string | null;
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
                          {t.agentVersionId ? ` · version ${t.agentVersionId.slice(0, 8)}…` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-[12px] font-semibold">
                          <Link href={`/voice/calls/${t.callId}`} className="text-violet-700">
                            {workSub === "calls"
                              ? "Recording / transcript / tools"
                              : "Open call evidence"}
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
                            Employee timeline
                          </button>
                          <button
                            type="button"
                            className="text-slate-700"
                            onClick={() => {
                              setSection("talk");
                              void ask(`What happened on the last call?`);
                            }}
                          >
                            Ask {name}
                          </button>
                        </div>
                        {selectedCallId === t.callId && timeline ? (
                          <ol className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                            {(
                              timeline as Array<{
                                timeLabel: string;
                                headline: string;
                                detail?: string;
                                href?: string;
                              }>
                            ).map((item, idx) => (
                              <li key={`${item.timeLabel}-${idx}`}>
                                <span className="font-semibold">{item.timeLabel}</span> —{" "}
                                {item.href ? (
                                  <Link href={item.href} className="text-violet-700">
                                    {item.headline}
                                  </Link>
                                ) : (
                                  item.headline
                                )}
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
              {workSub === "appointments" ? (
                <div className="mt-4 space-y-3">
                  {appointments.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No appointments linked to {name}&apos;s calls yet.
                    </p>
                  ) : (
                    (
                      appointments as Array<{
                        id: string;
                        serviceName?: string | null;
                        startsAt: string;
                        status: string;
                        callerPhone?: string | null;
                        externalId?: string | null;
                        href?: string | null;
                      }>
                    ).map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {a.serviceName || "Appointment"} · {a.status}
                          </p>
                          <p className="text-[12px] text-slate-500">
                            {new Date(a.startsAt).toLocaleString()}
                            {a.callerPhone ? ` · ${a.callerPhone}` : ""}
                            {a.externalId ? " · calendar verified id present" : " · internal record"}
                          </p>
                        </div>
                        {a.href ? (
                          <Link href={a.href} className="font-semibold text-violet-700">
                            Evidence
                          </Link>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              ) : null}
              {workSub === "results" ? (
                <div className="mt-4 space-y-4">
                  <p className="text-[12px] text-slate-500">
                    Window: last {agent.metrics.windowDays} days
                    {agent.metrics.previousWindow
                      ? ` · prior window conversion ${agent.metrics.previousWindow.bookingConversionRate}%`
                      : ""}
                    . Definitions: booked = appointmentBooked or non-cancelled VoiceAppointment;
                    conversion = booked / calls answered.
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      ["Calls", agent.metrics.callsAnswered],
                      ["Booking conversations", agent.metrics.bookingConversationsStarted],
                      ["Booked", agent.metrics.appointmentsBooked],
                      ["Conversion", `${agent.metrics.bookingConversionRate}%`],
                      ["Transfers", agent.metrics.transfers],
                      ["Abandoned booking", agent.metrics.abandonedBookingConversations],
                      ["Failures", agent.metrics.bookingFailures],
                      ["Calendar failures", agent.metrics.calendarFailures],
                      ["SMS confirmations", agent.metrics.confirmationSmsSent],
                    ].map(([l, v]) => (
                      <div key={String(l)} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[11px] uppercase text-slate-400">{l}</p>
                        <p className="mt-1 text-xl font-semibold">{v}</p>
                      </div>
                    ))}
                  </div>
                  {agent.metrics.mostRequestedServices.length ? (
                    <div>
                      <h3 className="text-sm font-semibold">Most requested services</h3>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {agent.metrics.mostRequestedServices.map((s) => (
                          <li key={s.service}>
                            {s.service}: {s.count}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
                  ["drafts", "Drafts"],
                  ["versions", "Versions"],
                  ["deployments", "Deployments"],
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
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            v{v.version}
                            {v.id === agent.currentVersionId ? " · Current" : ""} —{" "}
                            {v.changeLog || "No changelog"}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            deploy: {v.deploymentStatus || "—"} · tests: {v.testStatus || "—"}
                          </span>
                        </div>
                        {v.id !== agent.currentVersionId ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="mt-2 text-[12px] font-semibold text-violet-700"
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
                          >
                            Roll back to this version
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {buildSub === "drafts" ? (
                <div className="mt-4 space-y-3 text-sm">
                  <h3 className="font-semibold">Change proposals</h3>
                  {(proposals as Array<{ id: string; summary: string; status: string }>).length ===
                  0 ? (
                    <p className="text-slate-500">No proposals yet.</p>
                  ) : (
                    (proposals as Array<{ id: string; summary: string; status: string }>).map(
                      (p) => (
                        <div key={p.id} className="rounded-xl border border-slate-100 px-4 py-3">
                          {p.summary} · {p.status}
                        </div>
                      ),
                    )
                  )}
                  <h3 className="pt-2 font-semibold">Workflow drafts</h3>
                  {(workflowDrafts as Array<{ id: string; name: string; validationStatus: string }>)
                    .length === 0 ? (
                    <p className="text-slate-500">
                      No workflow drafts. Ask {name} to create an after-hours flow.
                    </p>
                  ) : (
                    (
                      workflowDrafts as Array<{
                        id: string;
                        name: string;
                        validationStatus: string;
                      }>
                    ).map((d) => (
                      <div key={d.id} className="rounded-xl border border-slate-100 px-4 py-3">
                        {d.name} · {d.validationStatus}
                      </div>
                    ))
                  )}
                </div>
              ) : null}
              {buildSub === "deployments" ? (
                <div className="mt-4 space-y-4 text-sm">
                  <div className="rounded-xl border border-slate-100 px-4 py-3">
                    <p className="font-semibold">Telnyx / drift</p>
                    <p className="mt-1 text-slate-600">
                      {drift?.message || agent.health.deploymentDrift.message}
                    </p>
                    <p className="mt-2 text-[12px] text-slate-500">
                      Assistant: {agent.telnyxAssistantId || "—"} · Expected version:{" "}
                      {drift?.expectedVersionNumber ?? "—"} · Drifted:{" "}
                      {String(drift?.drifted ?? agent.health.deploymentDrift.status !== "healthy")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 px-4 py-3">
                    <p className="font-semibold">Routing</p>
                    <p className="mt-1 text-slate-600">
                      Number {agent.resources.numberLabel} · {agent.health.assignedNumber.message}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Runtime registry</p>
                    <ul className="mt-2 space-y-2">
                      {(
                        runtimes as Array<{
                          id: string;
                          label: string;
                          writePermission: string;
                          promptSource: string;
                        }>
                      ).map((r) => (
                        <li key={r.id} className="rounded-xl bg-slate-50 px-3 py-2 text-[12px]">
                          <span className="font-semibold">{r.label}</span> · {r.writePermission}
                          <span className="block text-slate-500">{r.promptSource}</span>
                        </li>
                      ))}
                    </ul>
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
                <div className="mt-4 space-y-5 text-sm">
                  <div>
                    <h3 className="font-semibold">Shared Company Brain</h3>
                    <p className="mt-1 text-[12px] text-slate-500">
                      Company facts, hours, services — owned by the workspace, not only Amy.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {(
                        (memory?.sharedFacts as Array<{
                          id: string;
                          summary: string;
                          source?: string;
                          approvalState?: string;
                        }> | undefined) ||
                        agent.businessBrain.knowledgeFacts.map((f, i) => ({
                          id: `f${i}`,
                          summary: `${f.label}: ${f.summary}`,
                          source: "business_brain",
                          approvalState: f.status || "approved",
                        }))
                      )
                        .slice(0, 12)
                        .map((f) => (
                          <li key={f.id} className="rounded-xl border border-slate-100 px-3 py-2">
                            <p>{f.summary}</p>
                            <p className="text-[11px] text-slate-500">
                              source: {f.source || "—"} · {f.approvalState || "—"}
                            </p>
                          </li>
                        ))}
                    </ul>
                    <Link href="/company-brain" className="mt-2 inline-flex font-semibold text-violet-700">
                      Open Company Brain →
                    </Link>
                  </div>
                  <div>
                    <h3 className="font-semibold">Amy-specific knowledge</h3>
                    <ul className="mt-2 space-y-2">
                      {(
                        (memory?.agentFacts as Array<{
                          id: string;
                          summary: string;
                          source?: string;
                        }> | undefined) || []
                      ).map((f) => (
                        <li key={f.id} className="rounded-xl bg-slate-50 px-3 py-2">
                          {f.summary}
                          <span className="block text-[11px] text-slate-500">{f.source}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold">Review queue</h3>
                    {(memory?.learning as Array<{ id: string; summary?: string; title?: string }> | undefined)
                      ?.length ? (
                      (memory!.learning as Array<{ id: string; summary?: string; title?: string }>).map(
                        (item) => (
                          <div key={item.id} className="mt-2 rounded-xl border border-amber-100 px-3 py-2">
                            {item.title || item.summary}
                          </div>
                        ),
                      )
                    ) : (
                      <p className="mt-1 text-slate-500">No pending learning items.</p>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold"
                      onClick={() =>
                        void (async () => {
                          setBusy(true);
                          try {
                            await runCommand("approve_knowledge_facts", {
                              approveAllPending: true,
                            });
                            setMemory(await runCommand("get_memory_view"));
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
                      ["Telnyx assistant", agent.health.telnyxAssistant],
                      ["Assigned number / routing", agent.health.assignedNumber],
                      ["Calendar authorization", agent.health.calendar],
                      ["Booking tools", agent.health.bookingTools],
                      ["Slot holds", agent.health.slotHolds],
                      ["Workflow service", agent.health.primaryWorkflow],
                      ["Confirmation SMS", agent.health.smsConfirmation],
                      ["Webhook endpoint", agent.health.webhookEndpoint],
                      ["Latest deployment", agent.health.latestDeployment],
                      ["Prompt drift", agent.health.deploymentDrift],
                      ["Transfer destinations", agent.health.transferTargets],
                    ] as const
                  ).map(([label, check]) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-[12px] text-slate-600">{check?.message}</p>
                        {check?.required ? (
                          <p className="text-[11px] text-slate-400">Required dependency</p>
                        ) : null}
                      </div>
                      <Pill
                        tone={
                          check?.status === "healthy"
                            ? "ok"
                            : check?.status === "failed"
                              ? "bad"
                              : "warn"
                        }
                      >
                        {check?.status || "unknown"}
                      </Pill>
                    </div>
                  ))}
                  {(agent.readiness?.blockers || []).length ? (
                    <div className="space-y-2 pt-2">
                      <h3 className="text-sm font-semibold">Impact & recommended actions</h3>
                      {(agent.readiness?.blockers || []).map((b) => (
                        <div
                          key={b.code}
                          className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-[12px]"
                        >
                          <p className="font-medium text-sm">{b.message}</p>
                          <p className="mt-1 text-slate-600">Still can: review readiness · {b.affectedFunctionality}</p>
                          <p className="mt-1 text-slate-700">{b.recommendedAction}</p>
                          <p className="mt-1 text-slate-500">
                            Degraded mode:{" "}
                            {agent.identity.status === "degraded" ? "yes — answering with reduced booking" : "no"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
                <div className="mt-4 space-y-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      Mode: {String(autonomy?.label || agent.autonomyMode || "Balanced")}
                    </p>
                    {(["conservative", "balanced", "autonomous"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={busy}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-[12px] font-semibold capitalize",
                          (agent.autonomyMode || "balanced") === mode
                            ? "border-violet-300 bg-violet-50 text-violet-800"
                            : "border-slate-200",
                        )}
                        onClick={() =>
                          void (async () => {
                            setBusy(true);
                            try {
                              await runCommand("set_autonomy_budget", {
                                budget: mode,
                                confirm: true,
                              });
                              setAutonomy(await runCommand("get_autonomy_policy"));
                              await load();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err));
                            } finally {
                              setBusy(false);
                            }
                          })()
                        }
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  {(
                    [
                      ["May always", (autonomy?.buckets as { mayAlways?: string[] } | undefined)?.mayAlways],
                      [
                        "May auto-repair",
                        (autonomy?.buckets as { mayAutoRepair?: string[] } | undefined)?.mayAutoRepair,
                      ],
                      [
                        "Must request approval",
                        (autonomy?.buckets as { mustRequestApproval?: string[] } | undefined)
                          ?.mustRequestApproval,
                      ],
                      [
                        "Never allowed",
                        (autonomy?.buckets as { neverAllowed?: string[] } | undefined)?.neverAllowed ||
                          (autonomy?.forbidden as string[] | undefined),
                      ],
                    ] as const
                  ).map(([title, items]) => (
                    <div key={title}>
                      <h3 className="font-semibold">{title}</h3>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
                        {(items || []).map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {(runtimes as Array<{ id: string; label: string; writePermission: string }>).length ? (
                    <div>
                      <h3 className="font-semibold">Four runtimes</h3>
                      <ul className="mt-2 space-y-1 text-[12px] text-slate-600">
                        {(
                          runtimes as Array<{
                            id: string;
                            label: string;
                            writePermission: string;
                          }>
                        ).map((r) => (
                          <li key={r.id}>
                            {r.label} — write: {r.writePermission}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </main>

        {/* Right rail — matches mockup */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Today (24h)</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Calls answered</dt>
                <dd className="font-semibold">{agent.metrics.today?.callsAnswered ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Appointments booked</dt>
                <dd className="font-semibold">{agent.metrics.today?.appointmentsBooked ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Booking conversion</dt>
                <dd className="font-semibold">{agent.metrics.today?.bookingConversionRate ?? 0}%</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Transfers</dt>
                <dd className="font-semibold">{agent.metrics.today?.transfers ?? 0}</dd>
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
