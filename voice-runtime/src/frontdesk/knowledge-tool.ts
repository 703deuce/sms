import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";
import type { FrontDeskUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";

/**
 * Read-only business knowledge — wizard config + linked RAG corpus.
 * LiveKit progressive-disclosure pattern (lookup tool, not prompt stuffing).
 */
export function buildFrontDeskBusinessAnswerTool() {
  return llm.tool({
    name: "get_business_answer",
    description:
      "Look up business hours, pricing, services, policies, or FAQs. Call when the caller asks a general question.",
    parameters: z.object({
      topic: z.string().describe("What the caller wants to know, e.g. hours, pricing, warranty, emergency"),
    }),
    execute: async ({ topic }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "get_business_answer", { topic }, async () => {
        const result = await resolveBusinessAnswer({
          workspaceId: ud.workspaceId,
          agentId: ud.agentId,
          topic,
        });
        if (!result.ok) {
          throw new llm.ToolError(result.speak);
        }
        return result.speak;
      });
    },
  });
}
