/**
 * Read-only: latest inbound voice call + tool executions for cert workspace.
 * Usage: WS=<workspaceId> node scripts/cert-last-voice-call-inspect.mjs
 */
import { PrismaClient } from "@prisma/client";

const ws = process.env.WS?.trim();
if (!ws) {
  console.error("WS required");
  process.exit(1);
}

const prisma = new PrismaClient();
const call = await prisma.voiceCall.findFirst({
  where: { workspaceId: ws, direction: "INBOUND" },
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    createdAt: true,
    startedAt: true,
    endedAt: true,
    status: true,
    direction: true,
    fromE164: true,
    toE164: true,
    durationSeconds: true,
    telnyxCallControlId: true,
    telnyxConversationId: true,
    metadata: true,
    agentId: true,
    agentVersionId: true,
  },
});

if (!call) {
  console.log(JSON.stringify({ ok: false, reason: "no_calls" }));
  await prisma.$disconnect();
  process.exit(0);
}

const transcript = await prisma.voiceTranscript.findFirst({
  where: { callId: call.id },
  orderBy: { createdAt: "desc" },
  select: { fullText: true, status: true },
});

const tools = await prisma.voiceToolExecution.findMany({
  where: { callId: call.id },
  orderBy: { createdAt: "asc" },
  select: {
    createdAt: true,
    status: true,
    errorMessage: true,
    input: true,
    output: true,
    latencyMs: true,
    tool: { select: { name: true } },
  },
  take: 60,
});

const events = await prisma.voiceCallEvent.findMany({
  where: { callId: call.id },
  orderBy: { createdAt: "asc" },
  select: { createdAt: true, eventType: true, payload: true },
  take: 30,
});

const toolRows = tools.map((t) => ({
  at: t.createdAt,
  name: t.tool?.name ?? "(unknown)",
  status: t.status,
  errorMessage: t.errorMessage,
  input: t.input,
  output: t.output,
  latencyMs: t.latencyMs,
}));

console.log(
  JSON.stringify(
    {
      ok: true,
      call: {
        id: call.id,
        createdAt: call.createdAt,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        status: call.status,
        direction: call.direction,
        from: call.fromE164,
        to: call.toE164,
        durationSeconds: call.durationSeconds,
        telnyxCallControlId: call.telnyxCallControlId,
        agentId: call.agentId,
        agentVersionId: call.agentVersionId,
        metadata: call.metadata,
        transcriptPreview: (transcript?.fullText || "").slice(0, 2000),
        transcriptStatus: transcript?.status ?? null,
      },
      toolExecutions: toolRows,
      callEvents: events.map((e) => ({
        at: e.createdAt,
        type: e.eventType,
        payloadPreview: e.payload
          ? JSON.stringify(e.payload).slice(0, 400)
          : null,
      })),
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
