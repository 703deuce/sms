/** Per-call voice_url arrival timestamps for ms-since-arrival on later phases. */
const voiceUrlArrivalByCallSid = new Map<string, number>();

export type MctbEntryTimingPhase =
  | "voice_url_arrival"
  | "fields_parsed"
  | "texml_build_start"
  | "response_complete"
  | "call_answered"
  | "first_media"
  | "gather_start"
  | "hangup";

export function markMctbVoiceUrlArrival(callSid: string | null | undefined): void {
  const sid = callSid?.trim();
  if (!sid) return;
  voiceUrlArrivalByCallSid.set(sid, Date.now());
  if (voiceUrlArrivalByCallSid.size > 500) {
    const oldest = voiceUrlArrivalByCallSid.keys().next().value;
    if (oldest) voiceUrlArrivalByCallSid.delete(oldest);
  }
}

export function msSinceMctbVoiceUrlArrival(callSid: string | null | undefined): number | null {
  const sid = callSid?.trim();
  if (!sid) return null;
  const at = voiceUrlArrivalByCallSid.get(sid);
  return at ? Date.now() - at : null;
}

export function logMctbEntryTiming(input: {
  phase: MctbEntryTimingPhase;
  callSid?: string | null;
  to?: string | null;
  certMode?: string | null;
  branch?: string | null;
  extra?: Record<string, unknown>;
}): void {
  const callSid = input.callSid?.trim() || null;
  if (input.phase === "voice_url_arrival") markMctbVoiceUrlArrival(callSid);

  const msSinceArrival = msSinceMctbVoiceUrlArrival(callSid);

  console.log(
    JSON.stringify({
      source: "mctb-entry-timing",
      phase: input.phase,
      at: new Date().toISOString(),
      callSid,
      to: input.to ?? null,
      certMode: input.certMode ?? null,
      branch: input.branch ?? null,
      msSinceArrival,
      ...(input.extra || {}),
    }),
  );
}
