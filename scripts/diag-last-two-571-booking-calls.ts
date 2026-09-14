#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";

const CALL_IDS = (process.env.CALL_IDS || "cmu1ur41h2o6r252h3z420y5p,cmu1uncov202i3u39032p021f").split(",");

async function main() {
  const prisma = getPrisma();
  for (const callId of CALL_IDS) {
    const call = await prisma.voiceCall.findUnique({
      where: { id: callId.trim() },
      select: {
        id: true,
        workspaceId: true,
        toE164: true,
        fromE164: true,
        agentId: true,
        startedAt: true,
        metadata: true,
      },
    });
    console.log("\n=== CALL", callId, "===");
    console.log(call);

    const tools = await prisma.voiceToolExecution.findMany({
      where: { callId: callId.trim() },
      orderBy: { createdAt: "asc" },
    });
    for (const t of tools) {
      const inp = (t.input || {}) as Record<string, unknown>;
      const out = (t.output || {}) as Record<string, unknown>;
      console.log({
        at: t.createdAt.toISOString(),
        status: t.status,
        latencyMs: t.latencyMs,
        errorMessage: t.errorMessage,
        utterance: inp.utterance ?? inp.user_input,
        speak: out.speak,
        outStatus: out.status,
        outError: out.error,
        operationId: out.operation_id || out.operationId,
      });
      if (out.data) console.log("  data:", JSON.stringify(out.data).slice(0, 600));
    }
  }

  const phone = await prisma.voiceAgentPhoneNumber.findFirst({
    where: { e164: "+15714073615" },
    include: {
      agent: {
        select: { id: true, name: true, workspaceId: true, publishedVersionId: true },
      },
    },
  });
  console.log("\n=== PHONE +15714073615 ===");
  console.log(phone);

  const cal = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId: "ws_1" },
    select: {
      id: true,
      provider: true,
      status: true,
      email: true,
      updatedAt: true,
      metadata: true,
    },
  });
  console.log("\n=== ws_1 VoiceCalendarConnection ===");
  for (const c of cal) {
    const meta = (c.metadata || {}) as Record<string, unknown>;
    console.log({
      id: c.id,
      provider: c.provider,
      status: c.status,
      email: c.email,
      updatedAt: c.updatedAt,
      lastRefreshSource: meta.lastTokenRefreshSource,
      lastRefreshDiag: meta.lastTokenRefreshDiagnostics ?? meta.oauthDiagnostics,
    });
  }

  try {
    const ops = await prisma.mctbDurableOperation.findMany({
      where: { voiceCallId: { in: CALL_IDS.map((s) => s.trim()) } },
      orderBy: { createdAt: "asc" },
    });
    console.log("\n=== MctbDurableOperation rows ===", ops.length);
    for (const o of ops) {
      console.log({
        id: o.id,
        status: o.status,
        type: o.operationType,
        failureClass: o.failureClass,
        failureDetail: o.failureDetail,
        resultPreview: o.resultJson ? JSON.stringify(o.resultJson).slice(0, 400) : null,
      });
    }
  } catch (e) {
    console.log("\n=== MctbDurableOperation (table) ===", e instanceof Error ? e.message : e);
  }

  const jobs = await prisma.jobQueue.findMany({
    where: {
      jobType: { in: ["mctb_durable_operation_process", "voice_mctb_booking_create"] },
      createdAt: { gte: new Date("2026-09-14T22:00:00Z") },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  console.log("\n=== durable-related jobs since 22:00Z ===");
  for (const j of jobs) {
    const p = (j.payload || {}) as Record<string, unknown>;
    console.log({
      id: j.id,
      type: j.jobType,
      status: j.status,
      lastError: j.lastError,
      at: j.createdAt.toISOString(),
      operationId: p.operationId,
      callId: p.callId,
    });
  }

  const mctbCfg = await prisma.workspace.findUnique({
    where: { id: "ws_1" },
    select: { id: true, name: true, settings: true },
  });
  const settings = (mctbCfg?.settings || {}) as Record<string, unknown>;
  const mctb = (settings.mctb || settings.MCTB || {}) as Record<string, unknown>;
  console.log("\n=== ws_1 MCTB AI booking flags (settings) ===");
  console.log({
    aiBooking: mctb.aiBooking ?? mctb.ai_booking,
    provider: mctb.aiBookingProvider,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
