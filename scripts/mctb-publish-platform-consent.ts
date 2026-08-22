/**
 * Publish Verified Call Consent smart routing on platform Telnyx 571.
 * Run before Pass 3 live certification (real Press-1 DTMF).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-publish-platform-consent.ts
 */
import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { publishPlatformDemoMctbConsent } from "@/lib/mctb/consent-prompt/service";
import { hasActiveSmartRoutingOnNumber } from "@/lib/smart-routing/flow-service";
import { resolvePlatformDemoOwnerWorkspaceId } from "@/lib/mctb/onboarding/platform-demo";

async function main() {
  console.log("\n── Publish platform 571 Verified Call Consent ──\n");

  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  if (!ownerId) {
    console.error("❌ Platform owner workspace not found");
    process.exit(1);
  }

  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: MCTB_PLATFORM_DEMO_E164 },
    select: { id: true },
  });
  if (!pn) {
    console.error(`❌ PhoneNumber missing for ${MCTB_PLATFORM_DEMO_E164}`);
    process.exit(1);
  }

  const before = await hasActiveSmartRoutingOnNumber(ownerId, pn.id);
  console.log(`Owner workspace: ${ownerId}`);
  console.log(`Platform phone:  ${pn.id}`);
  console.log(`Smart routing before: ${before}\n`);

  const result = await publishPlatformDemoMctbConsent();
  const after = await hasActiveSmartRoutingOnNumber(ownerId, pn.id);

  console.log("Published consent prompt:");
  console.log(`  flowId:       ${result.flowId}`);
  console.log(`  publishedAt:  ${result.publishedAt}`);
  console.log(`  audioAssetId: ${result.publishedAudioAssetId}`);
  console.log(`\nSmart routing after: ${after}`);

  if (after) {
    console.log("\n✅ Platform 571 consent flow active — ready for Pass 3 Press-1");
  } else {
    console.error("\n❌ Smart routing still inactive after publish");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
