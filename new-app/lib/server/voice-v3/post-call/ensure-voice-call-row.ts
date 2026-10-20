import "server-only";

import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/server/db";

export type EnsureVoiceCallRowInput = {
  callId: string;
  workspaceId: string;
  agentId: string;
  fromE164: string;
  toE164: string;
  phoneNumberId?: string | null;
  metadata: Record<string, unknown>;
};

/**
 * Create the authoritative VoiceCall row at session resolve. Failures are logged and rethrown
 * so finalize/post-call cannot silently operate on a missing call.
 */
export async function ensureVoiceCallRowOnSessionResolve(
  input: EnsureVoiceCallRowInput,
): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.voiceCall.create({
      data: {
        id: input.callId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        direction: "INBOUND",
        status: "IN_PROGRESS",
        fromE164: input.fromE164,
        toE164: input.toE164,
        phoneNumberId: input.phoneNumberId || undefined,
        metadata: input.metadata as object,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await prisma.voiceCall.update({
        where: { id: input.callId },
        data: {
          status: "IN_PROGRESS",
          metadata: input.metadata as object,
        },
      });
      return;
    }
    console.error("VOICE_V3_CALL_ROW_CREATE_FAILED", {
      callId: input.callId,
      workspaceId: input.workspaceId,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
