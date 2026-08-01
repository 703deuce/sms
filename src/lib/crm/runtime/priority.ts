/**
 * Sync / event prioritization for the CRM runtime queues.
 */

import type { CrmPlatformEventType, EventPriority } from "../types";

/** Numeric priority for JobQueue — lower runs first. */
export const PRIORITY_SCORE: Record<EventPriority, number> = {
  high: 10,
  medium: 50,
  low: 90,
};

const HIGH: CrmPlatformEventType[] = [
  "call.incoming",
  "call.outgoing",
  "call.missed",
  "call.completed",
  "sms.sent",
  "sms.delivered",
  "sms.failed",
  "sms.received",
  "callback.scheduled",
  "task.created",
  "task.completed",
  "voicemail.received",
];

const MEDIUM: CrmPlatformEventType[] = [
  "recording.ready",
  "transcript.ready",
  "ai_summary.ready",
  "contact.created",
  "contact.updated",
  "lead.created",
  "appointment.booked",
];

export function priorityForEvent(type: CrmPlatformEventType): EventPriority {
  if (HIGH.includes(type)) return "high";
  if (MEDIUM.includes(type)) return "medium";
  return "low";
}

export function priorityScoreForEvent(type: CrmPlatformEventType): number {
  return PRIORITY_SCORE[priorityForEvent(type)];
}

export type SyncJobKind =
  | "initial"
  | "incremental"
  | "manual"
  | "webhook"
  | "scheduled"
  | "push"
  | "metadata"
  | "bulk";

export function priorityScoreForSyncKind(kind: SyncJobKind): number {
  switch (kind) {
    case "webhook":
    case "push":
      return PRIORITY_SCORE.high;
    case "incremental":
    case "manual":
    case "metadata":
      return PRIORITY_SCORE.medium;
    case "initial":
    case "bulk":
    case "scheduled":
    default:
      return PRIORITY_SCORE.low;
  }
}

/** Provider-isolated queue name so one CRM cannot starve another. */
export function crmQueueName(provider: string): string {
  return `crm-${provider}`;
}
