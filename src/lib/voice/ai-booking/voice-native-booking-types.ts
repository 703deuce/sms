import { createHash } from "node:crypto";

/** Voice Agent semantic actions — interpreted by Telnyx model, not by DeepSeek. */
export const VOICE_NATIVE_BOOKING_ACTIONS = [
  "FIND_AVAILABILITY",
  "SELECT_OFFERED_SLOT",
  "BOOK_OFFERED_SLOT",
  "CHANGE_AVAILABILITY_REQUEST",
  "CANCEL_BOOKING_FLOW",
] as const;

export type VoiceNativeBookingAction = (typeof VOICE_NATIVE_BOOKING_ACTIONS)[number];

export type VoiceNativeDaypart = "MORNING" | "AFTERNOON" | "EVENING";
export type VoiceNativeTimeRelation = "AT" | "AFTER" | "BEFORE" | "AROUND";

export type VoiceNativeBookingPayload = {
  action: VoiceNativeBookingAction;
  /** Business-local calendar date YYYY-MM-DD */
  requested_date?: string | null;
  /** Business-local wall time HH:mm (24h) */
  specific_local_time?: string | null;
  time_window_start?: string | null;
  time_window_end?: string | null;
  daypart?: VoiceNativeDaypart | null;
  time_relation?: VoiceNativeTimeRelation | null;
  /** Must match the active offer set returned with AVAILABILITY_FOUND */
  offer_set_id?: string | null;
  /** Canonical slot id from the active offer set only */
  selected_slot_id?: string | null;
  confirm_booking?: boolean;
  /** Telnyx tool invocation id for idempotency */
  tool_invocation_id?: string | null;
};

export function parseVoiceNativeBookingPayload(
  raw: Record<string, unknown>,
): { ok: true; payload: VoiceNativeBookingPayload } | { ok: false; error: string } {
  const action = String(raw.action || "").trim() as VoiceNativeBookingAction;
  if (!VOICE_NATIVE_BOOKING_ACTIONS.includes(action)) {
    return {
      ok: false,
      error: "voice_native_booking_action_required",
    };
  }

  const payload: VoiceNativeBookingPayload = {
    action,
    requested_date: raw.requested_date ? String(raw.requested_date).trim() : null,
    specific_local_time: raw.specific_local_time
      ? String(raw.specific_local_time).trim()
      : raw.specific_time
        ? String(raw.specific_time).trim()
        : null,
    time_window_start: raw.time_window_start ? String(raw.time_window_start).trim() : null,
    time_window_end: raw.time_window_end ? String(raw.time_window_end).trim() : null,
    daypart: raw.daypart ? (String(raw.daypart).trim().toUpperCase() as VoiceNativeDaypart) : null,
    time_relation: raw.time_relation
      ? (String(raw.time_relation).trim().toUpperCase() as VoiceNativeTimeRelation)
      : null,
    offer_set_id: raw.offer_set_id ? String(raw.offer_set_id).trim() : null,
    selected_slot_id: raw.selected_slot_id
      ? String(raw.selected_slot_id).trim()
      : raw.slot_id
        ? String(raw.slot_id).trim()
        : null,
    confirm_booking: raw.confirm_booking === true || raw.confirmation === true,
    tool_invocation_id: raw.tool_invocation_id
      ? String(raw.tool_invocation_id).trim()
      : raw.invocation_id
        ? String(raw.invocation_id).trim()
        : null,
  };

  if (
    (action === "SELECT_OFFERED_SLOT" || action === "BOOK_OFFERED_SLOT") &&
    !payload.selected_slot_id
  ) {
    return { ok: false, error: "voice_native_selected_slot_id_required" };
  }

  return { ok: true, payload };
}

export function voiceNativeActionDigest(payload: VoiceNativeBookingPayload): string {
  const stable = JSON.stringify({
    action: payload.action,
    requested_date: payload.requested_date,
    specific_local_time: payload.specific_local_time,
    time_window_start: payload.time_window_start,
    time_window_end: payload.time_window_end,
    daypart: payload.daypart,
    time_relation: payload.time_relation,
    offer_set_id: payload.offer_set_id,
    selected_slot_id: payload.selected_slot_id,
    confirm_booking: payload.confirm_booking === true,
  });
  return createHash("sha256").update(stable).digest("hex").slice(0, 24);
}
