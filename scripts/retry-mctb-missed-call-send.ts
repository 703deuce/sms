import { executeMissedCallTextSend } from "@/lib/agents/missed-call-text-back/send";
import { getPrisma } from "@/lib/db";

async function main() {
  const id = process.argv[2]?.trim();
  if (!id) {
    console.error("Usage: npx tsx scripts/retry-mctb-missed-call-send.ts <missedCallEventId>");
    process.exit(1);
  }
  const prisma = getPrisma();
  const ev = await prisma.missedCallEvent.findUnique({ where: { id } });
  if (!ev) throw new Error("event_not_found");
  console.log("before", {
    status: ev.status,
    suppressionReason: ev.suppressionReason,
    trigger: ev.trigger,
    callerE164: ev.callerE164,
  });
  await prisma.missedCallEvent.update({
    where: { id },
    data: { status: "SCHEDULED", eligible: true, suppressionReason: null },
  });
  const result = await executeMissedCallTextSend({
    workspaceId: ev.workspaceId,
    missedCallEventId: id,
    traceId: `mctb_retry_${id}`,
  });
  const after = await prisma.missedCallEvent.findUnique({ where: { id } });
  console.log("send", result);
  console.log("after", {
    status: after?.status,
    smsSentAt: after?.smsSentAt,
    suppressionReason: after?.suppressionReason,
  });
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
