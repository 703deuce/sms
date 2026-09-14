/**
 * Regression: all production dispatch queues must count toward boot readiness (incl. mctb + automations).
 */
import {
  MCTB_DISPATCH_BULLMQ_QUEUES,
  PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES,
  SMS_DISPATCH_BULLMQ_QUEUES,
} from "../src/lib/jobs/bullmq";

const smsOnly = new Set<string>(SMS_DISPATCH_BULLMQ_QUEUES);
const missing = PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES.filter((q) => !smsOnly.has(q));

if (missing.length < 2) {
  throw new Error("expected mctb + automations in production queue list");
}
for (const q of MCTB_DISPATCH_BULLMQ_QUEUES) {
  if (!PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES.includes(q)) {
    throw new Error(`missing ${q} from PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES`);
  }
}

console.log("test-bullmq-worker-readiness-set: ok", {
  production: [...PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES],
});
