import { JOB_PRIORITY_MCTB_OUTBOUND_SMS } from "@/lib/jobs/job-priority";

/** Lower number = higher priority (matches job_queue). */
export const PLATFORM_DISPATCH_PRIORITY_MCTB = JOB_PRIORITY_MCTB_OUTBOUND_SMS;
export const PLATFORM_DISPATCH_PRIORITY_AR_REMINDER = 8;
export const PLATFORM_DISPATCH_PRIORITY_AR_TRANSACTIONAL = 25;
export const PLATFORM_DISPATCH_PRIORITY_BULK = 50;

export const PLATFORM_DISPATCH_INTERACTIVE_MAX = 25;

export function platformDispatchScore(priority: number, enqueueMs: number): number {
  const p = Number.isFinite(priority) ? priority : PLATFORM_DISPATCH_PRIORITY_BULK;
  const t = Number.isFinite(enqueueMs) ? enqueueMs : Date.now();
  return p * 1_000_000_000_000 + t;
}

export function isInteractivePlatformDispatchPriority(priority: number): boolean {
  return priority <= PLATFORM_DISPATCH_INTERACTIVE_MAX;
}
