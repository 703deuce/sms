import { createId } from "@/lib/supabase/id";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import { isSelectedSlotAuthoritative } from "./selected-slot";
import { evaluateSlotRevalidation, revalidationBusyWindow } from "./revalidate-selected-slot";
import { updateDurableBookingTimes } from "./durable-booking-store";
import { buildLiveRescheduleConfirmedAppend } from "./live-management-context";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { pushLiveThinkingEvent } from "../live-runtime-hooks";
import type { RevalidateBusyFetcher } from "./book-dispatch";
import { runAuthoritativeOperation } from "../operations/run-authoritative-operation";
import { mapProviderFailureToRecoveryCode } from "../operations/provider-failure-map";

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
    }

    const filtered = busy.filter((b) => {
      const bs = new Date(b.startUtc).getTime();
      const be = new Date(b.endUtc).getTime();
      const es = new Date(existing.startUtc).getTime();
      const ee = new Date(existing.endUtc).getTime();
      return !(bs === es && be === ee);
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
        if (!hooks.updateBooking) {
          return { ok: true, value: { durationMs: 0 } };
        }
        const u = await hooks.updateBooking({
          providerEventId: existing.providerEventId,
          providerCalendarId: existing.providerCalendarId,
          startUtc: slotSnapshot.startUtc,
          endUtc: slotSnapshot.endUtc,
          timezone: slotSnapshot.timezone,
          summary,
          config: runtime.config,
        });
        if (u.ok) return { ok: true, value: { durationMs: u.durationMs } };
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
