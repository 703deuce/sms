import type { VoiceV3AgentConfig } from "../config/agent-config";
import { resolveBookingServiceForRuntime } from "../config/resolve-booking-service";
import type { VoiceV3CallContext } from "../state/call-context";
import type { CreateBookingRequest } from "./booking-types";
import { resolveCustomerIdentityFromIntake } from "../intake-objective/resolve-stored-intake";
import { isSelectedSlotAuthoritative } from "./selected-slot";

export function buildCreateBookingRequest(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
  bookingAttemptId: string,
): CreateBookingRequest | null {
  const selected = ctx.selection.selected;
  const offer = ctx.availability.activeOfferSet;
  if (!selected || !offer) return null;

  if (
    !isSelectedSlotAuthoritative(selected, {
      offerSetId: offer.offerSetId,
      schedulingGeneration: ctx.scheduling.generation,
    })
  ) {
    return null;
  }

  const calendarId = config.calendar?.calendarIds[0];
  if (!calendarId || !config.calendar?.connectionId) return null;

  const identity = resolveCustomerIdentityFromIntake(config, ctx.intake.values);
  const name = identity.name?.trim();
  if (!name) return null;

  const slot = offer.slots.find((s) => s.slotId === selected.slotId);
  if (!slot) return null;

  const service = resolveBookingServiceForRuntime(config, ctx);

  return {
    callId: ctx.callId,
    bookingAttemptId,
    schedulingGeneration: ctx.scheduling.generation,
    offerSetId: offer.offerSetId,
    slotId: selected.slotId,
    calendarId,
    startUtc: selected.startUtc,
    endUtc: selected.endUtc,
    timezone: selected.timezone,
    customer: {
      name,
      email: identity.email?.trim() || undefined,
      phone: identity.phone?.trim() || undefined,
    },
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
    },
  };
}
