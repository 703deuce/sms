/**
 * One-off: pull Twilio message status and apply delivery + MCTB trace (platform sender path).
 *
 * Usage:
 *   MESSAGE_ID=cmut0yxqh0q1x420b2r2h5w2e npx tsx scripts/mctb-sync-outbound-delivery-status.ts
 */
import { getPrisma } from "@/lib/db";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { applyOutboundDeliveryStatus } from "@/lib/messaging/delivery-status";
import { bridgeMctbRecoveryDeliveryWebhook } from "@/lib/mctb/messaging/delivery-trace";

const messageId = process.env.MESSAGE_ID?.trim();
if (!messageId) {
  console.error("Set MESSAGE_ID");
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg?.providerId || msg.providerId.startsWith("idem:") || msg.providerId.startsWith("pending:")) {
    console.error("Message missing real providerId", msg?.providerId);
    process.exit(1);
  }

  const client = getLiveParentClient();
  const twilioMsg = await client.messages(msg.providerId).fetch();
  const status = (twilioMsg.status || "unknown").toLowerCase();

  const result = await applyOutboundDeliveryStatus({
    providerMessageId: msg.providerId,
    status,
    providerStatus: twilioMsg.status,
    errorCode: twilioMsg.errorCode?.toString() || null,
    errorDetail: twilioMsg.errorMessage || null,
    provider: "twilio",
  });

  const mctb = await bridgeMctbRecoveryDeliveryWebhook({
    providerMessageId: msg.providerId,
    status: result.status,
    errorDetail: twilioMsg.errorMessage || null,
  });

  console.log(
    JSON.stringify(
      {
        messageId,
        providerId: msg.providerId,
        twilioStatus: twilioMsg.status,
        applied: result.status,
        mctbTrace: mctb,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
