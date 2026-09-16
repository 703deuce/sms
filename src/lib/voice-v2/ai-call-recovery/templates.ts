import type { VoiceV2AiCallRecoveryTemplates, VoiceV2RecoverySubtype } from "./types";

const TRUSTED_VARS = new Set([
  "business_name",
  "caller_first_name",
  "service",
  "requested_day",
  "requested_time_or_preference",
]);

export function renderRecoveryTemplate(input: {
  subtype: VoiceV2RecoverySubtype;
  templates: VoiceV2AiCallRecoveryTemplates;
  variables: Record<string, string>;
}): string {
  const base = templateForSubtype(input.subtype, input.templates);
  return base.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!TRUSTED_VARS.has(key)) return "";
    return input.variables[key]?.trim() || "";
  });
}

function templateForSubtype(
  subtype: VoiceV2RecoverySubtype,
  templates: VoiceV2AiCallRecoveryTemplates,
): string {
  switch (subtype) {
    case "SILENT_ABANDONMENT":
      return templates.silentAbandonment;
    case "PARTIAL_INTAKE":
      return templates.partialIntake;
    case "BOOKING_INTERRUPTED":
      return templates.bookingInterrupted;
    case "TRANSFER_INTERRUPTED":
      return templates.transferInterrupted;
    case "TRANSFER_FAILED":
      return templates.transferInterrupted;
    case "PROVIDER_FAILURE":
      return templates.providerFailure;
    case "AI_CHANNEL_DECLINED":
      return templates.aiChannelDeclined;
    case "GENERAL_UNRESOLVED":
    default:
      return templates.generalUnresolved;
  }
}
