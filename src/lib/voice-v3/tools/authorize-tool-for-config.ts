import type { VoiceV3AgentConfig } from "../config/agent-config";
import { voiceToolError } from "./types";

export type VoiceV3AuthorizedToolName =
  | "book_appointment"
  | "find_availability"
  | "find_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "transfer_call"
  | "send_booking_link";

function isMicrosoftDirectStrategy(config: VoiceV3AgentConfig): boolean {
  return config.scheduling?.bookingStrategy === "MICROSOFT_365";
}

export function isSendBookingLinkAuthorized(config: VoiceV3AgentConfig): boolean {
  if (config.scheduling?.bookingStrategy !== "SEND_LINK") return false;
  const url = config.bookingStrategyDetail?.bookingLinkUrl?.trim();
  return Boolean(url);
}

export function isVoiceV3ToolAuthorized(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
): boolean {
  const caps = config.capabilities;
  switch (toolName) {
    case "book_appointment":
      return caps.bookAppointments && isMicrosoftDirectStrategy(config);
    case "find_availability":
      return caps.checkAvailability && isMicrosoftDirectStrategy(config);
    case "find_appointment":
      return caps.findAppointments && isMicrosoftDirectStrategy(config);
    case "reschedule_appointment":
      return caps.rescheduleAppointments && isMicrosoftDirectStrategy(config);
    case "cancel_appointment":
      return caps.cancelAppointments && isMicrosoftDirectStrategy(config);
    case "send_booking_link":
      return isSendBookingLinkAuthorized(config);
    case "transfer_call":
      return (
        caps.transferCalls &&
        (config.transferDestinations?.some((d) => d.enabled !== false) ?? false)
      );
    default:
      return false;
  }
}

export function authorizeVoiceV3ToolOrError(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
) {
  if (isVoiceV3ToolAuthorized(config, toolName)) return null;
  if (toolName === "send_booking_link" && isMicrosoftDirectStrategy(config)) {
    return voiceToolError(
      "BOOKING_STRATEGY_MISMATCH",
      "send_booking_link is not available for Microsoft direct booking.",
      { tool: toolName },
      "not_allowed",
    );
  }
  if (
    (toolName === "book_appointment" || toolName === "find_availability") &&
    config.scheduling?.bookingStrategy === "SEND_LINK"
  ) {
    return voiceToolError(
      "BOOKING_STRATEGY_MISMATCH",
      `${toolName} is not available when the published strategy is Send booking link.`,
      { tool: toolName },
      "not_allowed",
    );
  }
  return voiceToolError(
    "CAPABILITY_DISABLED",
    `${toolName} is not enabled for this agent configuration.`,
    { tool: toolName },
    "not_ready",
  );
}

export function authorizeSendBookingLinkOrError(config: VoiceV3AgentConfig) {
  return authorizeVoiceV3ToolOrError(config, "send_booking_link");
}
