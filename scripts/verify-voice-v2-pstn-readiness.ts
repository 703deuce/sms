#!/usr/bin/env npx tsx
/**
 * Pre-PSTN gate checklist for Voice Booking V2.
 * EXPECTED_APP_URL=https://your-prod npx tsx scripts/verify-voice-v2-pstn-readiness.ts
 */
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import { getAppBaseUrl } from "../src/lib/messaging/telnyx/config";
import {
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_TELNYX_TOOL_NAME,
} from "../src/lib/voice-v2/telnyx-tool-definition";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";
const EXPECTED_APP_URL = (process.env.EXPECTED_APP_URL || process.env.APP_URL || "")
  .replace(/\/$/, "");

type Check = { name: string; pass: boolean; detail: string };

async function resolveV2SharedTool(): Promise<{
  id: string;
  webhookUrl: string;
  props: Record<string, unknown>;
} | null> {
  const listed = await ai.listSharedTools().catch(() => ({ data: [] }));
  const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
  const row = tools.find((t) => t.display_name === VOICE_V2_TELNYX_TOOL_NAME);
  if (!row?.id) return null;
  const shared = await ai.getSharedTool(row.id);
  const data = (shared as { data?: Record<string, unknown> }).data || shared;
  const webhook = (data as Record<string, unknown>).webhook as Record<string, unknown>;
  const params = (webhook?.body_parameters || {}) as Record<string, unknown>;
  return {
    id: row.id,
    webhookUrl: String(webhook?.url || ""),
    props: (params.properties || {}) as Record<string, unknown>,
  };
}

async function main() {
  const checks: Check[] = [];
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { telnyxAssistantId: true, name: true },
  });

  const v2 = await resolveV2SharedTool();
  checks.push({
    name: "1_voice_v2_find_availability_exists",
    pass: Boolean(v2?.id),
    detail: v2?.id || "missing shared tool",
  });

  const hasDate = Boolean(v2?.props.requested_date);
  const hasWindow = Boolean(v2?.props.time_window);
  const hasUtterance = Boolean(v2?.props.utterance);
  checks.push({
    name: "2_structured_schema",
    pass: hasDate && hasWindow,
    detail: `requested_date=${hasDate} time_window=${hasWindow}`,
  });
  checks.push({
    name: "3_no_utterance_semantic_field",
    pass: !hasUtterance,
    detail: hasUtterance ? "utterance still in schema" : "no utterance field",
  });

  let instructionsText = "";
  let toolIds: string[] = [];
  let legacyBookingToolId: string | null = null;
  if (agent?.telnyxAssistantId) {
    const remote = await ai.getAssistant(agent.telnyxAssistantId);
    const data = (remote as { data?: Record<string, unknown> }).data || remote;
    instructionsText = String(data.instructions || data.system_prompt || "");
    toolIds = Array.isArray(data.tool_ids) ? (data.tool_ids as string[]) : [];
    const listed = await ai.listSharedTools().catch(() => ({ data: [] }));
    const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
    legacyBookingToolId =
      tools.find((t) => t.display_name === "transovo-voice-ai-booking-turn")?.id || null;
  }

  const mentionsV2 =
    instructionsText.includes("voice_v2_find_availability") ||
    instructionsText.includes(VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE);
  const flow = agent?.telnyxAssistantId
    ? ((await ai.getAssistant(agent.telnyxAssistantId)) as { data?: Record<string, unknown> }).data
        ?.conversation_flow
    : null;
  const flowStr = JSON.stringify(flow || "");
  const flowMentionsV2 = flowStr.includes("voice_v2_find_availability");

  checks.push({
    name: "4_amy_instructions_use_v2",
    pass: mentionsV2 || flowMentionsV2,
    detail: mentionsV2
      ? "instructions mention v2"
      : flowMentionsV2
        ? "workflow mentions v2"
        : "run enable-amy-voice-v2-pstn-test-mode.ts",
  });

  const legacyAttached =
    legacyBookingToolId != null && toolIds.includes(legacyBookingToolId);
  checks.push({
    name: "5_legacy_voice_ai_booking_turn_detached",
    pass: !legacyAttached,
    detail: legacyAttached
      ? `legacy tool_id still attached: ${legacyBookingToolId}`
      : "legacy booking tool not in tool_ids",
  });

  const expectedWebhook = `${EXPECTED_APP_URL}/api/telnyx/voice-v2/find-availability`;
  const configuredUrl = v2?.webhookUrl || "";
  const urlOk =
    Boolean(EXPECTED_APP_URL) &&
    configuredUrl.replace(/\/$/, "") === expectedWebhook.replace(/\/$/, "");
  checks.push({
    name: "6_v2_webhook_points_to_expected_app",
    pass: urlOk,
    detail: `configured=${configuredUrl} expected=${expectedWebhook || "(set EXPECTED_APP_URL)"}`,
  });

  let deployOk = false;
  if (EXPECTED_APP_URL) {
    try {
      const res = await fetch(`${EXPECTED_APP_URL}/api/telnyx/voice-v2/find-availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-transovo-workspace-id": WORKSPACE_ID,
          "x-transovo-tool-type": VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
        },
        body: JSON.stringify({
          requested_date: "2099-01-01",
          time_window: { start: "12:00", end: "13:00" },
        }),
      });
      deployOk = res.status !== 404;
      checks.push({
        name: "7_production_v2_route_deployed",
        pass: deployOk,
        detail: `HTTP ${res.status} (404 means redeploy web with commit >= 5938499d)`,
      });
    } catch (err) {
      checks.push({
        name: "7_production_v2_route_deployed",
        pass: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    checks.push({
      name: "7_production_v2_route_deployed",
      pass: false,
      detail: "set EXPECTED_APP_URL or APP_URL",
    });
  }

  console.log("VOICE V2 PSTN READINESS CHECKLIST\n");
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
    console.log(`       ${c.detail}\n`);
  }

  const allPass = checks.every((c) => c.pass);
  console.log(allPass ? "READY_FOR_V2_PSTN_TEST" : "NOT_READY — fix FAIL items before calling");
  if (!allPass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
