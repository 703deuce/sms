#!/usr/bin/env npx tsx
/**
 * Read back LIVE Telnyx assistant tool schema for voice_ai_booking_turn (do not infer from repo).
 *
 * AGENT_ID=... WORKSPACE_ID=ws_1 npx tsx scripts/read-live-telnyx-voice-booking-tool-schema.ts
 */
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

const STRUCTURED_FIELDS = [
  "action",
  "requested_date",
  "specific_local_time",
  "time_window_start",
  "time_window_end",
  "daypart",
  "time_relation",
  "offer_set_id",
  "selected_slot_id",
  "confirm_booking",
  "tool_invocation_id",
];

function findBookingTool(tools: unknown): Record<string, unknown> | null {
  if (!Array.isArray(tools)) return null;
  for (const t of tools) {
    const tool = t as Record<string, unknown>;
    const name = String(tool.name || tool.type || tool.function?.name || "");
    if (
      name === "voice_ai_booking_turn" ||
      name === "transovo-voice-ai-booking-turn" ||
      name.includes("booking-turn")
    ) {
      return tool;
    }
  }
  return null;
}

function schemaProperties(tool: Record<string, unknown>): Record<string, unknown> {
  const fn = tool.function as Record<string, unknown> | undefined;
  const webhook = tool.webhook as Record<string, unknown> | undefined;
  const params = (fn?.parameters ||
    webhook?.body_parameters ||
    tool.parameters ||
    {}) as Record<string, unknown>;
  const props = (params.properties || {}) as Record<string, unknown>;
  return props;
}

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, name: true, telnyxAssistantId: true },
  });
  if (!agent?.telnyxAssistantId) {
    console.log("LIVE_TELNYX_STRUCTURED_SCHEMA .... FAIL (no telnyxAssistantId)");
    process.exit(1);
  }

  const remote = await ai.getAssistant(agent.telnyxAssistantId);
  const data = (remote as { data?: Record<string, unknown> }).data || remote;
  const assistant = data as Record<string, unknown>;
  const tools =
    assistant.tools ||
    (assistant.tool_resources as Record<string, unknown> | undefined)?.tools ||
    [];

  const bookingTool = findBookingTool(tools);
  if (!bookingTool) {
    console.log("LIVE_TELNYX_STRUCTURED_SCHEMA .... FAIL (voice_ai_booking_turn missing)");
    console.log("tool names:", JSON.stringify((tools as unknown[]).map((t) => (t as Record<string, unknown>).name)));
    process.exit(1);
  }

  const props = schemaProperties(bookingTool);
  if (!Object.keys(props).length) {
    console.log("\n=== raw booking tool (schema discovery) ===");
    console.log(JSON.stringify(bookingTool, null, 2).slice(0, 6000));
  }
  const present = STRUCTURED_FIELDS.filter((f) => f in props);
  const hasAction = "action" in props;
  const utteranceOnly = "utterance" in props && !hasAction;

  console.log("=== LIVE TELNYX ASSISTANT ===");
  console.log({
    agentId: agent.id,
    agentName: agent.name,
    telnyxAssistantId: agent.telnyxAssistantId,
  });
  console.log("\n=== voice_ai_booking_turn schema properties ===");
  console.log(JSON.stringify(props, null, 2));

  const pass = hasAction && present.length >= 5 && !utteranceOnly;
  console.log("\n=== VOICE BOOKING REAL-TIME TRACE (Telnyx schema) ===");
  console.log(`LIVE_TELNYX_STRUCTURED_SCHEMA .... ${pass ? "PASS" : "FAIL"}`);
  console.log(`VOICE_LEGACY_UTTERANCE_PATH ...... ${utteranceOnly ? "1" : "0"}`);
  console.log(`structured_fields_present ........ ${present.join(", ") || "(none)"}`);

  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
