/**
 * Classify actionable (pending/deferred/processing) job_queue rows — read-only.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/investigate-actionable-job-queue.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "@/lib/db";

const handlerSrc = readFileSync(join(process.cwd(), "src/lib/jobs/job-handlers.ts"), "utf8");
const REGISTERED_JOB_TYPES = new Set(
  [...handlerSrc.matchAll(/case \"([^\"]+)\"/g)].map((m) => m[1]),
);

function ageLabel(ms: number) {
  const days = ms / (24 * 60 * 60 * 1000);
  if (days >= 1) return `${Math.round(days * 10) / 10}d`;
  const hours = ms / (60 * 60 * 1000);
  if (hours >= 1) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round(ms / 60_000)}m`;
}

type ActionableClass =
  | "LEGITIMATE_ACTIONABLE"
  | "STALE_BUT_RECOVERABLE"
  | "ORPHANED_OBSOLETE"
  | "UNKNOWN";

function classifyRow(row: {
  jobType: string;
  workspaceId: string | null;
  status: string;
  runAfter: Date;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
}): { classification: ActionableClass; rationale: string } {
  const ageMs = Date.now() - row.runAfter.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (!row.workspaceId && row.jobType.includes("smoke")) {
    return {
      classification: "ORPHANED_OBSOLETE",
      rationale: "Null workspace smoke/test job type",
    };
  }

  if (ageDays > 14 && row.status === "pending" && row.attempts === 0) {
    return {
      classification: "STALE_BUT_RECOVERABLE",
      rationale: "Old pending with zero attempts — likely outbox not synced or worker backlog",
    };
  }

  if (ageDays > 60) {
    return {
      classification: "STALE_BUT_RECOVERABLE",
      rationale: "Very old actionable — investigate worker/queue routing before delete",
    };
  }

  if (row.jobType.startsWith("crm_") || row.jobType.includes("zoho")) {
    return {
      classification: ageDays > 7 ? "STALE_BUT_RECOVERABLE" : "LEGITIMATE_ACTIONABLE",
      rationale: "CRM sync/due work — may backlog when integration active",
    };
  }

  return {
    classification: ageDays > 3 ? "UNKNOWN" : "LEGITIMATE_ACTIONABLE",
    rationale: "Within normal processing window or needs manual review",
  };
}

function jobTypeRecognized(jobType: string): boolean {
  return REGISTERED_JOB_TYPES.has(jobType);
}

async function main() {
  const prisma = getPrisma();
  const now = new Date();

  const actionable = await prisma.jobQueue.findMany({
    where: { status: { in: ["pending", "deferred", "processing"] } },
    orderBy: { runAfter: "asc" },
    select: {
      id: true,
      jobType: true,
      queueName: true,
      workspaceId: true,
      status: true,
      runAfter: true,
      createdAt: true,
      attempts: true,
      maxAttempts: true,
      lastError: true,
      idempotencyKey: true,
      priority: true,
    },
  });

  const nullWs = actionable.filter((r) => r.workspaceId == null);
  const ws1 = actionable.filter((r) => r.workspaceId === "ws_1");

  const summarize = async (rows: typeof actionable, label: string) => {
    const byType: Record<string, number> = {};
    for (const r of rows) byType[r.jobType] = (byType[r.jobType] || 0) + 1;

    const oldest = rows[0];
    const samples = rows.slice(0, 25).map((r) => {
      const ageMs = now.getTime() - r.runAfter.getTime();
      const { classification, rationale } = classifyRow(r);
      const recognized = jobTypeRecognized(r.jobType);
      return {
        id: r.id,
        jobType: r.jobType,
        queueName: r.queueName,
        status: r.status,
        workspaceId: r.workspaceId,
        age: ageLabel(ageMs),
        runAfter: r.runAfter.toISOString(),
        attempts: r.attempts,
        maxAttempts: r.maxAttempts,
        lastError: r.lastError?.slice(0, 120) ?? null,
        workerRecognizesType: recognized,
        classification,
        rationale,
      };
    });

    return {
      label,
      count: rows.length,
      byJobType: byType,
      oldestAge: oldest ? ageLabel(now.getTime() - oldest.runAfter.getTime()) : null,
      oldestJobType: oldest?.jobType ?? null,
      samples,
    };
  };

  const report = {
    investigatedAt: now.toISOString(),
    totals: {
      actionable: actionable.length,
      nullWorkspace: nullWs.length,
      ws_1: ws1.length,
    },
    nullWorkspace: await summarize(nullWs, "null_workspace"),
    ws_1: await summarize(ws1, "ws_1"),
    note:
      "Do not delete from this script. STALE rows indicate runtime/backlog issues — fix workers or reclaim, not retention.",
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect().catch(() => {});
  });
