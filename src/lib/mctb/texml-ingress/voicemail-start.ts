import "server-only";

import { startMctbSipVoicemailForPython } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-record";
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
  if (!input.callSid?.trim() || !input.workspaceId) return null;

  const existing = getMctbTexmlVoicemailSession(input.callSid);
  if (existing) return { messageId: existing.messageId };

  const started = await startMctbSipVoicemailForPython({
    workspaceId: input.workspaceId,
    callerE164: input.callerE164,
    transovoNumberE164: input.transovoNumberE164,
    providerCallId: input.callSid,
    forwardedFromE164: input.forwardedFromE164 || null,
    livekitRoomName: null,
  });
  if (!started.ok || !started.messageId) return null;

  startMctbTexmlVoicemailSession({
    callSid: input.callSid,
    workspaceId: input.workspaceId,
    messageId: started.messageId,
  });

  return { messageId: started.messageId };
}
