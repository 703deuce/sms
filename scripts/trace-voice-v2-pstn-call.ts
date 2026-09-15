#!/usr/bin/env npx tsx
/**
 * Post-PSTN trace for Voice Booking V2 single-call proof.
 * CALL_ID=... WORKSPACE_ID=ws_1 npx tsx scripts/trace-voice-v2-pstn-call.ts
 */
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const CALL_ID = process.env.CALL_ID || "";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  if (!CALL_ID) {
    console.error("CALL_ID required");
    process.exit(1);
  }
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: CALL_ID, workspaceId: WORKSPACE_ID },
  });
  if (!call) {
    console.error("call not found");
    process.exit(1);
  }

  const audits = await prisma.auditLog.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      event: "voice_v2.pstn_tool_trace",
      createdAt: { gte: call.startedAt || new Date(Date.now() - 3600_000) },
    },
    orderBy: { createdAt: "asc" },
  });
  const v2Audits = audits.filter((a) => a.detail?.includes(CALL_ID));

  const tools = await prisma.voiceToolExecution.findMany({
    where: { callId: CALL_ID },
    orderBy: { createdAt: "asc" },
  });

  let legacyBookingCalls = 0;
  let v2Calls = 0;
  for (const t of tools) {
    const inp = (t.input || {}) as Record<string, unknown>;
    const tt = String(inp.toolType || "");
    if (tt === "voice_ai_booking_turn") legacyBookingCalls += 1;
    if (tt === "voice_v2_find_availability") v2Calls += 1;
  }

  console.log("=== VOICE V2 PSTN CALL TRACE ===");
  console.log({ callId: CALL_ID, conversationId: call.telnyxConversationId });

  console.log("\n=== voice_v2.pstn_tool_trace audits ===");
  for (const a of v2Audits) {
    console.log(a.createdAt.toISOString(), a.detail?.slice(0, 4000));
  }

  console.log("\n=== tool executions ===");
  for (const t of tools) {
    const inp = (t.input || {}) as Record<string, unknown>;
    const out = (t.output || {}) as Record<string, unknown>;
    console.log({
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      latencyMs: t.latencyMs,
      status: t.status,
      toolType: inp.toolType,
      structured: {
        requested_date: inp.requested_date,
        time_window: inp.time_window,
      },
      voice_v2_pstn_trace: out.voice_v2_pstn_trace,
      speak: out.speak,
    });
  }

  const convId = call.telnyxConversationId;
  let amySpokeAt: string | null = null;
  let callerUtterance: string | null = null;
  if (convId) {
    const msgs = await ai.listConversationMessages(convId, {});
    const mdata = (msgs as { data?: unknown[] }).data || [];
    const messages = (Array.isArray(mdata) ? mdata : []).sort((a, b) => {
      const ta = new Date(String((a as Record<string, unknown>).created_at)).getTime();
      const tb = new Date(String((b as Record<string, unknown>).created_at)).getTime();
      return ta - tb;
    });
    for (const m of messages) {
      const msg = m as Record<string, unknown>;
      const role = String(msg.role || "");
      const content = String(msg.content || "").trim();
      if (role === "user" && content.toLowerCase().includes("appointment")) {
        callerUtterance = content;
      }
      if (role === "assistant" && /(\d{1,2}:\d{2}|PM|available)/i.test(content)) {
        amySpokeAt = String(msg.created_at || "");
      }
      if (role === "tool" && content.includes("voice_v2")) {
        console.log("\nTelnyx tool message:", content.slice(0, 2000));
      }
    }
  }

  console.log("\n=== PASS/FAIL RUBRIC ===");
  console.log("voice_v2_find_availability_calls:", v2Calls);
  console.log("legacy_voice_ai_booking_turn_calls:", legacyBookingCalls);
  console.log("caller_utterance:", callerUtterance);
  console.log("AMY_RESULT_SPOKEN_AT (heuristic):", amySpokeAt);

  const pass =
    v2Calls >= 1 &&
    legacyBookingCalls === 0 &&
    v2Audits.length >= 1;
  console.log("\nOVERALL:", pass ? "PASS (pending human review of slots/spoken)" : "FAIL");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
