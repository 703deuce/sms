import { getPrisma } from "../src/lib/db";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "cmt2zyg4l43373s0f146b442h";
const TO_E164 = process.env.TO_E164;

async function main() {
  const prisma = getPrisma();
  const calls = await prisma.voiceCall.findMany({
    where: TO_E164
      ? { OR: [{ workspaceId: WORKSPACE_ID }, { toE164: TO_E164 }] }
      : { workspaceId: WORKSPACE_ID },
    orderBy: { startedAt: "desc" },
    take: 8,
    select: {
      id: true,
      fromE164: true,
      toE164: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      agentId: true,
      metadata: true,
      transcripts: { select: { segments: true, fullText: true }, take: 1, orderBy: { createdAt: "desc" } },
      toolExecutions: {
        select: { latencyMs: true, input: true, createdAt: true, status: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  for (const call of calls) {
    const meta = (call.metadata || {}) as Record<string, unknown>;
    const metrics = (meta.livekitCallMetrics || {}) as Record<string, unknown>;
    const trace = (meta.executionTrace || []) as Array<{
      at: string;
      kind: string;
      detail?: Record<string, unknown>;
    }>;

    console.log("\n=== CALL", call.id, "===");
    console.log("from:", call.fromE164, "to:", call.toE164);
    console.log(
      "started:",
      call.startedAt?.toISOString(),
      "ended:",
      call.endedAt?.toISOString(),
      "durSec:",
      call.durationSeconds,
    );
    console.log("livekitCallMetrics:", JSON.stringify(metrics));

    const interesting = trace.filter(
      (e) =>
        [
          "first_agent_response",
          "bootstrap_complete",
          "worker_ready",
          "call_summary",
          "tool_call",
          "runtime_template_selected",
        ].includes(e.kind) ||
        e.detail?.userToAgentResponseMs != null ||
        e.detail?.firstAgentResponseMs != null,
    );
    console.log("trace events:", interesting.length);
    for (const e of interesting) {
      console.log(`  ${e.at} ${e.kind} ${JSON.stringify(e.detail || {})}`);
    }

    if (call.toolExecutions?.length) {
      console.log("toolExecutions:");
      for (const t of call.toolExecutions) {
        console.log(`  ${t.createdAt.toISOString()} ${t.latencyMs}ms ${JSON.stringify(t.input)}`);
      }
    }

    const transcript = call.transcripts?.[0];
    const segs = transcript?.segments;
    if (Array.isArray(segs) && segs.length) {
      console.log("transcript segments (first 15):");
      for (const s of segs.slice(0, 15)) console.log(" ", JSON.stringify(s));
    } else if (transcript?.fullText) {
      console.log("transcript text:", transcript.fullText.slice(0, 500));
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    await prisma.$disconnect();
  });
