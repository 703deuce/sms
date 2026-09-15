import "server-only";

/**
 * Optional per-operation timing collector for voice booking worker traces.
 * Activated only during voice durable operation processing.
 */

export type VoiceGraphRequestSpan = {
  operation: string;
  httpMs: number;
  status: number;
};

export type VoiceOrchestratorTimingReport = {
  workerClaimMs?: number;
  bookingContextLoadMs?: number;
  providerTargetResolutionMs?: number;
  microsoftReadinessMs?: number;
  tokenValidationMs?: number;
  tokenRefreshMs?: number;
  graphRequests: VoiceGraphRequestSpan[];
  availabilityComputeMs?: number;
  offerSetPersistMs?: number;
  orchestratorTotalMs?: number;
  queueClaimMs?: number;
};

let activeOperationId: string | null = null;
let activeReport: VoiceOrchestratorTimingReport | null = null;

export function beginVoiceOrchestratorTiming(operationId: string): VoiceOrchestratorTimingReport {
  activeOperationId = operationId;
  activeReport = { graphRequests: [] };
  return activeReport;
}

export function getActiveVoiceOrchestratorTiming(): VoiceOrchestratorTimingReport | null {
  return activeReport;
}

export function endVoiceOrchestratorTiming(operationId: string): VoiceOrchestratorTimingReport | null {
  if (activeOperationId !== operationId) return activeReport;
  const report = activeReport;
  activeOperationId = null;
  activeReport = null;
  return report;
}

export function recordVoiceTimingField(
  field: keyof Omit<VoiceOrchestratorTimingReport, "graphRequests">,
  ms: number,
) {
  if (!activeReport) return;
  activeReport[field] = ms;
}

export function recordVoiceGraphRequest(span: VoiceGraphRequestSpan) {
  if (!activeReport) return;
  activeReport.graphRequests.push(span);
}

export function summarizeVoiceOrchestratorTiming(
  report: VoiceOrchestratorTimingReport | null,
): Record<string, unknown> {
  if (!report) return {};
  const graphTotalMs = report.graphRequests.reduce((sum, g) => sum + g.httpMs, 0);
  return {
    WORKER_CLAIM_MS: report.workerClaimMs ?? null,
    BOOKING_CONTEXT_LOAD_MS: report.bookingContextLoadMs ?? null,
    PROVIDER_TARGET_RESOLUTION_MS: report.providerTargetResolutionMs ?? null,
    MICROSOFT_READINESS_MS: report.microsoftReadinessMs ?? null,
    TOKEN_VALIDATION_MS: report.tokenValidationMs ?? null,
    TOKEN_REFRESH_MS: report.tokenRefreshMs ?? null,
    GRAPH_REQUEST_COUNT: report.graphRequests.length,
    GRAPH_REQUESTS: report.graphRequests,
    GRAPH_TOTAL_MS: graphTotalMs,
    AVAILABILITY_COMPUTE_MS: report.availabilityComputeMs ?? null,
    OFFER_SET_PERSIST_MS: report.offerSetPersistMs ?? null,
    ORCHESTRATOR_TOTAL_MS: report.orchestratorTotalMs ?? null,
    QUEUE_CLAIM_MS: report.queueClaimMs ?? null,
  };
}
