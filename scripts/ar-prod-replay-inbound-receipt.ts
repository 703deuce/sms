/**
 * Replay routing + ingress for a stuck platform inbound receipt (ops).
 * PROVIDER_MESSAGE_ID=... NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-prod-replay-inbound-receipt.ts
 */
import { getPrisma } from "../src/lib/db";
import { dispatchSharedPlatformSmsInbound } from "../src/lib/messaging/platform-sms-inbound-dispatch";
import { acceptArInboundSmsIngress } from "../src/lib/appointment-reminders/messaging/inbound-sms-ingress";
import { resolveArInboundFromOutboundInitiatedConversation } from "../src/lib/appointment-reminders/messaging/resolve-initiated-ar-inbound";

const providerMessageId = process.env.PROVIDER_MESSAGE_ID?.trim();
const REPLAY_SUFFIX = process.env.REPLAY_SUFFIX || "-replay-ops";

async function main() {
  if (!providerMessageId) {
    console.error("Set PROVIDER_MESSAGE_ID");
    process.exit(1);
  }
  const prisma = getPrisma();
  const receipt = await prisma.arPlatformSmsInboundReceipt.findUnique({
    where: { providerMessageId },
  });
  if (!receipt) {
    console.error("receipt_not_found", providerMessageId);
    process.exit(1);
  }
  console.log("receipt", {
    id: receipt.id,
    state: receipt.state,
    from: receipt.fromE164,
    to: receipt.toE164,
    platformPhoneNumberId: receipt.platformPhoneNumberId,
    bodyPreview: receipt.bodyPreview,
    routingResolution: receipt.routingResolution,
    processInboundJobId: receipt.processInboundJobId,
  });

  if (!receipt.platformPhoneNumberId) {
    console.error("missing_platform_phone_number_id");
    process.exit(1);
  }

  const phoneRow = await prisma.phoneNumber.findUnique({
    where: { id: receipt.platformPhoneNumberId },
    select: { id: true, e164: true, messagingProvider: true, workspaceId: true },
  });
  if (!phoneRow?.e164) {
    console.error("platform_sender_row_missing");
    process.exit(1);
  }

  const match = await resolveArInboundFromOutboundInitiatedConversation({
    consumerE164: receipt.fromE164,
    platformPhoneNumberId: receipt.platformPhoneNumberId,
  });
  console.log("resolve", match.status, match.status === "matched" ? match.session.id : match);

  if (match.status !== "matched") {
    const dispatch = await dispatchSharedPlatformSmsInbound({
      channel: receipt.channel === "twilio" ? "twilio" : "telnyx",
      fromE164: receipt.fromE164,
      body: receipt.bodyPreview,
      providerMessageId: `${providerMessageId}${REPLAY_SUFFIX}`,
      destination: {
        phoneNumberId: phoneRow.id,
        e164: phoneRow.e164,
        workspaceId: phoneRow.workspaceId,
        provider: phoneRow.messagingProvider || "telnyx",
      },
    });
    console.log("full_dispatch", dispatch);
    return;
  }

  const session = match.session;
  const ingress = await acceptArInboundSmsIngress({
    workspaceId: session.workspaceId,
    contactId: session.contactId,
    replySessionId: session.id,
    appointmentId: session.appointmentId,
    from: receipt.fromE164,
    to: receipt.toE164,
    body: receipt.bodyPreview,
    provider: receipt.channel === "twilio" ? "twilio" : "telnyx",
    providerMessageId: `${providerMessageId}${REPLAY_SUFFIX}`,
  });
  console.log("ingress", ingress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
