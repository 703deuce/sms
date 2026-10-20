import type { VoiceV3CallContext } from "../state/call-context";
import { isSelectedSlotAuthoritative } from "../calendar/selected-slot";

export class VoiceV3InvariantViolation extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "VoiceV3InvariantViolation";
  }
}

/**
 * Development/test guard — fail loudly on impossible authoritative combinations.
 */
export function assertVoiceV3RuntimeInvariants(
  ctx: VoiceV3CallContext,
  options?: { throwOnViolation?: boolean },
): string[] {
  const violations: string[] = [];
  const throwOn = options?.throwOnViolation ?? process.env.NODE_ENV === "test";

  if (ctx.booking.phase === "BOOKING_CONFIRMED" && !ctx.booking.confirmed) {
    violations.push("BOOKING_CONFIRMED_WITHOUT_CONFIRMED_RECORD");
  }

  const selected = ctx.selection.selected;
  const offer = ctx.availability.activeOfferSet;
  if (selected && offer) {
    if (!isSelectedSlotAuthoritative(selected, {
      offerSetId: offer.offerSetId,
      schedulingGeneration: ctx.scheduling.generation,
    })) {
      violations.push("SELECTED_SLOT_OFFER_SET_MISMATCH");
    }
  }

  if (selected && !offer) {
    violations.push("SELECTED_SLOT_WITHOUT_OFFER_SET");
  }

  if (offer && ctx.availability.inFlightGeneration != null) {
    if (offer.schedulingGeneration !== ctx.scheduling.generation) {
      violations.push("OFFER_SET_SCHEDULING_GENERATION_MISMATCH");
    }
  }

  if (ctx.recovery.active && ctx.recovery.active.status === "ACTIVE" && !ctx.recovery.active.code) {
    violations.push("ACTIVE_RECOVERY_WITHOUT_CODE");
  }

  if (violations.length > 0 && throwOn) {
    throw new VoiceV3InvariantViolation(violations[0], violations.join("; "));
  }

  return violations;
}
