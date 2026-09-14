#!/usr/bin/env npx tsx
/**
 * List recent MCTB BullMQ / DB jobs that may be stranded after worker crashes.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/audit-stuck-mctb-bullmq-jobs.ts
 */
import { getPrisma } from "../src/lib/db";

const TYPES = ["mctb_process_inbound_sms", "mctb_send_customer_sms"] as const;

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 48 * 3600_000);
  const jobs = await prisma.job.findMany({
    where: {
      type: { in: [...TYPES] },
      createdAt: { gte: since },
      status: { in: ["pending", "running", "failed"] },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      lastError: true,
      runAfter: true,
      lockedAt: true,
      lockedBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(`Stuck / recent MCTB jobs (since ${since.toISOString()}): ${jobs.length}\n`);
  for (const j of jobs) {
    console.log(JSON.stringify(j));
  }
}

main();
