import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { ReceptionistRouteTraceContext } from "./route-tracing";

const storage = new AsyncLocalStorage<ReceptionistRouteTraceContext>();

export function runWithReceptionistTraceContext<T>(
  ctx: ReceptionistRouteTraceContext,
  fn: () => T,
): T {
  return storage.run(ctx, fn);
}

export function getReceptionistTraceContext(): ReceptionistRouteTraceContext | undefined {
  return storage.getStore();
}

export function recordReceptionistSideEffect(
  kind: import("./side-effect-ledger").LiveSideEffectKind,
  detail?: Record<string, unknown>,
): void {
  const ctx = storage.getStore();
  ctx?.ledger.record(kind, detail);
}
