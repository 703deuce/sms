import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import { isStaleSchedulingPreference } from "../rules/stale-result";
import { buildFindAvailabilityRequest } from "./find-availability";
import { buildAvailabilityOfferSet } from "./offer-set";
import { generateAvailabilitySlots } from "./slot-generator";
import type { CalendarBusyInterval, FindAvailabilityFailure } from "./types";
import { buildLiveAvailabilitySessionAppend } from "./live-availability-context";
import { deriveDefaultPresentedSlotIds, recordPresentedOffer } from "./presentation";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { pushLiveThinkingEvent } from "../live-runtime-hooks";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { pushVoiceV3RecoveryToLive } from "../recovery/push-recovery-to-live";
import type { VoiceV3CallRuntime } from "../state/call-runtime";
import { startOperation, transitionOperation } from "../operations/registry";
import { noteBackendOperationDispatched } from "../telemetry/caller-turn-timing";
import { getCurrentConversationRevision } from "../conversation/conversation-revision";

export type FindBusyFetcher = (input: {
  request: ReturnType<typeof buildFindAvailabilityRequest>;
  config: VoiceV3AgentConfig;
}) => Promise<
  | { ok: true; busy: CalendarBusyInterval[]; durationMs: number }
  | { ok: false; failure: FindAvailabilityFailure; durationMs: number }
>;

type DispatchHooks = VoiceV3LiveRuntimeHooks & {
  fetchBusy?: FindBusyFetcher;
  /** Test-only: await Microsoft FIND in-process instead of execution lane background. */
  awaitCompletion?: boolean;
};

const defaultInFlight = new Map<string, number>();
const inFlightConversationRevision = new Map<string, number>();

export function markFindInFlight(
  liveSessionId: string,
  generation: number,
  conversationRevision?: number,
): void {
  defaultInFlight.set(liveSessionId, generation);
  if (conversationRevision != null) {
    inFlightConversationRevision.set(liveSessionId, conversationRevision);
  }
}

export function clearFindInFlight(liveSessionId: string): void {
  defaultInFlight.delete(liveSessionId);
  inFlightConversationRevision.delete(liveSessionId);
}

function isStaleConversationReadResult(
  liveSessionId: string,
  resultConversationRevision: number | undefined,
  currentRevision: number,
): boolean {
  if (resultConversationRevision == null) return false;
  return currentRevision > resultConversationRevision;
}

