/**
 * One-shot job claim probe for concurrency certification.
 * Usage: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/worker-claim-probe.ts <jobId>
 */
process.env.DISABLE_INPROCESS_WORKER = "1";

import { claimJobById } from "../src/lib/messaging/enqueue-advance";

async function main() {
  const jobId = process.argv[2]?.trim();
  if (!jobId) {
    console.error("jobId required");
    process.exit(2);
  }
  const claimed = await claimJobById(jobId);
  console.log(JSON.stringify({ jobId, claimed: claimed ? 1 : 0 }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
