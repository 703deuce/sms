/**
 * Reconcile platform demo Telnyx 571 from live provider state → workspace registration.
 *
 *   npx tsx scripts/mctb-reconcile-telnyx-platform-number.ts
 *   npx tsx scripts/mctb-reconcile-telnyx-platform-number.ts --apply
 */
import { getPrisma } from "@/lib/db";
import { isMessagingReady } from "@/lib/messaging/status";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  fetchTelnyxLocalNumberProviderSnapshot,
  reconcileTelnyxLocalNumberToWorkspace,
} from "@/lib/messaging/telnyx/reconcile-local-number";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const e164 = args.includes("--e164") ? args[args.indexOf("--e164") + 1]! : MCTB_PLATFORM_DEMO_E164;

async function main() {
  console.log(`\n── Telnyx local number reconciliation: ${e164} ──\n`);

  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164 },
    select: { id: true, workspaceId: true, e164: true, providerNumberId: true },
  });
  if (!pn) {
    console.error(`❌ No PhoneNumber row for ${e164}`);
    process.exit(1);
  }

  console.log(`PhoneNumber:  ${pn.id}`);
  console.log(`Workspace:    ${pn.workspaceId}`);
  console.log(`Mode:         ${apply ? "APPLY" : "DRY RUN"}\n`);

  const snapshot = await fetchTelnyxLocalNumberProviderSnapshot(e164);
  if (!snapshot) {
    console.error("❌ Number not found in live Telnyx account");
    process.exit(1);
  }

  console.log("Live Telnyx state:");
  console.log(`  providerNumberId:     ${snapshot.providerNumberId}`);
  console.log(`  phoneStatus:          ${snapshot.phoneStatus || "—"}`);
  console.log(`  messagingProfileId:   ${snapshot.messagingProfileId || "—"}`);
  console.log(`  messagingCampaignId:  ${snapshot.messagingCampaignId || "—"}`);
  console.log(`  assignmentCampaignId: ${snapshot.assignmentCampaignId || "—"}`);
  console.log(`  assignmentStatus:     ${snapshot.assignmentStatus || "—"}`);
  console.log(`  brandId:              ${snapshot.brandId || "—"}`);
  console.log(`  brandStatus:          ${snapshot.brandStatusRaw} (approved=${snapshot.brandApproved})`);
  console.log(`  campaignId:           ${snapshot.campaignId || "—"}`);
  console.log(`  campaignStatus:       ${snapshot.campaignStatusRaw} (approved=${snapshot.campaignApproved})`);
  console.log(`  providerReady:        ${snapshot.providerReady}\n`);

  const result = await reconcileTelnyxLocalNumberToWorkspace({
    workspaceId: pn.workspaceId,
    phoneE164: e164,
    dryRun: !apply,
  });

  console.log("Transovo sync:");
  console.log(`  messagingReady before: ${result.messagingReadyBefore}`);
  console.log(`  messagingReady after:  ${result.messagingReadyAfter}`);
  console.log(`  providerReady:         ${result.providerReady}`);

  if (!apply) {
    console.log("\n📋 Would apply registration patch:");
    console.log(JSON.stringify(result.changes.registration, null, 2));
    console.log("\nRe-run with --apply to write.");
  } else {
    const auth = await isPhoneAuthorizedForOutboundSms(pn.id);
    const reg = await import("@/lib/messaging/store").then((m) =>
      m.getRegistrationByWorkspace(pn.workspaceId),
    );
    console.log(`\nPost-apply isMessagingReady: ${isMessagingReady(reg)}`);
    console.log(`Post-apply outbound auth:    ${auth.allowed} (${auth.regime})`);
    if (result.messagingReadyAfter && auth.allowed) {
      console.log("\n✅ Ready for Pass 3 on 571");
    } else {
      console.log("\n❌ Still not messaging-ready — Telnyx provider state incomplete");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
