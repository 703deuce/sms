/**
 * Pull Telnyx delivery status for an outbound Message row (MCTB platform sender path).
 *
 * Usage:
 *   MESSAGE_ID=cmut0yxqh0q1x420b2r2h5w2e npx tsx scripts/mctb-sync-outbound-delivery-status.ts
 */
import { getPrisma } from "@/lib/db";
import { applyOutboundDeliveryStatus } from "@/lib/messaging/delivery-status";
import { bridgeMctbRecoveryDeliveryWebhook } from "@/lib/mctb/messaging/delivery-trace";
import { lookupTelnyxMessageStatus } from "@/lib/messaging/telnyx/lookup-message-status";

const messageId = process.env.MESSAGE_ID?.trim();
if (!messageId) {
  console.error("Set MESSAGE_ID");
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg?.providerId || msg.providerId.startsWith("idem:") || msg.providerId.startsWith("pending:")) {
    console.error("Message missing Telnyx providerId", msg?.providerId);
    process.exit(1);
  }

  const lookup = await lookupTelnyxMessageStatus(msg.providerId);
  if (!lookup) {
    console.error("Telnyx lookup failed for", msg.providerId);
    process.exit(1);
  }

  const result = await applyOutboundDeliveryStatus({
    providerMessageId: msg.providerId,
    status: lookup.status,
    providerStatus: lookup.providerStatus,
    errorCode: lookup.errorCode,
    errorDetail: lookup.errorDetail,
    provider: "telnyx",
    toE164: msg.to,
    fromE164: msg.from,
  });

  const mctb = await bridgeMctbRecoveryDeliveryWebhook({
    providerMessageId: msg.providerId,
    status: result.status,
    errorDetail: lookup.errorDetail,
  });

  console.log(
    JSON.stringify(
      {
        messageId,
        providerId: msg.providerId,
        telnyxStatus: lookup.providerStatus,
        applied: result.status,
        updatedMessage: result.updatedMessage,
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
