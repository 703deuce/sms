import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";
import type { FrontDeskUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import {
  formatToolFeedbackForModel,
  toolFeedbackFromError,
  toolFeedbackSuccess,
} from "../tool-feedback";

/**
 * Read-only business knowledge — wizard config + linked RAG corpus.
 * LiveKit progressive-disclosure pattern (lookup tool, not prompt stuffing).
 */
export function buildFrontDeskBusinessAnswerTool() {
  return llm.tool({
    name: "get_business_answer",
    description:
      "Look up long-tail business knowledge: uploaded documents, website pages, large FAQ libraries, detailed policies, manuals, or niche product documentation. Do not use for hours, pricing, services, or company name — those are in BUSINESS CONTEXT.",
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
          return formatToolFeedbackForModel(
            toolFeedbackFromError(result.speak || "Knowledge lookup failed", {
              tool: "get_business_answer",
            }),
          );
        }
        return formatToolFeedbackForModel(
          toolFeedbackSuccess(result.speak, {
            tool: "get_business_answer",
            next_action: "continue_conversation",
            guidance: "Answer the caller using this information — one concise thought.",
          }),
        );
      });
    },
  });
}
