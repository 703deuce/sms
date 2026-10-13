/**
 * Prelaunch nuclear reset — disposable job_queue + Microsoft test calendar connections.
 * Uses node `pg` against DATABASE_URL (not Prisma compat row APIs).
 *
 * Run ONLY while workers/schedulers are stopped and Redis already flushed.
 *
 * CONFIRM=DISPOSABLE_QUEUE_NUCLEAR_RESET DRY_RUN=1 \
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 * npx tsx scripts/ar-disposable-queue-nuclear-reset.ts
 */
import pg from "pg";

const dryRun = process.env.DRY_RUN !== "0";

async function main() {
  if (process.env.CONFIRM !== "DISPOSABLE_QUEUE_NUCLEAR_RESET") {
    throw new Error("Set CONFIRM=DISPOSABLE_QUEUE_NUCLEAR_RESET");
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL required");

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const beforeJobs = await client.query(`SELECT COUNT(*)::bigint AS n FROM job_queue`);
  const beforeMs = await client.query(
    `SELECT COUNT(*)::bigint AS n FROM voice_calendar_connections WHERE provider = 'microsoft'`,
  );

  console.log(
    JSON.stringify({
      event: "nuclear_reset_start",
      dryRun,
      jobQueue: beforeJobs.rows[0]?.n,
      microsoftConnections: beforeMs.rows[0]?.n,
    }),
  );

  if (!dryRun) {
    await client.query(`DELETE FROM job_queue`);
    await client.query(`DELETE FROM voice_calendar_connections WHERE provider = 'microsoft'`);
  }

  const afterJobs = await client.query(`SELECT COUNT(*)::bigint AS n FROM job_queue`);
  const afterMs = await client.query(
    `SELECT COUNT(*)::bigint AS n FROM voice_calendar_connections WHERE provider = 'microsoft'`,
  );

  console.log(
    JSON.stringify({
      event: "nuclear_reset_complete",
      dryRun,
      jobQueue: afterJobs.rows[0]?.n,
      microsoftConnections: afterMs.rows[0]?.n,
    }),
  );

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
