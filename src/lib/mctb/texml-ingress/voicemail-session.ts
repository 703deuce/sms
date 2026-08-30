import "server-only";

const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

type VoicemailPhase = "greeting" | "recording" | "recorded";

export type MctbTexmlVoicemailSession = {
  workspaceId: string;
  messageId: string;
  phase: VoicemailPhase;
  recordingSaved: boolean;
};

const sessions = new Map<string, MctbTexmlVoicemailSession>();

function scheduleCleanup(callSid: string) {
  const existing = cleanupTimers.get(callSid);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    sessions.delete(callSid);
    cleanupTimers.delete(callSid);
  }, 15 * 60 * 1000);
  cleanupTimers.set(callSid, timer);
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
  scheduleCleanup(input.callSid);
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
  const timer = cleanupTimers.get(callSid);
  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(callSid);
  }
}

export function resetMctbTexmlVoicemailSessionsForTests(): void {
  sessions.clear();
  for (const timer of cleanupTimers.values()) clearTimeout(timer);
  cleanupTimers.clear();
}
