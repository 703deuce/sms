#!/usr/bin/env npx tsx
/**
 * Read-only inventory for production test-data cleanup classification.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/inventory-production-test-data.ts
 */
import { getPrisma } from "@/lib/db";

const PRESERVE_WORKSPACE_ID = process.env.PRESERVE_WORKSPACE_ID?.trim() || "ws_1";

const TEST_NAME_RE =
  /cert|smoke|test|fixture|synthetic|benchmark|load|integration|e2e|example|temp|bench|adversarial|hermetic|isolated|dummy|fake/i;

type Classification = "PRESERVE_REAL" | "TEST_DISPOSABLE" | "SYSTEM_SHARED" | "UNKNOWN";

function classifyWorkspace(row: {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}): Classification {
  if (row.id === PRESERVE_WORKSPACE_ID) return "PRESERVE_REAL";
  const blob = `${row.id} ${row.name} ${row.slug}`;
  if (TEST_NAME_RE.test(blob)) return "TEST_DISPOSABLE";
  if (row.id.startsWith("mctb_") || row.id.startsWith("cert_") || row.slug.includes("bench"))
    return "TEST_DISPOSABLE";
  return "UNKNOWN";
}

async function main() {
  const prisma = getPrisma();

  const [dbSize] = await prisma.$queryRaw<{ db_size: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
  `;

  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, slug: true, createdAt: true, type: true },
    orderBy: { createdAt: "asc" },
  });

  const wsRows = [];
  for (const w of workspaces) {
    const classification = classifyWorkspace(w);
    const [
      missed,
      convos,
      msgs,
      consent,
      jobs,
      contacts,
      phoneNumbers,
      members,
    ] = await Promise.all([
      prisma.missedCallEvent.count({ where: { workspaceId: w.id } }),
      prisma.conversation.count({ where: { workspaceId: w.id } }),
      prisma.conversationMessage.count({
        where: { conversation: { workspaceId: w.id } },
      }),
      prisma.smartRoutingSmsConsentEvent.count({ where: { workspaceId: w.id } }),
      prisma.jobQueue.count({ where: { workspaceId: w.id } }),
      prisma.contact.count({ where: { workspaceId: w.id } }),
      prisma.phoneNumber.count({ where: { workspaceId: w.id } }),
      prisma.membership.count({ where: { workspaceId: w.id } }),
    ]);
    wsRows.push({
      workspaceId: w.id,
      name: w.name,
      slug: w.slug,
      type: w.type,
      createdAt: w.createdAt.toISOString(),
      users: members,
      phoneNumbers,
      missedCalls: missed,
      conversations: convos,
      messages: msgs,
      consent,
      jobQueue: jobs,
      contacts,
      classification,
    });
  }

  const jobTotal = await prisma.jobQueue.count();
  const jobByStatus = await prisma.jobQueue.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const jobNullWs = await prisma.jobQueue.count({ where: { workspaceId: null } });
  const jobWs1 = await prisma.jobQueue.count({ where: { workspaceId: PRESERVE_WORKSPACE_ID } });

  const jobByType = await prisma.$queryRaw<{ job_type: string; n: bigint }[]>`
    SELECT job_type, count(*)::bigint as n
    FROM job_queue
    GROUP BY job_type
    ORDER BY n DESC
    LIMIT 40
  `;

  const jobByWsTop = await prisma.$queryRaw<{ workspace_id: string | null; n: bigint }[]>`
    SELECT workspace_id, count(*)::bigint as n
    FROM job_queue
    GROUP BY workspace_id
    ORDER BY n DESC
    LIMIT 20
  `;

  const idempotencyPatterns = await prisma.$queryRaw<{ prefix: string; n: bigint }[]>`
    SELECT split_part(idempotency_key, ':', 1) as prefix, count(*)::bigint as n
    FROM job_queue
    WHERE idempotency_key IS NOT NULL
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 30
  `;

  console.log(
    JSON.stringify(
      {
        event: "production_test_data_inventory",
        timestamp: new Date().toISOString(),
        preserveWorkspaceId: PRESERVE_WORKSPACE_ID,
        databaseSize: dbSize?.db_size,
        workspaceCount: workspaces.length,
        workspaces: wsRows,
        jobQueue: {
          total: jobTotal,
          ws1: jobWs1,
          nullWorkspace: jobNullWs,
          byStatus: jobByStatus.map((r) => ({
            status: r.status,
            count: r._count._all,
          })),
          byTypeTop: jobByType.map((r) => ({
            jobType: r.job_type,
            count: Number(r.n),
          })),
          byWorkspaceTop: jobByWsTop.map((r) => ({
            workspaceId: r.workspace_id,
            count: Number(r.n),
          })),
          idempotencyPrefixTop: idempotencyPatterns.map((r) => ({
            prefix: r.prefix,
            count: Number(r.n),
          })),
        },
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
