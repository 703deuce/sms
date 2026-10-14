/** Capacity / priority deferral at platform sender gate — not a provider failure. */
export class PlatformDispatchDeferredError extends Error {
  readonly deferMs: number;
  readonly soft = true;
  readonly reason: string;

  constructor(reason: string, deferMs = 500) {
    super(`platform_dispatch_deferred:${reason}`);
    this.name = "PlatformDispatchDeferredError";
    this.reason = reason;
    this.deferMs = Math.max(50, Math.min(deferMs, 120_000));
  }
}

export function isPlatformDispatchDeferredError(
  err: unknown,
): err is PlatformDispatchDeferredError {
  return err instanceof PlatformDispatchDeferredError;
}
