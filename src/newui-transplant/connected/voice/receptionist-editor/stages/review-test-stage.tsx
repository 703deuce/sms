"use client";

import { TestStep } from "@/components/solutions/appointment-receptionist/steps/test-step";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { capabilityOptionsForPreset } from "@/lib/solutions/appointment-receptionist/wizard-presets";
import { Panel, Pill, Rows } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import type { ReceptionistEditorStage } from "../types";

function strategyLabel(strategy: string | undefined) {
  if (strategy === "REQUEST_ONLY") return "Request preferred time";
  if (strategy === "SEND_LINK") return "Send booking link";
  if (strategy === "NONE") return "Message / follow up";
  return "Book during the call";
}

export function ReviewTestStage({
  state,
  patch,
  calendarSummary,
  transferIssues,
  onGoToStage,
  onEnsureAgent,
  isLive,
  pendingPublication,
  hasLocalEdits,
  busy,
  onPublish,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  calendarSummary: { connected: boolean; label: string };
  transferIssues: Array<{ message: string }>;
  onGoToStage: (s: ReceptionistEditorStage) => void;
  onEnsureAgent: () => Promise<{ agentId: string } | null>;
  isLive: boolean;
  pendingPublication: boolean;
  hasLocalEdits: boolean;
  busy: boolean;
  onPublish: () => void;
}) {
  const caps = capabilityOptionsForPreset(state.preset).filter((o) =>
    state.capabilities.includes(o.id),
  );
  const enabledFields = state.collectFields.filter((f) => f.enabled !== false);
  const requiredFields = enabledFields.filter((f) => f.required);

  const readiness: Array<{ label: string; ok: boolean; fix?: () => void }> = [
    {
      label: "Voice selected",
      ok: Boolean(state.voiceId),
      fix: () => onGoToStage("identity"),
    },
    {
      label: "Greeting configured",
      ok: Boolean(state.openingGreeting?.trim()),
      fix: () => onGoToStage("identity"),
    },
    {
      label: "Caller information",
      ok: enabledFields.length > 0,
      fix: () => onGoToStage("responsibilities"),
    },
    {
      label: "Calendar (when booking)",
      ok:
        !state.capabilities.includes("book_appointments") ||
        (state.bookingStrategy === "NONE" ? true : calendarSummary.connected),
      fix: () => onGoToStage("responsibilities"),
    },
    {
      label: "Transfer setup",
      ok:
        !state.capabilities.includes("transfer_calls") || transferIssues.length === 0,
      fix: () => onGoToStage("responsibilities"),
    },
  ];

  const publishCopy = hasLocalEdits
    ? "Save your changes before publishing."
    : !isLive
      ? "Your draft is ready to publish."
      : pendingPublication
        ? "Live callers are still using the previously published configuration."
        : "Your receptionist is live and up to date.";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Panel
            title="Ready to take calls?"
            description="Review the important parts of your receptionist before publishing."
          >
            <Rows
              items={[
                {
                  label: "Identity & voice",
                  value: `${state.agentName || "—"} · ${state.voiceLabel || "—"} · ${state.language}`,
                },
                {
                  label: "Greeting",
                  value:
                    state.openingGreeting.length > 80
                      ? `${state.openingGreeting.slice(0, 80)}…`
                      : state.openingGreeting || "—",
                },
                {
                  label: "Responsibilities",
                  value: caps.length ? caps.map((c) => c.title).join(", ") : "None enabled",
                },
                {
                  label: "Caller information",
                  value: `${enabledFields.length} fields (${requiredFields.length} required)${
                    state.qualificationEnabled ? " · Qualification on" : ""
                  }`,
                },
                {
                  label: "Appointment handling",
                  value: `${strategyLabel(state.bookingStrategy)} · ${
                    calendarSummary.connected ? calendarSummary.label : "No calendar"
                  }`,
                },
                {
                  label: "Messages & callbacks",
                  value:
                    state.callbackRequestsEnabled === false
                      ? "Off"
                      : `${state.callbackRequiredCollectFieldIds?.length || 0} required callback fields`,
                },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onGoToStage("identity")}>
                Edit identity & conversation
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onGoToStage("responsibilities")}
              >
                Edit responsibilities
              </Button>
            </div>
          </Panel>
        </div>
        <div className="lg:col-span-4">
          <Panel title="Readiness">
            <ul className="divide-y">
              {readiness.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-2 py-2.5 first:pt-0">
                  <span className="text-sm">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <Pill tone={row.ok ? "success" : "warning"}>{row.ok ? "Ready" : "Needs attention"}</Pill>
                    {!row.ok && row.fix ? (
                      <Button type="button" variant="ghost" size="xs" onClick={row.fix}>
                        Fix
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel
        title="Test receptionist"
        description="Test the saved draft before publishing it to live callers."
      >
        <TestStep state={state} patch={patch} onEnsureAgent={onEnsureAgent} />
      </Panel>

      <Panel title="Publish">
        <p className="text-sm text-muted-foreground">{publishCopy}</p>
        <div className="mt-4">
          <Button type="button" disabled={busy || hasLocalEdits} onClick={onPublish}>
            {busy ? "Working…" : isLive ? "Publish changes" : "Go live"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
