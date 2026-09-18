import { buildLiveFrontendGreetingLine } from "@/lib/voice-v3/prompts/live-frontend-instructions";
import { resolveVoiceV3DefaultPromptInput } from "@/lib/voice-v3/prompts/build-voice-v3-prompts";
import type { VoiceV3CallTrace } from "./telemetry/call-trace";

export function resolveVoiceV3InitialGreetingText(): string {
  const ctx = resolveVoiceV3DefaultPromptInput();
  return buildLiveFrontendGreetingLine({
    agentName: ctx.agentName,
    businessName: ctx.businessName,
  });
}

const greetedSessions = new Map<string, number>();
const GREETING_DEDUP_TTL_MS = 15 * 60 * 1000;

export function shouldSendInitialGreeting(sessionId: string): boolean {
  const id = sessionId.trim();
  if (!id) return false;
  const now = Date.now();
  for (const [key, ts] of greetedSessions) {
    if (now - ts > GREETING_DEDUP_TTL_MS) greetedSessions.delete(key);
  }
  if (greetedSessions.has(id)) return false;
  greetedSessions.set(id, now);
  return true;
}

export type LiveSidebandSend = (event: { type: string; [key: string]: unknown }) => void;

/**
 * Trigger GPT-Live to speak first (no Telnyx/TeXML audio). Uses sideband commentary + response.create.
 */
export function requestInitialLiveGreeting(input: {
  sessionId: string;
  send: LiveSidebandSend;
  trace?: VoiceV3CallTrace;
}): void {
  if (!shouldSendInitialGreeting(input.sessionId)) {
    return;
  }

  console.log("LIVE_GREETING_REQUESTED", {
    sessionId: input.sessionId,
    ts: new Date().toISOString(),
  });
  input.trace?.mark("greeting.requested");

  input.send({
    type: "session.commentary.append",
    content: `Speak to the caller now. Say exactly: "${resolveVoiceV3InitialGreetingText()}"`,
    delegation_id: null,
  });
  input.send({
    type: "response.create",
    event_id: `voice_v3_greeting_${input.sessionId}`,
  });
}

export function logGreetingAudioStarted(sessionId: string, trace?: VoiceV3CallTrace): void {
  console.log("LIVE_GREETING_AUDIO_STARTED", {
    sessionId,
    ts: new Date().toISOString(),
  });
  trace?.mark("greeting.audio.started");
}

export function logGreetingAudioCompleted(sessionId: string, trace?: VoiceV3CallTrace): void {
  console.log("LIVE_GREETING_AUDIO_COMPLETED", {
    sessionId,
    ts: new Date().toISOString(),
  });
  trace?.mark("greeting.audio.completed");
}
