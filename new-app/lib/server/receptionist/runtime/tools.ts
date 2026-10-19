import { getPrisma } from "@/lib/server/db";
import { getLiveSession } from "@/lib/server/receptionist/runtime/session-store";

export async function executeVoiceV3ToolForNewApp(payload: {
  liveSessionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  functionCallId: string;
}): Promise<Record<string, unknown>> {
  try {
    const { executeVoiceV3ToolMonolith } = await import(
      "@/lib/server/receptionist/runtime/voice-v3-bridge"
    );
    return await executeVoiceV3ToolMonolith(payload);
  } catch (monolithErr) {
    console.warn("VOICE_V3_MONOLITH_TOOL_FALLBACK", {
      tool: payload.toolName,
      message: monolithErr instanceof Error ? monolithErr.message : String(monolithErr),
    });
  }

  const session = getLiveSession(payload.liveSessionId);
  if (!session) {
    return {
      ok: false,
      status: "error",
      code: "RUNTIME_NOT_FOUND",
      message: "Session not found",
    };
  }

  const allowed = new Set(session.bundle.runtime.toolNames);
  if (!allowed.has(payload.toolName)) {
    return {
      ok: false,
      status: "error",
      code: "TOOL_DISABLED",
      message: `Tool ${payload.toolName} is not enabled`,
    };
  }

  const prisma = getPrisma();
  const started = Date.now();

  try {
    let output: Record<string, unknown> = { ok: true, status: "success" };

    switch (payload.toolName) {
      case "update_intake": {
        const fields = (payload.arguments.fields || payload.arguments) as Record<string, unknown>;
        session.intake = { ...session.intake, ...fields };
        await prisma.voiceCall.update({
          where: { id: session.callId },
          data: { dynamicVariables: session.intake as object },
        });
        output = { ok: true, status: "success", intake: session.intake };
        break;
      }
      case "end_call":
        output = { ok: true, status: "success", ended: true };
        break;
      case "request_callback":
        await prisma.voiceCall.update({
          where: { id: session.callId },
          data: { outcome: "callback_requested" },
        });
        output = { ok: true, status: "success", callback: true };
        break;
      default:
        output = {
          ok: false,
          status: "error",
          code: "TOOL_UNAVAILABLE",
          message: "Voice V3 monolith runtime unavailable for this tool in fallback mode.",
        };
    }

    await prisma.voiceToolExecution.create({
      data: {
        workspaceId: session.workspaceId,
        callId: session.callId,
        status: output.ok ? "success" : "failed",
        input: {
          toolName: payload.toolName,
          arguments: payload.arguments,
          functionCallId: payload.functionCallId,
        },
        output,
        latencyMs: Date.now() - started,
        completedAt: new Date(),
      },
    });

    return output;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.voiceToolExecution.create({
      data: {
        workspaceId: session.workspaceId,
        callId: session.callId,
        status: "failed",
        input: { toolName: payload.toolName, arguments: payload.arguments },
        errorMessage: message,
        latencyMs: Date.now() - started,
        completedAt: new Date(),
      },
    });
    return { ok: false, status: "error", code: "TOOL_EXECUTION_FAILED", message };
  }
}
