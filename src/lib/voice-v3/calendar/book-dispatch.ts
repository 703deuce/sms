import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import { isSelectedSlotAuthoritative } from "./selected-slot";
import { buildCreateBookingRequest } from "./build-create-booking-request";
import type { BookingFailure, ConfirmedBooking } from "./booking-types";
import {
  bookingSlotKey,
  findInFlightCommit,
  getConfirmedBookingForSlot,
  getOrCreateBookingAttempt,
  markBookingConfirmed,
  updateBookingAttemptPhase,
} from "./booking-attempt-registry";
import {
  evaluateSlotRevalidation,
  revalidationBusyWindow,
} from "./revalidate-selected-slot";
import type { CalendarBusyInterval } from "./types";
import {
  buildLiveBookingConfirmedSessionAppend,
  buildLiveBookingFailureSessionAppend,
  buildLiveBookingInProgressSessionAppend,
  buildLiveSlotUnavailableSessionAppend,
} from "./live-booking-context";
import { invalidateSelectionForSchedulingChange } from "./apply-slot-selection";
import { dispatchFindAvailabilityIfRequired } from "./find-dispatch";

export type RevalidateBusyFetcher = (input: {
  connectionId: string;
  calendarIds: string[];
  rangeStartUtc: string;
  rangeEndUtc: string;
  config: VoiceV3AgentConfig;
}) => Promise<
  | { ok: true; busy: CalendarBusyInterval[]; durationMs: number }
  | { ok: false; failure: BookingFailure; durationMs: number }
>;

export type CreateBookingExecutor = (input: {
  request: ReturnType<typeof buildCreateBookingRequest> & object;
  config: VoiceV3AgentConfig;
}) => Promise<
  | { ok: true; providerEventId: string; providerCalendarId: string; durationMs: number }
  | { ok: false; failure: BookingFailure; durationMs: number; outcomeUncertain?: boolean }
>;

const bookingInFlight = new Set<string>();

function attemptStillValid(ctx: VoiceV3CallContext, attempt: {
  schedulingGeneration: number;
  offerSetId: string;
  slotId: string;
}): boolean {
  const selected = ctx.selection.selected;
  const offer = ctx.availability.activeOfferSet;
  if (!selected || !offer) return false;
  return (
    ctx.scheduling.generation === attempt.schedulingGeneration &&
    selected.offerSetId === attempt.offerSetId &&
    selected.slotId === attempt.slotId &&
    offer.offerSetId === attempt.offerSetId &&
    isSelectedSlotAuthoritative(selected, {
      offerSetId: offer.offerSetId,
      schedulingGeneration: ctx.scheduling.generation,
    })
  );
}

