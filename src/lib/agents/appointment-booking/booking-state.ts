/**
 * Structured booking conversation state — persisted on VoiceCall.metadata.
 */

import { getPrisma } from "@/lib/db";

export type BookingIntent =
  | "book"
  | "reschedule"
  | "cancel"
  | "question"
  | "transfer";

export type BookingConversationState = {
  intent?: BookingIntent;
  contactId?: string;
  callerName?: string;
  phoneNumber?: string;
  email?: string;
  serviceId?: string;
  serviceName?: string;
  serviceAddress?: string;
  locationId?: string;
  spokenDateExpression?: string;
  resolvedStartTime?: string;
  timezone?: string;
  offeredSlotIds: string[];
  selectedSlotId?: string;
  heldSlotId?: string;
  bookingConfirmed: boolean;
  appointmentId?: string;
  missingFields: string[];
  /** Custom + standard fields keyed by collection field key */
  collectedFields: Record<string, string | number | boolean | null>;
  correctionHistory: Array<{
    field: string;
    from: unknown;
    to: unknown;
    at: string;
  }>;
  transferRequested: boolean;
  humanHandoffReason?: string;
  updatedAt: string;
};

export function emptyBookingState(): BookingConversationState {
  return {
    offeredSlotIds: [],
    bookingConfirmed: false,
    missingFields: [],
    collectedFields: {},
    correctionHistory: [],
    transferRequested: false,
    updatedAt: new Date().toISOString(),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadBookingConversationState(
  callId: string,
): Promise<BookingConversationState> {
  const call = await getPrisma().voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = asRecord(call?.metadata);
  const state = asRecord(meta.bookingConversationState);
  if (!Object.keys(state).length) return emptyBookingState();
  return {
    ...emptyBookingState(),
    ...state,
    offeredSlotIds: Array.isArray(state.offeredSlotIds)
      ? state.offeredSlotIds.map(String)
      : [],
    missingFields: Array.isArray(state.missingFields)
      ? state.missingFields.map(String)
      : [],
    correctionHistory: Array.isArray(state.correctionHistory)
      ? (state.correctionHistory as BookingConversationState["correctionHistory"])
      : [],
    bookingConfirmed: Boolean(state.bookingConfirmed),
    transferRequested: Boolean(state.transferRequested),
    updatedAt: String(state.updatedAt || new Date().toISOString()),
  };
}

export async function patchBookingConversationState(
  callId: string,
  patch: Partial<BookingConversationState>,
): Promise<BookingConversationState> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) throw new Error("Call not found");
  const meta = asRecord(call.metadata);
  const prev = await loadBookingConversationState(callId);
  const next: BookingConversationState = {
    ...prev,
    ...patch,
    offeredSlotIds: patch.offeredSlotIds || prev.offeredSlotIds,
    missingFields: patch.missingFields || prev.missingFields,
    correctionHistory: patch.correctionHistory || prev.correctionHistory,
    updatedAt: new Date().toISOString(),
  };
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        bookingConversationState: next,
      },
    },
  });
  return next;
}
