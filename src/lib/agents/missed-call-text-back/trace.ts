import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";

export function newMctbTraceId(): string {
  return `mctb_${createId()}`;
}

export async function appendMctbTrace(input: {
  workspaceId: string;
  traceId: string;
  kind: string;
  missedCallEventId?: string | null;
  voiceCallId?: string | null;
  humanCallId?: string | null;
  conversationId?: string | null;
  detail?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  await prisma.missedCallTextTrace.create({
    data: {
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      missedCallEventId: input.missedCallEventId || null,
      voiceCallId: input.voiceCallId || null,
      humanCallId: input.humanCallId || null,
      conversationId: input.conversationId || null,
      kind: input.kind,
      detail: (input.detail || {}) as object,
    },
  });
}

/** Avoid duplicate timeline noise when webhooks or parallel paths retry the same step. */
export async function appendMctbTraceOnce(input: {
  workspaceId: string;
  traceId: string;
  kind: string;
  missedCallEventId?: string | null;
  voiceCallId?: string | null;
  humanCallId?: string | null;
  conversationId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<{ created: boolean }> {
  if (input.missedCallEventId) {
    const prisma = getPrisma();
    const existing = await prisma.missedCallTextTrace.findFirst({
      where: { missedCallEventId: input.missedCallEventId, kind: input.kind },
      select: { id: true },
    });
    if (existing) return { created: false };
  }
  await appendMctbTrace(input);
  return { created: true };
}
