/**
 * Grouped actionable job_queue triage + optional snapshot file for delta comparison.
 *
 * SNAPSHOT_OUT=/path/to.json NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/operations/actionable-job-queue-triage.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "@/lib/db";

const handlerSrc = readFileSync(join(process.cwd(), "src/lib/jobs/job-handlers.ts"), "utf8");
const REGISTERED = new Set([...handlerSrc.matchAll(/case \"([^\"]+)\"/g)].map((m) => m[1]));

type Row = {
  id: string;
  jobType: string;
  queueName: string;
  workspaceId: string | null;
  status: string;
  runAfter: Date;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedAt: Date | null;
  priority: number;
  payload: unknown;
};

function ageMs(now: number, d: Date) {
  return now - d.getTime();
}

function summarizePayloadWorkspace(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const w = (payload as Record<string, unknown>).workspaceId;
  return typeof w === "string" && w.trim() ? w.trim() : null;
}

async function main() {
  const prisma = getPrisma();
  const now = Date.now();
  const probedAt = new Date(now).toISOString();

  const actionable = await prisma.jobQueue.findMany({
    where: { status: { in: ["pending", "deferred", "processing"] } },
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
      lockedAt: true,
      priority: true,
      payload: true,
    },
  });

  type GroupKey = string;
  const groups = new Map<
    GroupKey,
    {
      jobType: string;
      status: string;
      workspaceId: string | null;
      queueName: string;
      count: number;
      oldestRunAfter: Date;
      newestRunAfter: Date;
      minAttempts: number;
      maxAttempts: number;
      sampleLastErrors: string[];
      payloadWorkspaceMismatch: number;
      recognized: boolean;
      priorities: number[];
    }
  >();

  for (const row of actionable as Row[]) {
    const key = `${row.jobType}|${row.status}|${row.workspaceId ?? "NULL"}|${row.queueName}`;
    const g = groups.get(key) ?? {
      jobType: row.jobType,
      status: row.status,
      workspaceId: row.workspaceId,
      queueName: row.queueName,
      count: 0,
      oldestRunAfter: row.runAfter,
      newestRunAfter: row.runAfter,
      minAttempts: row.attempts,
      maxAttempts: row.attempts,
      sampleLastErrors: [],
      payloadWorkspaceMismatch: 0,
      recognized: REGISTERED.has(row.jobType),
      priorities: [],
    };
    g.count += 1;
    if (row.runAfter < g.oldestRunAfter) g.oldestRunAfter = row.runAfter;
    if (row.runAfter > g.newestRunAfter) g.newestRunAfter = row.runAfter;
    g.minAttempts = Math.min(g.minAttempts, row.attempts);
    g.maxAttempts = Math.max(g.maxAttempts, row.attempts);
    g.priorities.push(row.priority);
    if (row.lastError && g.sampleLastErrors.length < 3 && !g.sampleLastErrors.includes(row.lastError)) {
      g.sampleLastErrors.push(row.lastError.slice(0, 160));
    }
    const pw = summarizePayloadWorkspace(row.payload);
    if (!row.workspaceId && pw) g.payloadWorkspaceMismatch += 1;
    groups.set(key, g);
  }

  const grouped = [...groups.values()]
    .map((g) => ({
      ...g,
      oldestAgeDays: Math.round((ageMs(now, g.oldestRunAfter) / 86400000) * 10) / 10,
      newestAgeDays: Math.round((ageMs(now, g.newestRunAfter) / 86400000) * 10) / 10,
      avgPriority: Math.round(g.priorities.reduce((a, b) => a + b, 0) / g.priorities.length),
    }))
    .sort((a, b) => b.count - a.count);

  const oldest = actionable.reduce<Row | null>((best, row) => {
    if (!best || row.runAfter < best.runAfter) return row as Row;
    return best;
  }, null);

  const snapshot = {
    probedAt,
    totals: {
      actionable: actionable.length,
      nullWorkspace: actionable.filter((r) => r.workspaceId == null).length,
      ws_1: actionable.filter((r) => r.workspaceId === "ws_1").length,
      processing: actionable.filter((r) => r.status === "processing").length,
    },
    oldestActionable: oldest
      ? {
          id: oldest.id,
          jobType: oldest.jobType,
          workspaceId: oldest.workspaceId,
          queueName: oldest.queueName,
          status: oldest.status,
          ageDays: Math.round((ageMs(now, oldest.runAfter) / 86400000) * 10) / 10,
          attempts: oldest.attempts,
          lastError: oldest.lastError?.slice(0, 200) ?? null,
        }
      : null,
    groups: grouped.slice(0, 80),
  };

  const out = process.env.SNAPSHOT_OUT?.trim();
  if (out) writeFileSync(out, JSON.stringify(snapshot, null, 2));

  console.log(JSON.stringify(snapshot, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect().catch(() => {});
  });
