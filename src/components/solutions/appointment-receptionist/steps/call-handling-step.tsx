"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { hasBookingCapability } from "@/lib/solutions/appointment-receptionist/wizard-presets";
import { Label } from "@/components/ui/input";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { EmergencyTransferEditor } from "../emergency-transfer-editor";
import { SpamUnwantedCallsEditor } from "../spam-unwanted-calls-editor";
import { ensureEmergencyTransferWizardState } from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import { normalizeWizardTransferPhone } from "@/lib/solutions/appointment-receptionist/transfer-utils";
import { InfoCallout, SidePanel, StatusPill } from "../ui";
import { UrgencyRulesEditor } from "../urgency-rules-editor";
import { AfterHoursNotificationsEditor } from "../after-hours-notifications-editor";
import { CallbackRequiredFieldsEditor } from "../callback-required-fields-editor";
import { defaultCallbackRequiredCollectFieldIds } from "@/lib/solutions/appointment-receptionist/callback-required-field-defaults";
import {
  AfterHoursBehaviorEditor,
  CallbackSlaEditor,
  OnCallScheduleEditor,
} from "../operating-maturity-editor";

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
  const transferReady = (() => {
    const n = ensureEmergencyTransferWizardState(state);
    return (n.transferDestinations ?? []).some(
      (d) => d.enabled !== false && normalizeWizardTransferPhone(d.phoneE164),
    );
  })();

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

          <div className="rounded-xl border border-border bg-card p-4 lg:col-span-3">
            <h3 className="text-sm font-semibold">Emergency &amp; human transfer</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Policy triggers (when Amy may offer a transfer):{" "}
              {state.transferTriggers.join(" · ")}
            </p>
            <div className="mt-4">
              <EmergencyTransferEditor state={state} patch={patch} />
            </div>
            <div className="mt-4">
              <SpamUnwantedCallsEditor state={state} patch={patch} />
            </div>
            {presentation === "mctb" ? (
              <div className="mt-4 space-y-3 border-t border-border pt-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={state.urgencyEnabled === true}
                    onChange={(e) => patch({ urgencyEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">Urgent-call handling</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Escalate when collected fields match your urgency rules.
                    </span>
                  </span>
                </label>
                {state.urgencyEnabled ? (
                  <UrgencyRulesEditor state={state} patch={patch} />
                ) : null}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={state.salesSolicitationEnabled === true}
                    onChange={(e) => patch({ salesSolicitationEnabled: e.target.checked })}
                  />
                  <span className="font-medium">Sales / solicitation handling</span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Messages &amp; callbacks</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Let your receptionist take a message when a caller needs someone from your business to
              follow up. Uses shared intake fields — one callback operation, not a separate message
              tool.
            </p>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={state.callbackRequestsEnabled !== false}
                  onChange={(e) => {
                    const on = e.target.checked;
                    if (on && !state.callbackRequiredCollectFieldIds?.length) {
                      patch({
                        callbackRequestsEnabled: true,
                        callbackRequiredCollectFieldIds: defaultCallbackRequiredCollectFieldIds(
                          state.collectFields,
                        ),
                      });
                    } else {
                      patch({ callbackRequestsEnabled: on });
                    }
                  }}
                />
                <span>
                  <span className="font-medium">Take messages and callback requests</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Independent of appointment booking strategy (Microsoft, send link, or none).
                  </span>
                </span>
              </label>
              {state.callbackRequestsEnabled !== false ? (
                <CallbackRequiredFieldsEditor state={state} patch={patch} />
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">After-hours notifications</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Send SMS or email when important call outcomes occur. Notifications never change what
              was saved on the call — they only alert your team.
            </p>
            <div className="mt-3">
              <AfterHoursNotificationsEditor state={state} patch={patch} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">AI Call Recovery</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Text callers when an AI conversation ends before their request is resolved. Replies
              continue in your existing SMS text agent with voice context — not a separate recovery
              bot.
            </p>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={state.aiCallRecoveryEnabled === true}
                  onChange={(e) => patch({ aiCallRecoveryEnabled: e.target.checked })}
                />
                <span className="font-medium">
                  Text callers when an AI conversation ends before their request is resolved
                </span>
              </label>
              {state.aiCallRecoveryEnabled ? (
                <>
                  <div>
                    <Label>Messaging permission</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                      value={state.aiCallRecoveryConsentMode || "DISABLED"}
                      onChange={(e) =>
                        patch({
                          aiCallRecoveryConsentMode: e.target.value as
                            | "DISABLED"
                            | "EXISTING_CONSENT"
                            | "PLATFORM_CAPTURED_CONSENT",
                        })
                      }
                    >
                      <option value="DISABLED">Disabled</option>
                      <option value="EXISTING_CONSENT">Existing consent</option>
                      <option value="PLATFORM_CAPTURED_CONSENT">
                        Platform-captured consent
                      </option>
                    </select>
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={state.aiCallRecoveryContinueOverSms !== false}
                      onChange={(e) =>
                        patch({ aiCallRecoveryContinueOverSms: e.target.checked })
                      }
                    />
                    <span>
                      Let callers continue the same conversation by text (voice transcript and
                      captured fields carry over)
                    </span>
                  </label>
                  <div>
                    <Label>Send delay</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                      value={String(state.aiCallRecoveryDelaySeconds ?? 0)}
                      onChange={(e) =>
                        patch({ aiCallRecoveryDelaySeconds: Number(e.target.value) })
                      }
                    >
                      <option value="0">Immediately (after internal settle)</option>
                      <option value="15">15 seconds</option>
                      <option value="30">30 seconds</option>
                    </select>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Other call handling</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Transfer fallback is configured under Emergency &amp; human transfer above.
            </p>
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

        <AfterHoursBehaviorEditor state={state} patch={patch} />
        <OnCallScheduleEditor state={state} patch={patch} />
        <CallbackSlaEditor state={state} patch={patch} />
      </div>

      <SidePanel title="Call handling preview">
        <ol className="space-y-2 border-l border-border pl-3 text-xs">
          {(booking
            ? LEGACY_BOOKING_FLOW_STEPS
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
            <span>Emergency transfer</span>
            <StatusPill tone={transferReady ? "success" : "warning"}>
              {transferReady ? "Ready" : "Needed"}
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
