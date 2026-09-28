/**
 * Cooldown suppresses repeat recovery SMS for the same caller within the configured window.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-recovery-cooldown-eligibility.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL?.trim();

async function runDbProof(): Promise<void> {
  const { getPrisma } = await import("../src/lib/db");
  const { evaluateMissedCallTextEligibility } = await import(
    "../src/lib/agents/missed-call-text-back/eligibility"
  );
  const { updateMissedCallTextConfig } = await import(
    "../src/lib/agents/missed-call-text-back/config"
  );

  const prisma = getPrisma();
  const workspaceId = `mctb_cd_${randomUUID().slice(0, 8)}`;
  const caller = "+15555550201";
  const business = "+15555550998";

  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "MCTB cooldown eligibility test",
      slug: `mctb-cd-${randomUUID().slice(0, 8)}`,
      type: "BUSINESS",
      billingPlan: "trial",
    },
  });

  await updateMissedCallTextConfig({
    workspaceId,
    patch: {
      cooldown_minutes: 180,
      max_messages_per_caller: 1,
      trigger_rules: { no_answer: true, busy: true, rejected: true },
      enabled: true,
    },
    source: "test-mctb-recovery-cooldown-eligibility",
  });

  const baseCall = {
    workspaceId,
    callerE164: caller,
    businessE164: business,
    call: { direction: "inbound", disposition: "no-answer" },
    idempotencyKey: `cd-${randomUUID()}`,
    demoMode: true,
  };

  const first = await evaluateMissedCallTextEligibility(baseCall);
  assert.equal(first.eligible, true, "first miss should be eligible");
  assert.equal(first.reason, null);

  await prisma.missedCallEvent.create({
    data: {
      workspaceId,
      callerE164: caller,
      businessE164: business,
      reason: "NO_ANSWER",
      traceId: randomUUID(),
      idempotencyKey: `sent-${randomUUID()}`,
      status: "SENT",
      smsSentAt: new Date(),
    },
  });

  const second = await evaluateMissedCallTextEligibility({
    ...baseCall,
    idempotencyKey: `cd-${randomUUID()}`,
  });
  assert.equal(second.eligible, false, "repeat within cooldown should be suppressed");
  assert.equal(second.reason, "COOLDOWN_ACTIVE");

  await updateMissedCallTextConfig({
    workspaceId,
    patch: { cooldown_minutes: 0 },
    source: "test-mctb-recovery-cooldown-eligibility",
  });
  const afterOff = await evaluateMissedCallTextEligibility({
    ...baseCall,
    idempotencyKey: `cd-${randomUUID()}`,
  });
  assert.equal(afterOff.eligible, true, "cooldown off should allow another recovery");

  await prisma.missedCallEvent.deleteMany({ where: { workspaceId } });
  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  console.log("test-mctb-recovery-cooldown-eligibility: DB PASS");
}

async function main() {
  if (!DATABASE_URL) {
    console.log("test-mctb-recovery-cooldown-eligibility: SKIP (no DATABASE_URL)");
    return;
  }
  await runDbProof();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
