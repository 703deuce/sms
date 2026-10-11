import "server-only";

import { getPrisma } from "@/lib/db";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { arSmsOutcomeTimelineType } from "./ar-sms-customer-outcome";
import { buildArSmsOutcomeDetail, type ArSmsOutcomeEvidence } from "./ar-sms-outcome-detail";

export type ArSmsRecordableOutcome =
  | "confirmed"
  | "cancel_pending"
  | "cancelled"
  | "reschedule_started"
  | "reschedule_requested"
  | "rescheduled"
  | "policy_disclosed"
  | "policy_accepted"
  | "policy_declined"
  | "reminder_sent"
  | "calendar_verified"
  | "customer_message";

const OUTCOME_LABELS: Record<ArSmsRecordableOutcome, string> = {
  confirmed: "Customer confirmed attendance",
  cancel_pending: "Cancellation requested",
  cancelled: "Appointment cancelled",
  reschedule_started: "Customer started rescheduling",
  reschedule_requested: "Customer requested reschedule",
  rescheduled: "Appointment rescheduled",
  policy_disclosed: "Cancellation policy disclosed",
  policy_accepted: "Customer accepted policy",
  policy_declined: "Customer declined policy",
  reminder_sent: "Reminder sent",
  calendar_verified: "Calendar update verified",
  customer_message: "Customer replied",
};

async function resolveReminderTimelineType(
  workspaceId: string,
  replySessionId?: string,
): Promise<string | null> {
  if (!replySessionId?.trim()) return null;
  const row = await getPrisma().arSmsReplySession.findFirst({
    where: { id: replySessionId, workspaceId },
    select: { timelineType: true },
  });
  return row?.timelineType?.trim() || null;
}

/**
 * Append a durable SMS customer-outcome event linked to the reminder that opened the session.
 */
export async function recordArSmsCustomerOutcome(input: {
  workspaceId: string;
  appointmentId: string;
  replySessionId?: string;
  outcome: ArSmsRecordableOutcome;
  /** ISO start time after reschedule, when applicable */
  newStartsAtIso?: string;
  /** Human context (e.g. customer message snippet or policy note) */
  note?: string;
  extraDetail?: string;
  at?: string;
  reminderTimelineType?: string;
  label?: string;
  evidence?: Omit<ArSmsOutcomeEvidence, "v" | "reminderTimelineType" | "note" | "newStartsAtIso">;
}): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  if (!row) return;

  const meta = (row.metadata || {}) as AppointmentMetadata;
  const reminderType =
    input.reminderTimelineType?.trim() ||
    (await resolveReminderTimelineType(input.workspaceId, input.replySessionId)) ||
    "unknown_reminder";
  const note = input.note?.trim() || input.extraDetail?.trim();
  const detail = buildArSmsOutcomeDetail({
    reminderTimelineType: reminderType,
    note,
    newStartsAtIso: input.newStartsAtIso,
    evidence: input.evidence,
  });

  const nextMeta = appendTimeline(meta, {
    type: arSmsOutcomeTimelineType(input.outcome),
    label: input.label?.trim() || OUTCOME_LABELS[input.outcome],
    detail,
    at: input.at || new Date().toISOString(),
  });

  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: { metadata: nextMeta as object },
  });
}
