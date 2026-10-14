import { JOB_PRIORITY_MCTB_OUTBOUND_SMS } from "@/lib/jobs/job-priority";

/** Lower number = higher priority (matches job_queue). */
export const PLATFORM_DISPATCH_PRIORITY_MCTB = JOB_PRIORITY_MCTB_OUTBOUND_SMS;
export const PLATFORM_DISPATCH_PRIORITY_AR_REMINDER = 8;
export const PLATFORM_DISPATCH_PRIORITY_AR_TRANSACTIONAL = 25;
export const PLATFORM_DISPATCH_PRIORITY_BULK = 50;

export const PLATFORM_DISPATCH_INTERACTIVE_MAX = 25;

/**
 * Gap between priority tiers — must exceed max FIFO sequence per tier.
 * Sequence comes from a monotonic INCR (Redis or memory), not wall-clock ms.
 */
export const PLATFORM_DISPATCH_SCORE_STRIDE = 1_000_000_000;

const MAX_PRIORITY = 999;
const MAX_SEQUENCE = PLATFORM_DISPATCH_SCORE_STRIDE - 1;

/**
 * Sort key for the platform wait ZSET: priority first, FIFO within tier.
 * Lower score = served sooner.
 */
export function platformDispatchScore(priority: number, fifoSequence: number): number {
  const p = Math.min(
    MAX_PRIORITY,
    Math.max(0, Math.floor(Number.isFinite(priority) ? priority : PLATFORM_DISPATCH_PRIORITY_BULK)),
  );
  const seq = Math.min(
    MAX_SEQUENCE,
    Math.max(1, Math.floor(Number.isFinite(fifoSequence) ? fifoSequence : 1)),
  );
  return p * PLATFORM_DISPATCH_SCORE_STRIDE + seq;
}

export function platformDispatchPriorityFromScore(score: number): number {
  return Math.floor(score / PLATFORM_DISPATCH_SCORE_STRIDE);
}

export function isInteractivePlatformDispatchPriority(priority: number): boolean {
  return priority <= PLATFORM_DISPATCH_INTERACTIVE_MAX;
}
