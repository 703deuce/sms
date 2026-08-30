import "server-only";

import { getPrisma } from "@/lib/db";
import { startMctbSipVoicemailForPython } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-record";
import {
  mctbTexmlVoicemailHumanCallId,
  resolveMctbTexmlVoicemailMessage,
} from "./voicemail-lookup";
import {
  getMctbTexmlVoicemailSession,
  startMctbTexmlVoicemailSession,
} from "./voicemail-session";

/** Create voicemail DB row + in-memory TeXML session (idempotent per callSid). */
export async function ensureMctbTexmlVoicemailSession(input: {
  callSid: string;
  workspaceId: string;
  callerE164: string;
  transovoNumberE164: string;
  forwardedFromE164?: string | null;
}): Promise<{ messageId: string } | null> {
  const callSid = input.callSid?.trim();
  if (!callSid || !input.workspaceId) return null;

  const existing = getMctbTexmlVoicemailSession(callSid);
  if (existing) return { messageId: existing.messageId };

  const dbExisting = await resolveMctbTexmlVoicemailMessage({
    callSid,
    workspaceId: input.workspaceId,
    callerE164: input.callerE164,
    transovoNumberE164: input.transovoNumberE164,
  });
  if (dbExisting) {
    startMctbTexmlVoicemailSession({
      callSid,
      workspaceId: dbExisting.workspaceId,
      messageId: dbExisting.messageId,
    });
    return { messageId: dbExisting.messageId };
  }

  const started = await startMctbSipVoicemailForPython({
    workspaceId: input.workspaceId,
    callerE164: input.callerE164,
    transovoNumberE164: input.transovoNumberE164,
    providerCallId: callSid,
    forwardedFromE164: input.forwardedFromE164 || null,
    livekitRoomName: null,
  });
  if (!started.ok || !started.messageId) return null;

  const prisma = getPrisma();
  await prisma.voicemailMessage.update({
    where: { id: started.messageId },
    data: { humanCallId: mctbTexmlVoicemailHumanCallId(callSid) },
  });

  startMctbTexmlVoicemailSession({
    callSid,
    workspaceId: input.workspaceId,
    messageId: started.messageId,
  });

  return { messageId: started.messageId };
}
