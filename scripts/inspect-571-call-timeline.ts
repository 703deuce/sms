/**
 * PSTN → first Amy audio timeline for latest 571 call (openai_live debugging).
 */
import { getPrisma } from "@/lib/db";

const E164 = process.env.PHONE_E164 || "+15714073615";
const WS = process.env.WORKSPACE_ID || "ws_1";

function ms(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return b.getTime() - a.getTime();
}

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { workspaceId: WS, toE164: E164 },
    orderBy: { createdAt: "desc" },
  });
  if (!call) {
    console.log("No call");
    return;
  }
  const events = await prisma.voiceCallEvent.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "asc" },
  });
  const pick = (type: string) => events.find((e) => e.eventType === type)?.createdAt ?? null;
  const initiated = pick("call.initiated");
  const answerSent = pick("media.answer_sent");
  const disclosure = pick("compliance.recording_disclosure");
  const bridge = pick("media.realtime_bridge_started");
  const fastPath = pick("media.live_fast_path_started");

  const payload = (call.payload || {}) as Record<string, unknown>;
  const startTimeRaw = payload.start_time as string | undefined;

  console.log(
    JSON.stringify(
      {
        callId: call.id,
        createdAt: call.createdAt,
        providerStartTime: startTimeRaw ?? null,
        milestones: {
          answer_sent: answerSent,
          recording_disclosure: disclosure,
          live_fast_path: fastPath,
          realtime_bridge_started: bridge,
        },
        deltas_ms: {
          created_to_answer: ms(call.createdAt, answerSent),
          answer_to_disclosure: ms(answerSent, disclosure),
          answer_to_bridge: ms(answerSent, bridge),
          answer_to_fast_path: ms(answerSent, fastPath),
        },
        note:
          "Amy first audio is ~1–2s after realtime_bridge_started in container LIVE_TIMING logs (grep openai_live_timing).",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void getPrisma().$disconnect());
