import type { VoiceV3AgentConfig } from "../config/agent-config";
import {
  isVoiceV3ToolAuthorizedBase,
  type VoiceV3AuthorizedToolName,
} from "../tools/authorize-tool-for-config";
import { isQualificationBlockingCalendarActions } from "../qualification/evaluate-qualification";
import { resolveActiveServicePolicy, serviceAllowsLiveBooking } from "./service-policy";
import type { VoiceV3CallContext } from "../state/call-context";
import { gateCapabilitiesForOperatingState } from "../operating-maturity/behavior-gating";
import { resolveVoiceV2OperatingState } from "../operating-maturity/operating-state";

/**
 * Deterministic tool authorization for new-app receptionist (AgentConfig → VoiceV3AgentConfig).
 * After-hours gating uses `config.operatingPolicy` when present on the published config;
 * otherwise capabilities + calendar connection govern booking tools.
 */
export function isVoiceV3ToolAuthorizedEffective(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
  _at?: string,
  callContext?: VoiceV3CallContext,
): boolean {
  if (!isVoiceV3ToolAuthorizedBase(config, toolName)) {
    return false;
  }

  if (callContext && isQualificationBlockingCalendarActions(config, callContext)) {
    if (
      toolName === "book_appointment" ||
      toolName === "find_availability" ||
      toolName === "find_appointment" ||
      toolName === "reschedule_appointment" ||
      toolName === "cancel_appointment"
    ) {
      return false;
    }
  }

  if (callContext) {
    const service = resolveActiveServicePolicy(config, callContext);
    if (
      !serviceAllowsLiveBooking(service) &&
      (toolName === "book_appointment" || toolName === "find_availability")
    ) {
      return false;
    }
  }

  if (toolName === "transfer_call" && config.callHandling.voiceV2HumanTransferEnabled === false) {
    return false;
  }

  const policy = config.operatingPolicy;
  if (policy?.businessSchedule && policy.afterHoursBehavior) {
    const operating = resolveVoiceV2OperatingState({
      schedule: policy.businessSchedule,
      overflowActive: callContext?.metadata?.overflowActive === true,
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
    if (toolName === "transfer_call" && !gates.transferToolAvailable) return false;
    if (toolName === "request_callback" && !gates.callbackToolAvailable) return false;
    if (
      (toolName === "book_appointment" || toolName === "find_availability") &&
      !gates.liveBookingAllowed
    ) {
      return false;
    }
    if (toolName === "take_message" && !gates.messageTakingAllowed) return false;
  }

  return true;
}
