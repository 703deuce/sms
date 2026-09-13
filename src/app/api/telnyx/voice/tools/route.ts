import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { executeVoiceTool } from "@/lib/voice/tools/executor";
import { executeBuiltinVoiceAction } from "@/lib/voice/tools/builtin-actions";
import {
  isBuiltinToolEnabled,
  resolveEnabledBuiltinTools,
} from "@/lib/voice/tools/catalog";
import {
  backfillCallAni,
  findVoiceCallByTelnyxIds,
  normalizeCallerAni,
} from "@/lib/voice/call-identity";
import { recordToolWebhookIngress } from "@/lib/voice/telnyx/tool-webhook-ingress";
import { formatTelnyxToolPayload } from "@/lib/voice/telnyx/format-speak-text";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  isLegacyCallerAmyAgent,
  requiresLiveKitVoiceRuntime,
} from "@/lib/voice/architecture/livekit-voice-profiles";
import {
  LEGACY_WORKFLOW_VOICE_TOOL_TYPES,
  isLegacyWorkflowVoicePathEnabled,
} from "@/lib/voice/architecture/legacy-voice-path";
import { isInternalBookingConductorMode } from "@/lib/voice/workflow-engine/conductor-mode";
import {
  isConversationWorkflowMode,
  WORKFLOW_PUBLISHED_WEBHOOK_TOOLS,
} from "@/lib/voice/workflow-engine/tool-publish";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";

function telnyxToolJson(payload: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(formatTelnyxToolPayload(payload), init);
}

function resolveInboundAni(request: Request, body: Record<string, unknown>): string {
  const headerKeys = [
    "x-telnyx-from",
    "x-telnyx-caller-id",
    "x-telnyx-end-user-target",
    "x-telnyx-calling-number",
    "from",
    "caller",
  ];
  for (const key of headerKeys) {
    const value = request.headers.get(key);
    if (value && value !== "unknown") return value;
  }
  const fromBody = body.from || body.caller || body.caller_id || body.from_number;
  if (fromBody && String(fromBody) !== "unknown") return String(fromBody);
  return "";
}

