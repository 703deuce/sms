import type { SlotSelectionMeaning } from "../intake/slot-selection-schema";
import { slotSelectionMeaningHasSignal } from "../intake/slot-selection-schema";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { initialVerbalConfirmationStatus } from "../booking/verbal-confirmation";
import { resolveSlotSelection, type SlotSelectionResolution } from "./resolve-slot-selection";
import type { SelectedAvailabilitySlot } from "./selected-slot";

export type ApplySlotSelectionResult = {
  context: VoiceV3CallContext;
  resolution: SlotSelectionResolution | null;
  selectionChanged: boolean;
  selectionInvalidated: boolean;
};

export function invalidateSelectionForSchedulingChange(
  ctx: VoiceV3CallContext,
  reason: string,
): VoiceV3CallContext {
  if (!ctx.selection.selected && !ctx.availability.activeOfferSet) {
    return ctx;
  }

  console.log("SLOT_SELECTION_INVALIDATED", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    scheduling_generation: ctx.scheduling.generation,
    reason,
    prior_offer_set_id: ctx.selection.selected?.offerSetId ?? null,
    prior_slot_id: ctx.selection.selected?.slotId ?? null,
  });

  const preserveConfirmed = Boolean(ctx.booking.confirmed);
  return {
    ...ctx,
    selection: {
      selected: null,
      lastResolutionStatus: null,
    },
    availability: {
      ...ctx.availability,
      activeOfferSet: null,
      status: "idle",
      inFlightGeneration: null,
      lastDispatchedRequestKey: null,
      findStartedAt: null,
    },
    presentation: {
      current: null,
    },
    booking: preserveConfirmed
      ? {
          ...ctx.booking,
          phase: "BOOKING_CONFIRMED",
          activeAttempt: null,
        }
      : {
          ...ctx.booking,
          phase: ctx.booking.phase === "BOOKING_CONFIRMED" ? "BOOKING_CONFIRMED" : "NONE",
          activeAttempt: null,
          verbalConfirmation: "NOT_REQUIRED",
        },
  };
}

function verbalConfirmationAfterSlotSelect(
  config: VoiceV3AgentConfig | undefined,
  priorSlotId: string | null,
  nextSlotId: string,
  priorStatus: VoiceV3CallContext["booking"]["verbalConfirmation"],
): VoiceV3CallContext["booking"]["verbalConfirmation"] {
  if (!config) return priorStatus;
  const base = initialVerbalConfirmationStatus(config);
  if (base === "NOT_REQUIRED") return "NOT_REQUIRED";
  if (priorSlotId && priorSlotId !== nextSlotId) {
    return "AWAITING";
  }
  if (priorStatus === "CONFIRMED" && priorSlotId === nextSlotId) {
    return "CONFIRMED";
  }
  return "AWAITING";
}

function selectedFromSlot(
  offerSetId: string,
  schedulingGeneration: number,
  slot: {
    slotId: string;
    startUtc: string;
    endUtc: string;
    localStart: string;
    localEnd: string;
  },
  timezone: string,
): SelectedAvailabilitySlot {
  return {
    offerSetId,
    slotId: slot.slotId,
    schedulingGeneration,
    startUtc: slot.startUtc,
    endUtc: slot.endUtc,
    localStart: slot.localStart,
    localEnd: slot.localEnd,
    timezone,
  };
}

export function applySlotSelectionFromMeaning(
  ctx: VoiceV3CallContext,
  meaning: SlotSelectionMeaning,
  at: Date = new Date(),
  config?: VoiceV3AgentConfig,
): ApplySlotSelectionResult {
  if (!slotSelectionMeaningHasSignal(meaning)) {
    return { context: ctx, resolution: null, selectionChanged: false, selectionInvalidated: false };
  }

  console.log("SLOT_SELECTION_MEANING_RECEIVED", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    scheduling_generation: ctx.scheduling.generation,
    selection_type: meaning.selection_type,
    spoken_time: meaning.spoken_time,
    ordinal: meaning.ordinal,
  });

  const resolution = resolveSlotSelection({
    meaning,
    offerSet: ctx.availability.activeOfferSet,
    presented: ctx.presentation.current,
    schedulingGeneration: ctx.scheduling.generation,
    timezone: ctx.business.timezone,
  });

  const updatedAt = at.toISOString();

  if (resolution.status === "RESOLVED") {
    const nextSelected = selectedFromSlot(
      resolution.offerSetId,
      ctx.scheduling.generation,
      resolution.slot,
      ctx.business.timezone,
    );
    const prior = ctx.selection.selected;
    const selectionChanged =
      !prior ||
      prior.slotId !== nextSelected.slotId ||
      prior.offerSetId !== nextSelected.offerSetId;

    if (selectionChanged && prior) {
      console.log("SLOT_SELECTION_CHANGED", {
        call_id: ctx.callId,
        scheduling_generation: ctx.scheduling.generation,
        offer_set_id: nextSelected.offerSetId,
        from_slot_id: prior.slotId,
        to_slot_id: nextSelected.slotId,
      });
    }

    console.log("SLOT_SELECTION_RESOLVED", {
      call_id: ctx.callId,
      scheduling_generation: ctx.scheduling.generation,
      offer_set_id: resolution.offerSetId,
      slot_id: resolution.slotId,
    });

    const priorSlotId = prior?.slotId ?? null;
    return {
      context: {
        ...ctx,
        updatedAt,
        selection: {
          selected: nextSelected,
          lastResolutionStatus: "RESOLVED",
        },
        booking: {
          ...ctx.booking,
          verbalConfirmation: verbalConfirmationAfterSlotSelect(
            config,
            priorSlotId,
            nextSelected.slotId,
            ctx.booking.verbalConfirmation,
          ),
        },
        runtime: { version: ctx.runtime.version + 1 },
      },
      resolution,
      selectionChanged,
      selectionInvalidated: false,
    };
  }

  if (resolution.status === "AMBIGUOUS") {
    console.log("SLOT_SELECTION_AMBIGUOUS", {
      call_id: ctx.callId,
      scheduling_generation: ctx.scheduling.generation,
      candidate_slot_ids: resolution.candidateSlotIds,
    });
  } else if (resolution.status === "NOT_IN_OFFER_SET") {
    console.log("SLOT_SELECTION_NOT_IN_OFFER_SET", {
      call_id: ctx.callId,
      scheduling_generation: ctx.scheduling.generation,
      spoken_time: meaning.spoken_time,
    });
  } else if (resolution.status === "NO_CURRENT_OFFER_SET") {
    console.log("SLOT_SELECTION_NOT_IN_OFFER_SET", {
      call_id: ctx.callId,
      scheduling_generation: ctx.scheduling.generation,
      reason: "no_current_offer_set",
    });
  }

  return {
    context: {
      ...ctx,
      updatedAt,
      selection: {
        selected: ctx.selection.selected,
        lastResolutionStatus: resolution.status,
      },
      runtime: { version: ctx.runtime.version + 1 },
    },
    resolution,
    selectionChanged: false,
    selectionInvalidated: false,
  };
}
