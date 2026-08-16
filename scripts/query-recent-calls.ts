import { getPrisma } from "../src/lib/db";

async function main() {
  const p = getPrisma();
  const calls = await p.voiceCall.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      createdAt: true,
      status: true,
      fromE164: true,
      toE164: true,
      durationSec: true,
      agentId: true,
      agentVersionId: true,
      transcript: true,
      metadata: true,
      outcome: true,
      summary: true,
    },
  });
  for (const c of calls) {
    const meta = (c.metadata || {}) as Record<string, unknown>;
    console.log("---");
    console.log(
      JSON.stringify(
        {
          id: c.id,
          at: c.createdAt,
          status: c.status,
          from: c.fromE164,
          to: c.toE164,
          durationSec: c.durationSec,
          agentId: c.agentId,
          agentVersionId: c.agentVersionId,
          outcome: c.outcome,
          summary: typeof c.summary === "string" ? c.summary.slice(0, 300) : c.summary,
          pipeline: meta.pipeline || meta.realtimeModel || meta.hybridTelemetry,
          transcriptLen: Array.isArray(c.transcript) ? c.transcript.length : 0,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
