import { logger } from "@/lib/observability/logger";
import { isReceptionistConfigTraceEnabled, isReceptionistConfigTraceVerbose } from "./flags";

export type ReceptionistLogPhase =
  | "UI_CHANGE"
  | "SAVE_DRAFT"
  | "SAVE_CONTINUE"
  | "TEST"
  | "PUBLISH"
  | "MERGE"
  | "PERSIST"
  | "PUBLISH_DIFF"
  | "RUNTIME_COMPILE"
  | "RUNTIME_LOAD"
  | "SIDE_EFFECT"
  | "STAGE";

export function receptionistLog(
  phase: ReceptionistLogPhase,
  status: string,
  fields: Record<string, unknown>,
): void {
  if (!isReceptionistConfigTraceEnabled() && phase !== "SIDE_EFFECT") {
    const trace = fields.trace ?? fields.receptionistTraceId;
    if (!trace) return;
  }
  const tag = `[RECEPTIONIST][${phase}][${status}]`;
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (typeof v === "object") return `${k}=${JSON.stringify(v)}`;
      return `${k}=${v}`;
    });
  const line = `${tag}\n${parts.join("\n")}`;
  if (status === "FAILED" || status === "UNEXPECTED_LIVE_EFFECT") {
    logger.error("receptionist_config_trace", { line, ...fields });
  } else if (status === "WARN") {
    logger.warn("receptionist_config_trace", { line, ...fields });
  } else {
    logger.info("receptionist_config_trace", { line, ...fields });
  }
}

export function receptionistFieldDiffLog(
  traceId: string,
  phase: ReceptionistLogPhase,
  entry: { path: string; before: unknown; after: unknown; reason?: string },
): void {
  if (!isReceptionistConfigTraceVerbose()) return;
  receptionistLog(phase, "FIELD", {
    trace: traceId,
    field: entry.path,
    previous: entry.before,
    next: entry.after,
    reason: entry.reason,
  });
}
