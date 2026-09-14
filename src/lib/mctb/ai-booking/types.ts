/**
 * MCTB AI Booking — product-level types.
 * The LLM must never call provider APIs directly; only this service + adapters may.
 */

export type MctbAiBookingProviderId = "microsoft" | "calendly" | "zoho";

/** Canonical slot returned from a provider availability query only. */
export type MctbBookingSlot = {
  slotId: string;
  startUtc: string;
  endUtc: string;
  timezone: string;
  label?: string;
};

export type MctbBookingContext = {
  provider: MctbAiBookingProviderId;
  connected: boolean;
  healthy: boolean;
  timezone: string;
  durationMinutes: number;
  eventTypeUri?: string | null;
  serviceName?: string | null;
  calendarId?: string | null;
  bufferMinutes?: number;
  fallbackBookingLinkId?: string | null;
  fallbackBookingUrl?: string | null;
};

export type MctbProviderCapabilityFlags = {
  readCalendar: boolean;
  checkAvailability: boolean;
  createBooking: boolean;
  aiBookingSupported: boolean;
  notes: string[];
};

export type MctbBookingProviderSummary = {
  id: MctbAiBookingProviderId;
  displayName: string;
  connected: boolean;
  capabilities: MctbProviderCapabilityFlags;
};

export type FindAvailableTimesRequest = {
  workspaceId: string;
  conversationId?: string;
  /** Normalized search window — from NL interpreter, not invented slots. */
  windowStartUtc: string;
  windowEndUtc: string;
  timezone: string;
  /** When set, prefer slots near this instant (e.g. "2 PM tomorrow"). */
  preferredStartUtc?: string | null;
  maxResults?: number;
};

export type FindAvailableTimesResult =
  | {
      ok: true;
      provider: MctbAiBookingProviderId;
      slots: MctbBookingSlot[];
      queriedWindow: { startUtc: string; endUtc: string };
    }
  | {
      ok: false;
      reason: string;
      fallbackRecommended: true;
    };

export type CreateBookingRequest = {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  slotId: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  /** Lead Recovery epoch captured when booking was armed — final provider-write gate. */
  writeEpoch?: number;
};

export type CreateBookingResult =
  | {
      ok: true;
      provider: MctbAiBookingProviderId;
      providerBookingId: string;
      startUtc: string;
      endUtc: string;
      timezone: string;
      status: "confirmed" | "pending";
      inviteSent?: boolean;
    }
  | {
      ok: false;
      reason: string;
      fallbackRecommended: true;
    };

export type BookingStatusResult =
  | {
      ok: true;
      provider: MctbAiBookingProviderId;
      providerBookingId: string;
      status: string;
      startUtc?: string;
      endUtc?: string;
    }
  | { ok: false; reason: string };

/** Stateful conversation slice — only slots from the last provider query may be booked. */
export type MctbAiBookingSessionStage =
  | "IDLE"
  | "COLLECTING_TIME_PREFERENCE"
  | "CHECKING_AVAILABILITY"
  | "AWAITING_SLOT_SELECTION"
  | "BOOKING"
  | "CONFIRMED"
  | "FALLBACK"
  | "FAILED";

export type MctbAiBookingSession = {
  conversationId: string;
  workspaceId: string;
  provider: MctbAiBookingProviderId;
  stage?: MctbAiBookingSessionStage;
  offeredSlots: MctbBookingSlot[];
  lastQueriedWindow?: { startUtc: string; endUtc: string };
  pendingSlotId?: string | null;
  updatedAt: string;
  expiresAt?: string | null;
};

export type SchedulingIntentKind =
  | "broad_day"
  | "time_window"
  | "specific_time"
  | "after_time"
  | "choose_offered";

export type AiBookingOrchestratorResult =
  | {
      kind: "offer_slots";
      messageHint: string;
      slots: MctbBookingSlot[];
    }
  | {
      kind: "specific_time";
      requestedAvailable: boolean;
      requestedSlot?: MctbBookingSlot;
      alternatives: MctbBookingSlot[];
      messageHint: string;
    }
  | {
      kind: "booked";
      booking: Extract<CreateBookingResult, { ok: true }>;
      messageHint: string;
    }
  | {
      kind: "fallback_link";
      url: string;
      reason: string;
      messageHint: string;
    }
  | { kind: "need_clarification"; messageHint: string };
