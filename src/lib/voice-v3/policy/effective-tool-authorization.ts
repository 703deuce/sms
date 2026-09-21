import type { VoiceV3AgentConfig } from "../config/agent-config";
import { isQualificationBlockingCalendarActions } from "../qualification/evaluate-qualification";
import { resolveActiveServicePolicy, serviceAllowsLiveBooking } from "./service-policy";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3AuthorizedToolName } from "../tools/authorize-tool-for-config";

/**
 * Deterministic tool authorization beyond static capability flags (qualification, service policy).
 * Conversational authority remains GPT-Live + delegated Responses/Sol.
 */
export function isVoiceV3ToolAuthorizedEffective(
  config: VoiceV3AgentConfig,
  toolName: VoiceV3AuthorizedToolName,
  _at?: string,
  callContext?: VoiceV3CallContext,
): boolean {
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

  return true;
}
