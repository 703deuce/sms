import "server-only";

import { getPrisma } from "@/lib/db";
import { mctbTexmlE164Variants } from "./e164-lookup";

const TEXML_VM_HUMAN_CALL_PREFIX = "texml-vm:";

export function mctbTexmlVoicemailHumanCallId(callSid: string): string {
  return `${TEXML_VM_HUMAN_CALL_PREFIX}${callSid}`;
}

export function parseMctbTexmlVoicemailCallSid(humanCallId: string | null | undefined): string | null {
  if (!humanCallId?.startsWith(TEXML_VM_HUMAN_CALL_PREFIX)) return null;
  const sid = humanCallId.slice(TEXML_VM_HUMAN_CALL_PREFIX.length).trim();
  return sid || null;
}

/** Resolve voicemail message by Telnyx CallSid (DB-backed, multi-instance safe). */
export async function resolveMctbTexmlVoicemailMessage(input: {
  callSid: string;
  workspaceId?: string | null;
  callerE164?: string | null;
  transovoNumberE164?: string | null;
}): Promise<{ workspaceId: string; messageId: string } | null> {
  const callSid = input.callSid?.trim();
  if (!callSid) return null;

  const prisma = getPrisma();
  const humanCallId = mctbTexmlVoicemailHumanCallId(callSid);

  const bySid = await prisma.voicemailMessage.findFirst({
    where: {
      humanCallId,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    select: { id: true, workspaceId: true, recordingUrl: true },
    orderBy: { createdAt: "desc" },
  });
  if (bySid) {
    return { workspaceId: bySid.workspaceId, messageId: bySid.id };
  }

  if (!input.workspaceId || !input.callerE164 || !input.transovoNumberE164) return null;

  const toVariants = mctbTexmlE164Variants(input.transovoNumberE164);
  const fromVariants = mctbTexmlE164Variants(input.callerE164);
  const since = new Date(Date.now() - 20 * 60 * 1000);

  const recent = await prisma.voicemailMessage.findFirst({
    where: {
      workspaceId: input.workspaceId,
      fromE164: { in: fromVariants },
      toE164: { in: toVariants },
      createdAt: { gte: since },
      recordingUrl: null,
    },
    select: { id: true, workspaceId: true },
    orderBy: { createdAt: "desc" },
  });
  if (!recent) return null;

  await prisma.voicemailMessage.update({
    where: { id: recent.id },
    data: { humanCallId },
  });

  return { workspaceId: recent.workspaceId, messageId: recent.id };
}
