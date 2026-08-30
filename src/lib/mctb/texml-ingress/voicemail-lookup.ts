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

/** Resolve voicemail message by Telnyx CallSid only (no from/to heuristic — avoids wrong-row attach). */
export async function resolveMctbTexmlVoicemailMessage(input: {
  callSid: string;
  workspaceId?: string | null;
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
    select: { id: true, workspaceId: true },
    orderBy: { createdAt: "desc" },
  });
  if (bySid) {
    return { workspaceId: bySid.workspaceId, messageId: bySid.id };
  }

  return null;
}

/** E164 variants helper — used when persisting voicemail rows at ingress. */
export { mctbTexmlE164Variants };
