import type { CallOutcomeBadge } from "../calls/display";
import {
  callHasTransferFailedEvent,
  countTransfersAnsweredOnCall,
  deriveCallMaterialOutcomeEvents,
  type CallRowOutcomeInput,
} from "../calls/outcome-classification";
import { localDateKeyInTimezone } from "./voice-analytics-period";

export type VoiceAnalyticsCallRow = CallRowOutcomeInput & {
  id: string;
  startedAt: Date;
  durationSeconds?: number | null;
  direction: string;
  isTest: boolean;
  metadata?: unknown;
};

export type MaterialOutcomeCounts = Partial<Record<CallOutcomeBadge, number>>;

export const ANALYTICS_OUTCOME_DISPLAY_ORDER: CallOutcomeBadge[] = [
  "Appointment Booked",
  "Appointment Requested",
  "Booking Link Sent",
  "Callback Requested",
  "Message Taken",
  "Transferred",
  "Transfer Failed",
  "Voicemail",
  "Emergency",
  "Urgent",
  "Spam",
  "Solicitor",
];

export function isReceptionistAnalyticsCall(call: Pick<VoiceAnalyticsCallRow, "isTest" | "direction">): boolean {
  return call.isTest === false && String(call.direction).toUpperCase() === "INBOUND";
}

export function aggregateReceptionistCalls(
  calls: VoiceAnalyticsCallRow[],
  timeZone: string,
): {
  calls: VoiceAnalyticsCallRow[];
  totalCalls: number;
  materialOutcomes: MaterialOutcomeCounts;
  transfersAnswered: number;
  transfersFailedEvents: number;
  appointmentsBooked: number;
  callbacksRequested: number;
  voicemailCount: number;
  totalDurationSeconds: number;
  dailyCallVolume: Record<string, number>;
} {
  const inbound = calls.filter(isReceptionistAnalyticsCall);
  const materialOutcomes: MaterialOutcomeCounts = {};
  let transfersAnswered = 0;
  let transfersFailedEvents = 0;
  let appointmentsBooked = 0;
  let callbacksRequested = 0;
  let voicemailCount = 0;
  let totalDurationSeconds = 0;
  const dailyCallVolume: Record<string, number> = {};

  for (const call of inbound) {
    const day = localDateKeyInTimezone(call.startedAt, timeZone);
    dailyCallVolume[day] = (dailyCallVolume[day] || 0) + 1;
    totalDurationSeconds += call.durationSeconds || 0;

    if (call.voicemailDetected) voicemailCount += 1;

    const events = deriveCallMaterialOutcomeEvents(call);
    for (const badge of events) {
      materialOutcomes[badge] = (materialOutcomes[badge] || 0) + 1;
    }

    transfersAnswered += countTransfersAnsweredOnCall(call.transfers);
    if (callHasTransferFailedEvent(call)) transfersFailedEvents += 1;

    if (call.appointmentBooked) appointmentsBooked += 1;
    if (events.includes("Callback Requested")) callbacksRequested += 1;
  }

  return {
    calls: inbound,
    totalCalls: inbound.length,
    materialOutcomes,
    transfersAnswered,
    transfersFailedEvents,
    appointmentsBooked,
    callbacksRequested,
    voicemailCount,
    totalDurationSeconds,
    dailyCallVolume,
  };
}

export function aggregateResponseLatencyMs(
  calls: VoiceAnalyticsCallRow[],
): {
  medianResponseLatencyMs: number | null;
  p95ResponseLatencyMs: number | null;
  responseLatencySampleSize: number;
} {
  const samples: number[] = [];
  for (const c of calls) {
    const meta = c.metadata as
      | {
          responseLatency?: {
            samples?: Array<{ latencyMs?: number }>;
            summary?: { medianMs?: number | null };
          };
        }
      | undefined;
    const s = meta?.responseLatency?.samples;
    if (Array.isArray(s) && s.length) {
      for (const row of s) {
        if (typeof row?.latencyMs === "number" && row.latencyMs >= 0) {
          samples.push(row.latencyMs);
        }
      }
    } else if (typeof meta?.responseLatency?.summary?.medianMs === "number") {
      samples.push(meta.responseLatency.summary.medianMs);
    }
  }
  const sorted = [...samples].sort((a, b) => a - b);
  if (!sorted.length) {
    return { medianResponseLatencyMs: null, p95ResponseLatencyMs: null, responseLatencySampleSize: 0 };
  }
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return {
    medianResponseLatencyMs: median,
    p95ResponseLatencyMs: p95,
    responseLatencySampleSize: sorted.length,
  };
}
