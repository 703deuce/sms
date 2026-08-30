import "server-only";

type VoicemailPhase = "greeting" | "recording" | "recorded";

export type MctbTexmlVoicemailSession = {
  workspaceId: string;
  messageId: string;
  phase: VoicemailPhase;
  recordingSaved: boolean;
};

const sessions = new Map<string, MctbTexmlVoicemailSession>();

function cleanup(callSid: string) {
  setTimeout(() => sessions.delete(callSid), 15 * 60 * 1000);
}

export function startMctbTexmlVoicemailSession(input: {
  callSid: string;
  workspaceId: string;
  messageId: string;
}): void {
  if (!input.callSid) return;
  sessions.set(input.callSid, {
    workspaceId: input.workspaceId,
    messageId: input.messageId,
    phase: "greeting",
    recordingSaved: false,
  });
  cleanup(input.callSid);
}

export function markMctbTexmlVoicemailRecording(callSid: string): void {
  const row = sessions.get(callSid);
  if (!row) return;
  row.phase = "recording";
}

export function markMctbTexmlVoicemailRecorded(callSid: string): void {
  const row = sessions.get(callSid);
  if (!row) return;
  row.phase = "recorded";
  row.recordingSaved = true;
}

export function wasMctbTexmlVoicemailRecorded(callSid: string): boolean {
  return sessions.get(callSid)?.recordingSaved === true;
}

export function getMctbTexmlVoicemailSession(callSid: string): MctbTexmlVoicemailSession | null {
  return sessions.get(callSid) || null;
}

export function clearMctbTexmlVoicemailSession(callSid: string): void {
  sessions.delete(callSid);
}

export function resetMctbTexmlVoicemailSessionsForTests(): void {
  sessions.clear();
}