/**
 * Telnyx AI Assistant webhook tools POST here mid-call.
 * Never hang up from this route — tool failures return speakable errors.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ingress = await recordToolWebhookIngress({ request, body });

  try {
    const workspaceId = request.headers.get("x-transovo-workspace-id") || "";
    const agentId = request.headers.get("x-transovo-agent-id") || "";
    const toolId = request.headers.get("x-transovo-tool-id") || "";
    const toolType = request.headers.get("x-transovo-tool-type") || "";

    if (!workspaceId) {
      return telnyxToolJson(
        {
          ok: false,
          error: "workspace required",
          speak: "I'm having trouble looking that up. Can I take a message instead?",
        },
        { status: 200 },
      );
    }

    if (agentId && toolType && !toolId) {
      const { handleWorkflowToolFastPath } = await import(
        "@/lib/voice/tools/workflow-tool-fast-path"
      );
      const fastResponse = await handleWorkflowToolFastPath({
        request,
        body,
        workspaceId,
        agentId,
        toolType,
      });
      if (fastResponse) return fastResponse;
    }

    const prisma = getPrisma();
    let conductorMode = false;
    let runtimeAgentConfig = null as ReturnType<typeof parseVoiceAgentConfig> | null;

    if (agentId) {
      const agent = await prisma.voiceAgent.findFirst({
        where: { id: agentId, workspaceId },
        select: {
          id: true,
          agentType: true,
          draftConfig: true,
          publishedVersionId: true,
        },
      });
      if (!agent) {
        return telnyxToolJson(
          {
            ok: false,
            error: "agent not found for workspace",
            speak: "I'm not able to do that right now.",
          },
          { status: 200 },
        );
      }

      runtimeAgentConfig = agent.publishedVersionId
        ? await loadVoiceAgentRuntimeConfig(workspaceId, agentId)
        : parseVoiceAgentConfig(agent.draftConfig);
      conductorMode = isInternalBookingConductorMode(runtimeAgentConfig);
      const agentConfig = runtimeAgentConfig;
      if (requiresLiveKitVoiceRuntime({ ...agentConfig, agentType: agent.agentType })) {
        return telnyxToolJson(
          {
            ok: false,
            error: "LiveKit-only voice agent — Telnyx AI tool webhooks are not supported",
            speak:
              "This line uses our LiveKit voice system. Please call back on the provisioned number.",
          },
          { status: 200 },
        );
      }

      if (
        toolType &&
        LEGACY_WORKFLOW_VOICE_TOOL_TYPES.has(toolType) &&
        !isLegacyWorkflowVoicePathEnabled() &&
        !conductorMode
      ) {
        return telnyxToolJson(
          {
            ok: false,
            error: `Legacy workflow tool "${toolType}" is retired`,
            speak: "I'm not able to do that on this line right now.",
          },
          { status: 200 },
        );
      }

      if (
        toolType &&
        LEGACY_WORKFLOW_VOICE_TOOL_TYPES.has(toolType) &&
        !isLegacyCallerAmyAgent({ agentType: agent.agentType, config: agentConfig })
      ) {
        return telnyxToolJson(
          {
            ok: false,
            error: "Workflow tools are only available for legacy Caller Amy agents",
            speak: "I'm not able to do that right now.",
          },
          { status: 200 },
        );
      }

      let enabledFromConfig: string[] | undefined;
      if (agent.publishedVersionId) {
        const ver = await prisma.voiceAgentVersion.findFirst({
          where: { id: agent.publishedVersionId, workspaceId },
          select: { config: true },
        });
        const cfg = (ver?.config || {}) as { enabledBuiltinTools?: string[] };
        enabledFromConfig = cfg.enabledBuiltinTools;
      }
      if (!enabledFromConfig) {
        const draft = (agent.draftConfig || {}) as { enabledBuiltinTools?: string[] };
        enabledFromConfig = draft.enabledBuiltinTools;
      }
      const enabled = resolveEnabledBuiltinTools({
        enabledBuiltinTools: enabledFromConfig,
        agentType: agent.agentType,
      });

      if (toolType && !toolId && !isBuiltinToolEnabled(enabled, toolType)) {
        return telnyxToolJson(
          {
            ok: false,
            error: `Tool "${toolType}" is not enabled for this agent.`,
            speak:
              "I'm not able to do that right now. I can take a message or transfer you instead.",
          },
          { status: 200 },
        );
      }

      if (toolId) {
        const link = await prisma.voiceAgentTool.findFirst({
          where: { agentId, workspaceId, toolId },
        });
        if (!link) {
          return telnyxToolJson(
            {
              ok: false,
              error: "Tool is not assigned to this agent.",
              speak: "I'm not able to do that right now.",
            },
            { status: 200 },
          );
        }
      }
    }

    // Resolve call identity from Telnyx headers first — never trust the LLM.
    const callControlId =
      request.headers.get("x-telnyx-call-control-id") ||
      request.headers.get("x-telnyx-call-control-id".toUpperCase()) ||
      String(body.call_control_id || body.callControlId || body.call_controlId || "");
    const conversationId =
      request.headers.get("x-telnyx-conversation-id") ||
      String(body.telnyx_conversation_id || body.conversation_id || "");
    const inboundAni = resolveInboundAni(request, body);
    const toE164FromBody = body.to
      ? String(body.to)
      : body.called
        ? String(body.called)
        : "";

    let callId: string | undefined;

    // TeXML-direct calls may not have a VoiceCall row until hangup — create early
    // so the first get_runtime_context / record_current_field has a callId.
    if (workspaceId && agentId && (callControlId || conversationId)) {
      const { ensureToolWebhookCallContext } = await import(
        "@/lib/voice/tools/ensure-tool-webhook-call-context"
      );
      const ensuredId = await ensureToolWebhookCallContext({
        workspaceId,
        agentId,
        callControlId: callControlId || undefined,
        conversationId: conversationId || undefined,
        inboundAni: inboundAni || undefined,
        toE164FromBody: toE164FromBody || undefined,
      }).catch(() => undefined);
      if (ensuredId) callId = ensuredId;
    }

    const resolved = await findVoiceCallByTelnyxIds({
      workspaceId,
      callControlId: callControlId || null,
      conversationId: conversationId || null,
      agentId: agentId || null,
    });
    callId = callId || resolved?.id;

    if (callId && inboundAni) {
      await backfillCallAni({
        callId,
        workspaceId,
        fromE164: inboundAni,
        agentId: agentId || undefined,
      }).catch(() => undefined);
    }

    if (callId && conversationId) {
      await prisma.voiceCall
        .updateMany({
          where: { id: callId, telnyxConversationId: null },
          data: { telnyxConversationId: conversationId },
        })
        .catch(() => undefined);
    }

    // Last-resort create when ensureVoiceCallForToolWebhook could not resolve workspace phone.
    if (!callId && (callControlId || conversationId) && agentId) {
      const agent = await prisma.voiceAgent.findFirst({
        where: { id: agentId, workspaceId },
        select: {
          id: true,
          phoneNumberId: true,
          publishedVersionId: true,
          telnyxAssistantId: true,
        },
      });
      if (agent) {
        let toE164 = toE164FromBody;
        if (!toE164 && agent.phoneNumberId) {
          const pn = await prisma.phoneNumber.findFirst({
            where: { id: agent.phoneNumberId },
            select: { e164: true },
          });
          toE164 = pn?.e164 || "";
        }
        const fromE164 = normalizeCallerAni(inboundAni) || inboundAni || "unknown";
        const created = await prisma.voiceCall
          .create({
            data: {
              workspaceId,
              agentId: agent.id,
              agentVersionId: agent.publishedVersionId || null,
              phoneNumberId: agent.phoneNumberId || null,
              direction: "INBOUND",
              status: "IN_PROGRESS",
              fromE164,
              toE164: toE164 || "unknown",
              telnyxCallControlId: callControlId,
              telnyxConversationId: conversationId || null,
              startedAt: new Date(),
              answeredAt: new Date(),
              metadata: {
                source: "telnyx_tool_webhook",
                assistantId: agent.telnyxAssistantId,
              } as object,
            },
          })
          .catch(() => null);
        if (created?.id) {
          callId = created.id;
          await backfillCallAni({
            callId: created.id,
            workspaceId,
            fromE164,
            agentId: agent.id,
          }).catch(() => undefined);
        } else {
          const again = await findVoiceCallByTelnyxIds({
            workspaceId,
            callControlId,
            conversationId,
            agentId,
          });
          callId = again?.id;
        }
      }
    }
    // Best-effort: keep VoiceAiConversation.callId linked for observability.
    if (callId && conversationId) {
      const aiConv = await prisma.voiceAiConversation
        .findFirst({
          where: { workspaceId, telnyxConversationId: conversationId },
          select: { id: true, callId: true },
        })
        .catch(() => null);
      if (aiConv && aiConv.callId !== callId) {
        await prisma.voiceAiConversation
          .update({
            where: { id: aiConv.id },
            data: { callId, ...(agentId ? { agentId } : {}) },
          })
          .catch(() => undefined);
      }
    }

    if (toolId) {
      const result = await executeVoiceTool({
        workspaceId,
        toolId,
        callId,
        input: body,
        asyncAllowed: true,
      });
        return telnyxToolJson({
          ...result,
          ok: result.ok !== false,
          agentId,
          ingressId: ingress.ingressId,
          speak:
          result.ok === false
            ? "I wasn't able to complete that. Would you like me to take a message?"
            : undefined,
      });
    }

    if (toolType) {
      let effectiveToolType = toolType;
      let effectiveBody = body;
      if (
        conductorMode &&
        ["continue_workflow", "get_runtime_context", "record_current_field"].includes(toolType)
      ) {
        effectiveToolType = "runtime_turn";
        effectiveBody = {
          ...body,
          utterance:
            body.user_input ??
            body.userInput ??
            body.value ??
            body.spoken ??
            body.utterance ??
            body.caller_message,
          interpreted_intent: body.interpreted_intent ?? body.intent,
        };
      }

      const start = Date.now();
      const execution = await prisma.voiceToolExecution
        .create({
          data: {
            workspaceId,
            callId: callId || null,
            toolId: null,
            status: "running",
            input: { toolType, ...body } as object,
            isAsync: false,
          },
        })
        .catch(() => null);
      try {
        const workflow = body.workflow ? String(body.workflow) : "book_appointment";
        const serviceName = body.serviceName ? String(body.serviceName) : null;

        const { assertToolAllowed } = await import("@/lib/voice/workflow-engine/guard");
        const guard = await assertToolAllowed({
          callId,
          workspaceId,
          agentId,
          toolType: effectiveToolType,
          workflow: workflow as import("@/lib/voice/field-runtime/types").WorkflowAction,
          serviceName,
        });
        if (!guard.allowed) {
          const { normalizeVoiceToolResult } = await import("@/lib/voice/runtime/tool-result");
          const blocked = normalizeVoiceToolResult({
            action: effectiveToolType,
            raw: {
              ok: false,
              success: false,
              error: guard.error_code || "TOOL_NOT_ALLOWED",
              error_code: guard.error_code,
              speak: guard.speak,
              retryable: guard.retryable ?? false,
              fallback: "capture_message",
              next_action: guard.next_action,
              workflow_state: guard.state,
              allowed_tools: guard.allowed_tools,
              current_field: guard.current_field || null,
              workflow_complete: guard.workflow_complete ?? false,
            },
          });
          if (execution) {
            await prisma.voiceToolExecution
              .update({
                where: { id: execution.id },
                data: {
                  status: "failed",
                  output: blocked as object,
                  errorMessage: guard.error_code || "tool not allowed",
                  latencyMs: Date.now() - start,
                  completedAt: new Date(),
                },
              })
              .catch(() => undefined);
          }
          return telnyxToolJson({
            ...blocked,
            speak: blocked.caller_safe_summary,
          });
        }

        const workflowGraphTool = WORKFLOW_PUBLISHED_WEBHOOK_TOOLS.includes(
          effectiveToolType as (typeof WORKFLOW_PUBLISHED_WEBHOOK_TOOLS)[number],
        );

        if (
          callId &&
          agentId &&
          isConversationWorkflowMode(runtimeAgentConfig) &&
          !workflowGraphTool
        ) {
          const { ensureVoiceCallState } = await import("@/lib/voice/runtime/call-state");
          const { loadWizardFromAgent } = await import("@/lib/voice/runtime/load-wizard");
          const { filterPublishedToolsForRuntime } = await import(
            "@/lib/voice/runtime/capability-resolver"
          );
          const wizard = await loadWizardFromAgent(workspaceId, agentId);
          const voiceState = await ensureVoiceCallState({
            callId,
            workspaceId,
            agentId,
            callerPhone: inboundAni || null,
            wizard: wizard || undefined,
          });
          const capCheck = filterPublishedToolsForRuntime({
            requestedTool: effectiveToolType,
            callState: voiceState,
            agentConfig: runtimeAgentConfig,
          });
          if (!capCheck.allowed) {
            const { normalizeVoiceToolResult } = await import("@/lib/voice/runtime/tool-result");
            const denied = normalizeVoiceToolResult({
              action: effectiveToolType,
              raw: {
                ok: false,
                error_code: "TOOL_NOT_ALLOWED",
                speak:
                  "I'm not able to do that right now. I can take a message or answer from what I already know about the business.",
                retryable: false,
                fallback: "capture_message",
                allowed_tools: voiceState.allowedTools,
              },
            });
            if (execution) {
              await prisma.voiceToolExecution
                .update({
                  where: { id: execution.id },
                  data: {
                    status: "failed",
                    output: denied as object,
                    errorMessage: capCheck.reason || "capability_denied",
                    latencyMs: Date.now() - start,
                    completedAt: new Date(),
                  },
                })
                .catch(() => undefined);
            }
            return telnyxToolJson({
              ...denied,
              speak: denied.caller_safe_summary,
              allowed_tools: voiceState.allowedTools,
            });
          }
        }

        if (effectiveToolType === "send_resource" && !callId && agentId && (callControlId || conversationId)) {
          const { ensureToolWebhookCallContext } = await import(
            "@/lib/voice/tools/ensure-tool-webhook-call-context"
          );
          const ensured = await ensureToolWebhookCallContext({
            workspaceId,
            agentId,
            callControlId: callControlId || undefined,
            conversationId: conversationId || undefined,
            inboundAni: inboundAni || undefined,
            toE164FromBody: toE164FromBody || undefined,
          }).catch(() => undefined);
          if (ensured) callId = ensured;
        }

        if (callId && inboundAni) {
          await backfillCallAni({
            callId,
            workspaceId,
            agentId,
            fromE164: inboundAni,
          }).catch(() => undefined);
        }

        let calledE164ForTool = toE164FromBody;
        if (!calledE164ForTool && agentId) {
          const { loadMctbLineInboundConfig } = await import(
            "@/lib/mctb/inbound-handling/line-config"
          );
          const line = await loadMctbLineInboundConfig({ workspaceId }).catch(() => null);
          if (line?.ingressE164) calledE164ForTool = line.ingressE164;
        }

        const result = (await executeBuiltinVoiceAction({
          workspaceId,
          agentId,
          callId,
          toolType: effectiveToolType,
          input: {
            ...effectiveBody,
            call_control_id: callControlId || body.call_control_id,
            conversation_id: conversationId || body.conversation_id,
            telnyx_conversation_id: conversationId,
            from: inboundAni || body.from,
            caller_e164: inboundAni,
            called_e164: calledE164ForTool,
            to: calledE164ForTool || body.to,
          },
        })) as Record<string, unknown>;
        const hasFieldSave =
          Array.isArray(result.saved_field_ids) && (result.saved_field_ids as string[]).length > 0;
        const opSucceeded =
          result.ok !== false || hasFieldSave || result.field_complete === true || result.saved === true;
        const executionStatus = opSucceeded ? "completed" : "failed";

        if (callId) {
          const { refreshRuntimeAfterTool } = await import("@/lib/voice/workflow-engine/engine");
          const { appendTraceEvent } = await import("@/lib/voice/workflow-engine/trace");
          await refreshRuntimeAfterTool({
            callId,
            workspaceId,
            agentId,
            toolType,
            toolResult: result,
            workflow: workflow as import("@/lib/voice/field-runtime/types").WorkflowAction,
            serviceName,
          }).catch(() => undefined);
          await appendTraceEvent(callId, {
            kind: opSucceeded ? "tool_success" : "tool_failure",
            tool: toolType,
            operation_id: result.operation_id ? String(result.operation_id) : undefined,
            detail: { error_code: result.error_code, workflow_state: result.workflow_state },
          }).catch(() => undefined);
        }
        if (execution) {
          await prisma.voiceToolExecution
            .update({
              where: { id: execution.id },
              data: {
                status: executionStatus,
                output: result as object,
                errorMessage: executionStatus === "failed" ? String(result.error || "tool failed") : null,
                latencyMs: Date.now() - start,
                completedAt: new Date(),
              },
            })
            .catch(() => undefined);
        }
        const { normalizeVoiceToolResult } = await import("@/lib/voice/runtime/tool-result");
        const normalized = normalizeVoiceToolResult({
          action: effectiveToolType,
          raw: result,
        });
        return telnyxToolJson({
          ...result,
          ...normalized,
          ok: normalized.ok,
          agentId,
          executionId: execution?.id,
          speak:
            typeof result.speak === "string"
              ? result.speak
              : normalized.caller_safe_summary ||
                (opSucceeded
                  ? undefined
                  : "I wasn't able to complete that just now. I can take a message or try something else."),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (execution) {
          await prisma.voiceToolExecution
            .update({
              where: { id: execution.id },
              data: {
                status: "failed",
                errorMessage: message,
                latencyMs: Date.now() - start,
                completedAt: new Date(),
              },
            })
            .catch(() => undefined);
        }
        console.error("[telnyx/voice/tools]", effectiveToolType, message);
        // Never hang up on tool failure — return a speakable error.
        const recoverable =
          conductorMode &&
          /callId required|missing|required field|collect/i.test(message);
        return telnyxToolJson(
          {
            ok: false,
            error: message,
            speak: recoverable
              ? "I still need a bit more information before we can check availability."
              : "Sorry, I ran into a problem looking that up. Would you like me to take a message instead?",
            agentId,
            executionId: execution?.id,
          },
          { status: 200 },
        );
      }
    }

    return telnyxToolJson(
      {
        ok: false,
        error: "No tool id or type",
        speak: "I'm not sure how to do that. Can I take a message?",
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[telnyx/voice/tools]", message);
    return telnyxToolJson(
      {
        ok: false,
        error: message,
        speak:
          "Sorry, something went wrong on my end. I can take a message for the team.",
      },
      { status: 200 },
    );
  }
}
