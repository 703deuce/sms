/**
 * One-off ops: expire duplicate eligible AR sessions, re-queue held ambiguous inbound Rs.
 */
import { getPrisma } from "../src/lib/db";
import { normalizeMctbCallerE164, mctbCallerE164Variants } from "../src/lib/mctb/messaging/caller-e164";
import { AR_REPLY_ELIGIBLE_STATES } from "../src/lib/appointment-reminders/messaging/ar-platform-sender-pool";
import { acceptArInboundSmsIngress } from "../src/lib/appointment-reminders/messaging/inbound-sms-ingress";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE = normalizeMctbCallerE164(process.env.PHONE || "+15714776175");

async function main() {
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(PHONE);
  const eligible = await prisma.arSmsReplySession.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      consumerE164: { in: variants },
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
    },
    orderBy: { lastUsedAt: "desc" },
  });
  console.log("eligible_sessions", eligible.map((s) => ({ id: s.id, appt: s.appointmentId, state: s.lifecycleState, lastUsedAt: s.lastUsedAt })));
  if (!eligible.length) {
    console.log("no_eligible_session");
    return;
  }
  const winner = eligible[0]!;
  const expired = await prisma.arSmsReplySession.updateMany({
    where: {
      workspaceId: WORKSPACE_ID,
      consumerE164: { in: variants },
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
      NOT: { id: winner.id },
    },
    data: { lifecycleState: "EXPIRED", completedAt: new Date(), lastUsedAt: new Date() },
  });
  console.log("expired_others", expired.count, "winner", winner.id);

  const held = await prisma.arSmsInboundHeldMessage.findMany({
    where: {
      state: "HELD",
      fromE164: { in: variants },
      holdReason: "ambiguous_ar_initiated_conversations",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const row of held) {
    const ingress = await acceptArInboundSmsIngress({
      workspaceId: winner.workspaceId,
      contactId: winner.contactId,
      replySessionId: winner.id,
      appointmentId: winner.appointmentId,
      from: row.fromE164,
      to: row.toE164,
      body: row.bodyPreview,
      provider: row.channel === "twilio" ? "twilio" : "telnyx",
      providerMessageId: `${row.providerMessageId}-reprocess`,
    });
    console.log("requeued", row.providerMessageId, ingress.processingJobId);
    await prisma.arSmsInboundHeldMessage.update({
      where: { id: row.id },
      data: { state: "RESOLVED", resolvedAt: new Date(), resolvedReplySessionId: winner.id },
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
