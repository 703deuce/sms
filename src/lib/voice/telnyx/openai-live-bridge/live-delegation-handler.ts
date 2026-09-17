import { liveBaselineEventId } from "./live-event-ids";
import {
  dispatchLiveVoiceTool,
  type LiveToolDispatchContext,
  liveToolExecutorLabel,
} from "./live-tool-runtime";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import type { LiveTurnTraceHooks } from "./live-turn-trace";

type LiveEvent = Record<string, unknown>;

function logLiveObs(event: string, fields: Record<string, unknown>) {
  console.info(
    `LIVE_${event} ${JSON.stringify(fields)}`,
  );
}

export function createLiveDelegationHandler(input: {
  callId: string;
  callContext: LiveToolDispatchContext;
  sendLiveOut: (event: Record<string, unknown>) => void;
  turnTrace?: LiveTurnTraceHooks;
}) {
  let toolBusy = false;

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
    input.sendLiveOut({
      type: "response.create",
      event_id: liveBaselineEventId("resp_cont"),
    });
    input.turnTrace?.onResponseCreateSent();
    logLiveObs("RESPONSE_CONTINUED", {
      callId: input.callId,
      delegation_id,
      tool_name: opts.toolName,
    });
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
    });

    const started = Date.now();
    try {
      logLiveObs("TOOL_DISPATCH", {
        callId: input.callId,
        tool_name: toolName,
        executor: liveToolExecutorLabel(toolName),
      });
      const { output, discard, executor } = await dispatchLiveVoiceTool({
        toolName,
        args,
        openAiFunctionCallId: callId,
        callContext: input.callContext,
      });
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
      logLiveObs("TOOL_RESULT", {
        callId: input.callId,
        tool_name: toolName,
        executor,
        elapsed_ms: elapsedMs,
        output_bytes: output.length,
        voice_v2_status: voiceV2Status,
        superseded: discard || generationAtStart !== input.callContext.schedulingGeneration,
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
      const elapsedMs = Date.now() - started;
      console.error("[live-delegation] tool dispatch failed", err);
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
      toolBusy = false;
    }
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
      input.turnTrace?.onDelegationCreated(delegationId);
      logLiveObs("DELEGATION_STARTED", {
        callId: input.callId,
        delegation_id: delegationId,
        event_type: type,
      });
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

  return { handleLiveServerEvent };
}
