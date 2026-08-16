import { getPrisma } from "@/lib/db";
import type { PythonRuntimeError } from "./types";

/** Persist a taken message on voiceCall metadata (lightweight — no voice-runtime imports). */
export async function persistMessageForPython(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  fields: Record<string, string>;
  summary?: string;
}): Promise<{ ok: true; messageTaken: true } | PythonRuntimeError> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  if (!call) return { ok: false, error: "Call not found", code: "CALL_NOT_FOUND" };

  const prior =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...prior,
        pythonMessageTaken: true,
        pythonMessageFields: input.fields,
        pythonMessageSummary: input.summary?.trim() || undefined,
        pythonMessageTakenAt: new Date().toISOString(),
      } as object,
    },
  });

  return { ok: true, messageTaken: true };
}
