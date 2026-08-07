#!/usr/bin/env node
/**
 * Enable runtime_turn in Amy's published config and republish to Telnyx.
 * Without this, Telnyx calls runtime_turn but our API rejects it immediately.
 */
import { PrismaClient } from "@prisma/client";

const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();

async function main() {
  const prisma = new PrismaClient();
  const { updateVoiceAgentDraft, publishVoiceAgent } = await import(
    "../src/lib/voice/agent-service.ts"
  );
  const { isBuiltinToolEnabled, resolveEnabledBuiltinTools } = await import(
    "../src/lib/voice/tools/catalog.ts"
  );

  const agent = await prisma.voiceAgent.findUnique({ where: { id: AMY_AGENT_ID } });
  if (!agent) throw new Error("Amy not found");

  const ver = agent.publishedVersionId
    ? await prisma.voiceAgentVersion.findUnique({ where: { id: agent.publishedVersionId } })
    : null;
  const cfg = (ver?.config || agent.draftConfig || {});
  const tools = new Set(
    Array.isArray(cfg.enabledBuiltinTools) ? cfg.enabledBuiltinTools : [],
  );
  tools.add("runtime_turn");

  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, {
    draftConfig: { ...cfg, enabledBuiltinTools: [...tools] },
  });

  const published = await publishVoiceAgent(WORKSPACE_ID, AMY_AGENT_ID, "enable-runtime-turn");
  const enabled = resolveEnabledBuiltinTools({
    enabledBuiltinTools: [...tools],
    agentType: agent.agentType,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        agentId: AMY_AGENT_ID,
        publishedVersionId: published.agent.publishedVersionId,
        runtime_turn_enabled: isBuiltinToolEnabled(enabled, "runtime_turn"),
        texmlRoute: published.texmlRoute,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
