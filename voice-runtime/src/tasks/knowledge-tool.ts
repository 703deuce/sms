import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { domainGetBusinessAnswer } from "@/lib/voice/domain-actions";
import type { AmyUserData } from "../metadata";
import { requireCallContext, stashCallContext } from "../call-context";

/**
 * Read-only knowledge lookup — safe during booking/collection sub-tasks.
 * Mirrors healthcare root-agent knowledge tools without mutating session booking state.
 */
export function buildGetBusinessAnswerTool(sessionRef: AgentSession<AmyUserData>) {
  return llm.tool({
    name: "get_business_answer",
    description:
      "Look up business hours, pricing, policies, or FAQs. Call when the caller asks a general question.",
    parameters: z.object({
      topic: z.string().describe("What the caller wants to know, e.g. hours, pricing, warranty"),
    }),
    execute: async ({ topic }) => {
      let ctx = requireCallContext(sessionRef);
      const result = await domainGetBusinessAnswer({ ctx, topic });
      stashCallContext(sessionRef, ctx);
      if (!result.ok) {
        throw new llm.ToolError(result.speak);
      }
      return result.speak;
    },
  });
}
