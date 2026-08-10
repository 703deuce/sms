/**
 * Offline tests for LiveKit call telemetry (booking flag, tool rows, transcripts).
 * Run: npx tsx scripts/test-livekit-call-telemetry.ts
 */
import assert from "node:assert/strict";
import {
  appendLiveKitTranscriptLine,
  finalizeLiveKitTranscript,
  markVoiceCallBooked,
  recordLiveKitBuiltinToolExecution,
} from "../src/lib/voice/runtime-provider/livekit-call-telemetry";
import { getPrisma } from "../src/lib/db";
import { getVoicePipelineConfig } from "../src/lib/voice/runtime-provider/config";

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    const value = vars[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function main() {
  const prisma = getPrisma();
  const workspaceId = `ws_livekit_telemetry_${Date.now()}`;
  let callId = "";
  let appointmentId = "";

  try {
  await prisma.workspace.create({
    data: { id: workspaceId, name: "Telemetry Test", slug: `telemetry-${Date.now()}` },
  });

  const call = await prisma.voiceCall.create({
    data: {
      workspaceId,
      direction: "INBOUND",
      status: "IN_PROGRESS",
      fromE164: "+15555550100",
      toE164: "+18663464256",
      appointmentBooked: false,
    },
  });
  callId = call.id;

  const appt = await prisma.voiceAppointment.create({
    data: {
      workspaceId,
      serviceName: "Test booking",
      startsAt: new Date("2026-08-10T15:00:00.000Z"),
      externalId: "calendly:https://api.calendly.com/scheduled_events/test-event",
      status: "active",
    },
  });
  appointmentId = appt.id;

  await markVoiceCallBooked({
    workspaceId,
    callId,
    appointmentId,
    externalId: "https://api.calendly.com/scheduled_events/test-event",
  });

  const bookedCall = await prisma.voiceCall.findUnique({ where: { id: callId } });
  assert.equal(bookedCall?.appointmentBooked, true);
  assert.equal(bookedCall?.outcome, "appointment_booked");

  const linkedAppt = await prisma.voiceAppointment.findUnique({ where: { id: appointmentId } });
  assert.equal(linkedAppt?.callId, callId);

  const toolOutput = await recordLiveKitBuiltinToolExecution({
    workspaceId,
    callId,
    toolType: "list_available_slots",
    args: { range: "default" },
    run: async () => ({ slots: 2 }),
  });
  assert.deepEqual(toolOutput, { slots: 2 });

  await new Promise((resolve) => setTimeout(resolve, 200));
  const tools = await prisma.voiceToolExecution.findMany({ where: { callId } });
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.status, "completed");
  assert.equal((tools[0]?.input as { toolType?: string })?.toolType, "list_available_slots");

  await appendLiveKitTranscriptLine({
    workspaceId,
    callId,
    speaker: "caller",
    text: "I'd like to book tomorrow.",
  });
  await appendLiveKitTranscriptLine({
    workspaceId,
    callId,
    speaker: "agent",
    text: "Sure, let me check the calendar.",
  });
  await finalizeLiveKitTranscript(callId);

  const transcript = await prisma.voiceTranscript.findFirst({ where: { callId } });
  assert.ok(transcript?.fullText?.includes("book tomorrow"));
  assert.equal(transcript?.provider, "livekit");
  assert.equal(transcript?.status, "completed");

  const segments = await prisma.voiceTranscriptSegment.findMany({
    where: { transcriptId: transcript!.id },
  });
  assert.equal(segments.length, 2);

  const meta = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const trace = (meta?.metadata as { executionTrace?: unknown[] })?.executionTrace;
  assert.ok(Array.isArray(trace) && trace.length >= 2);

  await withEnv(
    { VOICE_LLM_PRESET: "gpt-4.1-mini" },
    async () => {
      const cfg = getVoicePipelineConfig();
      assert.equal(cfg.llmProvider, "openai");
      assert.equal(cfg.llmModel, "gpt-4.1-mini");
    },
  );

  console.log("livekit call telemetry tests: PASS");
  } finally {
    if (callId) {
      const transcript = await prisma.voiceTranscript.findFirst({ where: { callId } });
      if (transcript) {
        await prisma.voiceTranscriptSegment.deleteMany({
          where: { transcriptId: transcript.id },
        });
      }
      await prisma.voiceTranscript.deleteMany({ where: { callId } });
      await prisma.voiceToolExecution.deleteMany({ where: { callId } });
      await prisma.voiceAppointment.deleteMany({ where: { workspaceId } });
      await prisma.voiceCall.deleteMany({ where: { id: callId } });
    }
    await prisma.workspace.deleteMany({ where: { id: workspaceId } }).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
