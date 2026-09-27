"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { hasBookingCapability } from "@/lib/solutions/appointment-receptionist/wizard-presets";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { EmergencyTransferEditor } from "../emergency-transfer-editor";
import { ensureEmergencyTransferWizardState } from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import { normalizeWizardTransferPhone } from "@/lib/solutions/appointment-receptionist/transfer-utils";
import { CallbackRequiredFieldsOpus } from "@/newui-transplant/connected/voice/receptionist-editor/callback-required-fields-opus";
import { WizardSection } from "../wizard-opus-ui";
import { WizardSelectField, WizardToggleField } from "../wizard-field-kit";
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
  presentation?: "legacy" | "mctb" | "opus";
}) {
  const isOpus = presentation === "opus";
  const uiVariant = isOpus ? "opus" : "legacy";
  const b = state.bookingBehavior;
  const booking = hasBookingCapability(state.capabilities);
  const transferReady = (() => {
    const n = ensureEmergencyTransferWizardState(state);
    return (n.transferDestinations ?? []).some(
      (d) => d.enabled !== false && normalizeWizardTransferPhone(d.phoneE164),
    );
  })();

  const headerDescription = `Configure transfers, messages${
    booking ? ", and booking behavior" : ", and fallbacks"
  }.`;

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-8">
        {!isOpus ? (
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            How should your agent handle calls?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{headerDescription}</p>
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
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {booking ? (
          <WizardSection
            opus={isOpus}
            title={isOpus ? "How should your agent handle calls?" : "Booking behavior"}
            description={isOpus ? headerDescription : undefined}
          >
            <div className="space-y-3">
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
                <WizardToggleField
                  key={key}
                  presentation={presentation}
                  label={label}
                  description={desc}
                  checked={b[key]}
                  onCheckedChange={(on) =>
                    patch({
                      bookingBehavior: { ...b, [key]: on },
                    })
                  }
                />
              ))}
            </div>
          </WizardSection>
          ) : null}

          <WizardSection
            opus={isOpus}
            className="lg:col-span-3"
            title="Emergency & human transfer"
            description={`Policy triggers (when Amy may offer a transfer): ${state.transferTriggers.join(" · ")}`}
          >
            <div>
              <EmergencyTransferEditor state={state} patch={patch} presentation={presentation} />
            </div>
            {presentation === "mctb" ? (
              <div className="mt-4 space-y-3 border-t border-border pt-3">
                <WizardToggleField
                  presentation={presentation}
                  label="Urgent-call handling"
                  description="Escalate when collected fields match your urgency rules."
                  checked={state.urgencyEnabled === true}
                  onCheckedChange={(on) => patch({ urgencyEnabled: on })}
                />
                {state.urgencyEnabled ? (
                  <UrgencyRulesEditor state={state} patch={patch} presentation={presentation} />
                ) : null}
                <WizardToggleField
                  presentation={presentation}
                  label="Sales / solicitation handling"
                  checked={state.salesSolicitationEnabled === true}
                  onCheckedChange={(on) => patch({ salesSolicitationEnabled: on })}
                />
              </div>
            ) : null}
          </WizardSection>

          <WizardSection
            opus={isOpus}
            title="Messages & callbacks"
            description="Let your receptionist take a message when a caller needs someone from your business to follow up."
          >
            <WizardToggleField
              presentation={presentation}
              label="Take messages and callback requests"
              description="Independent of appointment booking strategy (Microsoft, send link, or none)."
              checked={state.callbackRequestsEnabled !== false}
              onCheckedChange={(on) => {
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
            {state.callbackRequestsEnabled !== false ? (
              <div className="mt-4 border-t pt-4">
                {isOpus ? (
                  <CallbackRequiredFieldsOpus state={state} patch={patch} />
                ) : (
                  <CallbackRequiredFieldsEditor state={state} patch={patch} presentation={presentation} />
                )}
              </div>
            ) : null}
          </WizardSection>

          <WizardSection
            opus={isOpus}
            title="After-hours notifications"
            description="Send SMS or email when important call outcomes occur."
          >
              <AfterHoursNotificationsEditor state={state} patch={patch} presentation={presentation} />
          </WizardSection>

          <WizardSection
            opus={isOpus}
            title="AI Call Recovery"
            description="Text callers when an AI conversation ends before their request is resolved."
          >
            <div className="space-y-3">
              <WizardToggleField
                presentation={presentation}
                label="Text callers when an AI conversation ends before their request is resolved"
                checked={state.aiCallRecoveryEnabled === true}
                onCheckedChange={(on) => patch({ aiCallRecoveryEnabled: on })}
              />
              {state.aiCallRecoveryEnabled ? (
                <>
                  <WizardSelectField
                    presentation={presentation}
                    label="Messaging permission"
                    value={state.aiCallRecoveryConsentMode || "DISABLED"}
                    onChange={(value) =>
                      patch({
                        aiCallRecoveryConsentMode: value as
                          | "DISABLED"
                          | "EXISTING_CONSENT"
                          | "PLATFORM_CAPTURED_CONSENT",
                      })
                    }
                    options={[
                      { value: "DISABLED", label: "Disabled" },
                      { value: "EXISTING_CONSENT", label: "Existing consent" },
                      {
                        value: "PLATFORM_CAPTURED_CONSENT",
                        label: "Platform-captured consent",
                      },
                    ]}
                  />
                  <WizardToggleField
                    presentation={presentation}
                    label="Continue the same conversation by text"
                    description="Voice transcript and captured fields carry over to SMS."
                    checked={state.aiCallRecoveryContinueOverSms !== false}
                    onCheckedChange={(on) => patch({ aiCallRecoveryContinueOverSms: on })}
                  />
                  <WizardSelectField
                    presentation={presentation}
                    label="Send delay"
                    value={String(state.aiCallRecoveryDelaySeconds ?? 0)}
                    onChange={(value) =>
                      patch({ aiCallRecoveryDelaySeconds: Number(value) })
                    }
                    options={[
                      { value: "0", label: "Immediately (after internal settle)" },
                      { value: "15", label: "15 seconds" },
                      { value: "30", label: "30 seconds" },
                    ]}
                  />
                </>
              ) : null}
            </div>
          </WizardSection>

        </div>

        <AfterHoursBehaviorEditor state={state} patch={patch} presentation={presentation} />
        <OnCallScheduleEditor state={state} patch={patch} presentation={presentation} />
        <CallbackSlaEditor state={state} patch={patch} presentation={presentation} />
      </div>

      <SidePanel variant={uiVariant} title="Call handling preview">
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
            <StatusPill variant={uiVariant} tone={transferReady ? "success" : "warning"}>
              {transferReady ? "Ready" : "Needed"}
            </StatusPill>
          </div>
          <div className="flex items-center justify-between">
            <span>SMS confirmations</span>
            {b.sendSmsAfterBooking ? (
              <StatusPill variant={uiVariant} tone="warning">
                <AlertTriangle className="h-3 w-3" />
                Pending A2P
              </StatusPill>
            ) : (
              <StatusPill variant={uiVariant} tone="muted">Off</StatusPill>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>Staff notification</span>
            <StatusPill variant={uiVariant} tone="success">
              <CheckCircle2 className="h-3 w-3" />
              Enabled
            </StatusPill>
          </div>
        </div>
        <InfoCallout variant={uiVariant}>
          You can update these settings anytime after activation.
        </InfoCallout>
      </SidePanel>
    </div>
  );
}
