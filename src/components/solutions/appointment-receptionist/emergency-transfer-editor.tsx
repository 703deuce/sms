"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AppointmentReceptionistWizardState, FallbackAction } from "@/lib/solutions/appointment-receptionist/types";
import {
  TRANSFER_RING_SECONDS_OPTIONS,
  addTransferDestination,
  ensureEmergencyTransferWizardState,
  moveTransferPlanStep,
  removeTransferDestination,
  syncLegacyTransferFieldsFromDestinations,
  transferWizardValidationIssues,
  updateTransferDestination,
  updateTransferPlanStep,
} from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import { normalizeWizardTransferPhone } from "@/lib/solutions/appointment-receptionist/transfer-utils";
import { RadioRow } from "./ui";
import { OpusCompactPanel, OpusWarningPanel } from "./wizard-opus-ui";
import {
  pickWizardFieldComponents,
  type WizardPresentation,
  WizardSelectField,
  WizardToggleField,
} from "./wizard-field-kit";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

const FALLBACK_OPTIONS: Array<[FallbackAction, string, string]> = [
  ["return_to_ai", "Return caller to AI receptionist", "Amy keeps helping when nobody answers."],
  ["take_message", "Take a message", "Capture details for your team to follow up."],
  ["notify_staff", "Notify staff", "Alert your team that a caller needs help."],
];

