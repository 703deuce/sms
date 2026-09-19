import type { VoiceV3AgentConfig } from "../config/agent-config";
import { voiceToolError } from "./types";

export type VoiceV3AuthorizedToolName =
  | "book_appointment"
  | "find_availability"
  | "find_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "transfer_call";

export function isVoiceV3ToolAuthorized(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
): boolean {
  const caps = config.capabilities;
  switch (toolName) {
    case "book_appointment":
      return caps.bookAppointments && config.scheduling?.bookingStrategy === "MICROSOFT_365";
    case "find_availability":
      return caps.checkAvailability && config.scheduling?.bookingStrategy === "MICROSOFT_365";
    case "find_appointment":
      return caps.findAppointments;
    case "reschedule_appointment":
      return caps.rescheduleAppointments;
    case "cancel_appointment":
      return caps.cancelAppointments;
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
  return voiceToolError(
    "CAPABILITY_DISABLED",
    `${toolName} is not enabled for this agent configuration.`,
    { tool: toolName },
    "not_ready",
  );
}
