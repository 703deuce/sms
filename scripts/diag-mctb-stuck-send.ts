/**
 * Diagnose / replay a stuck MCTB missed-call SMS (status SCHEDULED).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diag-mctb-stuck-send.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diag-mctb-stuck-send.ts --send
 */
import { getPrisma } from "@/lib/db";
import { executeMissedCallTextSend } from "@/lib/agents/missed-call-text-back/send";

const args = process.argv.slice(2);
const doSend = args.includes("--send");
const eventId = args.find((a) => !a.startsWith("--")) || "cmtqtbdpu0q274m643c58595k";

async function main() {
  const prisma = getPrisma();
  const event = await prisma.missedCallEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error(`missedCallEvent not found: ${eventId}`);

  const jobs = await prisma.jobQueue.findMany({
    where: { idempotencyKey: `john-mctb-send:${eventId}` },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const traces = await prisma.missedCallTextTrace.findMany({
    where: { missedCallEventId: eventId },
    orderBy: { createdAt: "asc" },
  });

  const consent = await prisma.smartRoutingSmsConsentEvent.findFirst({
    where: {
      workspaceId: event.workspaceId,
      callerNumber: event.callerE164,
      consentedAt: { gte: new Date(event.createdAt.getTime() - 5 * 60 * 1000) },
    },
    orderBy: { consentedAt: "desc" },
  });

  console.log(
    JSON.stringify(
      {
        event: {
          id: event.id,
          status: event.status,
          callerE164: event.callerE164,
          businessE164: event.businessE164,
          phoneNumberId: event.phoneNumberId,
          scheduledSmsAt: event.scheduledSmsAt,
          smsSentAt: event.smsSentAt,
          suppressionReason: event.suppressionReason,
          metadata: event.metadata,
          traceId: event.traceId,
        },
        jobs,
        traceKinds: traces.map((t) => ({ kind: t.kind, detail: t.detailJson, at: t.createdAt })),
        consent: consent
          ? {
              id: consent.id,
              callerNumber: consent.callerNumber,
              businessNumber: consent.businessNumber,
              metadataJson: consent.metadataJson,
            }
          : null,
      },
      null,
      2,
    ),
  );

  if (doSend) {
    const result = await executeMissedCallTextSend({
      workspaceId: event.workspaceId,
      missedCallEventId: event.id,
      traceId: event.traceId,
    });
    console.log("\n-- send result --\n", JSON.stringify(result, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
