import type { VoiceV3AgentConfig } from "../config/agent-config";
import { isDirectCalendarBookingConfig } from "../calendar/direct-booking-strategy";
import { gateCapabilitiesForOperatingState } from "../operating-maturity/behavior-gating";
import { resolveVoiceV2OperatingState } from "../operating-maturity/operating-state";
import { isVoiceV3ToolAuthorizedEffective } from "../policy/effective-tool-authorization";
import type { VoiceToolErr } from "./types";
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
  | "take_message"
  | "report_unwanted_solicitor";

export function isRequestCallbackAuthorized(config: VoiceV3AgentConfig): boolean {
  return config.callHandling.callbackRequestsEnabled === true;
}

export function isTakeMessageAuthorized(config: VoiceV3AgentConfig): boolean {
  return config.capabilities?.takeMessages === true;
}

export function isReportUnwantedSolicitorAuthorized(config: VoiceV3AgentConfig): boolean {
  return (config.spamProtection?.solicitorPolicy ?? "ALLOW") === "DECLINE";
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
    case "report_unwanted_solicitor":
      return isReportUnwantedSolicitorAuthorized(config);
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

function explainVoiceV3ToolDenial(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
): VoiceToolErr | null {
  if (isVoiceV3ToolAuthorized(config, toolName)) return null;

  if (
    isVoiceV3ToolAuthorizedBase(config, toolName) &&
    !isVoiceV3ToolAuthorizedEffective(config, toolName)
  ) {
    const policy = config.operatingPolicy;
    if (
      policy?.businessSchedule &&
      policy.afterHoursBehavior &&
      (toolName === "book_appointment" || toolName === "find_availability")
    ) {
      const operating = resolveVoiceV2OperatingState({
        schedule: policy.businessSchedule,
      });
      const gates = gateCapabilitiesForOperatingState({
        ctx: {
          capabilities: {
            transferToolAvailable: isVoiceV3ToolAuthorizedBase(config, "transfer_call"),
            callbackToolAvailable: isVoiceV3ToolAuthorizedBase(config, "request_callback"),
            bookingEnabled: isVoiceV3ToolAuthorizedBase(config, "book_appointment"),
            voiceV2PstnLiveBooking: isVoiceV3ToolAuthorizedBase(config, "book_appointment"),
          },
        },
        operating,
        behavior: policy.afterHoursBehavior,
      });
      if (!gates.liveBookingAllowed) {
        return voiceToolError(
          "LIVE_BOOKING_BLOCKED_BY_OPERATING_STATE",
          "Live calendar booking is not allowed for the current operating state. Do not search or book on the calendar. Offer take_message or request_callback, or explain when live booking is available.",
          {
            tool: toolName,
            operating_state: operating.state,
            suggested_tools: ["take_message", "request_callback"],
          },
          "not_ready",
        );
      }
    }
    return voiceToolError(
      "BOOKING_POLICY_BLOCKED",
      `${toolName} is blocked by a runtime policy gate even though booking is configured. Use an alternate tool or explain the limitation to the caller.`,
      { tool: toolName },
      "not_ready",
    );
  }

  if (
    (toolName === "book_appointment" || toolName === "find_availability") &&
    config.capabilities?.bookAppointments &&
    !isDirectCalendarStrategy(config)
  ) {
    const strategy = config.scheduling?.bookingStrategy ?? "NONE";
    if (strategy === "SEND_LINK") {
      return voiceToolError(
        "BOOKING_STRATEGY_MISMATCH",
        `${toolName} is not available when the published strategy is Send booking link. Use send_booking_link instead.`,
        { tool: toolName, suggested_tools: ["send_booking_link"] },
        "not_allowed",
      );
    }
    if (strategy === "REQUEST_ONLY") {
      return voiceToolError(
        "BOOKING_STRATEGY_MISMATCH",
        `${toolName} is not available for request-only booking. Use submit_appointment_request instead.`,
        { tool: toolName, suggested_tools: ["submit_appointment_request"] },
        "not_allowed",
      );
    }
  }

  return null;
}

export function authorizeVoiceV3ToolOrError(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
) {
  const explained = explainVoiceV3ToolDenial(config, toolName);
  if (explained) return explained;
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
