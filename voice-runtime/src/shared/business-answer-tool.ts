import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";

type KnowledgeSessionUserData = {
  workspaceId: string;
  agentId: string;
  callId: string;
};

export function buildBusinessAnswerTool<T extends KnowledgeSessionUserData>(
  sessionRef: AgentSession<T>,
) {
  return llm.tool({
    name: "get_business_answer",
    description:
      "Look up business hours, pricing, services, policies, or FAQs. Call when the caller asks a general question.",
    parameters: z.object({
      topic: z.string().describe("What the caller wants to know"),
    }),
    execute: async ({ topic }) => {
      const ud = sessionRef.userData;
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
