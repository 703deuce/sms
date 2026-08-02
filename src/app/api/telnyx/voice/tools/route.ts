import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { executeVoiceTool } from "@/lib/voice/tools/executor";
import { executeBuiltinVoiceAction } from "@/lib/voice/tools/builtin-actions";

/**
 * Telnyx AI Assistant webhook tools POST here mid-call.
 * Headers carry workspace/agent/tool identity; body is tool arguments.
 */
export async function POST(request: Request) {
  try {
    const workspaceId = request.headers.get("x-transovo-workspace-id") || "";
    const agentId = request.headers.get("x-transovo-agent-id") || "";
    const toolId = request.headers.get("x-transovo-tool-id") || "";
    const toolType = request.headers.get("x-transovo-tool-type") || "";
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: "workspace required" }, { status: 400 });
    }

    const callControlId = String(body.call_control_id || body.callControlId || "");
    let callId: string | undefined;
    if (callControlId) {
      const call = await getPrisma().voiceCall.findFirst({
        where: { workspaceId, telnyxCallControlId: callControlId },
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
        ok: result.ok,
        agentId,
      });
    }

    if (toolType) {
      const prisma = getPrisma();
      const start = Date.now();
      const execution = await prisma.voiceToolExecution.create({
        data: {
          workspaceId,
          callId: callId || null,
          toolId: null,
          status: "running",
          input: { toolType, ...body } as object,
          isAsync: false,
        },
      }).catch(() => null);
      try {
        const result = await executeBuiltinVoiceAction({
          workspaceId,
          agentId,
          callId,
          toolType,
          input: body,
        });
        if (execution) {
          await prisma.voiceToolExecution.update({
            where: { id: execution.id },
            data: {
              status: "completed",
              output: result as object,
              latencyMs: Date.now() - start,
              completedAt: new Date(),
            },
          }).catch(() => undefined);
        }
        return NextResponse.json({
          ...result,
          ok: true,
          agentId,
          executionId: execution?.id,
        });
      } catch (err) {
        if (execution) {
          await prisma.voiceToolExecution.update({
            where: { id: execution.id },
            data: {
              status: "failed",
              errorMessage: err instanceof Error ? err.message : String(err),
              latencyMs: Date.now() - start,
              completedAt: new Date(),
            },
          }).catch(() => undefined);
        }
        throw err;
      }
    }

    return NextResponse.json({ ok: false, error: "No tool id or type" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[telnyx/voice/tools]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
