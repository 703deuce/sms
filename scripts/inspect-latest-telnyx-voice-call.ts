#!/usr/bin/env tsx
/**
 * Find the most recent inbound call to the MCTB/voice DID and summarize tools + latency signals.
 */
import { getPrisma } from "../src/lib/db";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";
const TO_E164 = process.env.TO_E164 || "+18663464256";

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      startedAt: { gte: since },
      OR: [{ toE164: TO_E164 }, { agentId: AGENT_ID }],
    },
    orderBy: { startedAt: "desc" },
    take: 15,
    select: {
      id: true,
      fromE164: true,
      toE164: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      status: true,
      agentId: true,
      telnyxConversationId: true,
      telnyxCallControlId: true,
      metadata: true,
    },
  });

  console.log(`Recent calls (last 6h) matching ${TO_E164} or agent: ${calls.length}\n`);

  for (const call of calls) {
    const tools = await prisma.voiceToolExecution.findMany({
      where: { callId: call.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        latencyMs: true,
        createdAt: true,
        input: true,
        output: true,
        errorMessage: true,
      },
    });

    const ingress = await prisma.auditLog.findMany({
      where: {
        workspaceId: WORKSPACE_ID,
        event: "voice.tool_webhook.ingress",
        createdAt: { gte: call.startedAt },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const meta = (call.metadata || {}) as Record<string, unknown>;
    const trace = Array.isArray(meta.executionTrace)
      ? (meta.executionTrace as Array<{ at: string; kind: string; tool?: string; detail?: unknown }>)
      : [];

    const toolIngress = ingress.filter((row) => {
      try {
        const d = JSON.parse(row.detail || "{}") as Record<string, unknown>;
        return d.callId === call.id || String(d.call_control_id || "").includes(call.telnyxCallControlId || "x");
      } catch {
        return false;
      }
    });

    console.log("===", call.id, "===");
    console.log({
      from: call.fromE164,
      to: call.toE164,
      started: call.startedAt?.toISOString(),
      ended: call.endedAt?.toISOString(),
      durationSeconds: call.durationSeconds,
      status: call.status,
      agentId: call.agentId,
      conversationId: call.telnyxConversationId,
    });
    console.log(`voiceToolExecution count: ${tools.length}`);
    for (const t of tools) {
      const inp = (t.input || {}) as Record<string, unknown>;
      const toolType = inp.toolType || inp.tool_type || "unknown";
      console.log(
        `  tool ${toolType} ${t.status} ${t.latencyMs ?? "?"}ms @ ${t.createdAt.toISOString()}`,
      );
    }
    console.log(`tool webhook ingress (matched): ${toolIngress.length}`);
    console.log(`executionTrace events: ${trace.length}`);
    const toolTrace = trace.filter((e) => /tool/i.test(e.kind));
    for (const e of toolTrace.slice(0, 20)) {
      console.log(`  trace ${e.at} ${e.kind} ${e.tool || ""} ${JSON.stringify(e.detail || {})}`);
    }

    const aiConv = call.telnyxConversationId
      ? await prisma.voiceAiConversation.findFirst({
          where: { telnyxConversationId: call.telnyxConversationId },
          select: { id: true, metadata: true, updatedAt: true },
        })
      : null;
    if (aiConv?.metadata) {
      const m = aiConv.metadata as Record<string, unknown>;
      console.log("voiceAiConversation metadata keys:", Object.keys(m).join(", "));
    }

    const transcript = await prisma.voiceTranscript.findFirst({
      where: { callId: call.id },
      orderBy: { createdAt: "desc" },
      select: { fullText: true, segments: true },
    });
    if (transcript?.fullText) {
      console.log("transcript preview:", transcript.fullText.slice(0, 400).replace(/\n/g, " "));
    }

    console.log("");
  }

  const aiConvs = await prisma.voiceAiConversation.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      agentId: AGENT_ID,
      updatedAt: { gte: since },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      callId: true,
      telnyxConversationId: true,
      updatedAt: true,
      metadata: true,
    },
  });
  if (aiConvs.length) {
    console.log("=== Recent VoiceAiConversation ===");
    for (const c of aiConvs) {
      console.log({
        id: c.id,
        callId: c.callId,
        telnyxConversationId: c.telnyxConversationId,
        updatedAt: c.updatedAt.toISOString(),
      });
    }
  }

  const auditVoice = await prisma.auditLog.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      createdAt: { gte: since },
      OR: [
        { event: { contains: "telnyx" } },
        { event: { contains: "voice" } },
        { event: { contains: "mctb.inbound" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { event: true, createdAt: true, detail: true },
  });
  console.log("\n=== Recent voice/telnyx audit (last 20) ===");
  for (const a of auditVoice) {
    console.log(a.createdAt.toISOString(), a.event, (a.detail || "").slice(0, 200));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
