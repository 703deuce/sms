"use client";

import { TEST_SCENARIOS } from "@/lib/solutions/appointment-receptionist/defaults";
import type {
  AppointmentReceptionistWizardState,
  TestScenarioId,
} from "@/lib/solutions/appointment-receptionist/types";
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
import { useEffect, useState } from "react";
import { SelectableCard, SidePanel, StatusPill } from "../ui";

type ToolLog = { name: string; system: string; status: "ok" | "pending" | "error" };

export function TestStep({
  state,
  patch,
  onEnsureAgent,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  /** Persist draft + build_for_test so WebRTC can talk to the real assistant. */
  onEnsureAgent?: () => Promise<{ agentId: string; telnyxAssistantId?: string | null } | null>;
}) {
  const scenario =
    TEST_SCENARIOS.find((s) => s.id === state.testScenario) || TEST_SCENARIOS[2];
  const [mode, setMode] = useState<"browser" | "my_phone" | "agent">("browser");
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");
  const [tools, setTools] = useState<ToolLog[]>([]);
  const [assistantId, setAssistantId] = useState<string | null>(
    state.telnyxAssistantId || null,
  );

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
    await prepareLiveTest();
    // Visual expected-tool checklist for the selected scenario (live talk uses WebRTC above).
    if (scenario.id === "appointment_booking") {
      setTools([
        { name: "Check availability", system: "Calendar", status: "ok" },
        { name: "Book appointment", system: "Calendar", status: "ok" },
        {
          name: "Send SMS confirmation",
          system: "SMS",
          status: state.bookingBehavior.sendSmsAfterBooking ? "pending" : "ok",
        },
      ]);
    } else if (scenario.id === "transfer" || scenario.id === "frustrated") {
      setTools([{ name: "Transfer call", system: "Phone", status: "ok" }]);
    } else {
      setTools([{ name: "Search knowledge", system: "Knowledge", status: "ok" }]);
    }
    patch({ lastTestPassed: true });
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Test your receptionist
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Talk back and forth with the real Telnyx assistant — same voice and tools as
            after you activate. Guided scenarios below help you know what to try.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Test scenarios
            </p>
            {TEST_SCENARIOS.map((s) => (
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
                {scenario.outcomes.map((o) => (
                  <li key={o} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-success" />
                    {o}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Try saying: “{scenario.prompt}”
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
              <dd className="text-foreground">{scenario.title}</dd>
            </div>
          </dl>
        </div>
      </SidePanel>
    </div>
  );
}
