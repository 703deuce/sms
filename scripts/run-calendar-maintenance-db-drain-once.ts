/**
 * One-shot: drain calendar maintenance jobs from Postgres (bypasses BullMQ).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/run-calendar-maintenance-db-drain-once.ts
 */
import { drainCalendarMaintenanceFromDb } from "@/lib/jobs/calendar-maintenance-db-drain";
import { getPrisma } from "@/lib/db";

async function main() {
  const limit = Number(process.env.LIMIT || "5");
  const drained = await drainCalendarMaintenanceFromDb(limit);
  console.log(JSON.stringify({ drained }, null, 2));

  const recent = await getPrisma().jobQueue.findMany({
    where: {
      jobType: { in: ["calendar_connections_reconcile", "calendar_subscription_renew"] },
      status: "completed",
    },
    orderBy: { completedAt: "desc" },
    take: 5,
    select: { id: true, jobType: true, completedAt: true, idempotencyKey: true },
  });
  console.log("recent_completed", recent);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
