/**
 * Read-only: platform-owner MessagingRegistration readiness for MCTB platform sender.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-mctb-platform-owner-registration.ts
 */
import { getPrisma } from "@/lib/db";
import { resolveMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";
import { isMessagingSendAuthorized } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { listTwilioOwnedNumbers } from "@/lib/numbers/twilio-number-import";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const PLATFORM_E164 = process.env.MCTB_PLATFORM_SENDER_E164?.trim() || "+18885046264";

async function main() {
  const workspaceId = resolveMctbPlatformOwnerWorkspaceId();
  const prisma = getPrisma();
  const reg = await getRegistrationByWorkspace(workspaceId);
  const target = normalizeE164(PLATFORM_E164);

  let twilioOwnership: {
    found: boolean;
    accountSid?: string;
    source?: string;
    sid?: string;
  } = { found: false };

  try {
    const owned = await listTwilioOwnedNumbers(workspaceId);
    const hit = owned.find((n) => n.e164 === target);
    if (hit) {
      twilioOwnership = {
        found: true,
        accountSid: hit.accountSid,
        source: hit.source,
        sid: hit.sid,
      };
    }
  } catch (err) {
    twilioOwnership = {
      found: false,
      source: err instanceof Error ? err.message.slice(0, 120) : "twilio_list_failed",
    };
  }

  const subaccountSidPresent = Boolean(reg?.subaccountSid?.trim());
  const messagingServiceSidPresent = Boolean(reg?.messagingServiceSid?.trim());
  const sendAuthorized = isMessagingSendAuthorized(reg);

  console.log(
    JSON.stringify(
      {
        workspaceId,
        registrationExists: Boolean(reg),
        provider: reg?.messagingProvider || null,
        overallStatus: reg?.overallStatus || null,
        messagingEnabled: reg?.messagingEnabled ?? null,
        subaccountSidPresent,
        messagingServiceSidPresent,
        isMessagingSendAuthorized: sendAuthorized,
        sendViaRegistrationPrerequisitesSatisfied:
          subaccountSidPresent && (sendAuthorized || twilioOwnership.found),
        platformE164: target,
        twilioNumberListing: twilioOwnership,
        regPhoneE164: reg?.phoneE164 || null,
        note:
          "If number is on parent account but subaccount cannot send, STOP before setup script.",
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
