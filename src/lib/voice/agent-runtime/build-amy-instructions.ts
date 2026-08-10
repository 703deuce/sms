import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import { buildAmyLiveKitPermanentPrompt } from "@/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";
import { buildConversationalContextBlock } from "./conversational-context";

/** Shared Amy instructions for LiveKit phone and text simulator — must stay identical. */
export function buildAmyAgentInstructions(callContext: LiveKitCallContext): string {
  const capabilityContext = buildConversationalContextBlock(callContext);

  return [buildAmyLiveKitPermanentPrompt(callContext.businessName), capabilityContext]
    .filter(Boolean)
    .join("\n\n");
}
