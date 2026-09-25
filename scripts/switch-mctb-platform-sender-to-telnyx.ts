/**
 * Switch canonical MCTB platform SMS sender: Telnyx primary, Twilio preserved.
 *
 * Does not change MCTB voice ingress routing or TeXML. Only platform SMS sender metadata + env pointer.
 *
 * Usage:
 *   MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 \
 *   MCTB_PLATFORM_TELNYX_SENDER_E164=+18666020680 \
 *   MCTB_PLATFORM_TWILIO_PRESERVED_E164=+18885046264 \
 *   npx tsx scripts/switch-mctb-platform-sender-to-telnyx.ts
 *
 * Optional: DRY_RUN=1
 */
import {
  adoptMctbPlatformSenderFromTelnyxAccount,
  demoteTwilioPlatformMctbSenderToPreserved,
} from "@/lib/mctb/messaging/platform-sender-adopt";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { requireMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

async function main() {
  const ownerWorkspaceId = requireMctbPlatformOwnerWorkspaceId();
  const telnyxE164 = normalizeE164(
    process.env.MCTB_PLATFORM_TELNYX_SENDER_E164?.trim() || "+18666020680",
  );
  const twilioPreservedE164 = normalizeE164(
    process.env.MCTB_PLATFORM_TWILIO_PRESERVED_E164?.trim() || "+18885046264",
  );
  const dryRun = process.env.DRY_RUN === "1";

  if (dryRun) {
    console.log(
      JSON.stringify({
        ok: true,
        dryRun: true,
        ownerWorkspaceId,
        telnyxE164,
        twilioPreservedE164,
        steps: [
          "demoteTwilioPlatformMctbSenderToPreserved",
          "adoptMctbPlatformSenderFromTelnyxAccount",
          `Set MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=<telnyx phoneNumberId>`,
          "Redeploy web + SMS worker",
        ],
      }),
    );
    return;
  }

  const demoted = await demoteTwilioPlatformMctbSenderToPreserved({
    ownerWorkspaceId,
    e164: twilioPreservedE164,
  });
  const adopted = await adoptMctbPlatformSenderFromTelnyxAccount({
    ownerWorkspaceId,
    e164: telnyxE164,
  });

  process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID = adopted.phoneNumberId;
  const canonical = await resolveCanonicalMctbPlatformSender();
  const auth = await isPhoneAuthorizedForOutboundSms(adopted.phoneNumberId);

  console.log(
    JSON.stringify(
      {
        ok: true,
        telnyxPrimary: adopted,
        twilioPreserved: demoted,
        canonical,
        outboundSmsAuthorized: auth.allowed,
        outboundAuth: auth,
        coolifyEnv: {
          MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID: adopted.phoneNumberId,
          MCTB_PLATFORM_OWNER_WORKSPACE_ID: ownerWorkspaceId,
        },
        switchBackToTwilio:
          "Re-adopt Twilio via setup-mctb-platform-sender.ts, demote Telnyx platformMctbSender flag, set MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID to Twilio phoneNumberId",
      },
      null,
      2,
    ),
  );

  if (!canonical || canonical.provider !== "telnyx" || !auth.allowed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
