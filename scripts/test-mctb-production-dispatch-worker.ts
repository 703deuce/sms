#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bullmq = readFileSync("src/lib/jobs/bullmq.ts", "utf8");
assert.ok(bullmq.includes('MCTB_DISPATCH_BULLMQ_QUEUES = ["mctb", "automations"]'));
assert.ok(bullmq.includes("PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES"));
assert.ok(bullmq.includes("wakeDurableJobQueueRowToBullmq"));
assert.ok(bullmq.includes("priority: { lte: JOB_PRIORITY_INTERACTIVE_MAX }"));

const ingress = readFileSync("src/lib/mctb/messaging/inbound-sms-ingress.ts", "utf8");
assert.ok(ingress.includes("wakeDurableJobQueueRowToBullmq"));

const worker = readFileSync("scripts/worker-sms.ts", "utf8");
assert.ok(worker.includes("mctb-interactive"));
assert.ok(worker.includes("getMctbDispatchBullmqStatus"));

console.log("test-mctb-production-dispatch-worker: ok");
