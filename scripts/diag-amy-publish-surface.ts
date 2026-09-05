import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { filterToolsForCallerAmyPublish } from "../src/lib/voice/workflow-engine/tool-publish";
import { resolveEnabledBuiltinTools } from "../src/lib/voice/tools/catalog";
import { buildAssistantTools } from "../src/lib/voice/telnyx/assistant-tools";
import { compileCallerToolPlaybookForPrompt } from "../src/lib/agents/appointment-booking/intelligence/caller-tool-playbook";

const AGENT_ID = "cmshz2lc25c622c4i58303501";

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID },
    select: { draftConfig: true, publishedVersionId: true, telnyxAssistantId: true },
  });
  if (!agent?.publishedVersionId) throw new Error("no published version");
  const ver = await prisma.voiceAgentVersion.findFirst({
    where: { id: agent.publishedVersionId },
    select: { config: true, version: true },
  });
  const config = parseVoiceAgentConfig(ver?.config);
  const enabled = resolveEnabledBuiltinTools({
    enabledBuiltinTools: config.enabledBuiltinTools,
    agentType: "appointment_booking",
  });
  const published = filterToolsForCallerAmyPublish(enabled, config);
  const telnyxTools = buildAssistantTools({
    workspaceId: "ws_1",
    agentId: AGENT_ID,
    bucketIds: [],
    tools: [],
    enabledBuiltinTools: config.enabledBuiltinTools || [],
    agentType: "appointment_booking",
    voiceConfig: config,
  });
  const names = telnyxTools
    .map((t) => (t as { webhook?: { name?: string } }).webhook?.name || (t as { type?: string }).type)
    .filter(Boolean);

  const playbookWrong = compileCallerToolPlaybookForPrompt(enabled, {
    minimumSideEffect: false,
  });
  const playbookRight = compileCallerToolPlaybookForPrompt(enabled, {
    minimumSideEffect: false,
    conversationWorkflow: false,
  });

  console.log(
    JSON.stringify(
      {
        version: ver?.version,
        telnyxAssistantId: agent.telnyxAssistantId,
        advanced: config.advanced,
        publishedTools: published,
        telnyxToolNames: names,
        playbookAuthorityWrong: playbookWrong.split("\n")[2],
        playbookAuthorityRight: playbookRight.split("\n")[2],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
