/**
 * Reminders log JSONB pagination accuracy (isolated workspace).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-appointment-reminders-log-pagination.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { loadRemindersLogPage } from "@/lib/appointment-reminders/reminders-log-query";

async function main() {
  const {
    requireIsolatedArTestDatabase,
    ArTestDatabaseSkip,
  } = await import("./cloud-agent/ar-test-database-guard");
  try {
    requireIsolatedArTestDatabase();
  } catch (err) {
    if (err instanceof ArTestDatabaseSkip) {
      console.log(`SKIP test-appointment-reminders-log-pagination — ${err.message}`);
      return;
    }
    throw err;
  }

  const prisma = getPrisma();
  const slug = `ar-log-test-${randomBytes(6).toString("hex")}`;
  const ws = await prisma.workspace.create({
    data: { name: "AR Log Test", slug },
  });

  try {
    const events: Array<{ type: string; at: string; label: string }> = [];
    for (let i = 0; i < 30; i++) {
      events.push({
        type: i % 3 === 0 ? "confirmation_sent" : `reminder_${60 * (i + 1)}m_sent`,
        at: new Date(Date.now() - i * 3600000).toISOString(),
        label: `Event ${i}`,
      });
    }

    for (let a = 0; a < 12; a++) {
      await prisma.voiceAppointment.create({
        data: {
          workspaceId: ws.id,
          serviceName: `Service ${a}`,
          startsAt: new Date(Date.now() + 86400000 * (a + 1)),
          status: "confirmed",
          metadata: {
            inviteeName: `Customer ${a}`,
            timeline: events.slice(a, a + 5),
          },
        },
      });
    }

    const page1 = await loadRemindersLogPage({
      workspaceId: ws.id,
      horizon: "past",
      page: 1,
      pageSize: 10,
    });
    const page2 = await loadRemindersLogPage({
      workspaceId: ws.id,
      horizon: "past",
      page: 2,
      pageSize: 10,
    });

    assert.ok(page1.total >= 30, `expected total >= 30, got ${page1.total}`);
    assert.equal(page1.rows.length, 10);
    const ids = new Set([...page1.rows, ...page2.rows].map((r) => r.id));
    assert.equal(ids.size, page1.rows.length + page2.rows.length, "no duplicate row ids across pages");

    const failed = page1.rows.find((r) => r.status === "failed");
    await prisma.voiceAppointment.create({
      data: {
        workspaceId: ws.id,
        serviceName: "Fail svc",
        startsAt: new Date(Date.now() + 86400000),
        status: "confirmed",
        metadata: {
          timeline: [
            {
              type: "reminder_60m_failed",
              at: new Date().toISOString(),
              label: "Failed send",
              detail: "provider",
            },
          ],
        },
      },
    });
    const withFailed = await loadRemindersLogPage({
      workspaceId: ws.id,
      horizon: "past",
      status: "failed",
      page: 1,
      pageSize: 50,
    });
    assert.ok(
      withFailed.rows.some((r) => r.status === "failed"),
      "failed filter must return failed timeline events",
    );

    console.log("PASS test-appointment-reminders-log-pagination");
  } finally {
    await prisma.voiceAppointment.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspace.delete({ where: { id: ws.id } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
