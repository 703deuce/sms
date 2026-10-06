/**
 * MCTB plan label + usage presentation.
 * Run: npx tsx scripts/test-mctb-plan-display.ts
 */
import assert from "node:assert/strict";
import {
  buildMctbPlanUsagePresentation,
  mctbCommercialPlanLabel,
  resolveMctbCommercialPlanKey,
} from "../src/lib/mctb/plan-display";

assert.equal(resolveMctbCommercialPlanKey({ recoveryPaid: false, aiRecoveryEntitled: false }), "free");
assert.equal(resolveMctbCommercialPlanKey({ recoveryPaid: true, aiRecoveryEntitled: false }), "pro");
assert.equal(resolveMctbCommercialPlanKey({ recoveryPaid: false, aiRecoveryEntitled: true }), "ai_recovery");
assert.equal(resolveMctbCommercialPlanKey({ recoveryPaid: true, aiRecoveryEntitled: true }), "ai_recovery");

assert.equal(mctbCommercialPlanLabel("free"), "Free");
assert.equal(mctbCommercialPlanLabel("pro"), "Pro");
assert.equal(mctbCommercialPlanLabel("ai_recovery"), "Pro");

const freeUsage = buildMctbPlanUsagePresentation({
  recoveryPaid: false,
  aiRecoveryEntitled: false,
  monthlyRecoveriesUsed: 3,
  monthlyRecoveryLimit: 25,
  atLimit: false,
  periodKey: "2026-09",
});
assert.equal(freeUsage.planLabel, "Free");
assert.equal(freeUsage.usageShortLabel, "3 / 25 missed calls texted");
assert.equal(freeUsage.atLimit, false);

const atLimit = buildMctbPlanUsagePresentation({
  recoveryPaid: true,
  aiRecoveryEntitled: false,
  monthlyRecoveriesUsed: 300,
  monthlyRecoveryLimit: 300,
  atLimit: true,
  periodKey: "2026-09",
});
assert.equal(atLimit.planKey, "pro");
assert.equal(atLimit.atLimit, true);
assert.match(atLimit.usageAriaLabel, /Pro plan/);

console.log("test-mctb-plan-display: ok");
