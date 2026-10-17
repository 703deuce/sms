import "server-only";

import { randomUUID } from "node:crypto";

export type VisualizerRequestLog = {
  requestId: string;
  route: string;
  log: (step: string, data?: Record<string, unknown>) => void;
};

export function createVisualizerRequestLog(route: string): VisualizerRequestLog {
  const requestId = randomUUID().slice(0, 8);
  const prefix = `[visualizer:${route}][${requestId}]`;
  return {
    requestId,
    route,
    log: (step, data) => {
      if (data && Object.keys(data).length > 0) {
        console.log(prefix, step, JSON.stringify(data));
      } else {
        console.log(prefix, step);
      }
    },
  };
}

export function logVisualizerError(
  route: string,
  requestId: string,
  step: string,
  err: unknown,
  extra?: Record<string, unknown>,
) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[visualizer:${route}][${requestId}] ${step}`, {
    message,
    stack,
    ...extra,
  });
}
