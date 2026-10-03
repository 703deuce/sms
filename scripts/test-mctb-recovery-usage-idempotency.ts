/**
 * Documents + optionally runs recovery usage idempotency semantics.
 * With DATABASE_URL: reserves twice for same missedCallEventId → used increments once.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-recovery-usage-idempotency.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MCTB_FREE_MONTHLY_RECOVERY_LIMIT } from "../src/lib/mctb/recovery-usage-constants";

const DATABASE_URL = process.env.DATABASE_URL?.trim();

async function runDbProof(): Promise<void> {
  const { getPrisma } = await import("../src/lib/db");
  const { reserveMctbRecoveryUnit, getMctbRecoveryUsageSnapshot } = await import(
    "../src/lib/mctb/recovery-usage"
  );
  const { currentMctbRecoveryPeriodKey } = await import("../src/lib/mctb/recovery-usage-constants");

  const prisma = getPrisma();
  const workspaceId = `mctb_usage_test_${randomUUID().slice(0, 8)}`;
  const eventId = randomUUID();

  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "MCTB usage idempotency test",
      slug: `mctb-usage-${randomUUID().slice(0, 8)}`,
      type: "BUSINESS",
      billingPlan: "trial",
    },
  });
  try {
    await prisma.workspaceProductFeature.create({
      data: {
        workspaceId,
        featureKey: "MCTB",
        status: "ACTIVE",
      },
    });
  } catch {
    // compat layer may omit table in some environments
  }
  const { saveMctbOnboardingState } = await import("../src/lib/mctb/onboarding/state");
  await saveMctbOnboardingState(workspaceId, {
    currentStep: "ready",
    liveTestPassedAt: new Date().toISOString(),
  });

  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: {
        mctbRecoveriesPeriodKey: currentMctbRecoveryPeriodKey(),
        mctbRecoveriesUsed: 0,
      },
    },
    update: {
      limits: {
        mctbRecoveriesPeriodKey: currentMctbRecoveryPeriodKey(),
        mctbRecoveriesUsed: 0,
      },
    },
  });
  await prisma.missedCallEvent.create({
    data: {
      id: eventId,
      workspaceId,
      callerE164: "+15555550123",
      businessE164: "+15555550999",
      reason: "NO_ANSWER",
      traceId: randomUUID(),
      idempotencyKey: `test-${randomUUID()}`,
      status: "DETECTED",
    },
  });

  for (let i = 0; i < MCTB_FREE_MONTHLY_RECOVERY_LIMIT - 1; i += 1) {
    const extraEventId = randomUUID();
    await prisma.missedCallEvent.create({
      data: {
        id: extraEventId,
        workspaceId,
        callerE164: "+15555550123",
        businessE164: "+15555550999",
        reason: "NO_ANSWER",
        traceId: randomUUID(),
        idempotencyKey: `test-${randomUUID()}`,
        status: "DETECTED",
      },
    });
    const r = await reserveMctbRecoveryUnit({
      workspaceId,
      missedCallEventId: extraEventId,
    });
    assert.equal(r.reserved, true, `recovery ${i + 1} should reserve`);
  }

  const first = await reserveMctbRecoveryUnit({
    workspaceId,
    missedCallEventId: eventId,
  });
  assert.equal(
    first.reserved,
    true,
    `${MCTB_FREE_MONTHLY_RECOVERY_LIMIT}th recovery should reserve`,
  );

  const second = await reserveMctbRecoveryUnit({
    workspaceId,
    missedCallEventId: eventId,
  });
  assert.equal(second.reserved, true, "replay should still allow send");
  assert.equal(second.reason, "idempotent_replay");

  const snap = await getMctbRecoveryUsageSnapshot(workspaceId);
  assert.equal(snap.usedInPeriod, MCTB_FREE_MONTHLY_RECOVERY_LIMIT, "only billable units consumed");

  const third = await reserveMctbRecoveryUnit({
    workspaceId,
    missedCallEventId: randomUUID(),
  });
  assert.equal(third.reserved, false, `${MCTB_FREE_MONTHLY_RECOVERY_LIMIT + 1}th distinct recovery should hit limit`);
  assert.equal(third.reason, "mctb_recovery_limit_reached");

  await prisma.missedCallEvent.deleteMany({ where: { workspaceId } });
  await prisma.workspaceLimits.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  console.log(
    `test-mctb-recovery-usage-idempotency: DB PASS (${MCTB_FREE_MONTHLY_RECOVERY_LIMIT}th ok, replay free, ${MCTB_FREE_MONTHLY_RECOVERY_LIMIT + 1}th blocked)`,
  );
}

if (!DATABASE_URL) {
  console.log(
    "test-mctb-recovery-usage-idempotency: SKIP DB (set DATABASE_URL) — limit constants verified via test-mctb-capabilities-resolver",
  );
  process.exit(0);
}

runDbProof().catch((err) => {
  console.error(err);
  process.exit(1);
});
