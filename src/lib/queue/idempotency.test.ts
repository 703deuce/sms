import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canReuseExistingJob } from "@/lib/queue/idempotency";
import type { QueueJobRecord } from "@/lib/queue/types";

function job(partial: Partial<QueueJobRecord>): QueueJobRecord {
  return {
    id: "j1",
    queueName: "maintenance",
    jobType: "growth_audit_run",
    payload: {},
    status: "pending",
    enqueueState: "enqueued",
    organizationId: "org",
    businessId: "biz",
    priority: 50,
    attempts: 0,
    maxAttempts: 3,
    progress: {},
    errorMessage: null,
    scheduledAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    heartbeatAt: null,
    ...partial,
  };
}

describe("idempotent job reuse", () => {
  it("reuses pending/running enqueued jobs", () => {
    assert.equal(canReuseExistingJob(job({ status: "pending", enqueueState: "enqueued" })), true);
    assert.equal(canReuseExistingJob(job({ status: "running", enqueueState: "enqueued" })), true);
  });

  it("rejects canceled, failed, enqueue_failed, and half-created rows", () => {
    assert.equal(canReuseExistingJob(job({ status: "canceled", enqueueState: "enqueued" })), false);
    assert.equal(canReuseExistingJob(job({ status: "failed", enqueueState: "enqueued" })), false);
    assert.equal(canReuseExistingJob(job({ status: "completed", enqueueState: "enqueued" })), false);
    assert.equal(
      canReuseExistingJob(job({ status: "pending", enqueueState: "enqueue_failed" })),
      false
    );
    assert.equal(canReuseExistingJob(job({ status: "pending", enqueueState: "pending" })), false);
  });
});

describe("job deferred error", () => {
  it("marks deferred errors distinctly from permanent failures", async () => {
    const { JobDeferredError, isDeferredError } = await import("@/lib/queue/errors");
    const { isPermanentError, isDeferredError: deferredFromProcessors } = await import(
      "@/lib/queue/processors"
    );
    const deferred = new JobDeferredError("wait", 7_000);
    assert.equal(isDeferredError(deferred), true);
    assert.equal(deferredFromProcessors(deferred), true);
    assert.equal(deferred.delayMs, 7_000);
    assert.equal(isPermanentError(deferred), false);
  });
});
