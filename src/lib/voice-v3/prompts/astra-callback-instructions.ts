import type { VoiceV3AgentConfig } from "../config/agent-config";
import { resolveConfiguredCallbackRequiredKeys } from "../callback/callback-requirements";

/** Config-driven callback context for Astra — not hardcoded per-tenant field lists. */
export function buildAstraCallbackInstructions(config: VoiceV3AgentConfig): string {
  if (config.callHandling?.callbackRequestsEnabled !== true) {
    return "";
  }

  const requiredKeys = resolveConfiguredCallbackRequiredKeys(config);
  const requiredLines = requiredKeys.map((key) => {
    const field = config.intakeFields.find((f) => f.key === key);
    const label = field?.label?.trim() || key;
    return `- ${label} (${key})`;
  });

  const aniLine =
    config.callHandling?.callbackUseAniByDefault !== false
      ? "The inbound caller number may satisfy phone when the caller is calling from the number they want called back."
      : "Phone must be collected explicitly; do not assume the inbound caller number is the callback number.";

  const confirmLine =
    config.callHandling?.callbackConfirmNumber !== false
      ? "Before completing request_callback, confirm the callback number aloud with the caller when using inbound caller ID or a newly collected number."
      : "";

  const preferredTimeLine =
    config.callHandling?.callbackAskPreferredTime !== false
      ? "Collect a preferred callback time (natural language) before calling request_callback when the caller has not given one."
      : "Preferred callback time is optional; use preferred_time only when the caller offers timing.";

  return `
Callback requests are enabled for this business.

Configured callback-required information:
${requiredLines.join("\n") || "(none configured)"}

${aniLine}
${confirmLine ? `\n${confirmLine}` : ""}
${preferredTimeLine}

Reuse caller facts already stored in shared call state for this call. When the caller has clearly requested a callback, invoke request_callback — the trusted executor validates requirements and returns needs_information with missingFields when more is needed. Do not require booking-only fields (for example email or scheduling preferences) unless they are also listed above for callback.
`.trim();
}
