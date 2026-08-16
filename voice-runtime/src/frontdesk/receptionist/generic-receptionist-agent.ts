import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import type { ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";
import { buildReceptionistCompiledPrompt } from "@/lib/voice/receptionist/build-receptionist-compiled-prompt";
import { withHybridStreamingAgentOptions } from "../../hybrid-streaming-tts-node";
import type { FrontDeskUserData } from "../userdata";
import { buildReceptionistTools } from "./receptionist-tools";
import { attachReceptionistWorkflowOrchestrator } from "./workflow-orchestrator";
import { ensureReceptionistWorkflow } from "./workflow-engine";

export function createGenericReceptionistAgent(input: {
  snapshot: ReceptionistCompiledSnapshot;
  businessName: string;
  timezone: string;
}) {
  const label = input.businessName.trim() || input.snapshot.businessName || "our office";
  const instructions =
    input.snapshot.compiledPrompt?.trim() || buildReceptionistCompiledPrompt(input.snapshot);

  const builtTools = buildReceptionistTools({
    snapshot: input.snapshot,
    timezone: input.timezone,
  });

  const agent = voice.Agent.create<FrontDeskUserData>(
    withHybridStreamingAgentOptions(
      {
        instructions,
        tools: llm.toToolContext(builtTools.toolDefs as never),
        onEnter: async (agentCtx) => {
          const session = agentCtx.session as AgentSession<FrontDeskUserData>;
          const ud = session.userData;
          ensureReceptionistWorkflow(ud);
          ud.receptionistSlotsMap = builtTools.slotsMap;
          ud.receptionistToolNames = builtTools.toolNames;
          ud.receptionistToolDefs = builtTools.toolDefs;

          attachReceptionistWorkflowOrchestrator(session);

          const greeting = input.snapshot.greeting.trim();
          if (greeting) {
            await session.generateReply({
              instructions: `Say exactly this greeting to the caller (warm and natural): ${greeting}`,
              toolChoice: "none",
            });
            return;
          }
          await session.generateReply({
            instructions: `Welcome the caller to ${label}. Ask how you can help today. Keep it brief and warm.`,
            toolChoice: "none",
          });
        },
      },
      input.snapshot.realtimeOutputMode,
    ),
  );

  return agent;
}
