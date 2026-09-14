import type { MctbDurableOperationTraceEvent } from "./types";

export function appendTraceEvent(
  trace: MctbDurableOperationTraceEvent[],
  step: string,
  detail?: Record<string, unknown>,
): MctbDurableOperationTraceEvent[] {
  return [
    ...trace,
    {
      at: new Date().toISOString(),
      step,
      ...(detail ? { detail } : {}),
    },
  ];
}
