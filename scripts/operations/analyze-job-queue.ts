#!/usr/bin/env npx tsx
import { getPrisma } from "@/lib/db";

async function main() {
  const prisma = getPrisma();
  const status = await prisma.$queryRaw<{ status: string; n: number }[]>`
    SELECT status::text, count(*)::int as n FROM job_queue GROUP BY 1 ORDER BY n DESC
  `;
  const pending = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int as n FROM job_queue WHERE status::text IN ('pending','deferred','running')
  `;
  const ws1pending = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int as n FROM job_queue WHERE workspace_id = 'ws_1' AND status::text IN ('pending','deferred','running')
  `;
  const byType = await prisma.$queryRaw<{ job_type: string; n: number }[]>`
    SELECT job_type, count(*)::int as n FROM job_queue GROUP BY 1 ORDER BY n DESC LIMIT 30
  `;
  const prefixes = await prisma.$queryRaw<{ p: string; n: number }[]>`
    SELECT split_part(idempotency_key, ':', 1) as p, count(*)::int as n
    FROM job_queue WHERE idempotency_key IS NOT NULL
    GROUP BY 1 ORDER BY n DESC LIMIT 30
  `;
  const oldCompletedNull = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int as n FROM job_queue
    WHERE workspace_id IS NULL AND status::text = 'completed'
      AND completed_at < NOW() - INTERVAL '7 days'
  `;
  const crmPrefix = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int as n FROM job_queue WHERE idempotency_key LIKE 'crm-%'
  `;
  const benchPrefix = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int as n FROM job_queue WHERE idempotency_key LIKE 'mctb-bench%' OR idempotency_key LIKE 'bullmq-hardening%'
  `;
  console.log(
    JSON.stringify(
      {
        status,
        pending: pending[0]?.n,
        ws1Pending: ws1pending[0]?.n,
        byType,
        prefixes,
        oldCompletedNullWs: oldCompletedNull[0]?.n,
        crmJobs: crmPrefix[0]?.n,
        benchJobs: benchPrefix[0]?.n,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
