import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";

const CALL_ID = process.argv[2] || "cmsv6fryq1702314q6j4j1t5u";

async function main() {
  const p = getPrisma();
  const call = await p.voiceCall.findUnique({ where: { id: CALL_ID } });
  if (!call) {
    console.error("Call not found");
    process.exit(1);
  }
  const ver = await p.voiceAgentVersion.findUnique({ where: { id: call.agentVersionId || "" } });
  const cfg = parseVoiceAgentConfig(ver?.config);
  const compiled = (cfg.advanced as Record<string, unknown> | undefined)?.receptionistCompiled as
    | Record<string, unknown>
    | undefined;

  console.log("=== CALL ===");
  console.log(
    JSON.stringify(
      {
        id: call.id,
        status: call.status,
        started: call.startedAt,
        ended: call.endedAt,
        durationSec: call.durationSeconds,
        outcome: call.outcome,
        appointmentBooked: call.appointmentBooked,
        agentVersion: ver?.version,
        realtimeModel: compiled?.realtimeModel,
      },
      null,
      2,
    ),
  );

  const tools = await p.voiceToolExecution.findMany({
    where: { callId: CALL_ID },
    orderBy: { createdAt: "asc" },
  });
  console.log("\n=== TOOLS (" + tools.length + ") ===");
  for (const t of tools) {
    const inp = t.input as Record<string, unknown> | undefined;
    const out = typeof t.output === "string" ? t.output.slice(0, 280) : JSON.stringify(t.output)?.slice(0, 280);
    console.log(`- ${inp?.toolType || "?"} | ${t.status} | ${t.latencyMs}ms`);
    if (inp) console.log("  input:", JSON.stringify(inp).slice(0, 200));
    console.log("  output:", out);
  }

  const appts = await p.voiceAppointment.findMany({ where: { callId: CALL_ID } });
  console.log("\n=== APPOINTMENTS (" + appts.length + ") ===");
  for (const a of appts) {
    console.log(JSON.stringify({ status: a.status, startsAt: a.startsAt, externalId: a.externalId, serviceName: a.serviceName }));
  }

  const tr = await p.voiceTranscript.findFirst({ where: { callId: CALL_ID } });
  if (tr) {
    const segs = await p.voiceTranscriptSegment.findMany({
      where: { transcriptId: tr.id },
      orderBy: { id: "asc" },
    });
    console.log("\n=== TRANSCRIPT (" + segs.length + " segments) ===");
    for (const s of segs) {
      const text = (s.text || "").trim();
      const line = text && text !== "." ? text : "[empty/dot]";
      console.log(`${s.speaker}: ${line.slice(0, 200)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
