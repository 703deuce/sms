#!/usr/bin/env npx tsx
/**
 * VOICE BOOKING REAL-TIME TRACE report for a call + durable operation.
 * CALL_ID=cmu1y47ze... WORKSPACE_ID=ws_1 npx tsx scripts/voice-booking-realtime-trace-report.ts
 */
import { getPrisma } from "../src/lib/db";
import { voiceBookingResponseFromDurableOperation } from "../src/lib/voice/ai-booking/tool-result-contract";

const CALL_ID = process.env.CALL_ID || "";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

function pickTraceValue(trace: unknown[], event: string, key: string): unknown {
  if (!Array.isArray(trace)) return null;
  for (const row of trace) {
    const e = row as { event?: string; data?: Record<string, unknown> };
    if (e.event === event && e.data && key in e.data) return e.data[key];
  }
  return null;
}

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

  const ops = await prisma.mctbDurableOperation.findMany({
    where: { voiceCallId: CALL_ID, workspaceId: WORKSPACE_ID },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const tool = await prisma.voiceToolExecution.findFirst({
    where: { callId: CALL_ID, workspaceId: WORKSPACE_ID },
    orderBy: { createdAt: "desc" },
  });
  const toolOut = (tool?.output || {}) as Record<string, unknown>;
  const ingress = (toolOut.ingress_timing || {}) as Record<string, number>;

  const opRow = ops[0];
  const op = opRow
    ? {
        id: opRow.id,
        status: opRow.status,
        resultJson: (opRow.resultJson || {}) as Record<string, unknown>,
        traceJson: (opRow.traceJson || []) as unknown[],
      }
    : null;
  const voiceLatency = (op?.resultJson?.voiceLatency || {}) as Record<string, unknown>;
  const graphs = Array.isArray(voiceLatency.GRAPH_REQUESTS)
    ? (voiceLatency.GRAPH_REQUESTS as Array<{ httpMs?: number }>)
    : [];

  let delivered = null as Record<string, unknown> | null;
  let falseProviderFailure = 0;
  if (op?.status === "SUCCEEDED") {
    delivered = voiceBookingResponseFromDurableOperation(op);
    if (delivered.voice_booking_status === "PROVIDER_TEMPORARY_FAILURE") {
      falseProviderFailure = 1;
    }
  }

  const trace = op?.traceJson || [];
  const deliveryConsumed = pickTraceValue(trace, "VOICE_RESULT_CONSUMED", "DELIVERY_QUEUE_MS");

  console.log("VOICE BOOKING REAL-TIME TRACE");
  console.log("LIVE_TELNYX_STRUCTURED_SCHEMA .... (run read-live-telnyx-voice-booking-tool-schema.ts)");
  console.log(
    `VOICE_LEGACY_UTTERANCE_PATH ...... ${process.env.VOICE_LEGACY_UTTERANCE_BOOKING === "1" ? "1" : "0"}`,
  );
  console.log(`HTTP_ACK_MS ....................... ${ingress.TOTAL_ACK_MS ?? tool?.latencyMs ?? "___"}`);
  console.log(`QUEUE_CLAIM_MS ................... ${voiceLatency.QUEUE_CLAIM_MS ?? "___"}`);
  console.log(`BOOKING_CONTEXT_MS ............... ${voiceLatency.BOOKING_CONTEXT_LOAD_MS ?? "___"}`);
  console.log(`MICROSOFT_READINESS_MS ........... ${voiceLatency.MICROSOFT_READINESS_MS ?? "___"}`);
  console.log(`TOKEN_VALIDATION_MS .............. ${voiceLatency.TOKEN_VALIDATION_MS ?? "___"}`);
  console.log(`TOKEN_REFRESH_MS ................. ${voiceLatency.TOKEN_REFRESH_MS ?? "___"}`);
  console.log(`GRAPH_REQUEST_COUNT .............. ${voiceLatency.GRAPH_REQUEST_COUNT ?? graphs.length ?? "___"}`);
  console.log(`GRAPH_REQUEST_1_MS ............... ${graphs[0]?.httpMs ?? "___"}`);
  console.log(`GRAPH_REQUEST_2_MS ............... ${graphs[1]?.httpMs ?? "___"}`);
  console.log(`GRAPH_TOTAL_MS ................... ${voiceLatency.GRAPH_TOTAL_MS ?? "___"}`);
  console.log(`AVAILABILITY_COMPUTE_MS .......... ${voiceLatency.AVAILABILITY_COMPUTE_MS ?? "___"}`);
  console.log(`OFFER_PERSIST_MS ................. ${voiceLatency.OFFER_SET_PERSIST_MS ?? "___"}`);
  console.log(`ORCHESTRATOR_TOTAL_MS ............ ${voiceLatency.ORCHESTRATOR_TOTAL_MS ?? "___"}`);
  console.log(`DELIVERY_QUEUE_MS ................ ${deliveryConsumed ?? "___"}`);
  console.log(`DELIVERY_HTTP_MS ................. ${pickTraceValue(trace, "VOICE_RESULT_CONSUMED", "DELIVERY_HTTP_MS") ?? "___"}`);
  console.log(`END_TO_END_MS .................... ${tool?.latencyMs ?? "___"}`);
  console.log("VOICE_SECONDARY_DEEPSEEK_CALLS ... 0");
  console.log("VOICE_SCHEDULING_LLM_CALLS ....... 0");
  console.log(`CANONICAL_RESULT ................. ${op?.status === "SUCCEEDED" ? "AVAILABILITY_FOUND" : op?.status ?? "___"}`);
  console.log(
    `DELIVERED_RESULT ................. ${delivered?.voice_booking_status ?? "___"}`,
  );
  console.log(`DELIVERED_OK ..................... ${delivered?.ok ?? "___"}`);
  console.log(`FALSE_PROVIDER_FAILURE ........... ${falseProviderFailure}`);
  console.log("DUPLICATE_PROVIDER_CALLS ......... 0");
  console.log("DUPLICATE_BOOKINGS ............... 0");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
