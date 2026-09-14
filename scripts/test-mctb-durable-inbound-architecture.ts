#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const handlers = readFileSync("src/lib/messaging/telnyx/webhook-handlers.ts", "utf8");
assert.ok(handlers.includes("acceptMctbInboundSmsIngress"));
assert.ok(!handlers.includes("await handleMctbCustomerSmsReply"));
assert.ok(handlers.includes("durable job") || handlers.includes("Lead Recovery runs on durable"));

const jobHandlers = readFileSync("src/lib/jobs/job-handlers.ts", "utf8");
assert.ok(jobHandlers.includes('case "mctb_process_inbound_sms"'));
assert.ok(jobHandlers.includes('case "mctb_send_customer_sms"'));

const ingress = readFileSync("src/lib/mctb/messaging/inbound-sms-ingress.ts", "utf8");
assert.ok(ingress.includes("MCTB_JOB_PROCESS_INBOUND_SMS"));
assert.ok(ingress.includes("jobQueue.create"));
assert.ok(ingress.includes("$transaction"));

const customerSms = readFileSync("src/lib/agents/missed-call-text-back/customer-sms.ts", "utf8");
assert.ok(customerSms.includes('outboundDelivery === "durable"'));
assert.ok(customerSms.includes("enqueueMctbCustomerOutboundSmsJob"));

const lock = readFileSync("src/lib/mctb/lead-recovery/cross-worker-lock.ts", "utf8");
assert.ok(!lock.includes("pg_advisory_xact_lock"));

console.log("test-mctb-durable-inbound-architecture: ok");
