/**
 * Backfill ws_1 compliance registration fields and refresh Telnyx status.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/bootstrap-ws1-compliance-a2p.ts --apply
 */
import { getPrisma } from "@/lib/db";
import { messagingOnboarding } from "@/lib/messaging/service";
import { appendRegistrationEvent } from "@/lib/messaging/store";

const WORKSPACE_ID = process.env.MCTB_ADMIN_WORKSPACE_ID?.trim() || "ws_1";
const args = process.argv.slice(2);
const apply = args.includes("--apply");

const SAMPLE_MESSAGES = [
  "Hi, sorry we missed your call from Blue Ridge Realty. How can we help? Reply STOP to opt out.",
  "Thanks for calling Blue Ridge Realty — we're with another client. Text us here and we'll follow up shortly. Reply STOP to opt out.",
];

async function main() {
  const prisma = getPrisma();
  const reg = await prisma.messagingRegistration.findFirst({ where: { workspaceId: WORKSPACE_ID } });
  if (!reg) throw new Error(`No messaging registration for ${WORKSPACE_ID}`);

  const patch = {
    privacyPolicyUrl: reg.privacyPolicyUrl || "https://www.blueridgerealty.com/privacy",
    sampleMessages: reg.sampleMessages?.length ? reg.sampleMessages : SAMPLE_MESSAGES,
    helpMessage:
      reg.helpMessage ||
      "Blue Ridge Realty support: reply here or call us back. Reply STOP to opt out.",
    stopMessage:
      reg.stopMessage ||
      "You are unsubscribed from Blue Ridge Realty texts. Reply START to opt back in.",
    messageVolume: reg.messageVolume || "100",
    vertical: reg.vertical || reg.businessIndustry || "REAL_ESTATE",
    campaignDisplayName: reg.campaignDisplayName || reg.dbaName || reg.legalBusinessName,
    registrationSubmittedAt: reg.registrationSubmittedAt || reg.certifiedAt || new Date(),
  };

  console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", workspaceId: WORKSPACE_ID, patch }, null, 2));

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply.");
    return;
  }

  const updated = await prisma.messagingRegistration.update({
    where: { workspaceId: WORKSPACE_ID },
    data: patch,
  });

  await appendRegistrationEvent({
    workspaceId: WORKSPACE_ID,
    registrationId: updated.id,
    eventType: "compliance_backfill",
    message: "Production compliance fields backfilled for ws_1",
  });

  const refreshed = await messagingOnboarding.refreshStatus(WORKSPACE_ID);
  console.log(
    JSON.stringify(
      {
        registration: {
          overallStatus: refreshed.overallStatus,
          brandStatus: refreshed.brandStatus,
          brandStatusRaw: refreshed.brandStatusRaw,
          campaignStatus: refreshed.campaignStatus,
          campaignStatusRaw: refreshed.campaignStatusRaw,
          phoneE164: refreshed.phoneE164,
          phoneAttached: refreshed.phoneAttached,
          sampleMessages: refreshed.sampleMessages,
          privacyPolicyUrl: refreshed.privacyPolicyUrl,
          registrationSubmittedAt: refreshed.registrationSubmittedAt,
        },
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
