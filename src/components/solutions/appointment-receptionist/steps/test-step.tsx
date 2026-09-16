"use client";

import type {
  AppointmentReceptionistWizardState,
  TestScenarioId,
} from "@/lib/solutions/appointment-receptionist/types";
import { testScenariosForCapabilities } from "@/lib/solutions/appointment-receptionist/wizard-presets";
import { AgentBrowserCall } from "@/components/voice/agent-browser-call";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  Phone,
  Play,
  Monitor,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SelectableCard, SidePanel, StatusPill } from "../ui";

type ToolLog = { name: string; system: string; status: "ok" | "pending" | "error" };

export function TestStep({
  state,
  patch,
  onEnsureAgent,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  /** Persist draft + build_for_test so WebRTC can talk to the real assistant. */
  onEnsureAgent?: () => Promise<{ agentId: string; telnyxAssistantId?: string | null } | null>;
  presentation?: "legacy" | "mctb";
}) {
  const isMctb = presentation === "mctb";
  const scenarios = useMemo(
    () => testScenariosForCapabilities(state.capabilities),
    [state.capabilities],
  );
  const scenario =
    scenarios.find((s) => s.id === state.testScenario) || scenarios[0];
  const [mode, setMode] = useState<"browser" | "my_phone" | "agent">("browser");
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");
  const [tools, setTools] = useState<ToolLog[]>([]);
  const [assistantId, setAssistantId] = useState<string | null>(
    state.telnyxAssistantId || null,
  );
  const [qualityBusy, setQualityBusy] = useState(false);
  const [qualitySummary, setQualitySummary] = useState<string | null>(null);
  const [qualityResults, setQualityResults] = useState<
    Array<{ scenarioId: string; status: string; observed: string }>
  >([]);

  useEffect(() => {
    if (!scenarios.some((s) => s.id === state.testScenario) && scenarios[0]) {
      patch({ testScenario: scenarios[0].id as TestScenarioId });
    }
  }, [scenarios, state.testScenario, patch]);

  useEffect(() => {
    setAssistantId(state.telnyxAssistantId || null);
  }, [state.telnyxAssistantId]);

  async function prepareLiveTest() {
    if (!onEnsureAgent) {
      setPrepareError("Save the draft first so we can build a live test assistant.");
      return null;
    }
    setPreparing(true);
    setPrepareError("");
    try {
      const result = await onEnsureAgent();
      if (!result?.agentId) {
        setPrepareError("Could not create or update the draft agent.");
        return null;
      }
      patch({ agentId: result.agentId, telnyxAssistantId: result.telnyxAssistantId });
      setAssistantId(result.telnyxAssistantId || null);

      const build = await fetch(`/api/voice/agents/${result.agentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "build_for_test" }),
      });
      const buildJson = await build.json();
      if (!build.ok) {
        setPrepareError(buildJson.error || "Build & test failed");
        return result;
      }
      const nextAssistant =
        buildJson.telnyxAssistantId ||
        buildJson.data?.telnyxAssistantId ||
        result.telnyxAssistantId ||
        null;
      setAssistantId(nextAssistant);
      patch({ telnyxAssistantId: nextAssistant });
      return { ...result, telnyxAssistantId: nextAssistant };
    } catch (err) {
      setPrepareError(err instanceof Error ? err.message : "Prepare failed");
      return null;
    } finally {
      setPreparing(false);
    }
  }

  async function runGuidedScenario() {
    setTools([]);
    const prepared = await prepareLiveTest();
    // Expected-tool checklist only — does not claim tools ran successfully.
    if (scenario?.id === "appointment_booking") {
      setTools([
        { name: "Check availability", system: "Calendar", status: "pending" },
        { name: "Book appointment", system: "Calendar", status: "pending" },
        {
          name: "Send SMS confirmation",
          system: "SMS",
          status: "pending",
        },
      ]);
    } else if (scenario?.id === "transfer" || scenario?.id === "frustrated") {
      setTools([{ name: "Transfer call", system: "Phone", status: "pending" }]);
    } else {
      setTools([{ name: "Search knowledge", system: "Knowledge", status: "pending" }]);
    }
    // Mark checked only after a live assistant is available for talk-back.
    patch({ lastTestPassed: Boolean(prepared?.telnyxAssistantId || assistantId) });
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {isMctb ? "Test your voice agent" : "Test your receptionist"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMctb
              ? "Try real scenarios before the agent answers customer calls."
              : "Talk back and forth with the real Telnyx assistant — same voice and tools as after you activate. Guided scenarios below help you know what to try."}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Test scenarios
            </p>
            {scenarios.map((s) => (
              <SelectableCard
                key={s.id}
                selected={state.testScenario === s.id}
                onClick={() => patch({ testScenario: s.id as TestScenarioId })}
                title={s.title}
                description={s.prompt}
                className="p-3"
              />
            ))}
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs font-semibold">Expected outcomes</p>
              <ul className="mt-2 space-y-1.5 text-xs">
                {(scenario?.outcomes || []).map((o) => (
                  <li key={o} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-success" />
                    {o}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Try saying: “{scenario?.prompt || "Hello"}”
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                  {(
                    [
                      ["browser", "Test in browser", Monitor],
                      ["my_phone", "Call my phone", Phone],
                      ["agent", "Call the agent", Phone],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMode(id)}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                        mode === id
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={preparing}
                    onClick={() => void prepareLiveTest()}
                  >
                    {preparing ? "Building…" : "Build & ready test"}
                  </Button>
                  <Button size="sm" onClick={() => void runGuidedScenario()} disabled={preparing}>
                    <Play className="h-3.5 w-3.5" />
                    Mark scenario checked
                  </Button>
                </div>
              </div>

              {prepareError ? (
                <p className="border-b border-border bg-danger/5 px-4 py-2 text-xs text-danger">
                  {prepareError}
                </p>
              ) : null}

              <div className="p-4">
                {mode === "browser" ? (
                  state.agentId ? (
                    <AgentBrowserCall
                      agentId={state.agentId}
                      telnyxAssistantId={assistantId}
                      voiceLabel={state.voiceLabel}
                      status={assistantId ? "TESTING" : "DRAFT"}
                      onNeedBuild={() => void prepareLiveTest()}
                      onSaveDraft={async () => {
                        await prepareLiveTest();
                      }}
                      onSessionSuccess={() => patch({ lastTestPassed: true })}
                      onSessionFailure={() => patch({ lastTestPassed: false })}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                      <p className="text-sm font-medium">Prepare a live test assistant</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        We&apos;ll save your wizard answers, sync the selected voice (
                        {state.voiceLabel}), and open a real mic conversation.
                      </p>
                      <Button
                        className="mt-4"
                        disabled={preparing}
                        onClick={() => void prepareLiveTest()}
                      >
                        {preparing ? "Building…" : "Build & start live test"}
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
                    <p className="font-medium">
                      {mode === "my_phone" ? "Call my phone" : "Call the agent"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {mode === "my_phone"
                        ? "After activate, place a real PSTN call to your assigned number to compare phone audio. Browser WebRTC above is the fastest talk-back loop while still in the wizard."
                        : "Dial your Transovo number after activation to hear Astra/Allie/etc. over the telephone network."}
                    </p>
                    {state.phoneNumberE164 ? (
                      <p className="mt-3 text-xs">
                        Number:{" "}
                        <span className="font-medium text-foreground">
                          {state.phoneNumberE164}
                        </span>
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {tools.length ? (
                <div className="border-t border-border px-4 py-3">
                  <p className="mb-2 text-xs font-semibold">Scenario tools checklist</p>
                  <ul className="space-y-1.5 text-xs">
                    {tools.map((t) => (
                      <li key={t.name} className="flex items-center justify-between">
                        <span>
                          <span className="font-medium">{t.name}</span>
                          <span className="text-muted-foreground"> ({t.system})</span>
                        </span>
                        {t.status === "ok" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-warning" />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-medium">Agent Quality Studio</h3>
        <p className="text-sm text-muted-foreground">
          Headless scenario suite against your draft configuration (no PSTN).
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={qualityBusy || !state.agentId}
          onClick={async () => {
            if (!state.agentId) return;
            setQualityBusy(true);
            setQualitySummary(null);
            setQualityResults([]);
            try {
              const res = await fetch("/api/voice-v2/quality-studio/run", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ agentId: state.agentId }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) {
                setQualitySummary(json.error || "Quality run failed");
                return;
              }
              const results = (json.results || []) as Array<{
                scenarioId: string;
                status: string;
                observed: string;
              }>;
              setQualityResults(results);
              const fails = results.filter((r) => r.status === "FAIL");
              patch({
                qualityStudioLastRun: {
                  configHash: json.configHash,
                  testedAt: new Date().toISOString(),
                  publishBlockers: json.publishBlockers,
                },
              });
              setQualitySummary(
                fails.length
                  ? `${fails.length} scenario(s) failed`
                  : `PASS — ${(json.results || []).length} scenarios`,
              );
            } finally {
              setQualityBusy(false);
            }
          }}
        >
          {qualityBusy ? "Running…" : "Run Quality Studio"}
        </Button>
        {qualitySummary ? <p className="text-sm">{qualitySummary}</p> : null}
        {qualityResults.length > 0 ? (
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {qualityResults.map((r) => (
              <li key={r.scenarioId} className="flex justify-between gap-2">
                <span>{r.scenarioId.replace(/_/g, " ")}</span>
                <span
                  className={
                    r.status === "PASS"
                      ? "text-success"
                      : r.status === "FAIL"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {state.qualityStudioLastRun ? (
          <p className="text-xs text-muted-foreground">
            Last run {new Date(state.qualityStudioLastRun.testedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      <SidePanel title="Test summary">
        <div className="grid gap-2">
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Selected voice</p>
            <p className="mt-1 text-sm font-semibold">{state.voiceLabel}</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Live assistant</p>
            <p className="mt-1 text-sm font-semibold">
              {assistantId ? "Synced for WebRTC" : "Not built yet"}
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Average response latency</p>
            <p className="mt-1 text-xl font-semibold">—</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowDown className="h-3 w-3" />
              Measured during live call
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Tool success rate</p>
            <p className="mt-1 text-xl font-semibold">—</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUp className="h-3 w-3" />
              From live tool log
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Scenario checklist</span>
            <StatusPill tone={state.lastTestPassed ? "success" : "muted"}>
              {state.lastTestPassed ? "Checked" : "Not run"}
            </StatusPill>
          </div>
          <dl className="mt-3 space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <dt>Scenario</dt>
              <dd className="text-foreground">{scenario?.title || "—"}</dd>
            </div>
          </dl>
        </div>
      </SidePanel>
    </div>
  );
}
