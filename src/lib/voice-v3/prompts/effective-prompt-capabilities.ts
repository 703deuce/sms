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

/** How the pre-Amy connection audio relates to Amy's configured opening greeting. */
export type ConnectionGreetingRole = "none" | "holding" | "full_business";

const HOLDING_PHRASE_MARKERS = [
  "one moment",
  "hang on",
  "connect you",
  "while i connect",
  "get our receptionist",
  "please hold",
];

function normalizeGreetingText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * LiveKit Voice V3 bootstrap today knows telephony.connectionGreetingMode/text — not
 * whether playback actually completed (see docs/VOICE-V3-CONNECTION-GREETING-COORDINATION.md).
 */
export function resolveConnectionGreetingRole(
  config: VoiceV3AgentConfig,
): ConnectionGreetingRole {
  if (!connectionGreetingWillPlay(config)) return "none";

  const opening = normalizeGreetingText(config.conversation.openingGreeting ?? "");
  const connection = normalizeGreetingText(
    config.telephony?.connectionGreetingText?.trim() ?? "",
  );

  if (opening && connection) {
    if (opening === connection) return "full_business";
    const shorter = opening.length < connection.length ? opening : connection;
    const longer = opening.length >= connection.length ? opening : connection;
    if (shorter.length >= 40 && longer.includes(shorter)) return "full_business";
  }

  if (
    connection &&
    HOLDING_PHRASE_MARKERS.some((marker) => connection.includes(marker))
  ) {
    return "holding";
  }

  const mode = config.telephony?.connectionGreetingMode?.trim().toLowerCase() ?? "";
  if (mode === "transovo_professional" || mode === "transovo_warm") {
    return "holding";
  }

  if (config.telephony?.connectionGreetingAudioUrl?.trim() && !connection) {
    return "holding";
  }

  if (connection && opening && connection.length > 80) {
    return "full_business";
  }

  return connection ? "holding" : "holding";
}
