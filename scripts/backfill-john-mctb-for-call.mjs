#!/usr/bin/env node
/**
 * Backfill John MCTB for a voice call that was incorrectly marked answered.
 *
 *   CALL_ID=cmsj8t5094e2a5619304w2q41 node scripts/backfill-john-mctb-for-call.mjs
 *   CALL_ID=... DRY_RUN=1 node scripts/backfill-john-mctb-for-call.mjs
 */
import { PrismaClient } from "@prisma/client";

const CALL_ID = (process.env.CALL_ID || "").trim();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function main() {
  if (!CALL_ID) throw new Error("Set CALL_ID");

  const prisma = new PrismaClient();
  const { wasCallGenuinelyAnswered, triggerJohnMctbForVoiceCall } = await import(
    "../src/lib/agents/missed-call-text-back/voice-missed-trigger.ts"
  );
  const { executeMissedCallTextSend } = await import(
    "../src/lib/agents/missed-call-text-back/send.ts"
  );

  let call = await prisma.voiceCall.findUnique({ where: { id: CALL_ID } });
  if (!call) throw new Error(`Call ${CALL_ID} not found`);

  console.log("Before:", {
    id: call.id,
    status: call.status,
    answeredAt: call.answeredAt,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSeconds: call.durationSeconds,
    agentId: call.agentId,
    genuinelyAnswered: wasCallGenuinelyAnswered(call),
  });

  if (!wasCallGenuinelyAnswered(call) && call.status === "COMPLETED") {
    console.log("Patching COMPLETED ring-out → NO_ANSWER");
    if (!DRY_RUN) {
      call = await prisma.voiceCall.update({
        where: { id: call.id },
        data: { status: "NO_ANSWER", answeredAt: null },
      });
    }
  } else if (!wasCallGenuinelyAnswered(call) && call.answeredAt) {
    console.log("Clearing false answeredAt");
    if (!DRY_RUN) {
      call = await prisma.voiceCall.update({
        where: { id: call.id },
        data: { answeredAt: null },
      });
    }
  }

  if (DRY_RUN) {
    console.log("DRY_RUN — skipping trigger/send");
    await prisma.$disconnect();
    return;
  }

  const trigger = await triggerJohnMctbForVoiceCall(call);
  console.log("Trigger:", trigger);

  if (trigger.triggered && trigger.result?.missedCallEventId) {
    const event = await prisma.missedCallEvent.findUnique({
      where: { id: trigger.result.missedCallEventId },
    });
    if (event && !event.smsSentAt) {
      const send = await executeMissedCallTextSend({
        workspaceId: call.workspaceId,
        missedCallEventId: event.id,
        traceId: event.traceId,
      });
      console.log("Send:", send);
    } else {
      console.log("Event already sent or missing:", event?.status);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
