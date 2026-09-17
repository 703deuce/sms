/**
 * Certified Voice V2 Microsoft booking — sealed pipeline invariants.
 * @see docs/VOICE-V2-CERTIFIED-BOOKING-BOUNDARY.md
 *
 * Peripheral features (recovery, analytics, CallContext enrichment, workflow UI)
 * must not change inputs, gating, or success criteria on this path unless recertified.
 */

export const VOICE_V2_CERTIFIED_BOOKING_PIPELINE = {
  label: "voice_v2_certified_find_offer_book",
  baselineCommit: "06125f5fb6be3850e9e93314901067d1a4c2fa32",
} as const;

export type VoiceV2CertifiedPipelineOptions = {
  /**
   * When true (Telnyx PSTN FIND/BOOK webhooks), skip qualification, intake gates,
   * and other feature-layer gates on the hot path. Offer-set + slot id authority unchanged.
   */
  certifiedPipeline?: boolean;
};

export function isVoiceV2CertifiedPipeline(
  options?: VoiceV2CertifiedPipelineOptions,
): boolean {
  return options?.certifiedPipeline === true;
}

/** Tool JSON envelope after FIND — forces BOOK as the only booking action. */
export function certifiedBookingHandoffPayload(input: {
  offerSetId: string;
  slots: Array<{ slot_id: string; label: string; spoken_label?: string }>;
}): Record<string, unknown> {
  return {
    certified_booking_pipeline: true,
    voice_v2_next_stage: "OFFER_SLOTS",
    booking_continue_required: true,
    allowed_next_actions: ["voice_v2_book_offered_slot"],
    forbidden_actions: [
      "claim_booked_without_book_tool",
      "callback_close",
      "follow_up_only",
      "message_taking_terminal",
    ],
    required_next_tool: "voice_v2_book_offered_slot",
    offer_set_id: input.offerSetId,
    booking_invariants: {
      only_canonical_slot_ids: true,
      provider_confirms_before_spoken_confirmation: true,
    },
    runtime_hint:
      "Caller chose or is choosing a time from the offered list. You MUST call voice_v2_book_offered_slot with this offer_set_id and the matching selected_slot_id. Do NOT say they are booked or confirmed until the tool returns BOOKING_CONFIRMED.",
    slots_for_book: input.slots.map((s) => ({
      slot_id: s.slot_id,
      label: s.label,
      spoken_label: s.spoken_label ?? s.label,
    })),
  };
}
