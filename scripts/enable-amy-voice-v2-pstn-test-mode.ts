#!/usr/bin/env npx tsx
/**
 * Telnyx-only PSTN test mode: V2 availability tool only (detaches legacy booking tool).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "../src/lib/voice-v2/telnyx-tool-definition";
import { restoreAmyTelnyxWorkflowWithV2 } from "./restore-amy-telnyx-tools-with-v2";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

const V2_PSTN_INSTRUCTION_APPEND = [
  "VOICE BOOKING V2 PSTN TEST (availability only):",
  "When the caller wants to schedule or asks what is open, call voice_v2_find_availability ONLY.",
  "Send structured requested_date (YYYY-MM-DD business local) and time_window { start, end } in HH:mm.",
  "Do NOT call voice_ai_booking_turn during this test.",
  "Do not book on this call — only return and speak available times from the tool response.",
].join(" ");

const LIVE_BOOKING_V2_INSTRUCTIONS = [
  "The caller wants to check live calendar availability.",
  `Call ${VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE} with requested_date and time_window only.`,
  "You interpret natural language (e.g. tomorrow afternoon) into structured date and window.",
  "Speak the exact slot labels returned in the tool response. Do not invent times.",
  "Do not call voice_ai_booking_turn.",
].join(" ");

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent?.telnyxAssistantId) throw new Error("assistant missing");

  await restoreAmyTelnyxWorkflowWithV2();

  const remote = await ai.getAssistant(agent.telnyxAssistantId);
  const data = (remote as { data?: Record<string, unknown> }).data || remote;
  mkdirSync("/tmp/voice-v2-pstn-backup", { recursive: true });
  writeFileSync(
    `/tmp/voice-v2-pstn-backup/assistant-${agent.telnyxAssistantId}.json`,
    JSON.stringify(data, null, 2),
  );

  const listed = await ai.listSharedTools();
  const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
  const v2Id = tools.find((t) => t.display_name === "transovo-voice-v2-find-availability")?.id;
  const legacyId = tools.find((t) => t.display_name === "transovo-voice-ai-booking-turn")?.id;
  if (!v2Id) throw new Error("v2 shared tool missing — run publish-voice-v2-telnyx-tool.ts");

  const toolIds = (Array.isArray(data.tool_ids) ? (data.tool_ids as string[]) : []).filter(
    (id) => id !== legacyId,
  );
  if (!toolIds.includes(v2Id)) toolIds.push(v2Id);

  const flow = data.conversation_flow as Record<string, unknown> | undefined;
  if (flow && Array.isArray(flow.nodes)) {
    for (const node of flow.nodes as Array<Record<string, unknown>>) {
      if (node.id === "n_live_booking") {
        node.shared_tool_ids = [v2Id];
        node.instructions = LIVE_BOOKING_V2_INSTRUCTIONS;
      }
    }
  }

  const priorInstructions = String(data.instructions || "");
  const instructions = priorInstructions.includes("VOICE BOOKING V2 PSTN TEST")
    ? priorInstructions
    : `${priorInstructions}\n\n${V2_PSTN_INSTRUCTION_APPEND}`.trim();

  await ai.updateAssistant(agent.telnyxAssistantId, {
    tool_ids: toolIds,
    tools: [],
    conversation_flow: flow,
    instructions,
  });

  console.log("Amy PSTN V2 test mode enabled.");
  console.log("v2 tool_id:", v2Id);
  console.log("legacy booking detached:", legacyId ? `removed ${legacyId}` : "n/a");
  console.log("Run: EXPECTED_APP_URL=$APP_URL npx tsx scripts/verify-voice-v2-pstn-readiness.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
