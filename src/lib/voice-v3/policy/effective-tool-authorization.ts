import type { VoiceV3AgentConfig } from "../config/agent-config";
import { gateCapabilitiesForOperatingState } from "@/lib/voice-receptionist-wizard/operating-maturity/behavior-gating";
import { resolveVoiceV2OperatingState } from "@/lib/voice-receptionist-wizard/operating-maturity/operating-state";
import {
  isVoiceV3ToolAuthorizedBase,
  type VoiceV3AuthorizedToolName,
} from "../tools/authorize-tool-for-config";
import { isDirectCalendarBookingConfig } from "../calendar/direct-booking-strategy";

type OperatingGatingContext = Parameters<typeof gateCapabilitiesForOperatingState>[0]["ctx"];

function baseCapabilityContext(config: VoiceV3AgentConfig): OperatingGatingContext {
  const caps = config.capabilities;
  const directBooking =
    isDirectCalendarBookingConfig(config) &&
    Boolean(config.calendar?.connectionId && config.calendar.calendarIds.length);
  return {
    capabilities: {
      transferToolAvailable:
        caps.transferCalls &&
        (config.transfer?.enabled === true ||
          (config.transferDestinations?.some((d) => d.enabled !== false) ?? false)),
      callbackToolAvailable: config.callHandling.callbackRequestsEnabled === true,
      bookingEnabled: directBooking && caps.bookAppointments,
      voiceV2PstnLiveBooking: directBooking && caps.bookAppointments,
    },
  } as OperatingGatingContext;
}

/**
 * Deterministic tool authorization including after-hours / holiday operating policy.
 */
export function isVoiceV3ToolAuthorizedEffective(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
  at?: string,
): boolean {
  if (!isVoiceV3ToolAuthorizedBase(config, toolName)) {
    return false;
  }

  if (toolName === "transfer_call" && config.callHandling.voiceV2HumanTransferEnabled === false) {
    return false;
  }

  const policy = config.operatingPolicy;
  if (!policy?.afterHoursBehavior) {
    return true;
  }

  const operating = resolveVoiceV2OperatingState({
    schedule: policy.businessSchedule,
    at,
  });

  const gates = gateCapabilitiesForOperatingState({
    ctx: baseCapabilityContext(config),
    operating,
    behavior: policy.afterHoursBehavior,
  });

  switch (toolName) {
    case "book_appointment":
    case "find_availability":
    case "find_appointment":
    case "reschedule_appointment":
    case "cancel_appointment":
      return gates.liveBookingAllowed;
    case "request_callback":
      return gates.callbackToolAvailable;
    case "transfer_call":
      return gates.transferToolAvailable;
    case "send_booking_link":
      return true;
    default:
      return true;
  }
}
