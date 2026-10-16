import type { VoiceV3AgentConfig } from "../config/agent-config";
import { isDirectCalendarBookingConfig } from "../calendar/direct-booking-strategy";
import { listVoiceV3AstraToolNamesForConfig } from "../tools/voice-tool-catalog";

export function runtimeAstraToolNames(config?: VoiceV3AgentConfig): string[] {
  if (!config) return [];
  return listVoiceV3AstraToolNamesForConfig(config);
}

export function runtimeHasTool(config: VoiceV3AgentConfig | undefined, name: string): boolean {
  return runtimeAstraToolNames(config).includes(name);
}

export function connectionGreetingWillPlay(config: VoiceV3AgentConfig): boolean {
  const mode = config.telephony?.connectionGreetingMode?.trim().toLowerCase() ?? "none";
  if (mode === "none" || mode === "off") return false;
  return Boolean(
    config.telephony?.connectionGreetingText?.trim() ||
      config.telephony?.connectionGreetingAudioUrl?.trim() ||
      mode.startsWith("transovo"),
  );
}
