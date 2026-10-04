const GREETING_ONLY_TRANSCRIPT =
  /^(this is a message from|you have reached|please leave (a )?message|at the tone|mailbox|not available|after the (tone|beep))/i;

/** STT sometimes returns carrier/greeting audio with no caller speech. */
export function voicemailTranscriptLooksLikeGreetingOnly(transcript: string): boolean {
  const text = transcript.trim();
  if (!text) return true;
  if (text.length < 40 && GREETING_ONLY_TRANSCRIPT.test(text)) return true;
  if (/^this is a message from\b/i.test(text) && text.split(/\s+/).length < 12) return true;
  return false;
}
