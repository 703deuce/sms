import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV3CallContext } from "@/lib/voice-v3/state/call-context";

export type ArRescheduleWorkflowPersisted = {
  version: 1;
  v3Context: VoiceV3CallContext;
};

export function parsePersistedWorkflowState(raw: unknown): ArRescheduleWorkflowPersisted | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (!o.v3Context || typeof o.v3Context !== "object") return null;
  return { version: 1, v3Context: o.v3Context as VoiceV3CallContext };
}

export async function loadWorkflowContext(sessionId: string): Promise<VoiceV3CallContext | null> {
  const prisma = getPrisma();
  const row = await prisma.arSmsReplySession.findFirst({
    where: { id: sessionId },
    select: { rescheduleWorkflowState: true },
  });
  const parsed = parsePersistedWorkflowState(row?.rescheduleWorkflowState);
  return parsed?.v3Context ?? null;
}

export async function saveWorkflowContext(sessionId: string, ctx: VoiceV3CallContext): Promise<void> {
  const prisma = getPrisma();
  const payload: ArRescheduleWorkflowPersisted = { version: 1, v3Context: ctx };
  await prisma.arSmsReplySession.update({
    where: { id: sessionId },
    data: { rescheduleWorkflowState: payload as object },
  });
}
