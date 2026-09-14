import { getPrisma } from "@/lib/db";
import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

export async function recordMctbBookingAuditEvent(input: {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  kind: string;
  payload: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  if (!prisma.mctbConversationBookingActivity?.create) return;
  await prisma.mctbConversationBookingActivity.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      contactId: input.contactId ?? null,
      kind: input.kind,
      payloadJson: input.payload,
    },
  });
}

export async function recordSlotsOfferedAudit(input: {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  bookingTimezone: string;
  slots: MctbBookingSlot[];
  writeEpoch?: number;
}) {
  await recordMctbBookingAuditEvent({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    contactId: input.contactId,
    kind: "BOOKING_SLOTS_OFFERED",
    payload: {
      bookingTimezone: input.bookingTimezone,
      writeEpoch: input.writeEpoch ?? null,
      slots: input.slots.map((s, i) => ({
        index: i + 1,
        slotId: s.slotId,
        startUtc: s.startUtc,
        endUtc: s.endUtc,
        bookingTimezone: s.bookingTimezone || s.timezone,
        displayStart: s.displayStart ?? null,
      })),
    },
  });
}

export async function recordBookingSelectionAudit(input: {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  bookingTimezone: string;
  specialist: SchedulingSpecialistResult;
  resolvedSlotId: string | null;
  resolvedSlot?: MctbBookingSlot | null;
  writeEpoch?: number;
}) {
  await recordMctbBookingAuditEvent({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    contactId: input.contactId,
    kind: "BOOKING_SELECTION_RESOLVED",
    payload: {
      bookingTimezone: input.bookingTimezone,
      writeEpoch: input.writeEpoch ?? null,
      specialist: {
        action: input.specialist.action,
        offered_slot_id: input.specialist.offered_slot_id ?? null,
        offered_slot_index: input.specialist.offered_slot_index ?? null,
        requested_local_date: input.specialist.requested_local_date ?? null,
        requested_local_time: input.specialist.requested_local_time ?? null,
        customer_confirms_booking: input.specialist.customer_confirms_booking ?? false,
      },
      runtime_selected_slot_id: input.resolvedSlotId,
      runtime_start_utc: input.resolvedSlot?.startUtc ?? null,
      runtime_end_utc: input.resolvedSlot?.endUtc ?? null,
    },
  });
}
