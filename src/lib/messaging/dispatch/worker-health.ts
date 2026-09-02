import "server-only";

import {
  collectDispatchMetrics,
  getWorkerHeartbeat,
  type WorkerMetrics,
} from "@/lib/messaging/dispatch/heartbeat";

export const SMS_DISPATCH_WORKER_KEY = "sms-dispatch";

export type SmsWorkerHealthSnapshot = {
  workerKey: string;
  healthy: boolean;
  workerId: string | null;
  lastBeatAt: Date | null;
  ageSeconds: number | null;
  staleThresholdSeconds: number;
  metrics: WorkerMetrics;
  tableMissing: boolean;
};

export async function loadSmsWorkerHealth(): Promise<SmsWorkerHealthSnapshot> {
  const pollMs = Number(process.env.WORKER_POLL_MS || 3_000);
  const staleThresholdMs = Number(process.env.SMS_WORKER_MAX_STALE_MS || pollMs * 10);

  let beat = null;
  let tableMissing = false;
  try {
    beat = await getWorkerHeartbeat(SMS_DISPATCH_WORKER_KEY);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("worker_heartbeats")) tableMissing = true;
    else throw err;
  }

  let metrics: WorkerMetrics = {};
  try {
    metrics = await collectDispatchMetrics();
  } catch {
    metrics = (beat?.metricsJson as WorkerMetrics | undefined) ?? {};
  }

  const lastBeatAt = beat?.lastBeatAt ?? null;
  const ageMs = lastBeatAt ? Math.max(0, Date.now() - lastBeatAt.getTime()) : null;

  return {
    workerKey: SMS_DISPATCH_WORKER_KEY,
    healthy: !tableMissing && ageMs != null && ageMs < staleThresholdMs,
    workerId: beat?.workerId ?? null,
    lastBeatAt,
    ageSeconds: ageMs != null ? Math.round(ageMs / 1000) : null,
    staleThresholdSeconds: Math.round(staleThresholdMs / 1000),
    metrics: (beat?.metricsJson as WorkerMetrics | undefined) ?? metrics,
    tableMissing,
  };
}