export function applyFindAvailabilityResult(
  ctx: VoiceV3CallContext,
  input: {
    schedulingGeneration: number;
    conversationRevision?: number;
    offerSet: ReturnType<typeof buildAvailabilityOfferSet> | null;
    failure: FindAvailabilityFailure | null;
    requestKey: string;
  },
): VoiceV3CallContext {
  const currentConversationRevision = getCurrentConversationRevision(ctx.liveSessionId);
  const revisionAtDispatch =
    input.conversationRevision ??
    inFlightConversationRevision.get(ctx.liveSessionId) ??
    currentConversationRevision;

  if (
    isStaleConversationReadResult(
      ctx.liveSessionId,
      revisionAtDispatch,
      currentConversationRevision,
    )
  ) {
    console.log("STALE_READ_RESULT_IGNORED", {
      tool: "find_availability",
      operation_id: input.requestKey,
      based_on_conversation_revision: revisionAtDispatch,
      current_conversation_revision: currentConversationRevision,
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
    });
    return ctx;
  }

  if (isStaleSchedulingPreference(ctx, input.schedulingGeneration)) {
    console.log("VOICE_TOOL_STALE_RESULT_IGNORED", {
      tool: "find_availability",
      operation_id: input.requestKey,
      operation_generation: input.schedulingGeneration,
      current_generation: ctx.scheduling.generation,
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
    });
    console.log("AVAILABILITY_RESULT_STALE", {
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
      result_scheduling_generation: input.schedulingGeneration,
      current_scheduling_generation: ctx.scheduling.generation,
    });
    return ctx;
  }

  const now = new Date().toISOString();
  if (input.failure) {
    return {
      ...ctx,
      updatedAt: now,
      availability: {
        ...ctx.availability,
        status: "failed",
        activeOfferSet: null,
        lastFailure: input.failure,
      inFlightGeneration: null,
      lastDispatchedRequestKey: input.requestKey,
      findStartedAt: null,
    },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

  const slots = input.offerSet?.slots ?? [];
  return {
    ...ctx,
    updatedAt: now,
    availability: {
      ...ctx.availability,
      status: slots.length > 0 ? "ready" : "empty",
      activeOfferSet: input.offerSet,
      lastFailure: null,
      inFlightGeneration: null,
      lastDispatchedRequestKey: input.requestKey,
      findStartedAt: null,
    },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

export async function dispatchFindAvailabilityIfRequired(
  runtime: {
    getSnapshot: () => VoiceV3CallContext;
    config: VoiceV3AgentConfig;
    replaceContext: (ctx: VoiceV3CallContext) => void;
  },
  hooks: DispatchHooks = {},
): Promise<void> {
  const ctx = runtime.getSnapshot();
  const rules = evaluateVoiceV3Rules(ctx, runtime.config);

  if (rules.requiredAction !== "FIND_AVAILABILITY") {
    if (rules.mayFindAvailability || rules.hasSchedulingPreference) {
      logVoiceV3Pipeline("calendar", "find_not_dispatched", {
        call_id: ctx.callId,
        live_session_id: ctx.liveSessionId,
        required_action: rules.requiredAction,
        may_find_availability: rules.mayFindAvailability,
        scheduling_requires_clarification: rules.schedulingRequiresClarification,
      });
    }
    return;
  }

  const request = buildFindAvailabilityRequest(ctx, runtime.config);
  if (!request) {
    console.log("FIND_AVAILABILITY_REQUEST_NOT_BUILDABLE", {
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
      scheduling_generation: ctx.scheduling.generation,
      has_normalized: Boolean(ctx.scheduling.normalized),
    });
    return;
  }

  logVoiceV3Pipeline("calendar", "find_required", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    scheduling_generation: request.schedulingGeneration,
    request_key: request.requestKey,
  });

  console.log("FIND_AVAILABILITY_REQUIRED", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    scheduling_generation: request.schedulingGeneration,
  });

  const findStartedAt = new Date().toISOString();
  console.log("ASYNC_ACTION_STARTED", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    action: "FIND_AVAILABILITY",
    scheduling_generation: request.schedulingGeneration,
    attempt_id: request.requestKey,
  });

  const opId = `find_${ctx.callId}_${request.schedulingGeneration}_${request.requestKey}`;
  let marked = {
    ...ctx,
    availability: {
      ...ctx.availability,
      status: "pending" as const,
      inFlightGeneration: request.schedulingGeneration,
      lastDispatchedRequestKey: request.requestKey,
      findStartedAt,
    },
  };
  marked = startOperation(marked, {
    operationId: opId,
    type: "FIND_AVAILABILITY",
    schedulingGeneration: request.schedulingGeneration,
    at: new Date(findStartedAt),
  });
  runtime.replaceContext(marked);
  markFindInFlight(
    ctx.liveSessionId,
    request.schedulingGeneration,
    getCurrentConversationRevision(ctx.liveSessionId),
  );
  noteBackendOperationDispatched(ctx.liveSessionId, opId);

  console.log("FIND_AVAILABILITY_DISPATCHED", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    scheduling_generation: request.schedulingGeneration,
    request_key: request.requestKey,
    execution_lane: hooks.awaitCompletion ? "inline" : "background",
  });

  const work = completeFindAvailabilityAfterDispatch({
    runtime,
    hooks,
    request,
    opId,
    findStartedAt,
    startedAt: Date.now(),
    callId: ctx.callId,
    liveSessionId: ctx.liveSessionId,
  });

  if (hooks.awaitCompletion) {
    return work;
  }

  void work.catch((err) => {
    console.error("FIND_AVAILABILITY_BACKGROUND_FAILED", {
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
      scheduling_generation: request.schedulingGeneration,
      err,
    });
  });
}

