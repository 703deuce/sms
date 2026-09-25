/**
 * One-shot: mark Telnyx platform sender row + adopt merge as messaging APPROVED (production ops).
 * Run: MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/fix-telnyx-platform-sender-messaging-approved.ts
 */
import { getPrisma } from "@/lib/db";
import {
  adoptMctbPlatformSenderFromTelnyxAccount,
} from "@/lib/mctb/messaging/platform-sender-adopt";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { requireMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";
import { parseMessagingComplianceFromSettings } from "@/lib/messaging/compliance/messaging-compliance";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

async function main() {
  const ownerWorkspaceId = requireMctbPlatformOwnerWorkspaceId();
  const e164 = normalizeE164(process.env.MCTB_PLATFORM_TELNYX_SENDER_E164?.trim() || "+18666020680");
  const prisma = getPrisma();

  await adoptMctbPlatformSenderFromTelnyxAccount({
    ownerWorkspaceId,
    e164,
  });

  const row = await prisma.phoneNumber.findFirst({
    where: { workspaceId: ownerWorkspaceId, e164 },
    select: { id: true, settingsJson: true },
  });
  if (!row) throw new Error("platform_sender_row_missing");

  const settings =
    row.settingsJson && typeof row.settingsJson === "object" && !Array.isArray(row.settingsJson)
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};
  settings.messagingCompliance = { type: "A2P_10DLC", status: "APPROVED" };
  settings.mctbNumberClass = "TELNYX_LOCAL_A2P";
  settings.platformMctbSender = true;

  await prisma.phoneNumber.update({
    where: { id: row.id },
    data: {
      a2pStatus: "APPROVED",
      settingsJson: settings,
    },
  });

  const auth = await isPhoneAuthorizedForOutboundSms(row.id);
  console.log(
    JSON.stringify(
      {
        ok: auth.allowed,
        phoneNumberId: row.id,
        e164,
        compliance: parseMessagingComplianceFromSettings(settings),
        auth,
      },
      null,
      2,
    ),
  );
  if (!auth.allowed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
