import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { wizardCollectFieldIdToCallerRowId } from "@/lib/solutions/appointment-receptionist/wizard-collect-field-id";
import { callerFieldIdToIntakeKey } from "@/lib/voice-v2/intake/compile-schema";
import type {
  VoiceV2FallbackAction,
  VoiceV2PublishedAfterHoursHandlingConfig,
  VoiceV2TransferDestinationRow,
  VoiceV2TransferPlanRow,
  VoiceV2UrgencyRuleRow,
} from "./after-hours-handling-types";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

function mapLegacyFallback(raw: string): VoiceV2FallbackAction {
  switch (raw) {
    case "take_message":
    case "message":
      return "TAKE_MESSAGE";
    case "callback":
      return "CALLBACK";
    case "request_appointment":
    case "request_only":
      return "REQUEST_ONLY";
    case "send_link":
      return "SEND_LINK";
    default:
      return "CONTINUE_WITH_AMY";
  }
}

function defaultDestinations(state: AppointmentReceptionistWizardState): VoiceV2TransferDestinationRow[] {
  const fromRows = state.transferDestinations || [];
  if (fromRows.length) {
    return fromRows
      .filter((d) => d.enabled !== false)
      .map((d) => {
        const raw = d.phoneE164?.trim() || "";
        let phoneE164 = raw;
        if (raw) {
          try {
            phoneE164 = normalizeE164(raw);
          } catch {
            phoneE164 = "";
          }
        }
        return {
          id: d.id,
          label: d.label?.trim() || "Destination",
          phoneE164,
          enabled: d.enabled !== false,
        };
      })
      .filter((d) => Boolean(d.phoneE164));
  }
  const rawPhone = state.transferDestinationPhone?.trim() || "";
  if (!rawPhone) return [];
  const phone = normalizeE164(rawPhone);
  if (!phone) return [];
  return [
    {
      id: "legacy_primary",
      label: state.transferDestinationName?.trim() || "Primary",
      phoneE164: phone,
      enabled: true,
    },
  ];
}

function defaultPlan(
  state: AppointmentReceptionistWizardState,
  destinations: VoiceV2TransferDestinationRow[],
): VoiceV2TransferPlanRow | null {
  if (!destinations.length) return null;
  const routing = state.transferRouting === "waterfall" ? "WATERFALL" : "SINGLE";
  const mode = state.warmTransfer ? "WARM" : "BASIC";
  const steps =
    state.transferPlanSteps?.length
      ? state.transferPlanSteps
          .filter((s) => destinations.some((d) => d.id === s.destinationId))
          .map((s, i) => ({
            order: s.order ?? i + 1,
            destinationId: s.destinationId,
            transferMode: s.transferMode === "WARM" ? "WARM" : mode,
            timeoutSeconds: s.timeoutSeconds ?? state.transferRingSeconds ?? 25,
          }))
      : destinations.map((d, i) => ({
          order: i + 1,
          destinationId: d.id,
          transferMode: mode,
          timeoutSeconds: state.transferRingSeconds ?? 25,
        }));

  const limited = steps.slice(0, 5);
  if (!limited.length) return null;

  return {
    id: state.defaultTransferPlanId?.trim() || "default_transfer_plan",
    label: "Default transfer plan",
    enabled: true,
    routing,
    steps: limited,
    fallbackAction: mapLegacyFallback(state.transferFallback || "return_to_ai"),
  };
}

export function afterHoursHandlingFromWizard(
  state: AppointmentReceptionistWizardState,
): VoiceV2PublishedAfterHoursHandlingConfig {
  const destinations = defaultDestinations(state);
  const plan = defaultPlan(state, destinations);
  const transferEnabled =
    state.voiceV2HumanTransferEnabled === true ||
    (state.capabilities.includes("transfer_calls") && destinations.length > 0);

  const urgencyRules: VoiceV2UrgencyRuleRow[] = (state.urgencyRules || []).map((r) => ({
    id: r.id,
    label: r.label,
    fieldKey: r.fieldKey,
    operator: r.operator,
    value: r.value || "",
    severity: r.severity === "CRITICAL" ? "CRITICAL" : "URGENT",
    action: r.action,
    transferPlanId: r.transferPlanId || plan?.id || null,
    fallbackAction: r.fallbackAction ?? null,
  }));

  const revision = [
    transferEnabled ? "t1" : "t0",
    state.urgencyEnabled ? "u1" : "u0",
    urgencyRules.length,
    destinations.map((d) => d.id).join(","),
    plan?.steps.length ?? 0,
    state.callbackRequestsEnabled ? "cb1" : "cb0",
    state.salesSolicitationEnabled ? "sp1" : "sp0",
  ].join("|");

  return {
    revision,
    urgencyEnabled: Boolean(state.urgencyEnabled),
    urgencyRules,
    transferEnabled,
    allowCallerRequestedTransfer: state.allowCallerRequestedTransfer !== false,
    defaultTransferPlanId: plan?.id ?? null,
    transferDestinations: destinations,
    transferPlans: plan ? [plan] : [],
    transferFailureFallback: mapLegacyFallback(state.transferFallback || "return_to_ai"),
    callbackRequestsEnabled: state.callbackRequestsEnabled !== false,
    callbackUseAniByDefault: state.callbackUseAniByDefault !== false,
    callbackAskPreferredTime: state.callbackAskPreferredTime !== false,
    callbackConfirmNumber: Boolean(state.callbackConfirmNumber),
    distinguishCustomerStatus: Boolean(state.bookingBehavior?.distinguishNewExisting),
    customerStatusFieldKey: "customer_status",
    salesSolicitationEnabled: Boolean(state.salesSolicitationEnabled),
    salesSolicitationAction: state.salesSolicitationAction || "TAKE_MESSAGE",
    classificationFieldKey: "caller_classification",
  };
}

