/**
 * Re-route HELD platform AR inbound messages when a single active session exists.
 * Run on production web container after deploying session dedupe + migration.
 */
import { getPrisma } from "../src/lib/db";
import { acceptArInboundSmsIngress } from "../src/lib/appointment-reminders/messaging/inbound-sms-ingress";
import { resolveArInboundFromOutboundInitiatedConversation } from "../src/lib/appointment-reminders/messaging/resolve-initiated-ar-inbound";
import { AR_REPLY_ELIGIBLE_STATES } from "../src/lib/appointment-reminders/messaging/ar-platform-sender-pool";

const PHONE = process.env.PHONE || "+15714776175";

async function main() {
  const prisma = getPrisma();
  const held = await prisma.arSmsInboundHeldMessage.findMany({
    where: { state: "HELD", holdReason: "ambiguous_ar_initiated_conversations" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  console.log("held_count", held.length);

  for (const row of held) {
    if (!row.platformPhoneNumberId) continue;
    const match = await resolveArInboundFromOutboundInitiatedConversation({
      consumerE164: row.fromE164,
      platformPhoneNumberId: row.platformPhoneNumberId,
    });
    if (match.status !== "matched") {
      console.log("skip", row.providerMessageId, match.status);
      continue;
    }
    const session = match.session;
    if (!AR_REPLY_ELIGIBLE_STATES.includes(session.lifecycleState as (typeof AR_REPLY_ELIGIBLE_STATES)[number])) {
      console.log("skip_ineligible_session", row.providerMessageId);
      continue;
    }
    await acceptArInboundSmsIngress({
      workspaceId: session.workspaceId,
      contactId: session.contactId,
      replySessionId: session.id,
      appointmentId: session.appointmentId,
      from: row.fromE164,
      to: row.toE164,
      body: row.bodyPreview,
      provider: row.channel === "twilio" ? "twilio" : "telnyx",
      providerMessageId: row.providerMessageId,
    });
    await prisma.arSmsInboundHeldMessage.update({
      where: { id: row.id },
      data: {
        state: "RESOLVED",
        resolvedAt: new Date(),
        resolvedReplySessionId: session.id,
        resolutionNote: "reprocessed_after_session_dedupe",
      },
    });
    console.log("reprocessed", row.providerMessageId, "→", session.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
