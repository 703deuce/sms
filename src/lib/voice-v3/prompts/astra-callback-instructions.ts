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

  return `
Callback requests are enabled for this business.

Configured callback-required information:
${requiredLines.join("\n") || "(none configured)"}

${aniLine}

Reuse caller facts already stored in shared call state for this call. Collect only missing callback-required facts before invoking the authoritative callback action. Do not require booking-only fields (for example email or scheduling preferences) unless they are also listed above for callback.
`.trim();
}
