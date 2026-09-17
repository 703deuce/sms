/**
 * In-memory authoritative booking state for GPT-Live delegation (per call).
 * Hydrated/updated on tool dispatch — not at session.start.
 */

export type LiveSchedulingPreference = {
  requested_date?: string;
  day_of_week_label?: string;
  specific_time?: string;
  period?: "morning" | "afternoon" | "evening";
  time_window?: { start: string; end: string };
  timezone?: string;
};

export type LiveOfferedSlotSnapshot = {
  slot_id: string;
  spoken_label: string;
  start?: string;
  end?: string;
};

export type LiveCurrentOfferSet = {
  offer_set_id: string;
  slots: LiveOfferedSlotSnapshot[];
  requested_date?: string;
  time_window?: { start: string; end: string };
};

export type LiveLatestToolResult = {
  tool: string;
  voice_v2_status: string;
  at_ms: number;
  appointment_id?: string | null;
};

export type LiveBookingSessionState = {
  schedulingPreference: LiveSchedulingPreference;
  currentOfferSet: LiveCurrentOfferSet | null;
  selectedSlotId: string | null;
  bookingConfirmed: boolean;
  findInvocationCount: number;
  latestToolResult: LiveLatestToolResult | null;
};

export function createLiveBookingSessionState(): LiveBookingSessionState {
  return {
    schedulingPreference: {},
    currentOfferSet: null,
    selectedSlotId: null,
    bookingConfirmed: false,
    findInvocationCount: 0,
    latestToolResult: null,
  };
}

function parseTimeWindow(raw: Record<string, unknown>): { start: string; end: string } | undefined {
  const tw = (raw.time_window || raw.timeWindow) as Record<string, unknown> | undefined;
  if (!tw) return undefined;
  const start = String(tw.start || "").trim();
  const end = String(tw.end || "").trim();
  if (!start || !end) return undefined;
  return { start, end };
}

function inferPeriod(window: { start: string; end: string }): LiveSchedulingPreference["period"] {
  const startH = Number(window.start.split(":")[0]);
  const endH = Number(window.end.split(":")[0]);
  if (startH < 12 && endH <= 12) return "morning";
  if (startH >= 12 && startH < 17) return "afternoon";
  return "evening";
}

/** Merge FIND args with durable preference when the model omits a dimension. */
export function mergeFindArgsWithSessionState(
  args: Record<string, unknown>,
  state: LiveBookingSessionState,
): { merged: Record<string, unknown>; mergeNotes: string[] } {
  const merged: Record<string, unknown> = { ...args };
  const notes: string[] = [];
  const pref = state.schedulingPreference;

  const requestedDate = String(merged.requested_date || merged.requestedDate || "").trim();
  if (!requestedDate && pref.requested_date) {
    merged.requested_date = pref.requested_date;
    notes.push("filled_requested_date_from_session");
  }

  const tw = parseTimeWindow(merged);
  const prefTw = pref.time_window;
  if (!tw && prefTw) {
    merged.time_window = { ...prefTw };
    notes.push("filled_time_window_from_session");
  }

  return { merged, mergeNotes: notes };
}

export function recordFindInvocation(
  state: LiveBookingSessionState,
  args: Record<string, unknown>,
): void {
  state.findInvocationCount += 1;
  const date = String(args.requested_date || args.requestedDate || "").trim();
  const tw = parseTimeWindow(args);
  if (date) state.schedulingPreference.requested_date = date;
  if (tw) {
    state.schedulingPreference.time_window = tw;
    state.schedulingPreference.period = inferPeriod(tw);
  }
}

export function applyFindResultToSessionState(
  state: LiveBookingSessionState,
  toolOutput: Record<string, unknown>,
): void {
  const status = String(toolOutput.voice_v2_status || toolOutput.status || "");
  if (status !== "AVAILABILITY_FOUND") {
    return;
  }
  const offerSetId = String(toolOutput.offer_set_id || "").trim();
  if (!offerSetId) return;
  const slotsRaw = Array.isArray(toolOutput.slots) ? toolOutput.slots : [];
  const slots: LiveOfferedSlotSnapshot[] = slotsRaw
    .map((s) => {
      const row = s as Record<string, unknown>;
      const slotId = String(row.slot_id || row.slotId || "").trim();
      const label = String(row.label || row.spoken_label || "").trim();
      if (!slotId) return null;
      return {
        slot_id: slotId,
        spoken_label: label || slotId,
        start: row.start ? String(row.start) : undefined,
        end: row.end ? String(row.end) : undefined,
      };
    })
    .filter(Boolean) as LiveOfferedSlotSnapshot[];

  state.currentOfferSet = {
    offer_set_id: offerSetId,
    slots,
    requested_date: state.schedulingPreference.requested_date,
    time_window: state.schedulingPreference.time_window,
  };
  state.selectedSlotId = null;
}

export function applyBookResultToSessionState(
  state: LiveBookingSessionState,
  toolOutput: Record<string, unknown>,
): void {
  const status = String(toolOutput.voice_v2_status || toolOutput.status || "");
  state.latestToolResult = {
    tool: "voice_v2_book_offered_slot",
    voice_v2_status: status,
    at_ms: Date.now(),
    appointment_id: toolOutput.appointment_id
      ? String(toolOutput.appointment_id)
      : toolOutput.external_id
        ? String(toolOutput.external_id)
        : null,
  };
  if (status === "BOOKING_CONFIRMED") {
    state.bookingConfirmed = true;
    state.currentOfferSet = null;
    state.selectedSlotId = null;
  }
}

export function recordLatestFindToolResult(
  state: LiveBookingSessionState,
  voiceV2Status: string,
): void {
  state.latestToolResult = {
    tool: "voice_v2_find_availability",
    voice_v2_status: voiceV2Status,
    at_ms: Date.now(),
  };
}

function windowsEqual(
  a?: { start: string; end: string },
  b?: { start: string; end: string },
): boolean {
  if (!a || !b) return false;
  return a.start === b.start && a.end === b.end;
}

/** Block duplicate FIND when the same date/window already has a canonical offer set. */
export function shouldShortCircuitRedundantFind(
  mergedArgs: Record<string, unknown>,
  state: LiveBookingSessionState,
): boolean {
  const offer = state.currentOfferSet;
  if (!offer || offer.slots.length === 0) return false;
  const date = String(mergedArgs.requested_date || mergedArgs.requestedDate || "").trim();
  const tw = parseTimeWindow(mergedArgs);
  if (date && offer.requested_date && date !== offer.requested_date) return false;
  if (tw && offer.time_window && !windowsEqual(tw, offer.time_window)) return false;
  return true;
}

export function buildAuthoritativeBackendStatePayload(state: LiveBookingSessionState): Record<string, unknown> {
  return {
    booking_status: state.bookingConfirmed ? "BOOKING_CONFIRMED" : "NOT_BOOKED",
    current_scheduling_preference: state.schedulingPreference,
    current_offer_set: state.currentOfferSet
      ? {
          offer_set_id: state.currentOfferSet.offer_set_id,
          slots: state.currentOfferSet.slots.map((s) => ({
            slot_id: s.slot_id,
            spoken_label: s.spoken_label,
          })),
          requested_date: state.currentOfferSet.requested_date ?? null,
          time_window: state.currentOfferSet.time_window ?? null,
        }
      : null,
    selected_slot_id: state.selectedSlotId,
    booking_confirmed: state.bookingConfirmed,
    latest_authoritative_tool_result: state.latestToolResult,
    find_invocation_count_this_call: state.findInvocationCount,
  };
}
