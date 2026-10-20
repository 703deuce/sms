#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";

const CALL_ID = process.env.CALL_ID || "";

async function main() {
  const prisma = getPrisma();
  let callId = CALL_ID;
  if (!callId) {
    const latest = await prisma.voiceCall.findFirst({
      where: { agentId: process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501" },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    callId = latest?.id || "";
  }
  if (!callId) {
    console.log("No call found");
    return;
  }

  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: {
      id: true,
      status: true,
      fromE164: true,
      toE164: true,
      startedAt: true,
      endedAt: true,
      appointmentBooked: true,
      metadata: true,
      transcript: true,
      livekitRoomName: true,
      runtimeProvider: true,
    },
  });
  if (!call) {
    return;
  }

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const runtime = meta.agentRuntime as Record<string, unknown> | undefined;
  const trace = meta.executionTrace;

  console.log(
    JSON.stringify(
      {
        id: call.id,
        status: call.status,
        from: call.fromE164,
        to: call.toE164,
        runtimeProvider: call.runtimeProvider,
        livekitRoomName: call.livekitRoomName,
        appointmentBooked: call.appointmentBooked,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        runtimeState: runtime?.state,
        runtimeIntent: runtime?.intent,
        proposedSlots: runtime?.proposed_slots,
        heldSlot: runtime?.held_slot,
        selectedSlot: runtime?.selected_slot,
        bookingId: runtime?.booking_id,
        lastAvailabilitySlots: meta.lastAvailabilitySlots,
        executionTraceEvents: Array.isArray(trace) ? trace.length : 0,
        executionTrace: trace,
        transcriptLength: call.transcript ? String(call.transcript).length : 0,
        transcriptPreview: call.transcript
          ? String(call.transcript).slice(0, 2000)
          : null,
        collectedFieldKeys: runtime?.field_receipts
          ? Object.keys(runtime.field_receipts as object)
          : [],
      },
      null,
      2,
    ),
  );

  const appt = await prisma.voiceAppointment.findFirst({
    where: { callId },
    select: { id: true, status: true, startsAt: true, externalId: true },
  });
  console.log("\nappointment:", appt);

  if (runtime) {
    console.log(
      "\nruntime detail:",
      JSON.stringify(
        {
          field_receipts: runtime.field_receipts,
          pending_operations: runtime.pending_operations,
          last_tool_result: runtime.last_tool_result,
          proposed_slots: runtime.proposed_slots,
          held_slot: runtime.held_slot,
          selected_slot: runtime.selected_slot,
        },
        null,
        2,
      ),
    );
  }
}

main().catch(console.error);
