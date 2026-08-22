/**
 * Align platform 571 inbound runtime with a consent mode (Pass 3 certification).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-platform-consent-runtime.ts --mode existing_consent
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-platform-consent-runtime.ts --mode press_1
 */
import { normalizeMctbConsentMode } from "@/lib/mctb/consent-mode";
import { syncPlatformDemoConsentRuntime } from "@/lib/mctb/onboarding/platform-demo";
import { hasActiveSmartRoutingOnNumber } from "@/lib/smart-routing/flow-service";
import { resolvePlatformDemoOwnerWorkspaceId } from "@/lib/mctb/onboarding/platform-demo";
import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_CONSENT_MODE_LABELS } from "@/lib/mctb/consent-mode";

const args = process.argv.slice(2);
const modeArg = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "existing_consent";
const mode = normalizeMctbConsentMode(modeArg);

async function main() {
  const label = MCTB_CONSENT_MODE_LABELS[mode];
  console.log(`\n── Platform 571 consent runtime: ${label.productCode} ──\n`);

  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  const prisma = getPrisma();
  const pn = ownerId
    ? await prisma.phoneNumber.findFirst({
        where: { e164: MCTB_PLATFORM_DEMO_E164, workspaceId: ownerId },
        select: { id: true },
      })
    : null;

  const before = pn && ownerId ? await hasActiveSmartRoutingOnNumber(ownerId, pn.id) : false;
  const result = await syncPlatformDemoConsentRuntime(mode);
  const after = pn && ownerId ? await hasActiveSmartRoutingOnNumber(ownerId, pn.id) : false;

  console.log(`Mode:           ${mode} (${label.title})`);
  console.log(`Action:         ${result.action}`);
  console.log(`Smart routing:  ${before} → ${after}`);

  if (mode === "existing_consent" && after) {
    console.error("\n❌ Verified Call Consent IVR still active — baseline SMS test will be blocked");
    process.exit(1);
  }
  if (mode === "press_1" && !after) {
    console.error("\n❌ Verified Call Consent IVR not active — Press-1 test will fail");
    process.exit(1);
  }

  console.log("\n✅ Platform 571 runtime aligned for this consent mode");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
