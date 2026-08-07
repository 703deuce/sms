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
