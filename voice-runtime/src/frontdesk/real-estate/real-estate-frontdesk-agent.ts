import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import type { CompiledRealEstateFrontDesk } from "@/lib/voice/real-estate/compile/types";
import { resolveRealEstateBusinessConfig } from "@/lib/voice/real-estate/config";
import { createInitialCallState } from "@/lib/voice/real-estate/state";
import { buildFrontDeskBookingTools } from "../booking-tools";
import type { FrontDeskUserData } from "../userdata";
import { buildRealEstateFrontDeskInstructions } from "./instructions";
import {
  buildRealEstateCollectRequiredFieldsTool,
  buildRealEstateGetRequiredFieldsTool,
  buildRealEstateIntentTools,
  buildRealEstateLookupContactTool,
  buildRealEstateTakeMessageTool,
} from "./re-tools";
import { prefetchCallerContactFromAni } from "./intake-lifecycle";
import { withHybridStreamingAgentOptions } from "../../hybrid-streaming-tts-node";

/**
 * Composition root for the Real Estate Front Desk LiveKit agent.
 * Instructions + allowed tools are assembled here; implementations live in sibling modules.
 */
export function createRealEstateFrontDeskAgent(input: {
  businessName: string;
  timezone: string;
  dynamicVariables?: Record<string, unknown> | null;
  publishedConfig?: CompiledRealEstateFrontDesk;
}) {
  const business = resolveRealEstateBusinessConfig({
    ...input.dynamicVariables,
    business_name: input.businessName,
    ...(input.publishedConfig?.business
      ? {
          service_areas: input.publishedConfig.business.serviceAreas,
          property_types: input.publishedConfig.business.propertyTypes,
        }
      : {}),
  });
  const label = business.businessName;
  const bookingEnabled = input.publishedConfig?.booking?.enabled !== false;
  const { toolDefs: bookingToolDefs } = buildFrontDeskBookingTools({
    timezone: input.timezone,
    includeBooking: bookingEnabled,
  });

  const reTools = [
    buildRealEstateLookupContactTool(),
    ...buildRealEstateIntentTools(),
    buildRealEstateGetRequiredFieldsTool(),
    buildRealEstateCollectRequiredFieldsTool(),
    buildRealEstateTakeMessageTool(),
  ];

  const agent = voice.Agent.create<FrontDeskUserData>(
    withHybridStreamingAgentOptions({
    instructions: buildRealEstateFrontDeskInstructions({
      business,
      timezone: input.timezone,
      compiled: input.publishedConfig,
    }),
    tools: llm.toToolContext([...reTools, ...bookingToolDefs]),
    onEnter: async (agentCtx) => {
      const session = agentCtx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      if (!ud.callState) {
        ud.callState = createInitialCallState();
      }
      prefetchCallerContactFromAni(session);

      const hour = ud.cal.now().getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      await session.generateReply({
        instructions:
          `Say hello and welcome the caller — it's ${timeOfDay} their time. ` +
          `You're the front desk for ${label}, a real estate brokerage. ` +
          "Ask how you can help with buying, selling, showings, or anything else today. " +
          "Keep it warm and brief — do not start collecting fields yet.",
        toolChoice: "none",
      });
    },
  }),
  );

  return agent;
}
