/**
 * Coolify-visible logs for module Run buttons and scan enqueue.
 * All messages use logger (JSON to stdout) with a consistent `module_run` prefix in msg.
 */
import { logger } from "@/lib/observability/logger";
import type { EnqueueJobResult } from "@/lib/queue/types";

export type ModuleRunContext = {
  route: string;
  businessId?: string;
  organizationId?: string;
  jobType?: string;
  action?: string;
  [key: string]: unknown;
};

export function logModuleRunStart(ctx: ModuleRunContext): void {
  logger.info("module_run_start", {
    ...ctx,
    note: "API received — enqueue on web app; heavy work runs in worker or after()",
  });
}

export function logModuleRunStep(ctx: ModuleRunContext, step: string, detail?: Record<string, unknown>): void {
  logger.info("module_run_step", { ...ctx, step, ...detail });
}

export function logModuleRunQueued(
  ctx: ModuleRunContext,
  job: Pick<EnqueueJobResult, "jobId" | "enqueueState" | "driver" | "reused" | "queueName">
): void {
  logger.info("module_run_queued", {
    ...ctx,
    jobId: job.jobId,
    enqueueState: job.enqueueState,
    queueDriver: job.driver,
    queueName: job.queueName,
    reused: job.reused,
    note:
      job.driver === "bullmq"
        ? "Job enqueued to Redis/BullMQ — worker process must consume this queue"
        : "Job enqueued to Postgres job_queue — cron /api/jobs/process or after() on web",
  });
}

export function logModuleRunEnqueueFailed(
  ctx: ModuleRunContext,
  job: Pick<EnqueueJobResult, "jobId" | "enqueueState" | "driver">
): void {
  logger.error("module_run_enqueue_failed", {
    ...ctx,
    jobId: job.jobId,
    enqueueState: job.enqueueState,
    queueDriver: job.driver,
  });
}

export function logModuleRunError(ctx: ModuleRunContext, step: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack =
    err instanceof Error ? err.stack?.split("\n").slice(0, 8).join("\n") : undefined;
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : undefined;
  logger.error("module_run_error", {
    ...ctx,
    step,
    error: message,
    errorCode: code || undefined,
    stack,
  });
}
