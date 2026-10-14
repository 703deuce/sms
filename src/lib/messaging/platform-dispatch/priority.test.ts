import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLATFORM_DISPATCH_PRIORITY_BULK,
  PLATFORM_DISPATCH_PRIORITY_MCTB,
  PLATFORM_DISPATCH_SCORE_STRIDE,
  platformDispatchPriorityFromScore,
  platformDispatchScore,
} from "@/lib/messaging/platform-dispatch/priority";

describe("platformDispatchScore", () => {
  it("orders priority before FIFO sequence", () => {
    const oldBulk = platformDispatchScore(PLATFORM_DISPATCH_PRIORITY_BULK, 1);
    const newMctb = platformDispatchScore(PLATFORM_DISPATCH_PRIORITY_MCTB, 9_999_999_999);
    assert.ok(newMctb < oldBulk, "new MCTB must beat old bulk");
  });

  it("FIFO within the same priority tier", () => {
    const first = platformDispatchScore(50, 100);
    const second = platformDispatchScore(50, 101);
    assert.ok(first < second);
  });

  it("does not use wall-clock ms in the score", () => {
    const a = platformDispatchScore(5, 42);
    const b = platformDispatchScore(5, 42);
    assert.equal(a, b);
    assert.ok(a < PLATFORM_DISPATCH_SCORE_STRIDE * 6);
  });

  it("recovers priority from score", () => {
    const score = platformDispatchScore(25, 7);
    assert.equal(platformDispatchPriorityFromScore(score), 25);
  });

  it("clamps sequence below stride so scores stay in-tier", () => {
    const atMax = platformDispatchScore(5, PLATFORM_DISPATCH_SCORE_STRIDE - 1);
    const nextTier = platformDispatchScore(6, 1);
    assert.ok(atMax < nextTier);
    assert.equal(platformDispatchPriorityFromScore(atMax), 5);
  });
});
