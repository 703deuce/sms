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

    console.log("RESCHEDULE_COMMIT_SENT", {
      call_id: ctx.callId,
      provider_event_id: existing.providerEventId,
      attempt_id: attemptId,
    });

    const summary = `${runtime.config.service.name} — ${ctx.intake.values.name?.value ?? "Guest"}`;
    let updateOk = false;
    if (hooks.updateBooking) {
      const u = await hooks.updateBooking({
        providerEventId: existing.providerEventId,
        providerCalendarId: existing.providerCalendarId,
        startUtc: selected.startUtc,
        endUtc: selected.endUtc,
        timezone: selected.timezone,
        summary,
        config: runtime.config,
      });
      updateOk = u.ok;
      if (!u.ok && u.outcomeUncertain) {
        runtime.replaceContext({
          ...runtime.getSnapshot(),
          appointmentManagement: {
            ...runtime.getSnapshot().appointmentManagement,
            reschedule: { phase: "RESCHEDULE_OUTCOME_UNKNOWN", attemptId },
          },
        });
        return;
      }
    } else {
      updateOk = true;
    }

    if (!updateOk) {
      runtime.replaceContext({
        ...runtime.getSnapshot(),
        appointmentManagement: {
          ...runtime.getSnapshot().appointmentManagement,
          reschedule: { phase: "RESCHEDULE_FAILED", attemptId },
        },
      });
      return;
    }

    updateDurableBookingTimes(existing.internalBookingId, {
      startUtc: selected.startUtc,
      endUtc: selected.endUtc,
      localStart: selected.localStart,
      localEnd: selected.localEnd,
    });

    const updatedExisting = {
      ...existing,
      startUtc: selected.startUtc,
      endUtc: selected.endUtc,
      localStart: selected.localStart,
      localEnd: selected.localEnd,
    };

    runtime.replaceContext({
      ...runtime.getSnapshot(),
      appointmentManagement: {
        ...runtime.getSnapshot().appointmentManagement,
        verifiedExisting: updatedExisting,
        reschedule: { phase: "RESCHEDULE_CONFIRMED", attemptId },
      },
    });

    console.log("RESCHEDULE_CONFIRMED", {
      call_id: ctx.callId,
      provider_event_id: existing.providerEventId,
      attempt_id: attemptId,
    });

    pushLiveThinkingEvent(
      hooks,
      buildLiveRescheduleConfirmedAppend({
        fromLocal: existing.localStart,
        toLocal: selected.localStart,
        timezone: selected.timezone,
      }),
      "reschedule_confirmed",
    );
  } finally {
    inFlight.delete(ctx.liveSessionId);
  }
}
