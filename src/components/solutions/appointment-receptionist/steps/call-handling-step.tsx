"use client";

import type {
  AppointmentReceptionistWizardState,
  FallbackAction,
} from "@/lib/solutions/appointment-receptionist/types";
import { hasBookingCapability } from "@/lib/solutions/appointment-receptionist/wizard-presets";
import { Input, Label } from "@/components/ui/input";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  UserRound,
} from "lucide-react";
import { InfoCallout, RadioRow, SidePanel, StatusPill } from "../ui";

const LEGACY_BOOKING_FLOW_STEPS = [
  "Understand request",
  "Identify appointment type",
  "Collect caller information",
  "Check availability",
  "Offer times",
  "Confirm",
  "Book appointment",
  "Send confirmation",
];

const MCTB_VOICE_FLOW_STEPS = [
  "Understand request",
  "Apply business policy",
  "Collect what's needed",
  "Perform allowed action",
  "Confirm or hand off",
];

export function CallHandlingStep({
  state,
  patch,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: "legacy" | "mctb";
}) {
  const b = state.bookingBehavior;
  const booking = hasBookingCapability(state.capabilities);

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            How should your agent handle calls?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure transfers, messages
            {booking ? ", and booking behavior" : ", and fallbacks"}.
          </p>
          {(booking || presentation === "mctb") ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
            {(presentation === "mctb" ? MCTB_VOICE_FLOW_STEPS : LEGACY_BOOKING_FLOW_STEPS).map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex h-16 w-24 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 text-center">
                  <span className="text-[10px] font-semibold text-primary">{i + 1}</span>
                  <span className="text-[10px] leading-tight text-foreground">{step}</span>
                </div>
                {i <
                (presentation === "mctb"
                  ? MCTB_VOICE_FLOW_STEPS
                  : LEGACY_BOOKING_FLOW_STEPS).length -
                  1 ? (
                  <ArrowRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                ) : null}
              </div>
            ))}
          </div>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {booking ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Booking behavior</h3>
            <div className="mt-3 space-y-3">
              {(
                [
                  [
                    "askPreferredDayFirst",
                    "Ask for preferred day first",
                    "Ask callers which day works best before checking times.",
                  ],
                  [
                    "offerEarliestThree",
                    "Offer earliest 3 appointments",
                    "Jump straight to the soonest available slots.",
                  ],
                  [
                    "confirmBeforeBooking",
                    "Confirm before booking",
                    "Confirm details with the caller before booking.",
                  ],
                  [
                    "sendSmsAfterBooking",
                    "Send SMS after booking",
                    "Send confirmation via SMS automatically.",
                  ],
                ] as const
              ).map(([key, label, desc]) => (
                <label key={key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border"
                    checked={b[key]}
                    onChange={(e) =>
                      patch({
                        bookingBehavior: { ...b, [key]: e.target.checked },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Human transfer</h3>
            <p className="mt-1 text-xs text-muted-foreground">Transfer triggers</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.transferTriggers.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <Label>Transfer destination</Label>
              <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Input
                    className="h-8 border-0 bg-transparent px-0 shadow-none"
                    placeholder="Name"
                    value={state.transferDestinationName}
                    onChange={(e) => patch({ transferDestinationName: e.target.value })}
                  />
                  <Input
                    className="h-8 border-0 bg-transparent px-0 shadow-none"
                    placeholder="+1 (555) 000-0000"
                    value={state.transferDestinationPhone}
                    onChange={(e) => patch({ transferDestinationPhone: e.target.value })}
                  />
                </div>
              </div>
              <Label>Ring for</Label>
              <select
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={state.transferRingSeconds}
                onChange={(e) => patch({ transferRingSeconds: Number(e.target.value) })}
              >
                {[10, 15, 20, 30, 45].map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
                  </option>
                ))}
              </select>
              {presentation === "mctb" ? (
                <InfoCallout>
                  Warm transfer is not available on Voice Agent (V2) phone calls yet. Transfer
                  destination settings are saved for cold handoff when transfer is enabled.
                </InfoCallout>
              ) : (
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={state.warmTransfer}
                    onChange={(e) => patch({ warmTransfer: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">Warm transfer</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Hold the caller and introduce them before connecting.
                    </span>
                  </span>
                </label>
              )}
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={state.detectVoicemailOnTransfer}
                  onChange={(e) =>
                    patch({ detectVoicemailOnTransfer: e.target.checked })
                  }
                />
                <span>
                  <span className="font-medium">Detect voicemail on transfer</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Return to AI if the transfer lands in voicemail.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Fallbacks</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              What happens if transfer or booking fails
            </p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["return_to_ai", "Return to AI", "Retry request or offer alternatives."],
                  ["take_message", "Take a message", "Capture details for your team."],
                  ["notify_staff", "Send staff notification", "Alert staff immediately."],
                ] as Array<[FallbackAction, string, string]>
              ).map(([id, label, desc]) => (
                <RadioRow
                  key={id}
                  selected={state.transferFallback === id}
                  onClick={() => patch({ transferFallback: id })}
                  label={label}
                  description={desc}
                />
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={state.longTermMemory}
                  onChange={(e) => patch({ longTermMemory: e.target.checked })}
                />
                <span>
                  <span className="font-medium">Long-term caller memory</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Remember returning callers across conversations (optional).
                  </span>
                </span>
              </label>
              {booking || state.capabilities.includes("qualify_callers") ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={state.crmEnabled}
                  onChange={(e) => patch({ crmEnabled: e.target.checked })}
                />
                <span>
                  <span className="font-medium">Enable CRM tools</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Search/upsert contacts and create CRM tasks (notes always on).
                  </span>
                </span>
              </label>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <SidePanel title="Call handling preview">
        <ol className="space-y-2 border-l border-border pl-3 text-xs">
          {(booking
            ? FLOW_STEPS
            : [
                "Greet caller",
                "Answer from knowledge",
                "Take a message if needed",
                "Transfer when requested",
                "Confirm next steps",
              ]
          ).map((s) => (
            <li key={s} className="font-medium text-foreground">
              {s}
            </li>
          ))}
        </ol>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Transfer destination</span>
            <StatusPill tone={state.transferDestinationPhone ? "success" : "warning"}>
              {state.transferDestinationPhone ? "Ready" : "Needed"}
            </StatusPill>
          </div>
          <div className="flex items-center justify-between">
            <span>SMS confirmations</span>
            {b.sendSmsAfterBooking ? (
              <StatusPill tone="warning">
                <AlertTriangle className="h-3 w-3" />
                Pending A2P
              </StatusPill>
            ) : (
              <StatusPill tone="muted">Off</StatusPill>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>Staff notification</span>
            <StatusPill tone="success">
              <CheckCircle2 className="h-3 w-3" />
              Enabled
            </StatusPill>
          </div>
        </div>
        <InfoCallout>You can update these settings anytime after activation.</InfoCallout>
      </SidePanel>
    </div>
  );
}
