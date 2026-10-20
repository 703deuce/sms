import type { VoiceV3AgentConfig } from "../config/agent-config";
import {
  isVoiceV3ToolAuthorizedBase,
  type VoiceV3AuthorizedToolName,
} from "../tools/authorize-tool-for-config";
import { isQualificationBlockingCalendarActions } from "../qualification/evaluate-qualification";
import { resolveActiveServicePolicy, serviceAllowsLiveBooking } from "./service-policy";
import type { VoiceV3CallContext } from "../state/call-context";

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

  // New-app editor does not populate legacy wizard operatingPolicy yet — no after-hours tool lockout.
  return true;
}
