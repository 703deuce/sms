/**
 * Production-safe readiness gate (no secrets).
 */
import { getPrisma } from "@/lib/db";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import {
  isPlatformMctbSenderPhoneRecord,
  parseMctbPhoneRole,
} from "@/lib/messaging/compliance/phone-number-class";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";

const EXPECTED_OWNER =
  process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "ws_1";
const EXPECTED_E164 =
  process.env.MCTB_PLATFORM_SENDER_E164?.trim() || "+18666020680";
const EXPECTED_PROVIDER =
  (process.env.MCTB_PLATFORM_SENDER_PROVIDER?.trim() || "telnyx").toLowerCase();
const EXPECTED_PHONE_ID =
  process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID?.trim() ||
  (EXPECTED_PROVIDER === "telnyx" ? "cmtoszkn26t6z485u3d2w3c51" : "cmufvsanf1g0v060m13730z0q");

async function main() {
  const prisma = getPrisma();
  const canonical = await resolveCanonicalMctbPlatformSender();
  const row = await prisma.phoneNumber.findUnique({
    where: { id: EXPECTED_PHONE_ID },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      provider: true,
      status: true,
      settingsJson: true,
    },
  });
  const auth = row ? await isPhoneAuthorizedForOutboundSms(row.id) : { allowed: false };
  const reg = await getRegistrationByWorkspace(EXPECTED_OWNER);

  const platformRows = await prisma.phoneNumber.findMany({
    where: { e164: EXPECTED_E164, status: "Active" },
    select: { id: true, workspaceId: true, settingsJson: true },
  });

  let migrationSenderModeColumn = false;
  try {
    await prisma.missedCallTextConfig.findFirst({ select: { senderMode: true } });
    migrationSenderModeColumn = true;
  } catch {
    migrationSenderModeColumn = false;
  }

  const senderModes = await prisma.missedCallTextConfig.findMany({
    select: { workspaceId: true, senderMode: true, phoneNumberId: true, smsPhoneNumberId: true },
  });

  console.log(
    JSON.stringify(
      {
        canonicalSenderFound: Boolean(canonical),
        canonical: canonical
          ? {
              phoneNumberId: canonical.phoneNumberId,
              e164: canonical.e164,
              workspaceId: canonical.workspaceId,
              provider: canonical.provider,
            }
          : null,
        expectedPhoneRow: row
          ? {
              id: row.id,
              e164: row.e164,
              workspaceId: row.workspaceId,
              provider: row.provider,
              mctbRole: parseMctbPhoneRole(row.settingsJson),
              platform_mctb_sender: isPlatformMctbSenderPhoneRecord({
                settingsJson: row.settingsJson,
              }),
              outboundSmsAuthorized: auth.allowed,
            }
          : null,
        idsMatch:
          canonical?.phoneNumberId === EXPECTED_PHONE_ID &&
          row?.workspaceId === EXPECTED_OWNER,
        expectedProvider: EXPECTED_PROVIDER,
        modelBParentPathEligible:
          Boolean(canonical) &&
          canonical?.provider === "twilio" &&
          auth.allowed &&
          isPlatformMctbSenderPhoneRecord({ settingsJson: row?.settingsJson }),
        telnyxRegistrationPathEligible:
          Boolean(canonical) &&
          canonical?.provider === "telnyx" &&
          auth.allowed &&
          isPlatformMctbSenderPhoneRecord({ settingsJson: row?.settingsJson }),
        ownerWorkspaceRegistration: {
          provider: reg?.messagingProvider || null,
          note: "Telnyx owner reg is NOT a Model B blocker",
          blocksPlatformSend: false,
        },
        uniquePlatformE164Rows: platformRows.length,
        platformE164RowIds: platformRows.map((r) => r.id),
        migrationSenderModeColumn,
        mctbSenderModes: senderModes,
        readinessGreen:
          Boolean(canonical) &&
          canonical?.phoneNumberId === EXPECTED_PHONE_ID &&
          canonical?.provider === EXPECTED_PROVIDER &&
          platformRows.length <= 1 &&
          migrationSenderModeColumn &&
          auth.allowed,
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
