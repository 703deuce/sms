/**
 * Timeline analysis for a voice call — tools + transcript offsets.
 * Run: npx tsx scripts/analyze-call-timing.ts <callId>
 */
import { getPrisma } from "../src/lib/db";

const CALL_ID = process.argv[2] || "cmsv9ebkg4s6o5p5d003c0x1q";

async function main() {
  const p = getPrisma();
  const call = await p.voiceCall.findUnique({
    where: { id: CALL_ID },
    select: { startedAt: true, endedAt: true, metadata: true, agentVersionId: true },
  });
  if (!call?.startedAt) {
    console.error("Call not found");
    process.exit(1);
  }

  const startMs = call.startedAt.getTime();
  const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  console.log("=== TOOL TIMELINE (from call start) ===");
  const tools = await p.voiceToolExecution.findMany({
    where: { callId: CALL_ID },
    orderBy: { createdAt: "asc" },
  });
  for (const t of tools) {
    const inp = t.input as Record<string, string> | undefined;
    const toolType = inp?.toolType || "?";
    const offset = t.createdAt.getTime() - startMs;
    console.log(
      `${fmt(offset)} → ${fmt(offset + (t.latencyMs || 0))}  ${toolType}  (${t.latencyMs}ms)`,
    );
  }

  const tr = await p.voiceTranscript.findFirst({ where: { callId: CALL_ID } });
  if (tr) {
    const segs = await p.voiceTranscriptSegment.findMany({
      where: { transcriptId: tr.id },
      orderBy: { id: "asc" },
    });
    console.log("\n=== TRANSCRIPT TIMELINE ===");
    for (const s of segs) {
      const off =
        s.startMs != null ? fmt(s.startMs) : s.createdAt ? fmt(s.createdAt.getTime() - startMs) : "?";
      const text = (s.text || "").trim().replace(/\s+/g, " ").slice(0, 100);
      if (!text || text === ".") continue;
      console.log(`${off}  ${s.speaker}: ${text}`);
    }
  }

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const telemetry = meta.hybridTelemetry || meta.taskTransitionInstrumentation;
  if (telemetry) {
    console.log("\n=== METADATA TELEMETRY (truncated) ===");
    console.log(JSON.stringify(telemetry).slice(0, 800));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
