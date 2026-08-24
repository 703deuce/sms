/**
 * Transcribe audio via Deepgram Nova-3 prerecorded API.
 * Replaces legacy OpenAI Whisper for voicemail/call recordings.
 */

import {
  isDeepgramConfigured,
  transcribeAudioUrlWithDeepgram,
  type DeepgramTranscriptionResult,
} from "@/lib/transcription/deepgram-prerecorded";

export type VoicemailTranscriptionResult = {
  text: string | null;
  language?: string | null;
};

export async function transcribeAudioUrl(
  recordingUrl: string,
  options?: { diarize?: boolean },
): Promise<VoicemailTranscriptionResult> {
  if (!isDeepgramConfigured() || !recordingUrl) {
    return { text: null };
  }
  const result: DeepgramTranscriptionResult = await transcribeAudioUrlWithDeepgram(
    recordingUrl,
    { diarize: options?.diarize },
  );
  return {
    text: result.text,
    language: result.language,
  };
}
