/**
 * Read-only: DB actionable groups for ws_1 + BullMQ depths for CRM/integration queues.
 */
import { getPrisma } from "@/lib/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const QUEUES = [
  "crm-zoho",
  "crm-pipedrive",
  "crm-salesforce",
  "ext-internal",
  "integrations",
  "automations",
  "sms-send",
  "default",
  "review-campaign",
];

async function main() {
  const p = getPrisma();
  const crm = await p.jobQueue.groupBy({
    by: ["jobType", "queueName"],
    where: { workspaceId: "ws_1", status: { in: ["pending", "deferred"] } },
    _count: true,
    _min: { runAfter: true, attempts: true },
    _max: { attempts: true },
  });
  console.log(JSON.stringify({ ws1DbGroups: crm }, null, 2));

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    console.log(JSON.stringify({ bullmq: "REDIS_URL missing" }));
    return;
  }
  const conn = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
  const depths: Record<string, unknown> = {};
  for (const q of QUEUES) {
    const queue = new Queue(q, { connection: conn });
    depths[q] = await queue.getJobCounts("waiting", "active", "delayed", "failed");
    await queue.close();
  }
  console.log(JSON.stringify({ bullmqDepths: depths }, null, 2));
  await conn.quit();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect().catch(() => {});
  });
