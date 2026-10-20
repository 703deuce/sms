import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import {
  resolveStoredIntakeField,
  resolveStoredIntakeString,
} from "../intake-objective/resolve-stored-intake";
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

function phoneSatisfied(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
  supplementalPhone: string | null | undefined,
): boolean {
  const explicit = supplementalPhone?.trim();
  if (explicit && normalizePhoneE164(explicit)) return true;

  const phoneField = config.intakeFields.find((f) => f.key === "phone");
  if (
    phoneField &&
    fieldSatisfiesObjectiveRequirement(
      phoneField,
      resolveStoredIntakeField(context.intake.values, "phone"),
    )
  ) {
    return true;
  }

  if (config.callHandling.callbackUseAniByDefault !== false) {
    const ani = context.telephony.inboundCallerE164?.trim();
    if (ani && normalizePhoneE164(ani)) return true;
  }
  return false;
}

export function getMissingCallbackRequirementKeys(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
  supplemental?: Partial<RequestCallbackToolArgs>,
): string[] {
  const requiredKeys = resolveConfiguredCallbackRequiredKeys(config);
  const missing: string[] = [];
  const values = context.intake.values;

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
    const stored = field
      ? resolveStoredIntakeField(values, field.key)
      : resolveStoredIntakeField(values, key);
    if (!field || !fieldSatisfiesObjectiveRequirement(field, stored)) {
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
  const captured = resolveStoredIntakeField(context.intake.values, "phone")?.value?.trim();
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
  return resolveStoredIntakeString(context.intake.values, "name");
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
