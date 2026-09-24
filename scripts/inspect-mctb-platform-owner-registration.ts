/**
 * Read-only: Model B platform sender readiness (parent Twilio TFN + adopted PhoneNumber).
 * Run: MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_... npx tsx scripts/inspect-mctb-platform-owner-registration.ts
 */
import { getPrisma } from "@/lib/db";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { requireMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { isPlatformMctbSenderPhoneRecord } from "@/lib/messaging/compliance/phone-number-class";
import { assertLiveTwilioConfigured, getTwilioParentCredentials } from "@/lib/messaging/twilio-config";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";

const PLATFORM_E164 = process.env.MCTB_PLATFORM_SENDER_E164?.trim() || "+18885046264";

function maskSid(sid: string | null | undefined): string | null {
  if (!sid) return null;
  return sid.length < 8 ? "***" : `${sid.slice(0, 2)}…${sid.slice(-4)}`;
}

async function main() {
  const ownerWorkspaceId = requireMctbPlatformOwnerWorkspaceId();
  const target = normalizeE164(PLATFORM_E164);
  const prisma = getPrisma();
  const reg = await getRegistrationByWorkspace(ownerWorkspaceId);

  let parentTfn: Record<string, unknown> = { configured: false };
  try {
    assertLiveTwilioConfigured();
    const { accountSid: parentAccountSid } = getTwilioParentCredentials();
    const client = getLiveParentClient();
    const listed = await client.incomingPhoneNumbers.list({ phoneNumber: target, limit: 5 });
    const row = listed.find((n) => normalizeE164(n.phoneNumber) === target);
    parentTfn = {
      configured: true,
      parentAccountSidMasked: maskSid(parentAccountSid || null),
      incomingFound: Boolean(row),
      phoneNumberSidMasked: row ? maskSid(row.sid) : null,
      ownedByParent:
        row && parentAccountSid ? row.accountSid === parentAccountSid : null,
      smsCapability: row?.capabilities?.sms ?? null,
    };
  } catch (err) {
    parentTfn = {
      configured: false,
      error: err instanceof Error ? err.message.slice(0, 160) : "twilio_read_failed",
    };
  }

  const canonical = await resolveCanonicalMctbPlatformSender();
  const adopted = await prisma.phoneNumber.findFirst({
    where: { e164: target, workspaceId: ownerWorkspaceId, status: "Active" },
    select: { id: true, settingsJson: true, provider: true },
  });
  const adoptedRole = adopted
    ? isPlatformMctbSenderPhoneRecord({ settingsJson: adopted.settingsJson })
    : false;
  const phoneAuth = adopted
    ? await isPhoneAuthorizedForOutboundSms(adopted.id)
    : { allowed: false, regime: null, provider: null };

  console.log(
    JSON.stringify(
      {
        model: "B_parent_account_platform_sender",
        ownerWorkspaceId,
        ownerMessagingRegistration: {
          exists: Boolean(reg),
          provider: reg?.messagingProvider || null,
          note:
            "Telnyx or non-Twilio owner registration does NOT block Model B platform Twilio sends.",
        },
        parentTwilioTfn: parentTfn,
        adoptedPhoneNumber: adopted
          ? {
              id: adopted.id,
              provider: adopted.provider,
              platform_mctb_sender: adoptedRole,
              outboundSmsAuthorized: phoneAuth.allowed,
            }
          : null,
        canonicalResolver: canonical
          ? {
              phoneNumberId: canonical.phoneNumberId,
              e164: canonical.e164,
              provider: canonical.provider,
            }
          : null,
        modelBPlatformSendReady:
          Boolean(parentTfn.incomingFound) &&
          adoptedRole &&
          phoneAuth.allowed &&
          Boolean(canonical),
        sendViaRegistrationSubaccountRequiredForPlatformSend: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
