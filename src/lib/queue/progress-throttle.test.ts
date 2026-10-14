import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  flushJobProgress,
  resetProgressThrottleForTests,
  scheduleJobProgressWrite,
  shouldFlushProgress,
} from "@/lib/queue/progress-throttle";

describe("job progress throttle", () => {
  beforeEach(() => {
    resetProgressThrottleForTests();
  });

  it("flushes on force, 100%, time, unit step, or percent step", () => {
    const base = {
      lastFlushAt: Date.now(),
      lastFlushedCompleted: 0,
      lastFlushedPercent: 0,
    };
    assert.equal(shouldFlushProgress({ ...base, force: true }), true);
    assert.equal(
      shouldFlushProgress({
        ...base,
        counters: { completed: 49, total: 49 },
      }),
      true
    );
    assert.equal(
      shouldFlushProgress({
        ...base,
        lastFlushAt: Date.now() - 2_000,
        counters: { completed: 1, total: 49 },
      }),
      true
    );
    assert.equal(
      shouldFlushProgress({
        ...base,
        counters: { completed: 5, total: 100 },
      }),
      true
    );
    assert.equal(
      shouldFlushProgress({
        ...base,
        lastFlushedCompleted: 10,
        lastFlushedPercent: 10,
        counters: { completed: 14, total: 100 },
      }),
      false
    );
    assert.equal(
      shouldFlushProgress({
        ...base,
        lastFlushedCompleted: 10,
        lastFlushedPercent: 10,
        counters: { completed: 15, total: 100 },
      }),
      true
    );
  });

  it("coalesces rapid writes and bumps a monotonic version only on flush", async () => {
    const writes: Array<{ completed?: number; version: number }> = [];
    const writer = async (payload: {
      progress: Record<string, unknown>;
      counters?: { completed?: number; total?: number };
      version: number;
    }) => {
      writes.push({ completed: payload.counters?.completed, version: payload.version });
    };

    const a = await scheduleJobProgressWrite(
      "job-1",
      { progress: { percent: 2 }, counters: { completed: 1, total: 49 } },
      writer
    );
    assert.equal(a.flushed, false);
    assert.equal(writes.length, 0);

    const b = await scheduleJobProgressWrite(
      "job-1",
      { progress: { percent: 10 }, counters: { completed: 5, total: 49 } },
      writer
    );
    assert.equal(b.flushed, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.completed, 5);
    assert.equal(writes[0]?.version, 1);

    await scheduleJobProgressWrite(
      "job-1",
      { progress: { percent: 100 }, counters: { completed: 49, total: 49 } },
      writer,
      { force: true }
    );
    assert.equal(writes.length, 2);
    assert.equal(writes[1]?.version, 2);
    assert.equal(writes[1]?.completed, 49);
  });

  it("seeds version from DB so restarts do not rewind the counter", async () => {
    const writes: number[] = [];
    await scheduleJobProgressWrite(
      "job-seed",
      { progress: { percent: 50 }, counters: { completed: 25, total: 50 } },
      async ({ version }) => {
        writes.push(version);
      },
      { force: true, seedVersion: 40 }
    );
    assert.deepEqual(writes, [41]);
  });

  it("flushJobProgress no-ops when nothing is pending", async () => {
    const result = await flushJobProgress("missing", async () => {
      throw new Error("should not write");
    });
    assert.equal(result.flushed, false);
    assert.equal(result.version, 0);
  });
});
