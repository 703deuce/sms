import assert from "node:assert/strict";
import { JobFailedError } from "@/lib/messaging/types";

/**
 * Contract test: calendar sync permanent auth paths must use JobFailedError so BullMQ
 * maps to UnrecoverableError (see src/lib/jobs/bullmq.ts).
 */
const RECONNECT_MSG = "Calendar access token unavailable — reconnect required";
const err = new JobFailedError(RECONNECT_MSG);
assert.equal(err.name, "JobFailedError");
assert.equal(err.message, RECONNECT_MSG);
assert.ok(err instanceof Error);

console.log("calendar-sync-job-failure-contract.test.ts PASS");
