import type { VoiceCall } from "@/newui-transplant/lib/view-models";
import type { VoiceOverviewRecentCall, VoiceOverviewSummaryResult } from "@/lib/voice/overview-summary";
import { mapVoiceCallApiRowToNewUi, type VoiceCallApiRow } from "@/lib/newui-transplant/adapters/voice-calls";

export function mapOverviewRecentCallToNewUi(row: VoiceOverviewRecentCall): VoiceCall {
  const apiRow: VoiceCallApiRow = {
    id: row.id,
    direction: "INBOUND",
    fromE164: row.fromE164,
    toE164: row.fromE164,
    startedAt: row.startedAt,
    durationSeconds: row.durationSeconds,
    contactName: row.contactName,
    summary: null,
    appointmentBooked: row.appointmentBooked,
    transferred: row.transferred,
    voicemailDetected: row.voicemailDetected,
    leadScore: row.leadScore,
    status: row.status,
    outcome: row.outcome,
    recordings: [],
  };
  return mapVoiceCallApiRowToNewUi(apiRow);
}

export function overviewMetricsFromResult(result: VoiceOverviewSummaryResult) {
  const m = result.data.metrics;
  return {
    totalCalls: m?.totalCalls ?? 0,
    appointmentsBooked: m?.appointmentsBooked ?? 0,
    callbacksRequested: m?.callbacksRequested ?? 0,
    periodLabel: m?.periodLabel ?? "Last 7 days",
  };
}
