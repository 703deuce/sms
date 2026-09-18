#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { RECEPTIONIST_COMPILED_KEY } from "../src/lib/voice/receptionist/types";
import { AMY_V2_CORE_STATIC_PROMPT } from "../src/lib/voice-receptionist-wizard/one-amy/amy-core-static-prompt";
import { readTelnyxWorkflowState } from "../src/lib/voice/telnyx/workflow-readback";
import { verifyVoiceV2WorkflowReadBack } from "../src/lib/voice-receptionist-wizard/workflow-capability";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    include: { publishedVersion: true },
  });
  if (!agent) throw new Error("no agent");
  const cfg = parseVoiceAgentConfig(agent.publishedVersion?.config || agent.draftConfig);
  const adv = (cfg.advanced || {}) as Record<string, unknown>;
  const snap = (cfg as Record<string, unknown>)[RECEPTIONIST_COMPILED_KEY] as {
    compiledPrompt?: string;
    voiceV2OneAmy?: boolean;
  };
  const prompt = snap?.compiledPrompt || "";
  console.log("DB:", {
    publishedVersion: agent.publishedVersion?.version,
    voiceV2PstnLiveBooking: adv.voiceV2PstnLiveBooking,
    voiceV2OneAmy: snap?.voiceV2OneAmy,
    promptMatch: prompt.slice(0, 200) === AMY_V2_CORE_STATIC_PROMPT.slice(0, 200),
  });
  if (agent.telnyxAssistantId) {
    const rb = await readTelnyxWorkflowState(agent.telnyxAssistantId);
    const v = verifyVoiceV2WorkflowReadBack({ expectedVoiceV2Booking: true, readBack: rb });
    console.log("Telnyx:", {
      toolIds: rb.tool_ids,
      generalTools: rb.generalNode?.shared_tool_ids,
      liveBooking: rb.liveBookingNode?.id,
      verify: v,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
