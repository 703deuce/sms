#!/usr/bin/env npx tsx
/**
 * End-to-end trace for a voice AI booking call (tool webhook + Telnyx conversation).
 * CALL_ID=... WORKSPACE_ID=ws_1 npx tsx scripts/trace-voice-booking-call.ts
 */
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const CALL_ID = process.env.CALL_ID || "cmu1uncov202i3u39032p021f";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: CALL_ID, workspaceId: WORKSPACE_ID },
  });
  if (!call) {
    console.log("Call not found", CALL_ID);
    return;
  }

  console.log("=== CALL ===");
  console.log({
    id: call.id,
    startedAt: call.startedAt?.toISOString(),
    endedAt: call.endedAt?.toISOString(),
    from: call.fromE164,
    to: call.toE164,
    agentId: call.agentId,
    telnyxConversationId: call.telnyxConversationId,
    telnyxCallControlId: call.telnyxCallControlId,
  });

  const tools = await prisma.voiceToolExecution.findMany({
    where: { callId: CALL_ID },
    orderBy: { createdAt: "asc" },
  });

  console.log("\n=== TOOL EXECUTIONS ===", tools.length);
  for (const t of tools) {
    const inp = (t.input || {}) as Record<string, unknown>;
    const out = (t.output || {}) as Record<string, unknown>;
    console.log("\n---", t.id, "---");
    console.log({
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt?.toISOString(),
      status: t.status,
      latencyMs: t.latencyMs,
      errorMessage: t.errorMessage,
      toolType: inp.toolType,
      fastPath: inp.fastPath,
    });
    console.log("INPUT utterance:", inp.utterance ?? inp.user_input);
    console.log("OUTPUT speak:", out.speak);
    console.log("OUTPUT status field:", out.status);
    console.log("OUTPUT ok:", out.ok);
    console.log("OUTPUT error:", out.error);
    console.log("OUTPUT data:", JSON.stringify(out.data, null, 2)?.slice(0, 2000));
    console.log("FULL OUTPUT keys:", Object.keys(out).join(", "));
  }

  const since = call.startedAt || new Date(Date.now() - 3600_000);
  const ingress = await prisma.auditLog.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      event: "voice.tool_webhook.ingress",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const matchedIngress = ingress.filter((row) => {
    try {
      const d = JSON.parse(row.detail || "{}") as Record<string, unknown>;
      return d.callId === CALL_ID || String(d.toolType || "").includes("booking");
    } catch {
      return false;
    }
  });
  console.log("\n=== TOOL WEBHOOK INGRESS (matched)", matchedIngress.length, "===");
  for (const a of matchedIngress) {
    console.log(a.createdAt.toISOString(), (a.detail || "").slice(0, 500));
  }

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const ops = meta.voiceAiBookingOperations;
  if (ops) {
    console.log("\n=== voiceAiBookingOperations on call metadata ===");
    console.log(JSON.stringify(ops, null, 2).slice(0, 3000));
  }

  const convId = call.telnyxConversationId;
  if (!convId) {
    console.log("\nNo telnyxConversationId — skip Telnyx message trace");
    return;
  }

  console.log("\n=== TELNYX CONVERSATION", convId, "===");
  try {
    const msgs = await ai.listConversationMessages(convId, {});
    const mdata = (msgs as { data?: unknown[] }).data || [];
    const messages = (Array.isArray(mdata) ? mdata : []).sort((a, b) => {
      const ta = new Date(String((a as Record<string, unknown>).created_at)).getTime();
      const tb = new Date(String((b as Record<string, unknown>).created_at)).getTime();
      return ta - tb;
    });
    for (const m of messages) {
      const msg = m as Record<string, unknown>;
      const content = String(msg.content || msg.text || "").replace(/\n/g, " ").trim();
      console.log(`\n${msg.created_at} [${msg.role}] type=${msg.type || ""}`);
      if (content) console.log(" ", content.slice(0, 600));
      if (msg.tool_calls) {
        console.log("  tool_calls:", JSON.stringify(msg.tool_calls).slice(0, 1200));
      }
      if (msg.role === "tool" || msg.type === "tool_result") {
        console.log("  tool_result:", content.slice(0, 1200) || JSON.stringify(msg).slice(0, 1200));
      }
    }
  } catch (err) {
    console.error("Telnyx API error:", err instanceof Error ? err.message : err);
  }

  console.log("\n=== REQUIRED TRACE SUMMARY ===");
  const first = tools[0];
  let telnyxToolTimeout = false;
  if (convId) {
    try {
      const msgs = await ai.listConversationMessages(convId, {});
      const mdata = (msgs as { data?: unknown[] }).data || [];
      telnyxToolTimeout = (Array.isArray(mdata) ? mdata : []).some((m) => {
        const msg = m as Record<string, unknown>;
        return msg.role === "tool" && String(msg.content || "").includes("timed out");
      });
    } catch {
      // ignore
    }
  }

  if (first) {
    const latency = first.latencyMs ?? 0;
    const out = (first.output || {}) as Record<string, unknown>;
    const hasSlots = Boolean(
      (out.data as Record<string, unknown> | undefined)?.slots ||
        JSON.stringify(out).includes("slot_id"),
    );
    console.log({
      CALLER_UTTERANCE: "see Telnyx user messages above",
      TOOL_SELECTED: "voice_ai_booking_turn",
      TOOL_EXECUTION_LATENCY_MS: latency,
      TOOL_EXECUTION_STATUS: first.status,
      NORMALIZED_SLOT_RESULT: hasSlots ? "slots in output.data" : "none",
      MICROSOFT_INTERNAL_SUCCESS: hasSlots && first.status === "completed",
      TELNYX_TOOL_RESULT: telnyxToolTimeout ? "The request timed out." : "unknown",
    });

    console.log("\n=== CLASSIFICATION ===");
    if (telnyxToolTimeout && hasSlots && first.status === "completed") {
      console.log("VOICE_TOOL_DELIVERY_TIMEOUT");
      console.log(
        "Telnyx gave up before HTTP response arrived. Backend later completed with slots — NOT a Microsoft failure.",
      );
    } else if (!telnyxToolTimeout && hasSlots) {
      console.log("Check TELNYX_TOOL_RESULT_ACCEPTED + VOICE_TOOL_RESULT_CONSUMPTION_FAILURE");
    }
    if (!telnyxToolTimeout && !hasSlots) {
      console.log("Provider or mapping failure — inspect output.error");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
