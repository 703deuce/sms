export const JOB_LIFECYCLE = {
  pending: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
} as const;

export function canTransitionLifecycle(from: string, to: string): boolean {
  const allowed = (JOB_LIFECYCLE as Record<string, string[]>)[from];
  return Array.isArray(allowed) && allowed.includes(to);
}
