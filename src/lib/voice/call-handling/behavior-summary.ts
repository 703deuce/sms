import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  ensureEmergencyTransferWizardState,
} from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import { resolveActiveOnCallTarget } from "@/lib/voice-receptionist-wizard/operating-maturity/on-call";
import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "@/lib/voice-receptionist-wizard/operating-maturity/defaults";

const FALLBACK_LABELS: Record<string, string> = {
  return_to_ai: "Return to Amy",
  take_message: "Take a message",
  notify_staff: "Notify staff",
};

export type CallHandlingBehaviorSummary = {
  transfersEnabled: boolean;
  routingMode: "single" | "waterfall";
  primaryDestinationLabel: string | null;
  waterfallSteps: Array<{
    order: number;
    label: string;
    mode: "Direct" | "Warm";
    ringSeconds: number;
  }>;
  fallbackLabel: string;
  onCallEnabled: boolean;
  onCallNowLabel: string | null;
  onCallNowPhone: string | null;
  emergencyHandlingEnabled: boolean;
  warmTransferConfigured: boolean;
};

export function buildCallHandlingBehaviorSummary(
  state: AppointmentReceptionistWizardState,
): CallHandlingBehaviorSummary {
  const normalized = ensureEmergencyTransferWizardState(state);
  const enabled =
    normalized.voiceV2HumanTransferEnabled !== false &&
    normalized.capabilities.includes("transfer_calls");
  const routing =
    normalized.transferRouting === "waterfall" ? "waterfall" : "single";
  const destinations = (normalized.transferDestinations ?? []).filter(
    (d) => d.enabled !== false,
  );
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const steps = [...(normalized.transferPlanSteps ?? [])]
    .filter((s) => destById.has(s.destinationId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const waterfallSteps = steps.map((s, i) => {
    const dest = destById.get(s.destinationId);
    return {
      order: i + 1,
      label: dest?.label || "Destination",
      mode: s.transferMode === "WARM" ? "Warm" : "Direct",
      ringSeconds: s.timeoutSeconds ?? normalized.transferRingSeconds ?? 30,
    };
  });

  const primary =
    waterfallSteps[0]?.label ??
    destinations[0]?.label ??
    normalized.transferDestinationName?.trim() ??
    null;

  const maturity = state.operatingMaturity ?? DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG;
  const onCall = resolveActiveOnCallTarget({
    schedule: maturity.onCallSchedule,
  });

  const fallbackKey = normalized.transferFallback || "return_to_ai";

  return {
    transfersEnabled: enabled && destinations.length > 0,
    routingMode: routing,
    primaryDestinationLabel: primary,
    waterfallSteps,
    fallbackLabel: FALLBACK_LABELS[fallbackKey] ?? fallbackKey,
    onCallEnabled: maturity.onCallSchedule.enabled,
    onCallNowLabel: onCall?.label ?? null,
    onCallNowPhone: onCall?.phoneE164 ?? null,
    emergencyHandlingEnabled: state.urgencyEnabled === true,
    warmTransferConfigured: waterfallSteps.some((s) => s.mode === "Warm"),
  };
}

export function afterHoursBehaviorSummary(
  state: AppointmentReceptionistWizardState,
): { duringHours: string; afterHours: string } {
  const maturity = state.operatingMaturity ?? DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG;
  const when = maturity.afterHoursBehavior.whenClosed;
  const office = when.allowOfficeTransfer
    ? "Office transfers allowed when open"
    : "Office transfers gated when closed";
  const onCall = when.allowOnCallEscalation
    ? "On-call escalation allowed after hours"
    : "On-call escalation off after hours";
  return {
    duringHours: "Amy answers per your agent and business-hours schedule.",
    afterHours: `${office}. ${onCall}.`,
  };
}
