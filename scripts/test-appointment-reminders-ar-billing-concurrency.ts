/**
 * AR SMS billing: concurrent reserve, idempotent replay, release, period reset.
 * Requires DATABASE_URL. Creates and deletes an isolated test workspace.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-appointment-reminders-ar-billing-concurrency.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import {
  LIMITS_OVERRIDE_KEY,
  USAGE_PERIOD_KEY,
  USAGE_USED,
  currentArSmsUsagePeriodKey,
} from "@/lib/appointment-reminders/ar-sms-usage-constants";
import {
  getArSmsUsageSnapshot,
  releaseArReminderSmsReservation,
  reserveArReminderSmsUnit,
} from "@/lib/appointment-reminders/ar-sms-usage";

const LIMIT = 10;

async function main() {
  const { isSupabaseConfigured } = await import("@/lib/supabase/admin");
  const { hydrateProdTestEnvFromCoolify } = await import("./cloud-agent/hydrate-prod-test-env");
  hydrateProdTestEnvFromCoolify();
  if (!process.env.DATABASE_URL && !isSupabaseConfigured()) {
    console.log(
      "SKIP test-appointment-reminders-ar-billing-concurrency — DATABASE_URL / Supabase not configured",
    );
    return;
  }

  const prisma = getPrisma();
  const slug = `ar-billing-test-${randomBytes(6).toString("hex")}`;
  const ws = await prisma.workspace.create({
    data: { name: "AR Billing Test", slug, billingPlan: "trial" },
  });

  try {
    await prisma.workspaceLimits.create({
      data: {
        workspaceId: ws.id,
        limits: {
          arSmsMeteringEnabled: true,
          [LIMITS_OVERRIDE_KEY]: LIMIT,
          [USAGE_PERIOD_KEY]: currentArSmsUsagePeriodKey(),
          [USAGE_USED]: 0,
        },
      },
    });

    const appointmentIds: string[] = [];
    for (let i = 0; i < 15; i++) {
      const row = await prisma.voiceAppointment.create({
        data: {
          workspaceId: ws.id,
          startsAt: new Date(Date.now() + 86400000),
          status: "confirmed",
          metadata: {},
        },
      });
      appointmentIds.push(row.id);
    }

    const results = await Promise.all(
      appointmentIds.map((appointmentId, i) =>
        reserveArReminderSmsUnit({
          workspaceId: ws.id,
          appointmentId,
          timelineType: `reminder_${i}_sent`,
        }),
      ),
    );

    const reserved = results.filter((r) => r.reserved).length;
    const denied = results.filter((r) => !r.reserved).length;
    assert.equal(reserved, LIMIT, `expected ${LIMIT} reservations, got ${reserved}`);
    assert.equal(denied, 5, `expected 5 denials, got ${denied}`);

    const snap = await getArSmsUsageSnapshot(ws.id);
    assert.equal(snap.usedInPeriod, LIMIT);
    assert.equal(snap.atLimit, true);

    const replay = await reserveArReminderSmsUnit({
      workspaceId: ws.id,
      appointmentId: appointmentIds[0],
      timelineType: "reminder_0_sent",
    });
    assert.equal(replay.reason, "idempotent_replay");
    assert.equal(replay.reserved, true);
    const snap2 = await getArSmsUsageSnapshot(ws.id);
    assert.equal(snap2.usedInPeriod, LIMIT, "idempotent replay must not double-count");

    await releaseArReminderSmsReservation({
      workspaceId: ws.id,
      appointmentId: appointmentIds[0],
      timelineType: "reminder_0_sent",
    });
    const snap3 = await getArSmsUsageSnapshot(ws.id);
    assert.equal(snap3.usedInPeriod, LIMIT - 1);

    const extraAppt = await prisma.voiceAppointment.create({
      data: {
        workspaceId: ws.id,
        startsAt: new Date(Date.now() + 86400000),
        status: "confirmed",
        metadata: {},
      },
    });
    const afterRelease = await reserveArReminderSmsUnit({
      workspaceId: ws.id,
      appointmentId: extraAppt.id,
      timelineType: "confirmation_sent",
    });
    assert.equal(afterRelease.reserved, true);

    const prevPeriod = "2020-01";
    await prisma.workspaceLimits.update({
      where: { workspaceId: ws.id },
      data: {
        limits: {
          arSmsMeteringEnabled: true,
          [LIMITS_OVERRIDE_KEY]: LIMIT,
          [USAGE_PERIOD_KEY]: prevPeriod,
          [USAGE_USED]: 99,
        },
      },
    });
    const periodAppt = await prisma.voiceAppointment.create({
      data: {
        workspaceId: ws.id,
        startsAt: new Date(Date.now() + 86400000),
        status: "confirmed",
        metadata: {},
      },
    });
    const afterPeriod = await reserveArReminderSmsUnit({
      workspaceId: ws.id,
      appointmentId: periodAppt.id,
      timelineType: "reminder_99_sent",
    });
    assert.equal(afterPeriod.reserved, true);
    assert.equal(afterPeriod.used, 1, "new billing period must reset counter before reserve");

    console.log("PASS test-appointment-reminders-ar-billing-concurrency");
  } finally {
    await prisma.voiceAppointment.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspaceLimits.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspace.delete({ where: { id: ws.id } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
