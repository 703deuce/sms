#!/usr/bin/env npx tsx
/** Read-only production DB metadata for durability reports (no secrets in output). */
import { getPrisma } from "@/lib/db";

async function main() {
  const prisma = getPrisma();
  const [versionRow] = await prisma.$queryRaw<{ v: string }[]>`SELECT version() as v`;
  const [sizeRow] = await prisma.$queryRaw<{ db_size: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
  `;
  const counts = await prisma.$queryRaw<
    { relname: string; n_live_tup: bigint }[]
  >`
    SELECT relname, n_live_tup
    FROM pg_stat_user_tables
    WHERE relname IN (
      'Workspace','workspace','MissedCallEvent','missed_call_events',
      'Conversation','conversation','ConversationMessage','conversation_messages',
      'job_queue','JobQueue','smart_routing_sms_consent_events'
    )
    ORDER BY relname
  `.catch(() => []);

  const workspaceCount = await prisma.workspace.count();
  const missedCount = await prisma.missedCallEvent.count().catch(() => -1);
  const jobQueueCount = await prisma.jobQueue.count().catch(() => -1);

  console.log(
    JSON.stringify(
      {
        event: "production_db_meta",
        timestamp: new Date().toISOString(),
        postgresVersion: versionRow?.v?.split(" ")[0] ?? "unknown",
        databaseSize: sizeRow?.db_size ?? "unknown",
        workspaceCount,
        missedCallEventCount: missedCount,
        jobQueueCount,
        samplePgStatTables: counts,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
