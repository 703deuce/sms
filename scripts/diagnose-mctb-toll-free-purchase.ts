/**
 * Read-only diagnostic: MCTB toll-free ingress pool + Telnyx search (no purchase).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diagnose-mctb-toll-free-purchase.ts
 */
import { listTelnyxTollFreeIngressCandidates } from "../src/lib/mctb/provisioning/telnyx-toll-free-ingress-pool";
import { telnyxProvider } from "../src/lib/messaging/telnyx/provider";
import { assertCanPurchaseNumber } from "../src/lib/numbers/acquire-guard";
import {
  isNorthAmericaTollFreeE164,
  isPreferredMctbIngressTollFreeE164,
} from "../src/lib/mctb/provisioning/telnyx-toll-free-ingress-pool";
import { MCTB_TRIAL_TOLL_FREE_AREA_CODES } from "../src/lib/mctb/onboarding/constants";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";

async function main() {
  const pool = await listTelnyxTollFreeIngressCandidates(WORKSPACE_ID);
  const assignable = pool.filter((p) => p.assignable);
  console.log("LOCAL_ELIGIBLE_POOL", assignable.length);

  const npaSummary: Record<string, { total: number; preferred: number; anyTollFree: number }> =
    {};
  for (const npa of MCTB_TRIAL_TOLL_FREE_AREA_CODES) {
    try {
      const results = await telnyxProvider.searchNumbers(npa);
      npaSummary[npa] = {
        total: results.length,
        preferred: results.filter((n) => isPreferredMctbIngressTollFreeE164(n.phoneNumber))
          .length,
        anyTollFree: results.filter((n) => isNorthAmericaTollFreeE164(n.phoneNumber)).length,
      };
    } catch (err) {
      npaSummary[npa] = { total: -1, preferred: 0, anyTollFree: 0 };
      console.warn("TELNYX_SEARCH_ERROR", npa, err instanceof Error ? err.message : err);
    }
  }
  console.log("TELNYX_TFN_SEARCH_BY_NPA", JSON.stringify(npaSummary, null, 2));

  const standardGuard = await assertCanPurchaseNumber(WORKSPACE_ID, { source: "standard" });
  const premiumGuard = await assertCanPurchaseNumber(WORKSPACE_ID, { source: "premium" });
  console.log("ACQUIRE_GUARD_STANDARD", standardGuard);
  console.log("ACQUIRE_GUARD_PREMIUM", premiumGuard);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