function applyBookingPhase(
  ctx: VoiceV3CallContext,
  phase: VoiceV3CallContext["booking"]["phase"],
  patch: Partial<VoiceV3CallContext["booking"]> = {},
): VoiceV3CallContext {
  return {
    ...ctx,
    updatedAt: new Date().toISOString(),
    booking: {
      ...ctx.booking,
      phase,
      ...patch,
    },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

export async function dispatchBookingIfRequired(
  runtime: {
    getSnapshot: () => VoiceV3CallContext;
    config: VoiceV3AgentConfig;
    replaceContext: (ctx: VoiceV3CallContext) => void;
  },
  hooks: {
    onLiveContext?: (event: { type: string; thinking: string }) => void;
    fetchRevalidateBusy?: RevalidateBusyFetcher;
    createBooking?: CreateBookingExecutor;
  } = {},
): Promise<void> {
  const ctx = runtime.getSnapshot();
  const rules = evaluateVoiceV3Rules(ctx, runtime.config);

  if (!rules.bookingReady || rules.requiredAction !== "BOOK_APPOINTMENT") {
    return;
  }

  if (ctx.booking.phase === "BOOKING_CONFIRMED" && ctx.booking.confirmed) {
    return;
  }

  const selected = ctx.selection.selected!;
  const slotKey = bookingSlotKey({
    schedulingGeneration: ctx.scheduling.generation,
    offerSetId: selected.offerSetId,
    slotId: selected.slotId,
  });

  if (getConfirmedBookingForSlot(ctx.liveSessionId, slotKey)) {
    return;
  }

  if (bookingInFlight.has(ctx.liveSessionId) || findInFlightCommit(ctx.liveSessionId)) {
    return;
  }

  const attempt = getOrCreateBookingAttempt({
    liveSessionId: ctx.liveSessionId,
    schedulingGeneration: ctx.scheduling.generation,
    offerSetId: selected.offerSetId,
    slotId: selected.slotId,
  });

  if (attempt.commitPhase === "COMMIT_SENT" || attempt.commitPhase === "CONFIRMED") {
    return;
  }

  const request = buildCreateBookingRequest(ctx, runtime.config, attempt.bookingAttemptId);
  if (!request) {
    return;
  }

  console.log("BOOKING_READY", {
    call_id: ctx.callId,
    scheduling_generation: ctx.scheduling.generation,
    offer_set_id: selected.offerSetId,
    slot_id: selected.slotId,
    booking_attempt_id: attempt.bookingAttemptId,
  });

  console.log("BOOKING_ATTEMPT_CREATED", {
    call_id: ctx.callId,
    scheduling_generation: ctx.scheduling.generation,
    offer_set_id: selected.offerSetId,
    slot_id: selected.slotId,
    booking_attempt_id: attempt.bookingAttemptId,
  });

  bookingInFlight.add(ctx.liveSessionId);
  runtime.replaceContext(
    applyBookingPhase(ctx, "BOOKING_REVALIDATING", {
      activeAttempt: attempt,
      lastFailure: null,
    }),
  );
  hooks.onLiveContext?.(buildLiveBookingInProgressSessionAppend());

  try {
    updateBookingAttemptPhase(ctx.liveSessionId, attempt.bookingAttemptId, "REVALIDATING");
    console.log("BOOKING_REVALIDATION_STARTED", {
      call_id: ctx.callId,
      scheduling_generation: ctx.scheduling.generation,
      offer_set_id: selected.offerSetId,
      slot_id: selected.slotId,
      booking_attempt_id: attempt.bookingAttemptId,
    });

    const window = revalidationBusyWindow(selected);
    let busy: CalendarBusyInterval[] = [];
    let revalDuration = 0;

    if (hooks.fetchRevalidateBusy) {
      const result = await hooks.fetchRevalidateBusy({
        connectionId: runtime.config.calendar!.connectionId,
        calendarIds: runtime.config.calendar!.calendarIds,
        rangeStartUtc: window.rangeStartUtc,
        rangeEndUtc: window.rangeEndUtc,
        config: runtime.config,
      });
      revalDuration = result.durationMs;
      if (!result.ok) {
        await failBooking(runtime, hooks, result.failure, attempt.bookingAttemptId);
        return;
      }
      busy = result.busy;
    } else {
      const { fetchMicrosoftBusyIntervals } = await import("./microsoft/microsoft-find-availability");
      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      const connection = await prisma.voiceCalendarConnection.findFirst({
        where: { id: runtime.config.calendar!.connectionId, provider: "microsoft" },
      });
      if (!connection || connection.status !== "connected") {
        await failBooking(runtime, hooks, {
          reason: "configuration_missing",
          message: "Microsoft calendar connection not available",
          at: new Date().toISOString(),
          bookingAttemptId: attempt.bookingAttemptId,
          schedulingGeneration: ctx.scheduling.generation,
        }, attempt.bookingAttemptId);
        return;
      }
      const calendarConfig = (connection.config || {}) as import("@/lib/voice/calendar/providers").CalendarConfig;
      const graphResult = await fetchMicrosoftBusyIntervals({
        request: {
          callId: ctx.callId,
          schedulingGeneration: ctx.scheduling.generation,
          timezone: ctx.business.timezone,
          rangeStartUtc: window.rangeStartUtc,
          rangeEndUtc: window.rangeEndUtc,
          durationMinutes: runtime.config.service.durationMinutes,
          calendarIds: runtime.config.calendar!.calendarIds,
          requestKey: `revalidate|${attempt.bookingAttemptId}`,
        },
        connectionId: connection.id,
        calendarConfig,
      });
      revalDuration = graphResult.durationMs;
      if (!graphResult.ok) {
        const reason =
          graphResult.reason === "microsoft_token"
            ? "MICROSOFT_AUTH_FAILED"
            : graphResult.reason === "microsoft_throttled"
              ? "MICROSOFT_THROTTLED"
              : "MICROSOFT_TEMPORARY_FAILURE";
        await failBooking(runtime, hooks, {
          reason,
          message: graphResult.message,
          at: new Date().toISOString(),
          bookingAttemptId: attempt.bookingAttemptId,
          schedulingGeneration: ctx.scheduling.generation,
        }, attempt.bookingAttemptId);
        return;
      }
      busy = graphResult.busy;
    }

    const latest = runtime.getSnapshot();
    if (!attemptStillValid(latest, attempt)) {
      console.log("BOOKING_ATTEMPT_STALE", {
        call_id: latest.callId,
        scheduling_generation: latest.scheduling.generation,
        booking_attempt_id: attempt.bookingAttemptId,
      });
      runtime.replaceContext(applyBookingPhase(latest, "SLOT_SELECTED", { activeAttempt: null }));
      return;
    }

    const reval = evaluateSlotRevalidation(selected, busy);
    if (!reval.ok) {
      console.log("BOOKING_REVALIDATION_FAILED", {
        call_id: latest.callId,
        scheduling_generation: latest.scheduling.generation,
        offer_set_id: selected.offerSetId,
        slot_id: selected.slotId,
        booking_attempt_id: attempt.bookingAttemptId,
        duration_ms: revalDuration,
        reason: reval.reason,
      });
      hooks.onLiveContext?.(
        buildLiveSlotUnavailableSessionAppend({
          localStart: selected.localStart,
          timezone: selected.timezone,
        }),
      );
      let cleared = invalidateSelectionForSchedulingChange(latest, "slot_no_longer_available");
      cleared = {
        ...cleared,
        booking: {
          ...cleared.booking,
          phase: "BOOKING_FAILED",
          lastFailure: {
            reason: "SLOT_NO_LONGER_AVAILABLE",
            message: reval.message,
            at: new Date().toISOString(),
            bookingAttemptId: attempt.bookingAttemptId,
            schedulingGeneration: latest.scheduling.generation,
          },
          activeAttempt: null,
        },
      };
      runtime.replaceContext(cleared);
      updateBookingAttemptPhase(latest.liveSessionId, attempt.bookingAttemptId, "FAILED");
      await dispatchFindAvailabilityIfRequired(runtime, {
        onLiveContext: hooks.onLiveContext,
        fetchBusy: hooks.fetchRevalidateBusy
          ? async ({ request, config }) => {
              const w = revalidationBusyWindow(selected);
              const result = await hooks.fetchRevalidateBusy!({
                connectionId: config.calendar!.connectionId,
                calendarIds: config.calendar!.calendarIds,
                rangeStartUtc: request.rangeStartUtc,
                rangeEndUtc: request.rangeEndUtc,
                config,
              });
              if (result.ok) {
                return { ok: true, busy: result.busy, durationMs: result.durationMs };
              }
              return {
                ok: false,
                failure: {
                  reason: "microsoft_error",
                  message: result.failure.message,
                  at: new Date().toISOString(),
                  schedulingGeneration: request.schedulingGeneration,
                },
                durationMs: result.durationMs,
              };
            }
          : undefined,
      });
      return;
    }

    console.log("BOOKING_REVALIDATION_PASSED", {
      call_id: latest.callId,
      scheduling_generation: latest.scheduling.generation,
      offer_set_id: selected.offerSetId,
      slot_id: selected.slotId,
      booking_attempt_id: attempt.bookingAttemptId,
      duration_ms: revalDuration,
    });

    updateBookingAttemptPhase(latest.liveSessionId, attempt.bookingAttemptId, "READY_TO_COMMIT");
    runtime.replaceContext(applyBookingPhase(latest, "BOOKING_CREATING"));

    if (!attemptStillValid(runtime.getSnapshot(), attempt)) {
      console.log("BOOKING_ATTEMPT_STALE", {
        call_id: runtime.getSnapshot().callId,
        booking_attempt_id: attempt.bookingAttemptId,
      });
      return;
    }

    console.log("BOOKING_COMMIT_STARTED", {
      call_id: latest.callId,
      scheduling_generation: latest.scheduling.generation,
      booking_attempt_id: attempt.bookingAttemptId,
    });

    updateBookingAttemptPhase(latest.liveSessionId, attempt.bookingAttemptId, "COMMIT_SENT");
    console.log("BOOKING_COMMIT_SENT", {
      call_id: latest.callId,
      scheduling_generation: latest.scheduling.generation,
      booking_attempt_id: attempt.bookingAttemptId,
      provider: "microsoft",
    });

    let createResult:
      | { ok: true; providerEventId: string; providerCalendarId: string; durationMs: number }
      | { ok: false; failure: BookingFailure; durationMs: number; outcomeUncertain?: boolean };

    if (hooks.createBooking) {
      createResult = await hooks.createBooking({ request, config: runtime.config });
    } else {
      const { executeMicrosoftCreateBooking } = await import("./microsoft/microsoft-create-booking");
      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      const connection = await prisma.voiceCalendarConnection.findFirst({
        where: { id: runtime.config.calendar!.connectionId, provider: "microsoft" },
      });
      if (!connection) {
        createResult = {
          ok: false,
          durationMs: 0,
          failure: {
            reason: "configuration_missing",
            message: "Connection missing",
            at: new Date().toISOString(),
            bookingAttemptId: attempt.bookingAttemptId,
            schedulingGeneration: latest.scheduling.generation,
          },
        };
      } else {
        const calendarConfig = (connection.config || {}) as import("@/lib/voice/calendar/providers").CalendarConfig;
        const ms = await executeMicrosoftCreateBooking({
          request,
          connectionId: connection.id,
          calendarConfig,
        });
        if (ms.ok) {
          createResult = ms;
        } else {
          createResult = {
            ok: false,
            durationMs: ms.durationMs,
            outcomeUncertain: ms.outcomeUncertain,
            failure: {
              reason: ms.reason,
              message: ms.message,
              at: new Date().toISOString(),
              bookingAttemptId: attempt.bookingAttemptId,
              schedulingGeneration: latest.scheduling.generation,
            },
          };
        }
      }
    }

    const afterCommit = runtime.getSnapshot();
    if (!attemptStillValid(afterCommit, attempt)) {
      console.log("BOOKING_ATTEMPT_STALE", {
        call_id: afterCommit.callId,
        booking_attempt_id: attempt.bookingAttemptId,
      });
      return;
    }

    if (!createResult.ok) {
      if (createResult.outcomeUncertain) {
        console.log("BOOKING_OUTCOME_UNKNOWN", {
          call_id: afterCommit.callId,
          booking_attempt_id: attempt.bookingAttemptId,
          duration_ms: createResult.durationMs,
        });
        runtime.replaceContext(
          applyBookingPhase(afterCommit, "BOOKING_OUTCOME_UNKNOWN", {
            lastFailure: createResult.failure,
            activeAttempt: { ...attempt, commitPhase: "OUTCOME_UNKNOWN" },
          }),
        );
        hooks.onLiveContext?.(buildLiveBookingFailureSessionAppend(createResult.failure));
        updateBookingAttemptPhase(afterCommit.liveSessionId, attempt.bookingAttemptId, "OUTCOME_UNKNOWN");
        return;
      }
      await failBooking(runtime, hooks, createResult.failure, attempt.bookingAttemptId, createResult.durationMs);
      return;
    }

    console.log("MICROSOFT_EVENT_CREATED", {
      call_id: afterCommit.callId,
      scheduling_generation: afterCommit.scheduling.generation,
      booking_attempt_id: attempt.bookingAttemptId,
      provider: "microsoft",
      duration_ms: createResult.durationMs,
    });

    const confirmed: ConfirmedBooking = {
      bookingAttemptId: attempt.bookingAttemptId,
      provider: "microsoft",
      providerEventId: createResult.providerEventId,
      providerCalendarId: createResult.providerCalendarId,
      startUtc: selected.startUtc,
      endUtc: selected.endUtc,
      localStart: selected.localStart,
      localEnd: selected.localEnd,
      timezone: selected.timezone,
      customerName: request.customer.name,
      serviceId: request.service.id,
      confirmedAt: new Date().toISOString(),
      offerSetId: selected.offerSetId,
      slotId: selected.slotId,
      schedulingGeneration: afterCommit.scheduling.generation,
    };

    markBookingConfirmed(afterCommit.liveSessionId, slotKey, confirmed);
    updateBookingAttemptPhase(afterCommit.liveSessionId, attempt.bookingAttemptId, "CONFIRMED");

    runtime.replaceContext(
      applyBookingPhase(afterCommit, "BOOKING_CONFIRMED", {
        confirmed,
        activeAttempt: null,
        lastFailure: null,
      }),
    );

    console.log("BOOKING_CONFIRMED", {
      call_id: afterCommit.callId,
      scheduling_generation: afterCommit.scheduling.generation,
      offer_set_id: selected.offerSetId,
      slot_id: selected.slotId,
      booking_attempt_id: attempt.bookingAttemptId,
      provider: "microsoft",
      duration_ms: createResult.durationMs,
    });

    const append = buildLiveBookingConfirmedSessionAppend(confirmed);
    hooks.onLiveContext?.(append);
    console.log("LIVE_BOOKING_CONFIRMATION_SENT", {
      call_id: afterCommit.callId,
      scheduling_generation: afterCommit.scheduling.generation,
      offer_set_id: selected.offerSetId,
      slot_id: selected.slotId,
      booking_attempt_id: attempt.bookingAttemptId,
    });
  } finally {
    bookingInFlight.delete(ctx.liveSessionId);
  }
}

async function failBooking(
  runtime: {
    getSnapshot: () => VoiceV3CallContext;
    replaceContext: (ctx: VoiceV3CallContext) => void;
  },
  hooks: { onLiveContext?: (event: { type: string; thinking: string }) => void },
  failure: BookingFailure,
  bookingAttemptId: string,
  durationMs?: number,
): Promise<void> {
  const ctx = runtime.getSnapshot();
  console.log("BOOKING_FAILED", {
    call_id: ctx.callId,
    scheduling_generation: ctx.scheduling.generation,
    booking_attempt_id: bookingAttemptId,
    reason: failure.reason,
    duration_ms: durationMs ?? null,
  });
  runtime.replaceContext(
    applyBookingPhase(ctx, "BOOKING_FAILED", {
      lastFailure: failure,
      activeAttempt: null,
    }),
  );
  hooks.onLiveContext?.(buildLiveBookingFailureSessionAppend(failure));
  updateBookingAttemptPhase(ctx.liveSessionId, bookingAttemptId, "FAILED");
}
