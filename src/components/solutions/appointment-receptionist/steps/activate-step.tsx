"use client";

import { buildReceptionistWillList } from "@/lib/solutions/appointment-receptionist/build-agent-config";
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

  const checklist = [
    { label: "Phone", ok: Boolean(state.phoneNumberId), detail: "Ready" },
    {
      label: "Google Calendar",
      ok: state.calendarConnected,
      detail: state.calendarConnected ? "Connected" : "Needed",
    },
    {
      label: "Transfer destination",
      ok: Boolean(state.transferDestinationPhone),
      detail: state.transferDestinationPhone ? "Tested" : "Optional",
    },
    { label: "Recording disclosure", ok: state.callRecording !== "off", detail: "Enabled" },
    { label: "AI receptionist", ok: true, detail: "Ready" },
    {
      label: "Main appointment type",
      ok: state.appointmentTypes.some((t) => t.enabled && t.status === "ready"),
      detail: "Ready",
    },
    {
      label: "SMS confirmations",
      ok: !state.bookingBehavior.sendSmsAfterBooking,
      detail: state.bookingBehavior.sendSmsAfterBooking ? "A2P pending" : "Off",
      warn: state.bookingBehavior.sendSmsAfterBooking,
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
            Review the generated setup, then activate.
          </p>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{state.solutionName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Answers calls and books appointments 24/7 — so you never miss an opportunity.
          </p>
        </div>

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

        <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Workflow preview</h3>
          <div className="flex min-w-max items-center gap-2 text-xs">
            {[
              "Incoming call",
              `AI answers as ${state.agentName || "Maya"}`,
              "Qualification & availability",
              "Book appointment",
              "Send confirmation & reminders",
              "Transfer or take message",
            ].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-medium">
                  {step}
                </span>
                {i < arr.length - 1 ? (
                  <span className="text-muted-foreground">→</span>
                ) : null}
              </div>
            ))}
          </div>
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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
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
          Once activated, the receptionist will start answering calls according to the set
          schedule. SMS pending A2P does not block voice booking.
        </InfoCallout>
      </SidePanel>
    </div>
  );
}
