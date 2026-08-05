import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { executeVoiceTool } from "@/lib/voice/tools/executor";
import { executeBuiltinVoiceAction } from "@/lib/voice/tools/builtin-actions";
import {
  isBuiltinToolEnabled,
  resolveEnabledBuiltinTools,
} from "@/lib/voice/tools/catalog";

/**
 * Telnyx AI Assistant webhook tools POST here mid-call.
 * Never hang up from this route — tool failures return speakable errors.
 */
export async function POST(request: Request) {
  try {
    const workspaceId = request.headers.get("x-transovo-workspace-id") || "";
    const agentId = request.headers.get("x-transovo-agent-id") || "";
    const toolId = request.headers.get("x-transovo-tool-id") || "";
    const toolType = request.headers.get("x-transovo-tool-type") || "";
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (!workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "workspace required",
          speak: "I'm having trouble looking that up. Can I take a message instead?",
        },
        { status: 200 },
      );
    }

    const prisma = getPrisma();

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
        return NextResponse.json(
          {
            ok: false,
            error: "agent not found for workspace",
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
        return NextResponse.json(
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
          return NextResponse.json(
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
    const endUserTarget =
      request.headers.get("x-telnyx-end-user-target") ||
      String(body.from || body.caller_id_number || body.telnyx_end_user_target || "");
    const agentTarget =
      request.headers.get("x-telnyx-agent-target") ||
      String(body.to || body.destination_number || body.telnyx_agent_target || "");

    let callId: string | undefined;
    if (callControlId) {
      const call = await prisma.voiceCall.findFirst({
        where: { workspaceId, telnyxCallControlId: callControlId },
        select: { id: true },
      });
      callId = call?.id;
    }
    if (!callId && conversationId) {
      const call = await prisma.voiceCall.findFirst({
        where: { workspaceId, telnyxConversationId: conversationId },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });
      callId = call?.id;
    }
    // Only fall back to a very recent live call — never a stale row that already
    // ended (that produced Telnyx "Call has already ended" and felt like a drop).
    if (!callId && agentId) {
      const since = new Date(Date.now() - 10 * 60 * 1000);
      const call = await prisma.voiceCall.findFirst({
        where: {
          workspaceId,
          agentId,
          status: { in: ["IN_PROGRESS", "ANSWERED", "RINGING"] },
          startedAt: { gte: since },
          endedAt: null,
        },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });
      callId = call?.id;
    }

    // TeXML-direct often creates VoiceCall only on hangup. Mid-call tools
    // (escalate_human, take_structured_message) need a row + call_control_id.
    if (!callId && callControlId) {
      try {
        let toE164 = agentTarget;
        let fromE164 = endUserTarget;
        let phoneNumberId: string | null = null;
        let agentVersionId: string | null = null;
        let telnyxAssistantId = String(body.assistant_id || "");

        if (agentId) {
          const agent = await prisma.voiceAgent.findFirst({
            where: { id: agentId, workspaceId },
            select: {
              phoneNumberId: true,
              publishedVersionId: true,
              telnyxAssistantId: true,
            },
          });
          phoneNumberId = agent?.phoneNumberId || null;
          agentVersionId = agent?.publishedVersionId || null;
          if (!telnyxAssistantId) {
            telnyxAssistantId = agent?.telnyxAssistantId || "";
          }
          if (!toE164 && agent?.phoneNumberId) {
            const pn = await prisma.phoneNumber.findFirst({
              where: { id: agent.phoneNumberId },
              select: { e164: true },
            });
            toE164 = pn?.e164 || "";
          }
        }

        const { ensureVoiceCallForTelnyxEvent } = await import(
          "@/lib/voice/ensure-call-from-event"
        );
        const ensured = await ensureVoiceCallForTelnyxEvent({
          eventType: "assistant.tool",
          eventPayload: {
            call_control_id: callControlId,
            conversation_id: conversationId || undefined,
            from: fromE164 || undefined,
            to: toE164 || undefined,
            assistant_id: telnyxAssistantId || undefined,
          },
        });
        callId = ensured?.callId;

        // Last resort: create a minimal IN_PROGRESS row so transfer/message tools
        // can bind to call_control_id even when Telnyx omits from/to headers.
        if (!callId && toE164) {
          const { normalizeE164 } = await import("@/lib/messaging/twilio-mappings");
          const fromNorm = fromE164
            ? normalizeE164(fromE164) || fromE164
            : "unknown";
          const toNorm = normalizeE164(toE164) || toE164;
          const created = await prisma.voiceCall.create({
            data: {
              workspaceId,
              agentId: agentId || null,
              agentVersionId,
              phoneNumberId,
              direction: "INBOUND",
              status: "IN_PROGRESS",
              fromE164: fromNorm,
              toE164: toNorm,
              telnyxCallControlId: callControlId,
              telnyxConversationId: conversationId || null,
              answeredAt: new Date(),
              metadata: {
                source: "tool_webhook_ensure",
                eventType: "assistant.tool",
              } as object,
            },
          });
          callId = created.id;
        }
      } catch (err) {
        console.warn(
          "[telnyx/voice/tools] ensure VoiceCall mid-call",
          err instanceof Error ? err.message : err,
        );
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
      return NextResponse.json({
        ...result,
        ok: result.ok !== false,
        agentId,
        speak:
          result.ok === false
            ? "I wasn't able to complete that. Would you like me to take a message?"
            : undefined,
      });
    }

    if (toolType) {
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
        const result = (await executeBuiltinVoiceAction({
          workspaceId,
          agentId,
          callId,
          toolType,
          input: {
            ...body,
            call_control_id: callControlId || body.call_control_id,
          },
        })) as Record<string, unknown>;
        const ok = result.ok !== false;
        if (execution) {
          await prisma.voiceToolExecution
            .update({
              where: { id: execution.id },
              data: {
                status: ok ? "completed" : "failed",
                output: result as object,
                errorMessage: ok ? null : String(result.error || "tool failed"),
                latencyMs: Date.now() - start,
                completedAt: new Date(),
              },
            })
            .catch(() => undefined);
        }
        return NextResponse.json({
          ...result,
          ok,
          agentId,
          executionId: execution?.id,
          speak:
            typeof result.speak === "string"
              ? result.speak
              : ok
                ? undefined
                : "I wasn't able to complete that just now. I can take a message or try something else.",
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
        console.error("[telnyx/voice/tools]", toolType, message);
        // Never hang up on tool failure — return a speakable error.
        return NextResponse.json(
          {
            ok: false,
            error: message,
            speak:
              "Sorry, I ran into a problem looking that up. Would you like me to take a message instead?",
            agentId,
            executionId: execution?.id,
          },
          { status: 200 },
        );
      }
    }

    return NextResponse.json(
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
    return NextResponse.json(
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
