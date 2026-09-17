import type { LiveBookingSessionState } from "./live-booking-session-state";
import { buildAuthoritativeBackendStatePayload } from "./live-booking-session-state";

export function logFindInput(input: {
  callId: string;
  callerRawPreference: Record<string, unknown>;
  mergedPreference: Record<string, unknown>;
  mergeNotes: string[];
  timezone?: string;
  bookingState?: LiveBookingSessionState | null;
  findReason?: string;
}): void {
  const pref = input.bookingState?.schedulingPreference ?? {};
  const tw = (input.mergedPreference.time_window || input.mergedPreference.timeWindow) as
    | Record<string, unknown>
    | undefined;
  console.info(
    `FIND_INPUT ${JSON.stringify({
      callId: input.callId,
      find_reason: input.findReason ?? "model_invoked_find",
      caller_raw_preference: {
        requested_date: input.callerRawPreference.requested_date ?? input.callerRawPreference.requestedDate ?? null,
        time_window: input.callerRawPreference.time_window ?? input.callerRawPreference.timeWindow ?? null,
      },
      normalized: {
        requested_date: input.mergedPreference.requested_date ?? input.mergedPreference.requestedDate ?? null,
        time_window: tw
          ? { start: tw.start ?? null, end: tw.end ?? null }
          : null,
        timezone: input.timezone ?? pref.timezone ?? null,
      },
      existing_scheduling_preference: pref,
      current_offer_set_id: input.bookingState?.currentOfferSet?.offer_set_id ?? null,
      merge_notes: input.mergeNotes,
      find_invocation_index: (input.bookingState?.findInvocationCount ?? 0) + 1,
    })}`,
  );
}

export function logFindResult(input: {
  callId: string;
  offerSetId: string | null;
  status: string;
  slots: Array<{ slot_id: string; spoken_label: string; start?: string; end?: string }>;
  error?: string | null;
}): void {
  console.info(
    `FIND_RESULT ${JSON.stringify({
      callId: input.callId,
      voice_v2_status: input.status,
      offer_set_id: input.offerSetId,
      slots: input.slots,
      error: input.error ?? null,
    })}`,
  );
}

export function logFindSkippedOfferSetActive(input: {
  callId: string;
  message: string;
  bookingState: LiveBookingSessionState;
}): void {
  console.info(
    `FIND_GUARD ${JSON.stringify({
      callId: input.callId,
      guard: "offer_set_active",
      message: input.message,
      authoritative_state: buildAuthoritativeBackendStatePayload(input.bookingState),
    })}`,
  );
}

export function parseFindToolOutput(output: string): Record<string, unknown> {
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function extractFindResultSlots(parsed: Record<string, unknown>): Array<{
  slot_id: string;
  spoken_label: string;
  start?: string;
  end?: string;
}> {
  const slotsRaw = Array.isArray(parsed.slots) ? parsed.slots : [];
  return slotsRaw
    .map((s) => {
      const row = s as Record<string, unknown>;
      const slotId = String(row.slot_id || row.slotId || "").trim();
      if (!slotId) return null;
      return {
        slot_id: slotId,
        spoken_label: String(row.label || row.spoken_label || slotId),
        start: row.start ? String(row.start) : undefined,
        end: row.end ? String(row.end) : undefined,
      };
    })
    .filter(Boolean) as Array<{
    slot_id: string;
    spoken_label: string;
    start?: string;
    end?: string;
  }>;
}