async function completeFindAvailabilityAfterDispatch(input: {
  runtime: {
    getSnapshot: () => VoiceV3CallContext;
    config: VoiceV3AgentConfig;
    replaceContext: (ctx: VoiceV3CallContext) => void;
  };
  hooks: DispatchHooks;
  request: NonNullable<ReturnType<typeof buildFindAvailabilityRequest>>;
  opId: string;
  findStartedAt: string;
  startedAt: number;
  callId: string;
  liveSessionId: string;
}): Promise<void> {
  const { runtime, hooks, request, opId } = input;
  const ctx = runtime.getSnapshot();
  const started = input.startedAt;
  console.log("MICROSOFT_AVAILABILITY_REQUEST_STARTED", {
    call_id: ctx.callId,
    scheduling_generation: request.schedulingGeneration,
  });

  let busy: CalendarBusyInterval[] = [];
  let failure: FindAvailabilityFailure | null = null;
  let graphDurationMs = 0;

  if (hooks.fetchBusy) {
    const result = await hooks.fetchBusy({ request, config: runtime.config });
    graphDurationMs = result.durationMs;
    if (result.ok) {
      busy = result.busy;
    } else {
      failure = result.failure;
    }
  } else if (!runtime.config.calendar?.connectionId) {
    failure = {
      reason: "configuration_missing",
      message: "Calendar not configured on agent",
      at: new Date().toISOString(),
      schedulingGeneration: request.schedulingGeneration,
    };
  } else {
    const { fetchMicrosoftBusyIntervals } = await import("./microsoft/microsoft-find-availability");
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    const connection = await prisma.voiceCalendarConnection.findFirst({
      where: { id: runtime.config.calendar!.connectionId, provider: "microsoft" },
    });
    if (!connection || connection.status !== "connected") {
      failure = {
        reason: "configuration_missing",
        message: "Microsoft calendar connection not found or not connected",
        at: new Date().toISOString(),
        schedulingGeneration: request.schedulingGeneration,
      };
    } else {
      const calendarConfig = (connection.config || {}) as import("@/lib/voice/calendar/providers").CalendarConfig;
      const graphResult = await fetchMicrosoftBusyIntervals({
        request,
        connectionId: connection.id,
        calendarConfig,
      });
      graphDurationMs = graphResult.durationMs;
      if (graphResult.ok) {
        busy = graphResult.busy;
      } else {
        failure = {
          reason: graphResult.reason,
          message: graphResult.message,
          at: new Date().toISOString(),
          schedulingGeneration: request.schedulingGeneration,
        };
      }
    }
  }

  console.log("MICROSOFT_AVAILABILITY_REQUEST_COMPLETED", {
    call_id: ctx.callId,
    scheduling_generation: request.schedulingGeneration,
    duration_ms: graphDurationMs,
    busy_interval_count: busy.length,
    failed: Boolean(failure),
  });

  clearFindInFlight(ctx.liveSessionId);

  const latest = runtime.getSnapshot();
  const staleOpId = `find_${latest.callId}_${request.schedulingGeneration}_${request.requestKey}`;
  if (isStaleSchedulingPreference(latest, request.schedulingGeneration)) {
    console.log("AVAILABILITY_RESULT_STALE", {
      call_id: latest.callId,
      live_session_id: latest.liveSessionId,
      result_scheduling_generation: request.schedulingGeneration,
      current_scheduling_generation: latest.scheduling.generation,
    });
    runtime.replaceContext(transitionOperation(latest, staleOpId, "STALE"));
    return;
  }

  let offerSet = null;
  if (!failure) {
    const existing = latest.appointmentManagement?.verifiedExisting;
    const slots = generateAvailabilitySlots({
      timezone: request.timezone,
      rangeStartUtc: request.rangeStartUtc,
      rangeEndUtc: request.rangeEndUtc,
      durationMinutes: request.durationMinutes,
      slotStepMinutes: runtime.config.service.slotStepMinutes,
      businessHours: runtime.config.businessHours,
      busyIntervals: busy,
      freeBusyOverrides: existing
        ? [{ startUtc: existing.startUtc, endUtc: existing.endUtc }]
        : undefined,
    });
    offerSet = buildAvailabilityOfferSet({
      schedulingGeneration: request.schedulingGeneration,
      timezone: request.timezone,
      slots,
    });
    console.log("AVAILABILITY_OFFER_SET_CREATED", {
      call_id: latest.callId,
      scheduling_generation: request.schedulingGeneration,
      offer_set_id: offerSet.offerSetId,
      slot_count: offerSet.slots.length,
      duration_ms: Date.now() - started,
    });
  } else {
    console.log("FIND_AVAILABILITY_FAILED", {
      call_id: latest.callId,
      scheduling_generation: request.schedulingGeneration,
      reason: failure.reason,
      message: failure.message,
      range_start_utc: request.rangeStartUtc,
      range_end_utc: request.rangeEndUtc,
      duration_ms: Date.now() - started,
    });
  }

  let updated = applyFindAvailabilityResult(latest, {
    schedulingGeneration: request.schedulingGeneration,
    conversationRevision: inFlightConversationRevision.get(latest.liveSessionId),
    offerSet,
    failure,
    requestKey: request.requestKey,
  });

  let presentedSlotIds: string[] | undefined;
  if (offerSet) {
    presentedSlotIds = deriveDefaultPresentedSlotIds(offerSet);
    const presented = recordPresentedOffer({ offerSet, presentedSlotIds });
    updated = {
      ...updated,
      presentation: { current: presented },
    };
    console.log("PRESENTED_OFFER_RECORDED", {
      call_id: latest.callId,
      scheduling_generation: request.schedulingGeneration,
      offer_set_id: offerSet.offerSetId,
      presented_slot_ids: presentedSlotIds,
    });
  }

  const current = runtime.getSnapshot();
  if (current.scheduling.generation !== request.schedulingGeneration) {
    const staleCtx = transitionOperation(current, staleOpId, "STALE");
    runtime.replaceContext(staleCtx);
    return;
  }
  let finalCtx = updated;
  if (failure) {
    finalCtx = transitionOperation(finalCtx, staleOpId, "FAILED", {
      failureCode: failure.reason,
    });
  } else {
    finalCtx = transitionOperation(finalCtx, staleOpId, "SUCCEEDED");
  }
  runtime.replaceContext(finalCtx);

  if (failure) {
    console.log("ASYNC_ACTION_FAILED", {
      call_id: latest.callId,
      live_session_id: latest.liveSessionId,
      action: "FIND_AVAILABILITY",
      scheduling_generation: request.schedulingGeneration,
      reason: failure.reason,
    });
  } else {
    console.log("ASYNC_ACTION_SUCCEEDED", {
      call_id: latest.callId,
      live_session_id: latest.liveSessionId,
      action: "FIND_AVAILABILITY",
      scheduling_generation: request.schedulingGeneration,
      slot_count: offerSet?.slots.length ?? 0,
    });
  }

  const append = buildLiveAvailabilitySessionAppend(
    offerSet,
    failure,
    request.schedulingGeneration,
    presentedSlotIds,
  );
  pushLiveThinkingEvent(
    hooks,
    append,
    failure ? "availability_failed" : offerSet?.slots.length ? "availability_ready" : "availability_empty",
  );
  console.log("LIVE_AVAILABILITY_CONTEXT_SENT", {
    call_id: latest.callId,
    scheduling_generation: request.schedulingGeneration,
    offer_set_id: offerSet?.offerSetId ?? null,
    slot_count: offerSet?.slots.length ?? 0,
    failed: Boolean(failure),
  });

  if (failure) {
    pushVoiceV3RecoveryToLive({
      runtime: runtime as VoiceV3CallRuntime,
      liveSessionId: latest.liveSessionId,
      hooks,
      speakReason: "availability_failed",
    });
  }
}

/** Fire-and-forget FIND when rules allow; does not block conversation lane. */
export function enqueueFindAvailabilityIfRequired(
  runtime: {
    getSnapshot: () => VoiceV3CallContext;
    config: VoiceV3AgentConfig;
    replaceContext: (ctx: VoiceV3CallContext) => void;
  },
  hooks: DispatchHooks = {},
): void {
  void dispatchFindAvailabilityIfRequired(runtime, hooks);
}
