import { receptionistLog } from "./log";

export type PublishStageId =
  | "requested_draft_revision"
  | "activation_readiness"
  | "configuration_compilation"
  | "tool_capability_resolution"
  | "knowledge_calendar_readiness"
  | "transfer_routing_prep"
  | "livekit_bootstrap_generation"
  | "provider_publication"
  | "published_version_persistence"
  | "active_version_verification";

export type StageStatus = "STARTED" | "SUCCEEDED" | "FAILED" | "SKIPPED" | "NOT_REQUIRED";

export class PublishStageTracker {
  private readonly traceId: string;
  private readonly stages: Record<
    PublishStageId,
    { status: StageStatus; durationMs?: number; detail?: Record<string, unknown> }
  > = {} as Record<
    PublishStageId,
    { status: StageStatus; durationMs?: number; detail?: Record<string, unknown> }
  >;

  constructor(traceId: string) {
    this.traceId = traceId;
  }

  start(stage: PublishStageId, detail?: Record<string, unknown>): void {
    this.stages[stage] = { status: "STARTED", detail };
    receptionistLog("STAGE", "STARTED", { trace: this.traceId, stage, ...detail });
  }

  succeed(stage: PublishStageId, startedAt: number, detail?: Record<string, unknown>): void {
    const durationMs = Date.now() - startedAt;
    this.stages[stage] = { status: "SUCCEEDED", durationMs, detail };
    receptionistLog("STAGE", "SUCCEEDED", {
      trace: this.traceId,
      stage,
      duration_ms: durationMs,
      ...detail,
    });
  }

  fail(stage: PublishStageId, startedAt: number, detail?: Record<string, unknown>): void {
    const durationMs = Date.now() - startedAt;
    this.stages[stage] = { status: "FAILED", durationMs, detail };
    receptionistLog("STAGE", "FAILED", {
      trace: this.traceId,
      stage,
      duration_ms: durationMs,
      ...detail,
    });
  }

  skip(stage: PublishStageId, reason?: string): void {
    this.stages[stage] = { status: "SKIPPED", detail: { reason } };
    receptionistLog("STAGE", "SKIPPED", { trace: this.traceId, stage, reason });
  }

  notRequired(stage: PublishStageId, reason?: string): void {
    this.stages[stage] = { status: "NOT_REQUIRED", detail: { reason } };
    receptionistLog("STAGE", "NOT_REQUIRED", { trace: this.traceId, stage, reason });
  }

  snapshot(): Record<string, unknown> {
    return { trace: this.traceId, stages: this.stages };
  }
}
