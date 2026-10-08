/**
 * Regression: AR platform SMS jobs enqueue to BullMQ queue `appointment_reminders`
 * and the SMS dispatch worker must subscribe to that queue in production.
 */
import assert from "node:assert/strict";
import { PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES } from "../src/lib/jobs/bullmq";

assert.ok(
  (PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES as readonly string[]).includes("appointment_reminders"),
  "SMS worker must consume appointment_reminders (ar_process_inbound_sms / ar_send_customer_sms)",
);

console.log("PASS test-ar-bullmq-queue-consumer");
