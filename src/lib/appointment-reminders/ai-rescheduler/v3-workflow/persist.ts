import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV3CallContext } from "@/lib/voice-v3/state/call-context";
import type { ArSmsContextNotes } from "../context-agent/ar-sms-context-notes";

export type ArRescheduleWorkflowPersisted = {
  version: 1;
  v3Context: VoiceV3CallContext;
  /** IANA timezone for customer-facing scheduling copy on this session */
  displayTimezone?: string;
  lastContextNotes?: ArSmsContextNotes;
  /** @deprecated legacy structured interpretation — read-only for old sessions */
  lastContextInterpretation?: unknown;
  lastContextProviderMessageId?: string;
  lastContextInterpretedAt?: string;
};

export function parsePersistedWorkflowState(raw: unknown): ArRescheduleWorkflowPersisted | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (!o.v3Context || typeof o.v3Context !== "object") return null;
  return {
    version: 1,
    v3Context: o.v3Context as VoiceV3CallContext,
    displayTimezone: typeof o.displayTimezone === "string" ? o.displayTimezone : undefined,
    lastContextNotes: typeof o.lastContextNotes === "string" ? o.lastContextNotes : undefined,
    lastContextInterpretation: o.lastContextInterpretation,
    lastContextProviderMessageId:
      typeof o.lastContextProviderMessageId === "string" ? o.lastContextProviderMessageId : undefined,
    lastContextInterpretedAt:
      typeof o.lastContextInterpretedAt === "string" ? o.lastContextInterpretedAt : undefined,
  };
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

export async function saveWorkflowContext(
  sessionId: string,
  ctx: VoiceV3CallContext,
  opts?: { displayTimezone?: string },
): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.arSmsReplySession.findFirst({
    where: { id: sessionId },
    select: { rescheduleWorkflowState: true },
  });
  const prior = parsePersistedWorkflowState(existing?.rescheduleWorkflowState);
  const payload: ArRescheduleWorkflowPersisted = {
    version: 1,
    v3Context: ctx,
    displayTimezone: opts?.displayTimezone ?? prior?.displayTimezone,
    lastContextNotes: prior?.lastContextNotes,
    lastContextInterpretation: prior?.lastContextInterpretation,
    lastContextProviderMessageId: prior?.lastContextProviderMessageId,
    lastContextInterpretedAt: prior?.lastContextInterpretedAt,
  };
  await prisma.arSmsReplySession.update({
    where: { id: sessionId },
    data: { rescheduleWorkflowState: payload as object },
  });
}

export async function saveArSmsContextNotes(input: {
  sessionId: string;
  providerMessageId?: string;
  notes: ArSmsContextNotes;
}): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.arSmsReplySession.findFirst({
    where: { id: input.sessionId },
    select: { rescheduleWorkflowState: true },
  });
  const prior = parsePersistedWorkflowState(existing?.rescheduleWorkflowState);
  if (!prior?.v3Context) {
    return;
  }
  const payload: ArRescheduleWorkflowPersisted = {
    ...prior,
    lastContextNotes: input.notes,
    lastContextProviderMessageId: input.providerMessageId,
    lastContextInterpretedAt: new Date().toISOString(),
  };
  await prisma.arSmsReplySession.update({
    where: { id: input.sessionId },
    data: { rescheduleWorkflowState: payload as object },
  });
}
