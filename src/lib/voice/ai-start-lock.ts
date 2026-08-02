/**
 * Prevent double ai_assistant_start (and double greeting masks).
 * Logs showed 90061 "AI Assistant is already in progress" when both
 * call.initiated and call.answered paths started the assistant.
 */

import { getPrisma } from "@/lib/db";

export async function claimAiStart(callId: string): Promise<{
  claimed: boolean;
  reason?: string;
  meta: Record<string, unknown>;
}> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) return { claimed: false, reason: "call_missing", meta: {} };
  const meta = { ...((call.metadata || {}) as Record<string, unknown>) };
  if (meta.aiStarted) {
    return { claimed: false, reason: "ai_already_started", meta };
  }
  if (meta.aiStartClaimed) {
    return { claimed: false, reason: "ai_start_claimed", meta };
  }

  meta.aiStartClaimed = true;
  meta.aiStartClaimedAt = new Date().toISOString();
  await prisma.voiceCall.update({
    where: { id: callId },
    data: { metadata: meta as object },
  });
  return { claimed: true, meta };
}

export function isAiStartClaimed(meta: Record<string, unknown> | null | undefined) {
  if (!meta) return false;
  return Boolean(meta.aiStarted || meta.aiStartClaimed);
}
