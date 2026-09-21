import { createId } from "@/lib/supabase/id";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import { isSelectedSlotAuthoritative } from "./selected-slot";
import { evaluateSlotRevalidation, revalidationBusyWindow } from "./revalidate-selected-slot";
import { filterBusyForReschedule } from "./slot-generator";
import { updateDurableBookingTimes } from "./durable-booking-store";
import { buildLiveRescheduleConfirmedAppend } from "./live-management-context";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { pushLiveThinkingEvent } from "../live-runtime-hooks";
import type { RevalidateBusyFetcher } from "./book-dispatch";
import { runAuthoritativeOperation } from "../operations/run-authoritative-operation";
import { mapProviderFailureToRecoveryCode } from "../operations/provider-failure-map";
import { calendarProviderForConfig } from "./direct-booking-strategy";

export type UpdateBookingExecutor = (input: {
  providerEventId: string;
  providerCalendarId: string;
  startUtc: string;
  endUtc: string;
  timezone: string;
  summary: string;
  config: VoiceV3AgentConfig;
}) => Promise<
  | { ok: true; durationMs: number }
  | { ok: false; message: string; outcomeUncertain?: boolean }
>;

const inFlight = new Set<string>();

export async function dispatchRescheduleIfRequired(
  runtime: {
    getSnapshot: () => VoiceV3CallContext;
    config: VoiceV3AgentConfig;
    replaceContext: (ctx: VoiceV3CallContext) => void;
  },
  hooks: VoiceV3LiveRuntimeHooks & {
    fetchRevalidateBusy?: RevalidateBusyFetcher;
    updateBooking?: UpdateBookingExecutor;
  } = {},
): Promise<void> {
  const ctx = runtime.getSnapshot();
  const rules = evaluateVoiceV3Rules(ctx, runtime.config);
  if (rules.requiredAction !== "RESCHEDULE_APPOINTMENT") return;

  const existing = ctx.appointmentManagement.verifiedExisting;
  const selected = ctx.selection.selected;
  const offer = ctx.availability.activeOfferSet;
  if (!existing || !selected || !offer) return;

  if (inFlight.has(ctx.liveSessionId)) return;
  inFlight.add(ctx.liveSessionId);

  const attemptId = ctx.appointmentManagement.reschedule.attemptId ?? `rsc_${createId()}`;
  console.log("RESCHEDULE_REQUESTED", {
    call_id: ctx.callId,
    provider_event_id: existing.providerEventId,
    attempt_id: attemptId,
  });

  try {
    runtime.replaceContext({
      ...ctx,
      appointmentManagement: {
        ...ctx.appointmentManagement,
        reschedule: { ...ctx.appointmentManagement.reschedule, phase: "RESCHEDULE_REVALIDATING", attemptId },
      },
    });

    console.log("RESCHEDULE_REVALIDATION_STARTED", { call_id: ctx.callId, attempt_id: attemptId });
    const window = revalidationBusyWindow(selected);
    let busy: import("./types").CalendarBusyInterval[] = [];
    if (hooks.fetchRevalidateBusy) {
      const r = await hooks.fetchRevalidateBusy({
        connectionId: runtime.config.calendar!.connectionId,
        calendarIds: runtime.config.calendar!.calendarIds,
        rangeStartUtc: window.rangeStartUtc,
        rangeEndUtc: window.rangeEndUtc,
        config: runtime.config,
      });
      if (!r.ok) {
        runtime.replaceContext({
          ...runtime.getSnapshot(),
          appointmentManagement: {
            ...runtime.getSnapshot().appointmentManagement,
            reschedule: { phase: "RESCHEDULE_FAILED", attemptId },
          },
        });
        return;
      }
      busy = r.busy;
    } else {
      const { fetchVoiceV3BusyIntervals } = await import("./calendar-provider-runtime");
      const graphResult = await fetchVoiceV3BusyIntervals({
        config: runtime.config,
        request: {
          callId: ctx.callId,
          schedulingGeneration: ctx.scheduling.generation,
          timezone: ctx.business.timezone,
          rangeStartUtc: window.rangeStartUtc,
          rangeEndUtc: window.rangeEndUtc,
          durationMinutes: runtime.config.service.durationMinutes,
          calendarIds: runtime.config.calendar?.calendarIds ?? ["primary"],
          requestKey: `reschedule_revalidate|${attemptId}`,
        },
      });
      if (!graphResult.ok) {
        runtime.replaceContext({
          ...runtime.getSnapshot(),
          appointmentManagement: {
            ...runtime.getSnapshot().appointmentManagement,
            reschedule: { phase: "RESCHEDULE_FAILED", attemptId },
          },
        });
        return;
      }
      busy = graphResult.busy;
    }

    const filtered = filterBusyForReschedule(busy, {
      startUtc: existing.startUtc,
      endUtc: existing.endUtc,
    });

    const reval = evaluateSlotRevalidation(selected, filtered);
    if (!reval.ok) {
      console.log("RESCHEDULE_FAILED", { call_id: ctx.callId, reason: "slot_unavailable" });
      runtime.replaceContext({
        ...runtime.getSnapshot(),
        appointmentManagement: {
          ...runtime.getSnapshot().appointmentManagement,
          reschedule: { phase: "RESCHEDULE_FAILED", attemptId },
        },
      });
      return;
    }

    const summary = `${runtime.config.service.name} — ${ctx.intake.values.name?.value ?? "Guest"}`;
    const slotSnapshot = selected;
    await runAuthoritativeOperation({
      runtime,
      operationId: attemptId,
      type: "RESCHEDULE_APPOINTMENT",
      schedulingGeneration: runtime.getSnapshot().scheduling.generation,
      prepareStart: (c) => ({
        ...c,
        appointmentManagement: {
          ...c.appointmentManagement,
          reschedule: { phase: "RESCHEDULE_COMMITTING", attemptId },
        },
        runtime: { version: c.runtime.version + 1 },
      }),
      isStillAuthoritative: (c) => {
        const sel = c.selection.selected;
        const ex = c.appointmentManagement.verifiedExisting;
        if (!sel || !ex || ex.providerEventId !== existing.providerEventId) return false;
        return isSelectedSlotAuthoritative(sel, {
          offerSetId: offer.offerSetId,
          schedulingGeneration: c.scheduling.generation,
        });
      },
      execute: async () => {
        console.log("RESCHEDULE_COMMIT_SENT", {
          call_id: ctx.callId,
          provider_event_id: existing.providerEventId,
          attempt_id: attemptId,
        });

        const runUpdate = async (): Promise<
          | { ok: true; durationMs: number }
          | { ok: false; message: string; outcomeUncertain?: boolean }
        > => {
          if (hooks.updateBooking) {
            return hooks.updateBooking({
              providerEventId: existing.providerEventId,
              providerCalendarId: existing.providerCalendarId,
              startUtc: slotSnapshot.startUtc,
              endUtc: slotSnapshot.endUtc,
              timezone: slotSnapshot.timezone,
              summary,
              config: runtime.config,
            });
          }

          const provider =
            existing.provider === "google" || existing.provider === "microsoft"
              ? existing.provider
              : calendarProviderForConfig(runtime.config);

          if (provider === "google") {
            const { resolveVoiceV3GoogleCalendar } = await import(
              "./google/resolve-voice-v3-google-calendar"
            );
            const resolved = await resolveVoiceV3GoogleCalendar(runtime.config);
            if (!resolved.ok) {
              return { ok: false, message: resolved.message };
            }
            const { validateGoogleAppointmentBeforeMutation } = await import(
              "./google/validate-google-appointment"
            );
            const validation = await validateGoogleAppointmentBeforeMutation({
              appointment: existing,
              connectionId: resolved.connectionId,
              calendarConfig: resolved.calendarConfig,
            });
            if (!validation.ok) {
              return {
                ok: false,
                message: validation.message,
                outcomeUncertain: validation.reason === "error",
              };
            }
            const { executeGoogleUpdateBooking } = await import("./google/google-update-booking");
            const ms = await executeGoogleUpdateBooking(
              {
                connectionId: resolved.connectionId,
                providerEventId: existing.providerEventId,
                providerCalendarId: existing.providerCalendarId,
                startUtc: slotSnapshot.startUtc,
                endUtc: slotSnapshot.endUtc,
                timezone: slotSnapshot.timezone,
              },
              resolved.calendarConfig,
            );
            if (ms.ok) return { ok: true, durationMs: ms.durationMs };
            return {
              ok: false,
              message: ms.message,
              outcomeUncertain: ms.outcomeUncertain,
            };
          }

          const { resolveVoiceV3MicrosoftCalendar } = await import(
            "./microsoft/resolve-voice-v3-microsoft-calendar"
          );
          const resolved = await resolveVoiceV3MicrosoftCalendar(runtime.config);
          if (!resolved.ok) {
            return { ok: false, message: resolved.message };
          }
          const { validateMicrosoftAppointmentBeforeMutation } = await import(
            "./microsoft/validate-microsoft-appointment"
          );
          const validation = await validateMicrosoftAppointmentBeforeMutation({
            appointment: existing,
            connectionId: resolved.connectionId,
            calendarConfig: resolved.calendarConfig,
          });
          if (!validation.ok) {
            return {
              ok: false,
              message: validation.message,
              outcomeUncertain: validation.reason === "error",
            };
          }
          const { executeMicrosoftUpdateBooking } = await import(
            "./microsoft/microsoft-update-booking"
          );
          const ms = await executeMicrosoftUpdateBooking(
            {
              connectionId: resolved.connectionId,
              providerEventId: existing.providerEventId,
              providerCalendarId: existing.providerCalendarId,
              startUtc: slotSnapshot.startUtc,
              endUtc: slotSnapshot.endUtc,
              timezone: slotSnapshot.timezone,
              summary,
            },
            resolved.calendarConfig,
          );
          if (ms.ok) return { ok: true, durationMs: ms.durationMs };
          return {
            ok: false,
            message: ms.message,
            outcomeUncertain: ms.outcomeUncertain,
          };
        };

        const u = await runUpdate();
        if (u.ok) return { ok: true, value: { durationMs: u.durationMs } };
        if (u.outcomeUncertain) {
          const provider =
            existing.provider === "google" || existing.provider === "microsoft"
              ? existing.provider
              : calendarProviderForConfig(runtime.config);
          if (provider === "google") {
            const { reconcileGoogleRescheduleOutcome } = await import(
              "./google/google-reconcile-mutation-outcome"
            );
            const verdict = await reconcileGoogleRescheduleOutcome({
              appointment: existing,
              requestedStartUtc: slotSnapshot.startUtc,
              requestedEndUtc: slotSnapshot.endUtc,
              config: runtime.config,
            });
            if (verdict === "NEW_TIME") {
              return { ok: true, value: { durationMs: u.durationMs } };
            }
          } else {
            const { reconcileMicrosoftRescheduleOutcome } = await import(
              "./microsoft/microsoft-reconcile-mutation-outcome"
            );
            const verdict = await reconcileMicrosoftRescheduleOutcome({
              appointment: existing,
              requestedStartUtc: slotSnapshot.startUtc,
              requestedEndUtc: slotSnapshot.endUtc,
              config: runtime.config,
            });
            if (verdict === "NEW_TIME") {
              return { ok: true, value: { durationMs: u.durationMs } };
            }
          }
        }
        return {
          ok: false,
          failureCode: mapProviderFailureToRecoveryCode(u.message),
          outcomeUncertain: u.outcomeUncertain,
        };
      },
      applySuccess: (c) => {
        updateDurableBookingTimes(existing.internalBookingId, {
          startUtc: slotSnapshot.startUtc,
          endUtc: slotSnapshot.endUtc,
          localStart: slotSnapshot.localStart,
          localEnd: slotSnapshot.localEnd,
        });
        const updatedExisting = {
          ...existing,
          startUtc: slotSnapshot.startUtc,
          endUtc: slotSnapshot.endUtc,
          localStart: slotSnapshot.localStart,
          localEnd: slotSnapshot.localEnd,
        };
        console.log("RESCHEDULE_CONFIRMED", {
          call_id: ctx.callId,
          provider_event_id: existing.providerEventId,
          attempt_id: attemptId,
        });
        pushLiveThinkingEvent(
          hooks,
          buildLiveRescheduleConfirmedAppend({
            fromLocal: existing.localStart,
            toLocal: slotSnapshot.localStart,
            timezone: slotSnapshot.timezone,
          }),
          "reschedule_confirmed",
        );
        return {
          ...c,
          appointmentManagement: {
            ...c.appointmentManagement,
            verifiedExisting: updatedExisting,
            reschedule: { phase: "RESCHEDULE_CONFIRMED", attemptId },
          },
        };
      },
      applyFailure: (c, terminal) => ({
        ...c,
        appointmentManagement: {
          ...c.appointmentManagement,
          reschedule: {
            phase:
              terminal === "OUTCOME_UNKNOWN" ? "RESCHEDULE_OUTCOME_UNKNOWN" : "RESCHEDULE_FAILED",
            attemptId,
          },
        },
      }),
    });
  } finally {
    inFlight.delete(ctx.liveSessionId);
  }
}
