import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { fieldSatisfiesObjectiveRequirement } from "../intake-objective/validate-intake-value";
import type { RequestCallbackToolArgs } from "./types";

const DEFAULT_REASON_KEYS = ["service_reason", "service", "notes", "reason"] as const;

export function resolveConfiguredCallbackRequiredKeys(
  config: VoiceV3AgentConfig,
): string[] {
  const fromOp = config.operationRequirements?.request_callback;
  if (fromOp?.length) return [...fromOp];
  const keys = new Set(config.intakeFields.map((f) => f.key));
  const required: string[] = [];
  if (keys.has("name")) required.push("name");
  if (keys.has("phone")) required.push("phone");
  const reasonKey = DEFAULT_REASON_KEYS.find((k) => keys.has(k));
  if (reasonKey) required.push(reasonKey);
  else required.push("service_reason");
  return required;
}

function reasonSatisfied(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
  supplementalReason: string | null | undefined,
): boolean {
  const trimmed = supplementalReason?.trim();
  if (trimmed) return true;
  const values = context.intake.values;
  for (const key of DEFAULT_REASON_KEYS) {
    const field = config.intakeFields.find((f) => f.key === key);
    if (!field) continue;
    if (fieldSatisfiesObjectiveRequirement(field, values[key])) return true;
  }
  return false;
}

function phoneConfirmationSatisfied(context: VoiceV3CallContext): boolean {
  const flag = context.intake.values.callback_phone_confirmed?.value?.trim().toLowerCase();
  return flag === "true" || flag === "yes" || flag === "confirmed";
}

function phoneSatisfied(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
  supplementalPhone: string | null | undefined,
): boolean {
  const explicit = supplementalPhone?.trim();
  if (explicit && normalizePhoneE164(explicit)) return true;

  const phoneField = config.intakeFields.find((f) => f.key === "phone");
  if (phoneField && fieldSatisfiesObjectiveRequirement(phoneField, context.intake.values.phone)) {
    return true;
  }

  if (config.callHandling.callbackUseAniByDefault !== false) {
    const ani = context.telephony.inboundCallerE164?.trim();
    if (ani && normalizePhoneE164(ani)) {
      return true;
    }
  }
  return false;
}

function needsCallbackPhoneConfirmation(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
  supplemental?: Partial<RequestCallbackToolArgs>,
): boolean {
  if (!config.callHandling.callbackConfirmNumber) return false;
  if (supplemental?.phone_confirmed === true) return false;
  if (phoneConfirmationSatisfied(context)) return false;
  const explicit = supplemental?.callback_phone?.trim();
  if (explicit && normalizePhoneE164(explicit)) return false;
  const captured = context.intake.values.phone?.value?.trim();
  if (captured && normalizePhoneE164(captured)) return false;
  if (config.callHandling.callbackUseAniByDefault === false) return false;
  const ani = context.telephony.inboundCallerE164?.trim();
  return Boolean(ani && normalizePhoneE164(ani));
}

export function getMissingCallbackRequirementKeys(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
  supplemental?: Partial<RequestCallbackToolArgs>,
): string[] {
  const requiredKeys = resolveConfiguredCallbackRequiredKeys(config);
  const missing: string[] = [];
  const values = context.intake.values;

  if (
    config.callHandling.callbackAskPreferredTime &&
    !supplemental?.preferred_time?.trim() &&
    !context.callback?.preferredTime?.trim()
  ) {
    missing.push("preferred_callback_time");
  }

  if (needsCallbackPhoneConfirmation(config, context, supplemental)) {
    missing.push("phone_number_confirmation");
  }

  for (const key of requiredKeys) {
    if (key === "phone") {
      if (!phoneSatisfied(config, context, supplemental?.callback_phone)) {
        missing.push("phone");
      }
      continue;
    }
    if (DEFAULT_REASON_KEYS.includes(key as (typeof DEFAULT_REASON_KEYS)[number])) {
      if (!reasonSatisfied(config, context, supplemental?.reason)) {
        missing.push(key);
      }
      continue;
    }
    const field = config.intakeFields.find((f) => f.key === key);
    if (!field || !fieldSatisfiesObjectiveRequirement(field, values[key])) {
      missing.push(key);
    }
  }
  return missing;
}

export function resolveCallbackPhoneE164(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
  args: RequestCallbackToolArgs,
): string | null {
  const fromArg = args.callback_phone?.trim();
  if (fromArg) {
    return normalizePhoneE164(fromArg) || null;
  }
  const captured = context.intake.values.phone?.value?.trim();
  if (captured) {
    const normalized = normalizePhoneE164(captured);
    if (normalized) return normalized;
  }
  if (config.callHandling.callbackUseAniByDefault !== false) {
    const ani = context.telephony.inboundCallerE164?.trim();
    if (ani) return normalizePhoneE164(ani) || ani;
  }
  return null;
}

export function resolveCallbackCallerName(context: VoiceV3CallContext): string | null {
  const name = context.intake.values.name?.value?.trim();
  return name || null;
}

export function resolveCallbackReasonText(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
  args: RequestCallbackToolArgs,
): string | null {
  const fromArg = args.reason?.trim();
  if (fromArg) return fromArg;
  const values = context.intake.values;
  for (const key of DEFAULT_REASON_KEYS) {
    const v = values[key]?.value?.trim();
    if (v) return v;
  }
  return null;
}
