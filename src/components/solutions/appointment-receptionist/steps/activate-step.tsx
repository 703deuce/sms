"use client";

import { buildReceptionistWillList } from "@/lib/solutions/appointment-receptionist/build-agent-config";
import {
  getWizardActivationIssues,
  hasBlockingActivationIssues,
} from "@/lib/solutions/appointment-receptionist/capability-checklist";
import type {
  ActivationMode,
  AppointmentReceptionistWizardState,
} from "@/lib/solutions/appointment-receptionist/types";
import { formatPhone } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { InfoCallout, SelectableCard, SidePanel, StatusPill } from "../ui";

export function ActivateStep({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const will = buildReceptionistWillList(state);
  const phone = state.phoneNumberE164
    ? formatPhone(state.phoneNumberE164)
    : "No number assigned";
  const [hasCalendar, setHasCalendar] = useState(state.calendarConnected);
  const books = state.capabilities.includes("book_appointments");
  const transfers = state.capabilities.includes("transfer_calls");

  useEffect(() => {
    fetch("/api/voice/calendars")
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data || []) as Array<{ status?: string; provider?: string }>;
        const connected = rows.some(
          (r) =>
            ["connected", "active", "ok"].includes(String(r.status || "")) &&
            ["google", "microsoft", "internal"].includes(String(r.provider || "")),
        );
        setHasCalendar(connected);
        if (connected && !state.calendarConnected) {
          patch({ calendarConnected: true });
        } else if (!connected && state.calendarConnected) {
          patch({ calendarConnected: false });
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issues = getWizardActivationIssues(state, {
    hasCalendarConnection: hasCalendar,
  });
  const blocked = hasBlockingActivationIssues(issues);

  const checklist = [
    {
      label: "Phone number",
      ok: Boolean(state.phoneNumberId),
      detail: state.phoneNumberId ? "Ready" : "Needed",
    },
    {
      label: "Receptionist name",
      ok: Boolean(state.agentName?.trim()),
      detail: state.agentName?.trim() || "Needed",
    },
    {
      label: "Business information",
      ok: Boolean(
        state.businessName?.trim() ||
          state.knowledgeItems.some(
            (k) => k.status === "complete" || Boolean(k.summary?.trim()),
          ) ||
          state.websiteUrl?.trim(),
      ),
      detail: state.businessName?.trim() ? "Ready" : "Needed",
    },
    {
      label: "Voice",
      ok: Boolean(state.voiceId),
      detail: state.voiceLabel || (state.voiceId ? "Ready" : "Needed"),
    },
    {
      label: "Opening greeting",
      ok: Boolean(state.openingGreeting?.trim()),
      detail: state.openingGreeting?.trim() ? "Ready" : "Needed",
    },
    ...(books
      ? [
          {
            label: "Calendar",
            ok: hasCalendar,
            detail: hasCalendar ? "Connected" : "Needed for booking",
          },
          {
            label: "Appointment type",
            ok: state.appointmentTypes.some((t) => t.enabled),
            detail: state.appointmentTypes.some((t) => t.enabled)
              ? "Ready"
              : "Enable at least one",
          },
        ]
      : []),
    ...(transfers
      ? [
          {
            label: "Transfer destination",
            ok: Boolean(state.transferDestinationPhone),
            detail: state.transferDestinationPhone ? "Ready" : "Needed",
          },
        ]
      : []),
    {
      label: "Test call",
      ok: state.lastTestPassed === true,
      warn: state.lastTestPassed === null,
      detail:
        state.lastTestPassed === true
          ? "Passed"
          : state.lastTestPassed === false
            ? "Failed — retest"
            : "Not run yet",
    },
    {
      label: "Recording disclosure",
      ok: state.callRecording === "off",
      warn: state.callRecording !== "off",
      detail:
        state.callRecording === "off"
          ? "Recording off"
          : "Recording on — disclose to callers",
    },
    {
      label: "Message taking + notify",
      ok: true,
      detail: "Enabled",
    },
    {
      label: "Post-call summary",
      ok: true,
      detail: "Enabled on activate",
    },
    { label: "Time zone", ok: true, detail: state.timezone },
  ];

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Make your receptionist live
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Activate pushes knowledge, transfer destinations, appointment types, and insights
            to the live agent.
          </p>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{state.solutionName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Answers calls, uses business knowledge, collects info, books appointments, transfers,
            saves messages, and notifies your team.
          </p>
        </div>

        {issues.length ? (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Activation checklist</p>
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    issue.severity === "blocking" ? "text-destructive" : "text-warning"
                  }`}
                />
                <span>
                  <span className="font-medium text-foreground">
                    {issue.severity === "blocking" ? "Required: " : "Warning: "}
                  </span>
                  {issue.message}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
            >
              <span className="font-medium">{item.label}</span>
              <StatusPill
                tone={item.warn ? "warning" : item.ok ? "success" : "warning"}
              >
                {item.warn ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : item.ok ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {item.detail}
              </StatusPill>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Your receptionist will</h3>
          <ol className="mt-3 space-y-2 text-sm">
            {will.map((item, i) => (
              <li key={item} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Activation options</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["activate_now", "Activate now", "Go live on this number immediately."],
                ["schedule", "Schedule activation", "Pick a date and time to go live."],
                ["save_draft", "Save as draft", "Keep editing without answering calls."],
                [
                  "duplicate_location",
                  "Duplicate for another location",
                  "Clone this setup for a second office.",
                ],
              ] as Array<[ActivationMode, string, string]>
            ).map(([id, title, desc]) => (
              <SelectableCard
                key={id}
                selected={state.activationMode === id}
                onClick={() => patch({ activationMode: id })}
                title={title}
                description={desc}
              />
            ))}
          </div>
        </div>
      </div>

      <SidePanel title="Deployment">
        <dl className="space-y-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Phone number</dt>
            <dd className="mt-0.5 font-medium text-foreground">{phone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Active schedule</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              Mon – Fri, 8:00 AM – 6:00 PM ({state.timezone})
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">AI receptionist</dt>
            <dd className="mt-0.5 font-medium text-foreground">{state.agentName}</dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={blocked && state.activationMode === "activate_now"}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          onClick={() => patch({ activationMode: "activate_now" })}
        >
          <Zap className="h-4 w-4" />
          Activate now
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium"
        >
          <Play className="h-4 w-4" />
          Run final test
        </button>
        <InfoCallout>
          Activate publishes this agent, attaches business knowledge, syncs transfer numbers,
          creates bookable services, and enables post-call summaries + staff message alerts.
        </InfoCallout>
      </SidePanel>
    </div>
  );
}
