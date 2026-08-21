import { getPrisma } from "../src/lib/db";

const callId = process.env.CALL_ID || "cmt35duse633352544b11035q";

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      fromE164: true,
      toE164: true,
      metadata: true,
      transcripts: true,
      toolExecutions: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!call) {
    console.log("call not found");
    return;
  }

  console.log("CALL", call.id);
  console.log("from", call.fromE164, "to", call.toE164);
  console.log("started", call.startedAt?.toISOString(), "ended", call.endedAt?.toISOString());

  const meta = (call.metadata || {}) as Record<string, unknown>;
  console.log("\nMETRICS", JSON.stringify(meta.livekitCallMetrics, null, 2));
  const turnLatencies = (meta.livekitCallMetrics as Record<string, unknown> | undefined)
    ?.turnLatencies;
  if (Array.isArray(turnLatencies) && turnLatencies.length) {
    console.log("\nTURN LATENCIES:");
    for (const row of turnLatencies) {
      console.log(" ", JSON.stringify(row));
    }
  }

  const trace = (meta.executionTrace || []) as Array<{
    at: string;
    kind: string;
    detail?: Record<string, unknown>;
  }>;
  console.log("\nTRACE (all):");
  for (const e of trace) {
    console.log(`${e.at} | ${e.kind} | ${JSON.stringify(e.detail || {})}`);
  }

  console.log("\nTRANSCRIPTS:");
  console.log(JSON.stringify(call.transcripts, null, 2));

  console.log("\nTOOL EXECUTIONS:");
  const tools = await prisma.voiceToolExecution.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "asc" },
  });
  console.log(JSON.stringify(tools, null, 2));

  console.log("\nCALL EVENTS:");
  const events = await prisma.voiceCallEvent.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  console.log(JSON.stringify(events, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
