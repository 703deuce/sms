/**
 * Ops: enqueue AR inbound processing (same path as Telnyx webhook after routing).
 * REPLY_SESSION_ID=... BODY="Next Monday at 1pm" NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-prod-inject-inbound-sms.ts
 */
import { createId } from "../src/lib/supabase/id";
import { getPrisma } from "../src/lib/db";
import { acceptArInboundSmsIngress } from "../src/lib/appointment-reminders/messaging/inbound-sms-ingress";

const sessionId = process.env.REPLY_SESSION_ID?.trim();
const body = process.env.BODY?.trim() || "Next Monday at 1pm";

async function main() {
  if (!sessionId) {
    console.error("Set REPLY_SESSION_ID");
    process.exit(1);
  }
  const prisma = getPrisma();
  const session = await prisma.arSmsReplySession.findFirst({
    where: { id: sessionId },
  });
  if (!session) {
    console.error("session_not_found", sessionId);
    process.exit(1);
  }
  const phoneRow = await prisma.phoneNumber.findFirst({
    where: { id: session.platformPhoneNumberId },
    select: { e164: true },
  });
  const providerMessageId = process.env.PROVIDER_MESSAGE_ID?.trim() || `ops-inject-${createId()}`;
  const ingress = await acceptArInboundSmsIngress({
    workspaceId: session.workspaceId,
    contactId: session.contactId,
    replySessionId: session.id,
    appointmentId: session.appointmentId,
    from: session.consumerE164,
    to: phoneRow?.e164 || "+18666020680",
    body,
    provider: session.provider === "twilio" ? "twilio" : "telnyx",
    providerMessageId,
  });
  console.log("ingress", ingress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
