"use client";

import { TEST_SCENARIOS } from "@/lib/solutions/appointment-receptionist/defaults";
import type {
  AppointmentReceptionistWizardState,
  TestScenarioId,
} from "@/lib/solutions/appointment-receptionist/types";
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
import { useMemo, useState } from "react";
import { SelectableCard, SidePanel, StatusPill } from "../ui";

type ChatMsg = { role: "ai" | "caller"; text: string };
type ToolLog = { name: string; system: string; status: "ok" | "pending" | "error" };

export function TestStep({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const scenario =
    TEST_SCENARIOS.find((s) => s.id === state.testScenario) || TEST_SCENARIOS[2];
  const [mode, setMode] = useState<"browser" | "my_phone" | "agent">("browser");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "ai",
      text: `Thank you for calling ${state.businessName || "our office"}. This is ${state.agentName || "Maya"}. How may I help you today?`,
    },
  ]);
  const [tools, setTools] = useState<ToolLog[]>([]);

  const transcript = useMemo(() => {
    if (scenario.id === "appointment_booking") {
      return [
        { role: "caller" as const, text: scenario.prompt },
        {
          role: "ai" as const,
          text: "Of course. What type of appointment are you looking for?",
        },
        { role: "caller" as const, text: "An initial consultation tomorrow morning." },
        {
          role: "ai" as const,
          text: "I have Tuesday at 9:30 a.m. or 10:30 a.m. available. Which works better?",
        },
        { role: "caller" as const, text: "10:30 works." },
        {
          role: "ai" as const,
          text: "I have you scheduled for tomorrow at 10:30 a.m. for an initial consultation. Is that correct?",
        },
        { role: "caller" as const, text: "Yes." },
        {
          role: "ai" as const,
          text: "You're booked. I'll send a confirmation text shortly. Anything else I can help with?",
        },
      ];
    }
    return [
      { role: "caller" as const, text: scenario.prompt },
      {
        role: "ai" as const,
        text: "Let me check that for you using our business information.",
      },
    ];
  }, [scenario, state.agentName, state.businessName]);

  async function runScenario() {
    setRunning(true);
    setMessages([
      {
        role: "ai",
        text: `Thank you for calling ${state.businessName || "our office"}. This is ${state.agentName || "Maya"}. How may I help you today?`,
      },
    ]);
    setTools([]);
    for (let i = 0; i < transcript.length; i++) {
      await new Promise((r) => setTimeout(r, 350));
      setMessages((prev) => [...prev, transcript[i]]);
      if (scenario.id === "appointment_booking") {
        if (i === 2) {
          setTools([{ name: "Check availability", system: "Calendar", status: "ok" }]);
        }
        if (i === 6) {
          setTools([
            { name: "Check availability", system: "Calendar", status: "ok" },
            { name: "Book appointment", system: "Calendar", status: "ok" },
            {
              name: "Send SMS confirmation",
              system: "SMS",
              status: state.bookingBehavior.sendSmsAfterBooking ? "pending" : "ok",
            },
          ]);
        }
      }
    }
    patch({ lastTestPassed: true });
    setRunning(false);
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        <div className="mb-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Test your receptionist
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Run guided scenarios before you go live.
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
            </div>
          </div>

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
              <Button size="sm" onClick={() => void runScenario()} disabled={running}>
                <Play className="h-3.5 w-3.5" />
                {running ? "Running…" : "Run test scenario"}
              </Button>
            </div>

            <div className="max-h-[360px] space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`flex ${m.role === "caller" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === "caller"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="mb-0.5 text-[10px] font-semibold uppercase opacity-70">
                      {m.role === "ai" ? "AI Receptionist" : "Caller"}
                    </p>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {tools.length ? (
              <div className="border-t border-border px-4 py-3">
                <p className="mb-2 text-xs font-semibold">Live tools log</p>
                <ul className="space-y-1.5 text-xs">
                  {tools.map((t) => (
                    <li key={t.name} className="flex items-center justify-between">
                      <span>
                        <span className="font-medium">{t.name}</span>
                        <span className="text-muted-foreground"> ({t.system})</span>
                      </span>
                      {t.status === "ok" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : t.status === "pending" ? (
                        <Clock className="h-3.5 w-3.5 text-warning" />
                      ) : (
                        <StatusPill tone="warning">Error</StatusPill>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <SidePanel title="Test summary">
        <div className="grid gap-2">
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Average response latency</p>
            <p className="mt-1 text-xl font-semibold">1.4s</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-success">
              <ArrowDown className="h-3 w-3" />
              Good · −0.3s
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Tool success rate</p>
            <p className="mt-1 text-xl font-semibold">100%</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-success">
              <ArrowUp className="h-3 w-3" />
              Excellent
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Last test result</span>
            <StatusPill tone={state.lastTestPassed ? "success" : "muted"}>
              {state.lastTestPassed ? "Passed" : "Not run"}
            </StatusPill>
          </div>
          <dl className="mt-3 space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <dt>Scenario</dt>
              <dd className="text-foreground">{scenario.title}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Duration</dt>
              <dd className="text-foreground">2m 14s</dd>
            </div>
            <div className="flex justify-between">
              <dt>Turns</dt>
              <dd className="text-foreground">6</dd>
            </div>
          </dl>
        </div>
        <button type="button" className="text-xs font-medium text-primary">
          View full test history
        </button>
      </SidePanel>
    </div>
  );
}
