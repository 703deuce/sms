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
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { registerDurableBooking } from "./durable-booking-store";
import { persistVoiceV3BookingAfterConfirmation } from "./persist-booking-after-confirmation";
import { calendarProviderForConfig } from "./direct-booking-strategy";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { pushLiveThinkingEvent } from "../live-runtime-hooks";
import { finishMutatingOperation } from "../operations/dispatch-mutations";
import { mapProviderFailureToRecoveryCode } from "../operations/provider-failure-map";
import { runAuthoritativeOperation } from "../operations/run-authoritative-operation";
import { getCurrentConversationRevision } from "../conversation/conversation-revision";

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
  hooks: VoiceV3LiveRuntimeHooks & {
    fetchRevalidateBusy?: RevalidateBusyFetcher;
    createBooking?: CreateBookingExecutor;
  } = {},
): Promise<void> {
  const ctx = runtime.getSnapshot();
  const rules = evaluateVoiceV3Rules(ctx, runtime.config);

  if (!rules.bookingReady || rules.requiredAction !== "BOOK_APPOINTMENT") {
    if (rules.slotSelected || ctx.booking.phase === "SLOT_SELECTED") {
      logVoiceV3Pipeline("calendar", "book_not_ready", {
        call_id: ctx.callId,
        live_session_id: ctx.liveSessionId,
        booking_ready: rules.bookingReady,
        required_action: rules.requiredAction,
        missing_required_fields: rules.missingRequiredFields,
      });
    }
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

  logVoiceV3Pipeline("calendar", "book_ready", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    scheduling_generation: ctx.scheduling.generation,
    offer_set_id: selected.offerSetId,
    slot_id: selected.slotId,
    booking_attempt_id: attempt.bookingAttemptId,
  });

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
  pushLiveThinkingEvent(hooks, buildLiveBookingInProgressSessionAppend(), "booking_in_progress");

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
      const { fetchVoiceV3BusyIntervals, mapBusyFailureToBookingFailure } = await import(
        "./calendar-provider-runtime"
      );
      const graphResult = await fetchVoiceV3BusyIntervals({
        config: runtime.config,
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
      });
      revalDuration = graphResult.durationMs;
      if (!graphResult.ok) {
        await failBooking(
          runtime,
          hooks,
          mapBusyFailureToBookingFailure({
            reason: graphResult.reason,
            message: graphResult.message,
            bookingAttemptId: attempt.bookingAttemptId,
            schedulingGeneration: ctx.scheduling.generation,
          }),
          attempt.bookingAttemptId,
        );
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
      pushLiveThinkingEvent(
        hooks,
        buildLiveSlotUnavailableSessionAppend({
          localStart: selected.localStart,
          timezone: selected.timezone,
        }),
        "slot_unavailable",
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

    const conversationRevisionAtCommitStart = getCurrentConversationRevision(
      latest.liveSessionId,
    );
    const commitProvider = calendarProviderForConfig(runtime.config) ?? "microsoft";

    const commitResult = await runAuthoritativeOperation({
      runtime,
      operationId: attempt.bookingAttemptId,
      type: "BOOK_APPOINTMENT",
      schedulingGeneration: latest.scheduling.generation,
      prepareStart: (c) => applyBookingPhase(c, "BOOKING_CREATING"),
      isStillAuthoritative: (c) => attemptStillValid(c, attempt),
      execute: async () => {
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
          provider: commitProvider,
        });

        let createResult:
          | { ok: true; providerEventId: string; providerCalendarId: string; durationMs: number }
          | { ok: false; failure: BookingFailure; durationMs: number; outcomeUncertain?: boolean };

        if (hooks.createBooking) {
          createResult = await hooks.createBooking({ request, config: runtime.config });
        } else {
          const { executeVoiceV3CreateBooking } = await import("./calendar-provider-runtime");
          const created = await executeVoiceV3CreateBooking({
            config: runtime.config,
            request,
            bookingAttemptId: attempt.bookingAttemptId,
            schedulingGeneration: latest.scheduling.generation,
          });
          if (created.ok) {
            createResult = created;
          } else {
            createResult = {
              ok: false,
              durationMs: created.durationMs,
              outcomeUncertain: created.outcomeUncertain,
              failure: created.failure,
            };
          }
        }

        if (!createResult.ok) {
          return {
            ok: false,
            failureCode: mapProviderFailureToRecoveryCode(createResult.failure.reason),
            outcomeUncertain: createResult.outcomeUncertain,
          };
        }
        return {
          ok: true,
          value: {
            providerEventId: createResult.providerEventId,
            providerCalendarId: createResult.providerCalendarId,
            durationMs: createResult.durationMs,
          },
        };
      },
      applySuccess: (afterCommit, value) => {
        console.log("CALENDAR_EVENT_CREATED", {
          call_id: afterCommit.callId,
          scheduling_generation: afterCommit.scheduling.generation,
          booking_attempt_id: attempt.bookingAttemptId,
          provider: commitProvider,
          duration_ms: value.durationMs,
        });

        const confirmed: ConfirmedBooking = {
          bookingAttemptId: attempt.bookingAttemptId,
          provider: commitProvider,
          providerEventId: value.providerEventId,
          providerCalendarId: value.providerCalendarId,
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
        registerDurableBooking(confirmed, {
          name: request.customer.name,
          email: request.customer.email,
          phone: request.customer.phone,
        });

        const workspaceId = runtime.config.workspaceId?.trim();
        if (workspaceId) {
          void persistVoiceV3BookingAfterConfirmation({
            workspaceId,
            callId: afterCommit.callId,
            confirmed,
            serviceName: request.service.name,
            customerEmail: request.customer.email,
            customerPhone: request.customer.phone,
          }).catch((err) => {
            console.error("VOICE_V3_BOOKING_PERSIST_FAILED", {
              call_id: afterCommit.callId,
              booking_attempt_id: attempt.bookingAttemptId,
              message: err instanceof Error ? err.message : String(err),
            });
          });
        } else {
          console.warn("VOICE_V3_BOOKING_PERSIST_SKIPPED", {
            call_id: afterCommit.callId,
            reason: "missing_workspace_id_on_config",
          });
        }

        console.log("BOOKING_CONFIRMED", {
          call_id: afterCommit.callId,
          scheduling_generation: afterCommit.scheduling.generation,
          offer_set_id: selected.offerSetId,
          slot_id: selected.slotId,
          booking_attempt_id: attempt.bookingAttemptId,
          provider: "microsoft",
          duration_ms: value.durationMs,
        });

        const currentConversationRevision = getCurrentConversationRevision(
          afterCommit.liveSessionId,
        );
        if (currentConversationRevision > conversationRevisionAtCommitStart) {
          console.log("COMMITTED_WRITE_RECONCILED_AFTER_REVISION", {
            live_session_id: afterCommit.liveSessionId,
            call_id: afterCommit.callId,
            tool: "book_appointment",
            operation_id: attempt.bookingAttemptId,
            revision_at_commit_start: conversationRevisionAtCommitStart,
            current_conversation_revision: currentConversationRevision,
            provider_commit_state: "CONFIRMED",
          });
        }

        const append = buildLiveBookingConfirmedSessionAppend(confirmed);
        pushLiveThinkingEvent(hooks, append, "booking_confirmed");
        console.log("LIVE_BOOKING_CONFIRMATION_SENT", {
          call_id: afterCommit.callId,
          scheduling_generation: afterCommit.scheduling.generation,
          offer_set_id: selected.offerSetId,
          slot_id: selected.slotId,
          booking_attempt_id: attempt.bookingAttemptId,
        });

        return applyBookingPhase(afterCommit, "BOOKING_CONFIRMED", {
          confirmed,
          activeAttempt: null,
          lastFailure: null,
        });
      },
      applyFailure: (afterCommit, terminal, failureCode) => {
        if (terminal === "STALE") {
          return applyBookingPhase(afterCommit, "SLOT_SELECTED", { activeAttempt: null });
        }
        if (terminal === "OUTCOME_UNKNOWN") {
          console.log("BOOKING_OUTCOME_UNKNOWN", {
            call_id: afterCommit.callId,
            booking_attempt_id: attempt.bookingAttemptId,
          });
          const failure: BookingFailure = {
            reason: failureCode,
            message: failureCode,
            at: new Date().toISOString(),
            bookingAttemptId: attempt.bookingAttemptId,
            schedulingGeneration: afterCommit.scheduling.generation,
          };
          pushLiveThinkingEvent(hooks, buildLiveBookingFailureSessionAppend(failure), "booking_outcome_unknown");
          updateBookingAttemptPhase(afterCommit.liveSessionId, attempt.bookingAttemptId, "OUTCOME_UNKNOWN");
          return applyBookingPhase(afterCommit, "BOOKING_OUTCOME_UNKNOWN", {
            lastFailure: failure,
            activeAttempt: { ...attempt, commitPhase: "OUTCOME_UNKNOWN" },
          });
        }
        const failure: BookingFailure = {
          reason: failureCode,
          message: failureCode,
          at: new Date().toISOString(),
          bookingAttemptId: attempt.bookingAttemptId,
          schedulingGeneration: afterCommit.scheduling.generation,
        };
        pushLiveThinkingEvent(hooks, buildLiveBookingFailureSessionAppend(failure), "booking_failed");
        updateBookingAttemptPhase(afterCommit.liveSessionId, attempt.bookingAttemptId, "FAILED");
        return applyBookingPhase(afterCommit, "BOOKING_FAILED", {
          lastFailure: failure,
          activeAttempt: null,
        });
      },
    });

    if (!commitResult.ok && commitResult.failureCode === "stale") {
      console.log("BOOKING_ATTEMPT_STALE", {
        call_id: runtime.getSnapshot().callId,
        booking_attempt_id: attempt.bookingAttemptId,
      });
    }
  } finally {
    bookingInFlight.delete(ctx.liveSessionId);
  }
}

async function failBooking(
  runtime: {
    getSnapshot: () => VoiceV3CallContext;
    replaceContext: (ctx: VoiceV3CallContext) => void;
  },
  hooks: VoiceV3LiveRuntimeHooks,
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
  const failureCode = mapProviderFailureToRecoveryCode(failure.reason);
  let failedCtx = finishMutatingOperation(ctx, bookingAttemptId, "FAILED", failureCode);
  runtime.replaceContext(
    applyBookingPhase(failedCtx, "BOOKING_FAILED", {
      lastFailure: failure,
      activeAttempt: null,
    }),
  );
  pushLiveThinkingEvent(hooks, buildLiveBookingFailureSessionAppend(failure), "booking_failed");
  updateBookingAttemptPhase(ctx.liveSessionId, bookingAttemptId, "FAILED");
}
