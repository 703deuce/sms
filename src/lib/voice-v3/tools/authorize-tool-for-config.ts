import type { VoiceV3AgentConfig } from "../config/agent-config";
import { isDirectCalendarBookingConfig } from "../calendar/direct-booking-strategy";
import { isVoiceV3ToolAuthorizedEffective } from "../policy/effective-tool-authorization";
import { voiceToolError } from "./types";

export type VoiceV3AuthorizedToolName =
  | "book_appointment"
  | "find_availability"
  | "find_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "transfer_call"
  | "send_booking_link"
  | "request_callback"
  | "take_message";

export function isRequestCallbackAuthorized(config: VoiceV3AgentConfig): boolean {
  return config.callHandling.callbackRequestsEnabled === true;
}

export function isTakeMessageAuthorized(config: VoiceV3AgentConfig): boolean {
  return config.capabilities?.takeMessages === true;
}

function isDirectCalendarStrategy(config: VoiceV3AgentConfig): boolean {
  return isDirectCalendarBookingConfig(config);
}

export function isSendBookingLinkAuthorized(config: VoiceV3AgentConfig): boolean {
  if (config.scheduling?.bookingStrategy !== "SEND_LINK") return false;
  const url = config.bookingStrategyDetail?.bookingLinkUrl?.trim();
  return Boolean(url);
}

export function isVoiceV3ToolAuthorizedBase(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
): boolean {
  const caps = config.capabilities;
  switch (toolName) {
    case "book_appointment":
      return caps.bookAppointments && isDirectCalendarStrategy(config);
    case "find_availability":
      return caps.checkAvailability && isDirectCalendarStrategy(config);
    case "find_appointment":
      return caps.findAppointments && isDirectCalendarStrategy(config);
    case "reschedule_appointment":
      return caps.rescheduleAppointments && isDirectCalendarStrategy(config);
    case "cancel_appointment":
      return caps.cancelAppointments && isDirectCalendarStrategy(config);
    case "send_booking_link":
      return isSendBookingLinkAuthorized(config);
    case "transfer_call":
      return (
        caps.transferCalls &&
        (config.transfer?.enabled === true ||
          (config.transferDestinations?.some((d) => d.enabled !== false) ?? false))
      );
    case "request_callback":
      return isRequestCallbackAuthorized(config);
    case "take_message":
      return isTakeMessageAuthorized(config);
    default:
      return false;
  }
}

export function isVoiceV3ToolAuthorized(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
): boolean {
  if (!isVoiceV3ToolAuthorizedBase(config, toolName)) {
    return false;
  }
  return isVoiceV3ToolAuthorizedEffective(config, toolName);
}

export function authorizeVoiceV3ToolOrError(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
) {
  if (isVoiceV3ToolAuthorized(config, toolName)) return null;
  if (toolName === "send_booking_link" && isDirectCalendarStrategy(config)) {
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

export function authorizeRequestCallbackOrError(config: VoiceV3AgentConfig) {
  if (!isRequestCallbackAuthorized(config)) {
    return voiceToolError(
      "CALLBACK_DISABLED",
      "Callback requests are not enabled for this agent.",
      { status: "not_available" },
      "not_available",
    );
  }
  return null;
}

export function authorizeTakeMessageOrError(config: VoiceV3AgentConfig) {
  if (!isTakeMessageAuthorized(config)) {
    return voiceToolError(
      "MESSAGE_TAKING_DISABLED",
      "Message taking is not enabled for this agent.",
      { status: "not_available" },
      "not_available",
    );
  }
  return null;
}
