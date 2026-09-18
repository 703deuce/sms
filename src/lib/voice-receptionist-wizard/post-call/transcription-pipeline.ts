export async function callUsesVoiceV2PostCallPipeline(_callId: string): Promise<boolean> {
  return false;
}

export function deepgramApiKeyConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY?.trim());
}

export async function enqueueVoiceV2PostCallTranscription(_input: {
  workspaceId: string;
  callId: string;
  recordingId: string;
  recordingUrl: string;
  channels?: number | null;
}): Promise<void> {
  void _input;
}

export async function executeVoiceV2PostCallTranscriptionJob(
  _payload: Record<string, unknown>,
): Promise<{ ok: true; skipped: true }> {
  return { ok: true, skipped: true };
}
