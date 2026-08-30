/**
 * Remove runtime_turn from Amy's Telnyx assistant and republish direct webhook tools.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/amy-remove-runtime-turn-republish.ts
 */
import { getPrisma } from "../src/lib/db";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { buildAssistantTools } from "../src/lib/voice/telnyx/assistant-tools";
import { resolveEnabledBuiltinTools } from "../src/lib/voice/tools/catalog";
import { filterToolsForCallerAmyPublish } from "../src/lib/voice/workflow-engine/tool-publish";
import { restoreTexmlInboundRoute } from "../src/lib/telephony/provisioning/number-assignment";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = process.env.PHONE_E164 || "+18663464256";

const DIRECT_TOOLS = [
  "hangup",
  "end_call",
  "get_runtime_context",
  "record_current_field",
  "continue_workflow",
  "lookup_customer",
  "take_structured_message",
  "escalate_human",
];

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AMY_AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Amy not found: ${AMY_AGENT_ID}`);

  const prev = parseVoiceAgentConfig(agent.draftConfig);
  const tools = new Set(
    Array.isArray(prev.enabledBuiltinTools) ? prev.enabledBuiltinTools : [],
  );
  tools.delete("runtime_turn");
  for (const t of DIRECT_TOOLS) tools.add(t);

  const enabled = [...tools];
  const published = filterToolsForCallerAmyPublish(enabled);
  const telnyxTools = buildAssistantTools({
    workspaceId: WORKSPACE_ID,
    agentId: AMY_AGENT_ID,
    bucketIds: [],
    tools: [],
    enabledBuiltinTools: enabled,
    agentType: agent.agentType,
  });
  const webhookNames = telnyxTools
    .map((t) => (t as { webhook?: { name?: string } }).webhook?.name)
    .filter(Boolean);

  console.log("=== Tool surface before publish ===");
  console.log(
    JSON.stringify(
      {
        enabledBuiltinTools: enabled.filter((t) => !t.includes("calendar") && !t.includes("book_")),
        publishedFilter: published,
        telnyxWebhooks: webhookNames,
        runtime_turn_present: webhookNames.includes("runtime_turn"),
      },
      null,
      2,
    ),
  );

  if (webhookNames.includes("runtime_turn")) {
    throw new Error("runtime_turn still in Telnyx build — aborting");
  }

  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, {
    draftConfig: { ...prev, enabledBuiltinTools: enabled },
  });

  const publishedAgent = await publishVoiceAgent(
    WORKSPACE_ID,
    AMY_AGENT_ID,
    "remove-runtime-turn-direct-tools",
  );

  const restored = await restoreTexmlInboundRoute({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    agentId: AMY_AGENT_ID,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        version: publishedAgent.version.version,
        telnyxAssistantId: publishedAgent.agent.telnyxAssistantId,
        texmlRoute: restored.texmlRoute,
        webhookNames,
      },
      null,
      2,
    ),
  );

  console.log(`\nDone. Call ${PHONE_E164} — FAQ should not invoke runtime_turn.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
