#!/usr/bin/env npx tsx
/**
 * Phase 2 booking-intent latency report (observability + PSTN post-hoc).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/voice-v2-booking-intent-latency-phase2-report.ts
 */
import * as ai from "../src/lib/voice/telnyx/ai-client";
import {
  analyzeBookingIntentTurnFromMessages,
} from "../src/lib/voice-v2/pstn-turn-observability";
import { clearVoiceV2CallSessions } from "../src/lib/voice-v2/intake/session-store";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-v2/intake/save-intake-fields";
import { SaveIntakeTrace } from "../src/lib/voice-v2/intake/save-intake-trace";

const PSTN_CONV = "07844724-0254-4e45-bd5b-00c5b5b21a78";
const WORKSPACE = process.env.WORKSPACE_ID || "ws_1";
const AGENT = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

async function pstnSection() {
  const msgs = await ai.listConversationMessages(PSTN_CONV, {});
  const data = (msgs as { data?: Array<Record<string, unknown>> }).data || [];
  const analysis = analyzeBookingIntentTurnFromMessages(data);

  console.log("\n=== A/D/E — PSTN booking-intent turn (Telnyx sent_at/ended_at) ===\n");
  console.log(JSON.stringify(analysis, null, 2));

  const sorted = [...data].sort((a, b) =>
    String(a.sent_at || a.created_at).localeCompare(String(b.sent_at || b.created_at)),
  );
  const bookUser = sorted.find((m) => m.role === "user" && String(m.text).includes("book"));
  const toolMsg = sorted.find(
    (m) =>
      m.role === "assistant" &&
      Array.isArray(m.tool_calls) &&
      (m.tool_calls as unknown[]).length > 0,
  );
  const toolRes = sorted.find((m) => m.role === "tool" && String(m.text).includes("INTAKE_SAVED"));
  const amy = sorted.find(
    (m) => m.role === "assistant" && String(m.text).includes("name"),
  );

  const toolBody = toolRes ? JSON.parse(String(toolRes.text)) : {};
  console.log("\nFirst save Transovo (from PSTN tool body):", {
    telnyx_to_transovo_ms: toolBody.telnyx_to_transovo_ms,
    timing_ms: toolBody.timing_ms,
  });

  console.log("\nWorkflow hop evidence:");
  console.log({
    user_flow: (bookUser?.metadata as Record<string, unknown>)?.flow_node_id,
    tool_flow: (toolMsg?.metadata as Record<string, unknown>)?.flow_node_id,
    assistant_messages_between_user_and_tool: 0,
    note:
      "Single assistant message with tool_calls (no spoken assistant turn between user book and save). Telnyx may still run internal workflow edge before that one inference — cannot count LLM hops without Telnyx request logs.",
  });

  console.log("\nPost-tool Amy metadata:", (amy?.metadata as Record<string, unknown>) || {});
}

async function localSaveBenchmark() {
  console.log("\n=== B/C — Local save-intake cold vs warm (same agent config) ===\n");
  clearVoiceV2CallSessions();
  const callId = "cc:phase2-bench";
  const runs: Array<Record<string, unknown>> = [];

  for (let i = 1; i <= 3; i++) {
    clearVoiceV2CallSessions();
    const trace = new SaveIntakeTrace();
    const t0 = Date.now();
    const result = await executeVoiceV2SaveIntakeFields(
      {
        call_id: callId,
        fields: i === 1 ? { service_reason: "book test" } : { name: `Run ${i}` },
      },
      WORKSPACE,
      AGENT,
      { trace },
    );
    runs.push({
      run: i,
      status: result.status,
      wall_ms: Date.now() - t0,
      timing_ms: "timing_ms" in result ? result.timing_ms : null,
      observability:
        result.status === "INTAKE_SAVED" ? result.observability : null,
    });
  }

  console.log(JSON.stringify(runs, null, 2));
}

function classificationSection() {
  console.log("\n=== C — Operation classification (no moves yet) ===\n");
  const rows = [
    ["loadVoiceAgentRuntimeConfig", "PRELOAD_AT_CALL_START / CACHE_FOR_CALL", "MUST_NOT_BLOCK"],
    ["parseVoiceAgentConfig", "CACHE_FOR_CALL", "MUST_NOT_BLOCK"],
    ["compileVoiceV2IntakeSchema", "PRELOAD_AT_CALL_START / CACHE_FOR_CALL", "MUST_NOT_BLOCK"],
    ["loadMctbAiBookingConfig (timezone)", "PRELOAD_AT_CALL_START / CACHE_FOR_CALL", "MUST_NOT_BLOCK"],
    ["ensureVoiceV2CallContext (first hit)", "Currently lazy on first tool — blocks", "SHOULD_PRELOAD"],
    ["validateIntakeFieldPayload", "MUST_BLOCK_CURRENT_RESPONSE", "MUST_BLOCK"],
    ["commit intake state (memory)", "MUST_BLOCK_CURRENT_RESPONSE", "MUST_BLOCK"],
    ["transitionAfterIntakeSave", "MUST_BLOCK_CURRENT_RESPONSE", "MUST_BLOCK (small)"],
    ["loadVoiceV2PstnLiveBookingFlag", "CACHE_FOR_CALL", "SHOULD_NOT_BLOCK_FIRST_SAVE"],
    ["scheduleIntakePersistence", "DEFER_AFTER_RESPONSE", "DEFER"],
    ["auditLog intake_save_trace", "DEFER_AFTER_RESPONSE", "DEFER"],
  ];
  for (const r of rows) console.log(r.join(" | "));
}

async function main() {
  await pstnSection();
  await localSaveBenchmark();
  classificationSection();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
