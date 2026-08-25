import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import { buildAmyLiveKitRootInstructions } from "@/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";

/** Root-agent instructions for LiveKit phone runtime (healthcare-style thin receptionist). */
export function buildAmyAgentInstructions(callContext: LiveKitCallContext): string {
  return buildAmyLiveKitRootInstructions(callContext.businessName);
}
