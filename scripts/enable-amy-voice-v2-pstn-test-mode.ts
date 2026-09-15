#!/usr/bin/env npx tsx
/**
 * Telnyx-only PSTN test mode: V2 find + book (detaches legacy booking tool).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import {
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
} from "../src/lib/voice-v2/telnyx-tool-definition";
import { restoreAmyTelnyxWorkflowWithV2 } from "./restore-amy-telnyx-tools-with-v2";
import { loadVoiceAgentRuntimeConfig } from "../src/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { INTAKE_FIELD_DEFAULTS } from "../src/lib/voice-v2/intake/defaults";
import { INTAKE_FIELD_KEYS, type IntakeFieldKey } from "../src/lib/voice-v2/intake/wizard-config";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

function enabledIntakeKeysFromConfig(config: ReturnType<typeof parseVoiceAgentConfig>): IntakeFieldKey[] {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const wizard = advanced.voiceV2Intake as { fields?: Record<string, { enabled?: boolean }> } | undefined;
  const enabled: IntakeFieldKey[] = [];
  for (const key of INTAKE_FIELD_KEYS) {
    const def = INTAKE_FIELD_DEFAULTS[key];
    const row = wizard?.fields?.[key];
    if (row?.enabled ?? def.enabled) enabled.push(key);
  }
  return enabled;
}

function buildIntakePolicyBlock(enabledKeys: IntakeFieldKey[]): string {
  const enabled = new Set(enabledKeys);
  const enabledList = enabledKeys.join(", ") || "(none)";
  const disabledList = INTAKE_FIELD_KEYS.filter((k) => !enabled.has(k)).join(", ") || "(none)";
  return [
    `ENABLED intake fields only: ${enabledList}.`,
    `Do NOT ask for or call save for disabled fields: ${disabledList}.`,
    "If save returns FIELD_NOT_ENABLED, acknowledge briefly and continue — do not say you cannot save; do not take a message instead of booking.",
    "When save readiness shows missingBeforeBooking empty, proceed immediately to voice_v2_find_availability (do not collect optional/disabled fields first).",
  ].join(" ");
}

const V2_PSTN_INSTRUCTION_APPEND_BASE = [
  "VOICE BOOKING V2 PSTN TEST (intake + find + book):",
  "Keep the full live conversation in mind. Never ask for information the caller already provided.",
  `When the caller supplies configured intake fields, call ${VOICE_V2_SAVE_INTAKE_TOOL_TYPE} immediately — batch multiple fields in one call when given together.`,
  "Before asking for an intake field, check prior conversation and saved intake state; recover via save instead of re-asking.",
  "When the caller wants to schedule, call voice_v2_find_availability with structured requested_date and time_window.",
  "Speak slot labels from the tool response. Remember offer_set_id and each slot_id.",
  "When the caller picks a time, map their choice to the canonical selected_slot_id from that offer only.",
  `Then call ${VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE} with offer_set_id and selected_slot_id only.`,
  "Do NOT send the caller's raw words to the book tool. Do NOT call voice_ai_booking_turn.",
  "Only say the appointment is booked after BOOKING_CONFIRMED; speak spoken_confirmation from the tool.",
];

const LIVE_BOOKING_V2_INSTRUCTIONS = [
  "The caller wants to book on the live calendar.",
  `First call ${VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE} with requested_date and time_window only.`,
  "You interpret natural language into structured date and window.",
  "Speak the exact slot labels returned. Keep offer_set_id and slot_ids from the response.",
  "When the caller chooses, call voice_v2_book_offered_slot with offer_set_id and selected_slot_id.",
  "Do not invent times or slot IDs. Do not call voice_ai_booking_turn.",
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
  const v2FindId = tools.find((t) => t.display_name === "transovo-voice-v2-find-availability")?.id;
  const v2BookId = tools.find((t) => t.display_name === "transovo-voice-v2-book-offered-slot")?.id;
  const v2SaveId = tools.find((t) => t.display_name === "transovo-voice-v2-save-intake-fields")?.id;
  const legacyId = tools.find((t) => t.display_name === "transovo-voice-ai-booking-turn")?.id;
  if (!v2FindId) throw new Error("v2 find shared tool missing — run publish-voice-v2-telnyx-tool.ts");
  if (!v2BookId) throw new Error("v2 book shared tool missing — run publish-voice-v2-telnyx-tool.ts");
  if (!v2SaveId) throw new Error("v2 save-intake shared tool missing — run publish-voice-v2-telnyx-tool.ts");

  const toolIds = (Array.isArray(data.tool_ids) ? (data.tool_ids as string[]) : []).filter(
    (id) => id !== legacyId,
  );
  if (!toolIds.includes(v2FindId)) toolIds.push(v2FindId);
  if (!toolIds.includes(v2BookId)) toolIds.push(v2BookId);
  if (!toolIds.includes(v2SaveId)) toolIds.push(v2SaveId);

  const flow = data.conversation_flow as Record<string, unknown> | undefined;
  const runtime = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
  const config = parseVoiceAgentConfig(runtime || agent.draftConfig);
  const intakePolicy = buildIntakePolicyBlock(enabledIntakeKeysFromConfig(config));

  if (flow && Array.isArray(flow.nodes)) {
    for (const node of flow.nodes as Array<Record<string, unknown>>) {
      if (node.id === "n_live_booking") {
        node.shared_tool_ids = [v2SaveId, v2FindId, v2BookId];
        node.instructions = `${LIVE_BOOKING_V2_INSTRUCTIONS} ${intakePolicy}`;
      }
    }
  }
  const V2_PSTN_INSTRUCTION_APPEND = [...V2_PSTN_INSTRUCTION_APPEND_BASE, intakePolicy].join(" ");

  const priorInstructions = String(data.instructions || "");
  const withoutOldV2Block = priorInstructions
    .replace(/\n*VOICE BOOKING V2 PSTN TEST[\s\S]*$/m, "")
    .trim();
  const instructions = `${withoutOldV2Block}\n\n${V2_PSTN_INSTRUCTION_APPEND}`.trim();

  await ai.updateAssistant(agent.telnyxAssistantId, {
    tool_ids: toolIds,
    tools: [],
    conversation_flow: flow,
    instructions,
  });

  console.log("Amy PSTN V2 test mode enabled (intake + find + book).");
  console.log("v2 save-intake tool_id:", v2SaveId);
  console.log("v2 find tool_id:", v2FindId);
  console.log("v2 book tool_id:", v2BookId);
  console.log("legacy booking detached:", legacyId ? `removed ${legacyId}` : "n/a");
  console.log("Run: EXPECTED_APP_URL=$APP_URL npx tsx scripts/verify-voice-v2-pstn-readiness.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
