import type { VoiceV3AgentConfig } from "../config/agent-config";

/** Published strategies that use direct calendar FIND/BOOK/MANAGE (Microsoft or Google). */
export function isDirectCalendarBookingStrategy(
  strategy: VoiceV3AgentConfig["scheduling"]["bookingStrategy"] | undefined,
): boolean {
  return strategy === "MICROSOFT_365" || strategy === "GOOGLE_CALENDAR";
}
