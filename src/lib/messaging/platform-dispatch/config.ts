function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** Combined outbound starts per second for one platform toll-free / shared sender. */
export function platformDispatchMps(): number {
  return envNumber("PLATFORM_DISPATCH_MPS", envNumber("DISPATCH_PLATFORM_MPS", 10));
}

/** Max time to spin-wait for a slot before deferring (does not block workers long). */
export function platformDispatchMaxWaitMs(): number {
  return envNumber("PLATFORM_DISPATCH_MAX_WAIT_MS", 120);
}

export function platformDispatchDefaultDeferMs(): number {
  return envNumber("PLATFORM_DISPATCH_DEFER_MS", 400);
}

/** When true and Redis is unavailable, defer sends (fail closed). */
export function platformDispatchRequireRedis(): boolean {
  if (process.env.PLATFORM_DISPATCH_REQUIRE_REDIS === "0") return false;
  if (process.env.PLATFORM_DISPATCH_REQUIRE_REDIS === "1") return true;
  return process.env.NODE_ENV === "production";
}

/** In-process coordinator for tests (single VM). */
export function platformDispatchUseMemory(): boolean {
  return (
    process.env.PLATFORM_DISPATCH_USE_MEMORY === "1" ||
    (!process.env.REDIS_URL?.trim() && !platformDispatchRequireRedis())
  );
}