function enabledWizardFieldKeys(state: AppointmentReceptionistWizardState): Set<string> {
  return new Set(
    (state.collectFields || [])
      .filter((f) => f.enabled !== false)
      .map((f) => callerFieldIdToIntakeKey(wizardCollectFieldIdToCallerRowId(f.id))),
  );
}

const VALUE_OPTIONAL_OPERATORS = new Set(["EXISTS", "NOT_EXISTS"]);

export function validateAfterHoursHandlingWizard(
  state: AppointmentReceptionistWizardState,
): string[] {
  const config = afterHoursHandlingFromWizard(state);
  const errors = validateAfterHoursHandlingConfig(config);
  if (!state.urgencyEnabled) return errors;

  const fields = enabledWizardFieldKeys(state);
  const planIds = new Set(config.transferPlans.map((p) => p.id));

  for (const rule of state.urgencyRules || []) {
    if (!rule.fieldKey?.trim()) {
      errors.push(`urgency_rule_missing_field:${rule.id}`);
      continue;
    }
    if (!fields.has(rule.fieldKey)) {
      errors.push(`urgency_rule_unknown_field:${rule.id}:${rule.fieldKey}`);
    }
    if (!VALUE_OPTIONAL_OPERATORS.has(rule.operator) && !String(rule.value || "").trim()) {
      errors.push(`urgency_rule_missing_value:${rule.id}`);
    }
    if (rule.action === "TRANSFER") {
      const pid = rule.transferPlanId || config.defaultTransferPlanId;
      if (!pid || !planIds.has(pid)) {
        errors.push(`urgency_transfer_missing_plan:${rule.id}`);
      }
    }
    const supportedActions = new Set([
      "TRANSFER",
      "CALLBACK",
      "TAKE_MESSAGE",
      "REQUEST_ONLY",
      "SEND_LINK",
      "CONTINUE",
      "END_POLITELY",
    ]);
    if (!supportedActions.has(rule.action)) {
      errors.push(`urgency_unsupported_action:${rule.id}`);
    }
  }
  return errors;
}

export function validateAfterHoursHandlingConfig(
  config: VoiceV2PublishedAfterHoursHandlingConfig,
): string[] {
  const errors: string[] = [];
  if (config.transferEnabled) {
    if (!config.transferDestinations.length) {
      errors.push("transfer_enabled_without_destination");
    }
    if (!config.transferPlans.length) {
      errors.push("transfer_enabled_without_plan");
    }
    for (const plan of config.transferPlans) {
      if (!plan.steps.length) errors.push(`transfer_plan_empty:${plan.id}`);
      if (plan.steps.length > 5) errors.push(`transfer_plan_too_many_steps:${plan.id}`);
      for (const step of plan.steps) {
        if (!config.transferDestinations.some((d) => d.id === step.destinationId)) {
          errors.push(`transfer_plan_unknown_destination:${plan.id}:${step.destinationId}`);
        }
      }
    }
  }
  for (const rule of config.urgencyRules) {
    if (rule.action === "TRANSFER" && !rule.transferPlanId) {
      errors.push(`urgency_transfer_missing_plan:${rule.id}`);
    }
  }
  const fallbackLoop = (a: VoiceV2FallbackAction, b: VoiceV2FallbackAction) => a === b;
  for (const plan of config.transferPlans) {
    if (plan.fallbackAction === "CONTINUE_WITH_AMY" && plan.steps.length) continue;
    if (fallbackLoop(plan.fallbackAction, "SEND_LINK") && plan.fallbackAction === "SEND_LINK") {
      // direct self-loop on send link only when primary was send link — checked at runtime
    }
  }
  return errors;
}

export function resolveAfterHoursHandlingFromAgentAdvanced(
  advanced: Record<string, unknown> | undefined,
): VoiceV2PublishedAfterHoursHandlingConfig | null {
  const raw = advanced?.voiceV2AfterHoursHandling;
  if (!raw || typeof raw !== "object") return null;
  return raw as VoiceV2PublishedAfterHoursHandlingConfig;
}

export function resolveAfterHoursHandlingFromAgentConfig(
  config?: { advanced?: Record<string, unknown> } | null,
): VoiceV2PublishedAfterHoursHandlingConfig | null {
  return resolveAfterHoursHandlingFromAgentAdvanced(config?.advanced);
}
