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
    if (!callId && agentId) {
      const call = await prisma.voiceCall.findFirst({
        where: {
          workspaceId,
          agentId,
          status: {
            in: ["IN_PROGRESS", "ANSWERED", "RINGING", "QUEUED", "INITIATED"],
          },
        },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });
      callId = call?.id;
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
