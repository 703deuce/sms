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

  const preferredTimeLine =
    config.callHandling?.callbackAskPreferredTime !== false
      ? "When the caller has not already given a preferred callback time, ask naturally when would be a good time for someone to call back and pass preferred_time to request_callback."
      : "Do not require a preferred callback time unless the caller offers one.";

  const confirmNumberLine =
    config.callHandling?.callbackConfirmNumber === true
      ? "When using inbound ANI or a stored phone, confirm with the caller that it is the best number (for example ending in the last four digits) before request_callback. After explicit confirmation, save callback_phone_confirmed via update_intake."
      : "When ANI is allowed by policy, you may use it without an extra confirmation question.";

  return `
Callback requests are enabled for this business.

Configured callback-required information:
${requiredLines.join("\n") || "(none configured)"}

${aniLine}

${preferredTimeLine}

${confirmNumberLine}

Reuse caller facts already stored in shared call state for this call. When the caller has clearly requested a callback, invoke request_callback — the trusted executor validates requirements and returns needs_information with missingFields when more is needed. Do not require booking-only fields (for example email or scheduling preferences) unless they are also listed above for callback.
`.trim();
}