export function EmergencyTransferEditor({
  state,
  patch,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: WizardPresentation;
}) {
  const ui = pickWizardFieldComponents(presentation);
  const { Input, Label, Button } = ui;
  const isOpus = presentation === "opus";
  const uiVariant = isOpus ? "opus" : "legacy";
  const transferCapability = state.capabilities.includes("transfer_calls");
  const hydrated = useRef(false);

  useEffect(() => {
    if (!transferCapability || hydrated.current) return;
    const next = syncLegacyTransferFieldsFromDestinations(state);
    if (
      next.transferDestinations?.length &&
      (!state.transferDestinations?.length || state.transferPlanSteps?.length === 0)
    ) {
      patch(next);
    }
    hydrated.current = true;
  }, [transferCapability, state, patch]);

  const normalized = useMemo(
    () => ensureEmergencyTransferWizardState(state),
    [state],
  );

  const issues = useMemo(() => transferWizardValidationIssues(state), [state]);

  if (!transferCapability) {
    return (
      <p className="text-xs text-muted-foreground">
        Turn on <span className="font-medium">Transfer calls</span> in Goals to configure emergency
        and human escalation.
      </p>
    );
  }

  const enabled =
    normalized.voiceV2HumanTransferEnabled !== false && normalized.voiceV2HumanTransferEnabled !== null;
  const routing = normalized.transferRouting === "waterfall" ? "waterfall" : "single";
  const defaultRing = normalized.transferRingSeconds ?? 30;
  const destinations = (normalized.transferDestinations ?? []).filter((d) => d.enabled !== false);
  const steps = [...(normalized.transferPlanSteps ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const apply = (partial: Partial<AppointmentReceptionistWizardState>) => {
    patch(syncLegacyTransferFieldsFromDestinations({ ...state, ...partial }));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        After-hours escalation: when policy allows, Amy can transfer urgent or emergency callers to
        your team. Transfer is not automatic for every call — triggers and your instructions still
        apply.
      </p>

      <WizardToggleField
        presentation={presentation}
        label="Enable emergency & human transfer"
        description="Authorized contacts only — callers are never transferred to numbers you have not configured here."
        checked={enabled}
        onCheckedChange={(on) => patch({ voiceV2HumanTransferEnabled: on })}
      />

      <WizardToggleField
        presentation={presentation}
        label="Allow caller-requested human"
        checked={state.allowCallerRequestedTransfer !== false}
        onCheckedChange={(on) => patch({ allowCallerRequestedTransfer: on })}
      />

      <div className={enabled ? "" : "pointer-events-none opacity-50"}>
        <WizardSelectField
          presentation={presentation}
          label="Routing"
          value={routing}
          onChange={(v) =>
            apply({
              transferRouting: v as "single" | "waterfall",
            })
          }
          options={[
            { value: "single", label: "Single destination" },
            { value: "waterfall", label: "Waterfall (try contacts in order)" },
          ]}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {routing === "waterfall"
            ? "Transovo tries the configured contacts in order until someone answers. If nobody answers, the selected fallback is used."
            : "The caller is transferred to the first contact in your list below."}
        </p>

        <div className="mt-3">
          <WizardSelectField
            presentation={presentation}
            label="Default ring timeout"
            value={String(defaultRing)}
            onChange={(v) => apply({ transferRingSeconds: Number(v) })}
            options={TRANSFER_RING_SECONDS_OPTIONS.map((s) => ({
              value: String(s),
              label: `${s} seconds`,
            }))}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Used when a contact does not set its own ring timeout below.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Label>Transfer contacts</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => patch(addTransferDestination(state))}
          >
            <Plus className="h-3.5 w-3.5" />
            Add contact
          </Button>
        </div>

        {destinations.length === 0 ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Add at least one contact with a valid phone number.
          </p>
        ) : null}

        <ul className="mt-2 space-y-0">
          {steps.map((step, stepIndex) => {
            const dest = destinations.find((d) => d.id === step.destinationId);
            if (!dest) return null;
            const phoneOk = Boolean(normalizeWizardTransferPhone(dest.phoneE164));
            const mode = step.transferMode === "WARM" ? "WARM" : "BASIC";
            const stepTimeout = step.timeoutSeconds ?? defaultRing;
            const usesDefaultTimeout = step.timeoutSeconds == null;

            return (
              <li key={dest.id} className="space-y-0">
              <OpusCompactPanel isOpus={isOpus}>
                <div className="flex items-start gap-2">
                  {routing === "waterfall" ? (
                    <div className="flex flex-col gap-0.5 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={stepIndex === 0}
                        aria-label={`Move ${dest.label} up`}
                        onClick={() => patch(moveTransferPlanStep(state, dest.id, "up"))}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={stepIndex === steps.length - 1}
                        aria-label={`Move ${dest.label} down`}
                        onClick={() => patch(moveTransferPlanStep(state, dest.id, "down"))}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="mt-2 text-xs font-semibold text-muted-foreground w-6">
                      {stepIndex === 0 ? "1" : "—"}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        className="h-9"
                        placeholder="Display name"
                        value={dest.label}
                        onChange={(e) =>
                          patch(updateTransferDestination(state, dest.id, { label: e.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-destructive"
                        aria-label={`Remove ${dest.label}`}
                        onClick={() => patch(removeTransferDestination(state, dest.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      className="h-9"
                      placeholder="+1 (555) 000-0000"
                      value={dest.phoneE164}
                      onChange={(e) =>
                        patch(
                          updateTransferDestination(state, dest.id, { phoneE164: e.target.value }),
                        )
                      }
                      aria-invalid={!phoneOk}
                    />
                    {!phoneOk ? (
                      <p className="text-xs text-destructive">Enter a valid phone number.</p>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <WizardSelectField
                        presentation={presentation}
                        label="Transfer mode"
                        value={mode}
                        onChange={(v) =>
                          patch(
                            updateTransferPlanStep(state, dest.id, {
                              transferMode: v as "BASIC" | "WARM",
                            }),
                          )
                        }
                        options={[
                          { value: "BASIC", label: "Direct" },
                          { value: "WARM", label: "Warm" },
                        ]}
                      />
                      <WizardSelectField
                        presentation={presentation}
                        label="Ring timeout"
                        value={usesDefaultTimeout ? "default" : String(stepTimeout)}
                        onChange={(v) => {
                          if (v === "default") {
                            patch(
                              updateTransferPlanStep(state, dest.id, {
                                timeoutSeconds: undefined,
                              }),
                            );
                          } else {
                            patch(
                              updateTransferPlanStep(state, dest.id, {
                                timeoutSeconds: Number(v),
                              }),
                            );
                          }
                        }}
                        options={[
                          { value: "default", label: `Default (${defaultRing}s)` },
                          ...TRANSFER_RING_SECONDS_OPTIONS.map((s) => ({
                            value: String(s),
                            label: `${s} seconds`,
                          })),
                        ]}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {mode === "WARM"
                        ? "Warm transfer — Amy contacts this person first and connects the caller after they accept."
                        : "Direct transfer — Amy sends the caller straight to this number."}
                    </p>
                  </div>
                </div>
              </OpusCompactPanel>
              {routing === "waterfall" && stepIndex < steps.length - 1 ? (
                <p
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                  aria-hidden
                >
                  ↓ if unanswered
                </p>
              ) : null}
              </li>
            );
          })}
        </ul>

        <WizardToggleField
          presentation={presentation}
          label="Detect voicemail on transfer"
          description="Return to the receptionist if the transfer reaches voicemail."
          checked={state.detectVoicemailOnTransfer}
          onCheckedChange={(on) => patch({ detectVoicemailOnTransfer: on })}
        />

        <div className="mt-4 border-t border-border pt-3">
          <Label className="text-sm font-medium">
            If nobody answers (waterfall exhausted or transfer fails)
          </Label>
          <div className="mt-2 space-y-2">
            {FALLBACK_OPTIONS.map(([id, label, desc]) => (
              <RadioRow
                key={id}
                variant={uiVariant}
                selected={state.transferFallback === id}
                onClick={() => patch({ transferFallback: id })}
                label={label}
                description={desc}
              />
            ))}
          </div>
        </div>

        {issues.length > 0 ? (
          isOpus ? (
            <OpusWarningPanel title="Fix before activate" className="mt-4">
              <ul className="space-y-1">
                {issues.map((i) => (
                  <li key={i.id}>{i.message}</li>
                ))}
              </ul>
            </OpusWarningPanel>
          ) : (
            <ul className="mt-4 space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
              {issues.map((i) => (
                <li key={i.id}>{i.message}</li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}
