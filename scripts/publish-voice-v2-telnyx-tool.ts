#!/usr/bin/env npx tsx
/**
 * Attach Voice Booking V2 shared Telnyx tool (tool_ids) — does not modify legacy booking tool.
 */
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import { TelnyxApiError } from "../src/lib/voice/telnyx/ai-client";
import { getAppBaseUrl } from "../src/lib/messaging/telnyx/config";
import {
  VOICE_V2_TELNYX_TOOL_NAME,
  VOICE_V2_FIND_AVAILABILITY_BODY,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
} from "../src/lib/voice-v2/telnyx-tool-definition";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

function unwrapToolId(res: unknown): string | null {
  if (!res || typeof res !== "object") return null;
  const obj = res as Record<string, unknown>;
  if (typeof obj.id === "string") return obj.id;
  const data = obj.data;
  if (data && typeof data === "object" && typeof (data as { id?: string }).id === "string") {
    return (data as { id: string }).id;
  }
  return null;
}

async function ensureV2SharedTool(): Promise<string> {
  const base = getAppBaseUrl();
  const url = `${base.replace(/\/$/, "")}/api/telnyx/voice-v2/find-availability`;
  const payload = {
    type: "webhook",
    display_name: VOICE_V2_TELNYX_TOOL_NAME,
    webhook: {
      name: VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
      description:
        "Voice Booking V2 proof: structured FIND_AVAILABILITY only. Interpret caller intent; send date + local time window.",
      url,
      method: "POST",
      timeout_ms: 10000,
      headers: [
        { name: "X-Transovo-Workspace-Id", value: WORKSPACE_ID },
        { name: "X-Transovo-Agent-Id", value: AGENT_ID },
        { name: "X-Transovo-Tool-Type", value: VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE },
      ],
      body_parameters: VOICE_V2_FIND_AVAILABILITY_BODY,
    },
  };

  const listed = await ai.listSharedTools().catch(() => ({ data: [] }));
  const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
  const existing = tools.find((t) => t.display_name === VOICE_V2_TELNYX_TOOL_NAME);
  if (existing?.id) {
    try {
      await ai.updateSharedTool(existing.id, payload);
      return existing.id;
    } catch (err) {
      if (!(err instanceof TelnyxApiError) || (err.status !== 404 && err.status !== 410)) {
        throw err;
      }
    }
  }
  const created = await ai.createSharedTool(payload);
  const id = unwrapToolId(created);
  if (!id) throw new Error("createSharedTool_missing_id");
  return id;
}

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { telnyxAssistantId: true },
  });
  if (!agent?.telnyxAssistantId) throw new Error("telnyxAssistantId missing");

  const v2ToolId = await ensureV2SharedTool();
  const remote = await ai.getAssistant(agent.telnyxAssistantId);
  const data = (remote as { data?: Record<string, unknown> }).data || remote;
  const assistant = data as Record<string, unknown>;
  const { syncConversationWorkflowToTelnyx } = await import("../src/lib/voice/telnyx/workflow-sync");
  const { loadVoiceAgentRuntimeConfig } = await import("../src/lib/voice/load-agent-config");
  const { parseVoiceAgentConfig } = await import("../src/lib/voice/types");
  const fullAgent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  const runtime = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
  const config = parseVoiceAgentConfig(runtime || fullAgent?.draftConfig);
  const synced = await syncConversationWorkflowToTelnyx({
    assistantId: agent.telnyxAssistantId,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    config,
  });
  if (!synced.ok) throw new Error(synced.error || "workflow_sync_failed");
  const toolIds = [...new Set([...(synced.toolIds || []), v2ToolId])];

  await ai.updateAssistant(agent.telnyxAssistantId, {
    tool_ids: toolIds,
    tools: [],
  });

  console.log("Attached V2 shared tool_id:", v2ToolId);
  console.log("tool_ids:", toolIds.join(", "));
  console.log("Re-run: npx tsx scripts/read-live-telnyx-voice-v2-tool-schema.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
