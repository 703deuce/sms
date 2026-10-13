import assert from "node:assert/strict";
import { bullmqOutboxShouldAlignPostgresTerminal } from "./bullmq-outbox-recovery";

assert.equal(bullmqOutboxShouldAlignPostgresTerminal("completed"), "completed");
assert.equal(bullmqOutboxShouldAlignPostgresTerminal("failed"), "failed");
assert.equal(bullmqOutboxShouldAlignPostgresTerminal("active"), null);
assert.equal(bullmqOutboxShouldAlignPostgresTerminal("waiting"), null);
assert.equal(bullmqOutboxShouldAlignPostgresTerminal("delayed"), null);
assert.equal(bullmqOutboxShouldAlignPostgresTerminal(null), null);

console.log("bullmq-outbox-recovery.test.ts PASS");
