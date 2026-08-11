import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import { resolveRealEstateBusinessConfig } from "@/lib/voice/real-estate/config";
import { createInitialCallState } from "@/lib/voice/real-estate/state";
import { buildFrontDeskBookingTools } from "../booking-tools";
import type { FrontDeskUserData } from "../userdata";
import { buildRealEstateFrontDeskInstructions } from "./instructions";
import {
  buildRealEstateFieldTools,
  buildRealEstateGetRequiredFieldsTool,
  buildRealEstateIntentTools,
  buildRealEstateLookupContactTool,
  buildRealEstateTakeMessageTool,
} from "./re-tools";

export function createRealEstateFrontDeskAgent(input: {
  businessName: string;
  timezone: string;
  dynamicVariables?: Record<string, unknown> | null;
}) {
  const business = resolveRealEstateBusinessConfig({
    ...input.dynamicVariables,
    business_name: input.businessName,
  });
  const label = business.businessName;
  const { toolDefs: bookingToolDefs } = buildFrontDeskBookingTools({
    timezone: input.timezone,
  });

  const reTools = [
    buildRealEstateLookupContactTool(),
    ...buildRealEstateIntentTools(),
    buildRealEstateGetRequiredFieldsTool(),
    buildRealEstateFieldTools(),
    buildRealEstateTakeMessageTool(),
  ];

  return voice.Agent.create<FrontDeskUserData>({
    instructions: buildRealEstateFrontDeskInstructions({
      business,
      timezone: input.timezone,
    }),
    tools: llm.toToolContext([...reTools, ...bookingToolDefs]),
    onEnter: async (agentCtx) => {
      const session = agentCtx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      if (!ud.callState) {
        ud.callState = createInitialCallState();
      }

      const hour = ud.cal.now().getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      await session.generateReply({
        instructions:
          `Say hello and welcome the caller — it's ${timeOfDay} their time. ` +
          `You're the front desk for ${label}, a real estate brokerage. ` +
          "Ask how you can help with buying, selling, showings, or anything else today. " +
          "Keep it warm and brief — do not start collecting fields yet.",
        toolChoice: "none",
        allowInterruptions: false,
      });
    },
  });
}
