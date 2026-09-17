/**
 * Inspect latest ws_1 call to +15714073615 (bridge debugging).
 */
import { getPrisma } from "@/lib/db";

const E164 = process.env.PHONE_E164 || "+15714073615";
const WS = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { workspaceId: WS, toE164: E164 },
    orderBy: { createdAt: "desc" },
  });
  const events = call
    ? await prisma.voiceCallEvent.findMany({
        where: { callId: call.id },
        orderBy: { createdAt: "asc" },
        take: 80,
      })
    : [];
  if (!call) {
    console.log("No call found");
    return;
  }
  const meta = (call.metadata || {}) as Record<string, unknown>;
  console.log(
    JSON.stringify(
      {
        id: call.id,
        createdAt: call.createdAt,
        status: call.status,
        fromE164: call.fromE164,
        toE164: call.toE164,
        agentId: call.agentId,
        aiStarted: meta.aiStarted,
        aiStartFailed: meta.aiStartFailed,
        aiStartError: meta.aiStartError,
        voiceTransport: meta.voiceTransport,
        realtimeBridgeStreamUrl: meta.realtimeBridgeStreamUrl,
        events: events.map((e) => ({
          at: e.createdAt,
          type: e.eventType,
          payload: e.payload,
        })),
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
  .finally(() => {
    void getPrisma().$disconnect();
  });
