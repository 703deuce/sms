import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { resolveStoredIntakeString } from "./resolve-stored-intake";

/**
 * Compact summary for Live thinking/commentary — authoritative values already on file.
 * Helps Live avoid re-asking and answer "do you already have my name?" correctly.
 */
export function buildSharedCallerFactsLiveSummary(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): string {
  const lines: string[] = [];
  for (const field of config.intakeFields) {
    const value = resolveStoredIntakeString(context.intake.values, field.key);
    if (!value) continue;
    lines.push(`- ${field.label} (${field.key}): ${value}`);
  }
  const ani = context.telephony.inboundCallerE164?.trim();
  if (ani && !resolveStoredIntakeString(context.intake.values, "phone")) {
    lines.push(`- Inbound caller ID (ANI): ${ani}`);
  }
  if (lines.length === 0) {
    return "SHARED CALLER FACTS (authoritative): (none persisted yet for this call)";
  }
  return [
    "SHARED CALLER FACTS (authoritative — reuse; do not ask again unless the caller wants to change them):",
    ...lines,
  ].join("\n");
}
