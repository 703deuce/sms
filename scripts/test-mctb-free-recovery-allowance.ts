/**
 * Free MCTB plan must expose 10 monthly recoveries (not SMS credits / not 0).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-free-recovery-allowance.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL?.trim();

async function main() {
  const { MCTB_FREE_MONTHLY_RECOVERY_LIMIT } = await import(
    "../src/lib/mctb/recovery-usage-constants.js"
  );

  if (!DATABASE_URL) {
    const { resolveMctbMonthlyRecoveryLimit } = await import(
      "../src/lib/mctb/recovery-usage-constants"
    );
    assert.equal(
      resolveMctbMonthlyRecoveryLimit({
        mctbProductActive: true,
        recoveryPaid: false,
        paidTier: null,
      }),
      MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
    );
    console.log("test-mctb-free-recovery-allowance: SKIP DB — constants OK");
    return;
  }

  const { resolveMctbCommercialEntitlements } = await import(
    "../src/lib/mctb/commercial-entitlements.js"
  );
  const { getMctbRecoveryUsageSnapshot } = await import("../src/lib/mctb/recovery-usage.js");
  const { getPrisma } = await import("../src/lib/db.js");
  const prisma = getPrisma();
  const workspaceId = `mctb_free_allow_${randomUUID().slice(0, 8)}`;

  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "MCTB free allowance test",
      slug: `mctb-free-${randomUUID().slice(0, 8)}`,
      type: "PERSONAL",
      billingPlan: "free",
      customFieldsConfig: {
        mctbOnboarding: { version: 2, currentStep: "complete", completedSteps: ["ready"] },
      },
    },
  });

  try {
    const commercial = await resolveMctbCommercialEntitlements(workspaceId);
    assert.equal(commercial.mctbProductActive, true, "personal + mctb onboarding must count as MCTB");

    const snap = await getMctbRecoveryUsageSnapshot(workspaceId);
    assert.equal(snap.limit, MCTB_FREE_MONTHLY_RECOVERY_LIMIT);
    assert.equal(snap.atLimit, false);
    assert.equal(snap.usedInPeriod, 0);
  } finally {
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
  }

  console.log("test-mctb-free-recovery-allowance: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
