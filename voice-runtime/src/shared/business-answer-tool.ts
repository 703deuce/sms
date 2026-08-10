import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";
import { resolveOutboundProfileBusinessAnswer } from "@/lib/voice/outbound/compile-outbound-call-context";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { isOutboundLeadUserData } from "../outbound/userdata";

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
        if (isOutboundLeadUserData(ud)) {
          const profileAnswer = resolveOutboundProfileBusinessAnswer({
            business: ud.mission.business,
            businessName: ud.businessName,
            topic,
          });
          if (profileAnswer) {
            return `${profileAnswer} Then return to gathering any remaining qualification details.`;
          }
        }

        const result = await resolveBusinessAnswer({
          workspaceId: ud.workspaceId,
          agentId: ud.agentId,
          topic,
        });
        if (!result.ok) {
          if (isOutboundLeadUserData(ud) && ud.mission.business?.description) {
            return `${ud.mission.business.description} Then return to qualification.`;
          }
          throw new llm.ToolError(result.speak);
        }
        return `${result.speak} Then return to gathering any remaining qualification details.`;
      });
    },
  });
}
