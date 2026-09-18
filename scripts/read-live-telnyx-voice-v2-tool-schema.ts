#!/usr/bin/env npx tsx
/**
 * Read back LIVE Telnyx voice_v2_find_availability tool schema.
 */
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE, VOICE_V2_TELNYX_TOOL_NAME } from "../src/lib/voice-receptionist-wizard/telnyx-tool-definition";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

function findV2Tool(tools: unknown): Record<string, unknown> | null {
  if (!Array.isArray(tools)) return null;
  for (const t of tools) {
    const tool = t as Record<string, unknown>;
    const name = String(tool.name || "");
    const webhook = tool.webhook as Record<string, unknown> | undefined;
    const wname = String(webhook?.name || "");
    if (
      name === VOICE_V2_TELNYX_TOOL_NAME ||
      wname === VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE ||
      name.includes("voice-v2-find")
    ) {
      return tool;
    }
  }
  return null;
}

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { telnyxAssistantId: true, name: true },
  });
  if (!agent?.telnyxAssistantId) {
    console.log("TELNYX_V2_SCHEMA_LIVE .............. FAIL");
    process.exit(1);
  }

  const remote = await ai.getAssistant(agent.telnyxAssistantId);
  const data = (remote as { data?: Record<string, unknown> }).data || remote;
  let tool = findV2Tool((data as Record<string, unknown>).tools);
  if (!tool && Array.isArray((data as Record<string, unknown>).tool_ids)) {
    const ids = (data as Record<string, unknown>).tool_ids as string[];
    for (const id of ids) {
      try {
        const shared = await ai.getSharedTool(id);
        const row = (shared as { data?: Record<string, unknown> }).data || shared;
        if (String((row as Record<string, unknown>).display_name || "") === VOICE_V2_TELNYX_TOOL_NAME) {
          tool = row as Record<string, unknown>;
          break;
        }
      } catch {
        // skip
      }
    }
  }
  if (!tool) {
    console.log("TELNYX_V2_SCHEMA_LIVE .............. FAIL (tool missing)");
    process.exit(1);
  }

  const webhook = (tool.webhook || tool) as Record<string, unknown>;
  const params = (webhook?.body_parameters || {}) as Record<string, unknown>;
  const props = (params.properties || {}) as Record<string, unknown>;
  const hasDate = "requested_date" in props;
  const hasWindow = "time_window" in props;
  const hasUtterance = "utterance" in props;
  const pass = hasDate && hasWindow && !hasUtterance;

  console.log(JSON.stringify(props, null, 2));
  console.log(`\nTELNYX_V2_SCHEMA_LIVE .............. ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
