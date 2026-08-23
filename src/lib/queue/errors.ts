/** Ledger deferred (lease held / scheduled later) — must not burn BullMQ attempts. */
export class JobDeferredError extends Error {
  readonly deferred = true as const;
  readonly delayMs: number;

  constructor(message = "Job deferred", delayMs = 5_000) {
    super(message);
    this.name = "JobDeferredError";
    this.delayMs = delayMs;
  }
}

export function isDeferredError(err: unknown): err is JobDeferredError {
  return (
    err instanceof JobDeferredError ||
    Boolean(err instanceof Error && (err as Error & { deferred?: boolean }).deferred)
  );
}
