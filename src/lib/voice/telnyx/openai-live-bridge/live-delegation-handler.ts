import { liveBaselineEventId } from "./live-event-ids";
import {
  dispatchLiveVoiceTool,
  type LiveToolDispatchContext,
  liveToolExecutorLabel,
} from "./live-tool-runtime";
import {
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
} from "@/lib/voice-v2/telnyx-tool-definition";
import type { LiveTurnTraceHooks } from "./live-turn-trace";
import { createLiveDelegationContextTracker } from "./live-delegation-context-tracker";
import type { LiveConversationTranscript } from "./live-conversation-transcript";
import {
  buildDelegationDeveloperText,
  buildLiveDelegationContextItem,
  type LiveDelegationHydratedContext,
} from "./live-delegation-context";
import { buildLiveResponsesRuntimeContext } from "./live-runtime-context";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";
import { buildLiveControlPlaneSyncEvents } from "./live-backend-state-sync";
import { shouldIssueResponseCreateOnDelegation } from "./live-workflow-tool-filter";
import type { VoiceV2NextStage } from "@/lib/voice-v2/booking-workflow";
import { VOICE_V2_SAVE_INTAKE_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { createLiveToolWaitProgressController } from "./live-tool-wait-commentary";
import {
  beginLiveVoiceToolExecution,
  finishLiveVoiceToolExecution,
} from "./live-tool-execution-record";

type LiveEvent = Record<string, unknown>;

function logLiveObs(event: string, fields: Record<string, unknown>) {
  console.info(`LIVE_${event} ${JSON.stringify(fields)}`);
}

function logResponseCreate(
  callId: string,
  reason: string,
  stage: VoiceV2NextStage,
  allowed: unknown,
) {
  console.info(
    `LIVE_RESPONSE_CREATE ${JSON.stringify({
      callId,
      reason,
      stage,
      allowed_next_actions: allowed,
    })}`,
  );
}

export function createLiveDelegationHandler(input: {
  callId: string;
  claims: RealtimeBridgeStreamClaims;
  callContext: LiveToolDispatchContext;
  conversationTranscript: LiveConversationTranscript;
  sendLiveOut: (event: Record<string, unknown>) => void;
  turnTrace?: LiveTurnTraceHooks;
}) {
  let toolBusy = false;
  let activeDelegationId: string | null = null;
  let delegationEpisodeCount = 0;
  let hydratedContext: LiveDelegationHydratedContext | null = null;
  let hydratePromise: Promise<void> | null = null;
  const contextTracker = createLiveDelegationContextTracker({
    callId: input.callId,
    onLog: logLiveObs,
  });
  const controlPlane = input.callContext.controlPlane;

  const syncControlPlaneToLive = () => {
    for (const event of buildLiveControlPlaneSyncEvents(controlPlane)) {
      input.sendLiveOut(event);
    }
    const env = controlPlane.getWorkflowEnvelope();
    logLiveObs("BACKEND_STATE_SYNC", {
      call_id: input.callId,
      live_session_id: controlPlane.getLiveSessionId(),
      offer_set_id: controlPlane.getCallContext()?.currentOfferSet?.offerSetId ?? null,
      booking_status: controlPlane.isBookingConfirmed() ? "BOOKING_CONFIRMED" : "NOT_BOOKED",
      booking_confirmed: controlPlane.isBookingConfirmed(),
      voice_v2_next_stage: env.voice_v2_next_stage,
      active_tool_names: controlPlane.getActiveTools().map((t) => t.name),
    });
  };

  const ensureHydratedContext = async (): Promise<LiveDelegationHydratedContext> => {
    if (hydratedContext) return hydratedContext;
    if (!hydratePromise) {
      hydratePromise = (async () => {
        const t0 = Date.now();
        await controlPlane.ensureHydrated();
        const { runtimeContext, bookingContext } = await buildLiveResponsesRuntimeContext(
          input.claims,
        );
        hydratedContext = {
          callerStateJson: runtimeContext,
          bookingConfigJson: bookingContext,
        };
        console.info(
          `LIVE_DELEGATION_HYDRATE ${JSON.stringify({
            callId: input.callId,
            elapsed_ms: Date.now() - t0,
          })}`,
        );
      })();
    }
    await hydratePromise;
    return hydratedContext!;
  };

  const issueResponseCreate = (reason: string) => {
    const env = controlPlane.getWorkflowEnvelope();
    const stage = controlPlane.getStage();
    logResponseCreate(input.callId, reason, stage, env.allowed_next_actions);
    input.sendLiveOut({
      type: "response.create",
      event_id: liveBaselineEventId("delegation_ctx_resp"),
    });
    input.turnTrace?.onResponseCreateSent();
  };

  const pushDelegationContext = async (delegationId: string | null) => {
    delegationEpisodeCount += 1;
    const isFirstDelegation = delegationEpisodeCount === 1;
    await controlPlane.ensureHydrated();
    controlPlane.logStageTransitionIfChanged();
    syncControlPlaneToLive();

    const hydrated = await ensureHydratedContext();
    const developerText = buildDelegationDeveloperText({
      transcript: input.conversationTranscript,
      controlPlane,
      hydrated,
      isFirstDelegation,
    });
    const contextItem = buildLiveDelegationContextItem({ developerText });
    const eventId = String(contextItem.event_id || "");
    contextTracker.markSent(eventId, delegationEpisodeCount);
    input.sendLiveOut(contextItem);
    input.conversationTranscript.markDelegationCheckpoint();

    const env = controlPlane.getWorkflowEnvelope();
    const stage = controlPlane.getStage();
    const allowed = (env.allowed_next_actions as string[]) || [];

    logLiveObs("DELEGATION_CONTEXT_ITEM_SENT", {
      call_id: input.callId,
      has_active_delegation: Boolean(delegationId ?? activeDelegationId),
      delegation_id: delegationId ?? activeDelegationId,
      event_type: contextItem.type,
      episode: delegationEpisodeCount,
      event_id: eventId,
      developer_text_chars: developerText.length,
      transcript_cursor: input.conversationTranscript.delegationCursorIndex(),
      transcript_segments: input.conversationTranscript.segmentCount(),
      voice_v2_next_stage: stage,
      allowed_next_actions: allowed,
    });

    if (shouldIssueResponseCreateOnDelegation(stage, allowed)) {
      issueResponseCreate("delegation_proactive_scheduling");
    }
  };

  input.callContext.onBookingStateChanged = () => {
    syncControlPlaneToLive();
    controlPlane.logStageTransitionIfChanged();
  };

  const returnLiveToolResult = async (opts: {
    callId: string;
    delegationId?: string | null;
    output: string;
    toolName: string;
    executor: string;
    elapsedMs: number;
  }) => {
    const delegation_id = opts.delegationId ?? null;
    input.sendLiveOut({
      type: "response.item.create",
      event_id: liveBaselineEventId("tool_out"),
      item: {
        type: "function_call_output",
        call_id: opts.callId,
        output: opts.output,
      },
    });
    logLiveObs("FUNCTION_OUTPUT_SENT", {
      callId: input.callId,
      tool_name: opts.toolName,
      call_id: opts.callId,
      delegation_id,
      executor: opts.executor,
      elapsed_ms: opts.elapsedMs,
    });

    const stage = controlPlane.getStage();
    const continueBackend =
      stage !== "BOOKING_CONFIRMED" &&
      stage !== "COMPLETE" &&
      opts.toolName !== VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE;

    const bookJustConfirmed =
      opts.toolName === VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE &&
      controlPlane.isBookingConfirmed();

    if (continueBackend && !bookJustConfirmed) {
      issueResponseCreate("tool_continuation");
      logLiveObs("RESPONSE_CONTINUED", {
        callId: input.callId,
        delegation_id,
        tool_name: opts.toolName,
      });
    } else {
      logLiveObs("RESPONSE_CREATE_SKIPPED", {
        callId: input.callId,
        delegation_id,
        tool_name: opts.toolName,
        stage,
        reason: bookJustConfirmed ? "booking_confirmed_wrap_up" : "stage_complete",
      });
    }
  };

  const handleLiveFunctionCall = async (opts: {
    delegationId?: string | null;
    item: Record<string, unknown>;
  }) => {
    if (toolBusy) {
      logLiveObs("FUNCTION_CALL_SKIPPED_BUSY", { callId: input.callId });
      return;
    }
    toolBusy = true;
    const toolName = String(opts.item.name || "");
    const callId = String(opts.item.call_id || "");
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(String(opts.item.arguments || "{}")) as Record<string, unknown>;
    } catch {
      await returnLiveToolResult({
        callId,
        delegationId: opts.delegationId,
        toolName,
        executor: "none",
        elapsedMs: 0,
        output: JSON.stringify({ ok: false, error: "INVALID_TOOL_ARGUMENTS" }),
      });
      toolBusy = false;
      return;
    }

    let generationAtStart = input.callContext.schedulingGeneration;
    if (toolName === VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE) {
      const requestedDate = String(args.requested_date || args.requestedDate || "").trim();
      input.callContext.onFindStarted?.(requestedDate);
      generationAtStart = input.callContext.schedulingGeneration;
    }

    input.turnTrace?.onToolCalled(toolName);
    logLiveObs("FUNCTION_CALL", {
      callId: input.callId,
      tool_name: toolName,
      call_id: callId,
      delegation_id: opts.delegationId ?? null,
    });
    logLiveObs("FUNCTION_ARGS", {
      callId: input.callId,
      tool_name: toolName,
      arg_keys: Object.keys(args),
      args:
        toolName === VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE ||
        toolName === VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE
          ? args
          : undefined,
    });

    const started = Date.now();
    const waitProgress = createLiveToolWaitProgressController({
      callId: input.callId,
      liveSessionId: controlPlane.getLiveSessionId(),
      delegationId: opts.delegationId ?? activeDelegationId,
      toolCallId: callId,
      toolName,
      sendLiveOut: input.sendLiveOut,
    });
    waitProgress.start();
    const toolInvocationId = String(
      args.tool_invocation_id || args.toolInvocationId || callId,
    ).trim();
    const executionId = await beginLiveVoiceToolExecution({
      workspaceId: input.claims.workspaceId,
      callId: input.callId,
      toolName,
      toolInvocationId,
      args,
    });
    let executionOutput: string | null = null;
    let executionStatus: "completed" | "failed" = "completed";
    let executionError: string | undefined;
    try {
      logLiveObs("TOOL_DISPATCH", {
        callId: input.callId,
        tool_name: toolName,
        executor: liveToolExecutorLabel(toolName),
        voice_tool_execution_id: executionId,
      });
      const { output, discard, executor } = await dispatchLiveVoiceTool({
        toolName,
        args,
        openAiFunctionCallId: callId,
        callContext: input.callContext,
      });
      executionOutput = output;
      waitProgress.complete();
      const elapsedMs = Date.now() - started;
      let voiceV2Status: string | null = null;
      try {
        voiceV2Status = String(
          (JSON.parse(output) as Record<string, unknown>).voice_v2_status ||
            (JSON.parse(output) as Record<string, unknown>).status ||
            "",
        );
      } catch {
        voiceV2Status = null;
      }
      const parsedOut = (() => {
        try {
          return JSON.parse(output) as Record<string, unknown>;
        } catch {
          return {};
        }
      })();
      logLiveObs("TOOL_RESULT", {
        callId: input.callId,
        tool_name: toolName,
        executor,
        elapsed_ms: elapsedMs,
        output_bytes: output.length,
        voice_v2_status: voiceV2Status,
        superseded: discard || generationAtStart !== input.callContext.schedulingGeneration,
        ...(toolName === VOICE_V2_SAVE_INTAKE_TOOL_TYPE
          ? {
              booking_intent_active: args.booking_intent_active ?? args.bookingIntentActive ?? null,
              explicit_callback_requested:
                args.explicit_callback_requested ?? args.explicitCallbackRequested ?? null,
              cancel_booking_requested:
                args.cancel_booking_requested ?? args.cancelBookingRequested ?? null,
              voice_v2_next_stage: parsedOut.voice_v2_next_stage ?? null,
              allowed_next_actions: parsedOut.allowed_next_actions ?? null,
              active_goal: parsedOut.active_goal ?? null,
            }
          : {}),
      });
      if (discard || generationAtStart !== input.callContext.schedulingGeneration) {
        await returnLiveToolResult({
          callId,
          delegationId: opts.delegationId,
          toolName,
          executor,
          elapsedMs,
          output: JSON.stringify({
            ok: false,
            speak: "Let me check again with your updated preference.",
            superseded: true,
          }),
        });
      } else {
        await returnLiveToolResult({
          callId,
          delegationId: opts.delegationId,
          toolName,
          executor,
          elapsedMs,
          output,
        });
      }
    } catch (err) {
      executionStatus = "failed";
      executionError = err instanceof Error ? err.message : String(err);
      waitProgress.complete();
      const elapsedMs = Date.now() - started;
      console.error("[live-delegation] tool dispatch failed", err);
      executionOutput = JSON.stringify({
        ok: false,
        error: "TOOL_DISPATCH_FAILED",
        message: executionError,
      });
      await returnLiveToolResult({
        callId,
        delegationId: opts.delegationId,
        toolName,
        executor: liveToolExecutorLabel(toolName),
        elapsedMs,
        output: JSON.stringify({
          ok: false,
          error: "TOOL_DISPATCH_FAILED",
          message: err instanceof Error ? err.message : String(err),
        }),
      });
    } finally {
      const elapsedMs = Date.now() - started;
      await finishLiveVoiceToolExecution({
        executionId,
        status: executionStatus,
        output: executionOutput ?? undefined,
        errorMessage: executionError,
        latencyMs: elapsedMs,
      });
      toolBusy = false;
    }
  };

  const observeInboundLiveEvent = (liveEvent: LiveEvent) => {
    contextTracker.observeInbound(liveEvent);
  };

  const handleLiveServerEvent = async (liveEvent: LiveEvent) => {
    const type = String(liveEvent.type || "");

    if (
      type === "delegation.started" ||
      type === "response.delegation.started" ||
      type === "session.delegation.created" ||
      type === "delegation.created"
    ) {
      const delegationId = (liveEvent.delegation_id as string | null) ?? null;
      if (delegationId) activeDelegationId = delegationId;
      input.turnTrace?.onDelegationCreated(delegationId);
      logLiveObs("DELEGATION_STARTED", {
        callId: input.callId,
        delegation_id: delegationId,
        event_type: type,
      });
      if (controlPlane.isBookingConfirmed()) {
        logLiveObs("DELEGATION_SKIPPED_POST_BOOK", {
          callId: input.callId,
          delegation_id: delegationId,
          stage: controlPlane.getStage(),
        });
        return;
      }
      try {
        await pushDelegationContext(delegationId);
      } catch (err) {
        console.error("[live-delegation] context push failed", err);
      }
      return;
    }

    if (type !== "response.event") {
      return;
    }

    const delegationId = liveEvent.delegation_id as string | null | undefined;
    const responseEvent = liveEvent.event as Record<string, unknown> | undefined;
    const responseType = String(responseEvent?.type || "");

    logLiveObs("RESPONSE_EVENT", {
      callId: input.callId,
      delegation_id: delegationId ?? null,
      response_type: responseType,
    });
    if (responseType) {
      input.turnTrace?.onFirstResponseEvent(responseType, delegationId ?? null);
    }

    switch (responseType) {
      case "response.output_item.done": {
        const item = responseEvent?.item as Record<string, unknown> | undefined;
        if (item?.type !== "function_call") return;
        await handleLiveFunctionCall({ delegationId, item });
        break;
      }
      case "response.completed":
        logLiveObs("RESPONSE_COMPLETED", {
          callId: input.callId,
          delegation_id: delegationId ?? null,
        });
        break;
      case "response.failed":
        console.error(
          "LIVE_RESPONSE_FAILED",
          JSON.stringify({ callId: input.callId, delegationId, responseEvent }),
        );
        break;
      default:
        break;
    }
  };

  return { handleLiveServerEvent, observeInboundLiveEvent };
}
