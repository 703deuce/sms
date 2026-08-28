import "server-only";

import { resolveMctbVoicemailFallbackPlayback } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-fallback";
import { startMctbSipVoicemailForPython } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-record";
import { logMctbEventOnly } from "@/lib/mctb/event-only/logging";
import type { CallContext } from "@/lib/mctb/event-only/fqdn-direct-press-1";

type VoicemailPhase = "greeting" | "recording" | "done";

const voicemailMessageByCall = new Map<string, { workspaceId: string; messageId: string }>();
const voicemailPhaseByCall = new Map<string, VoicemailPhase>();

export function isCallControlVoicemailActive(callControlId: string): boolean {
  return voicemailPhaseByCall.has(callControlId);
}

export async function startCallControlVoicemailFallback(input: {
  eventPayload: Record<string, unknown>;
  ctx: CallContext;
}): Promise<{ action: string }> {
  const callControlId = String(input.eventPayload.call_control_id || "");
  if (!callControlId) return { action: "voicemail_missing_call_id" };

  const started = await startMctbSipVoicemailForPython({
    workspaceId: input.ctx.workspaceId,
    callerE164: input.ctx.callerE164,
    transovoNumberE164: input.ctx.transovoE164,
    providerCallId: callControlId,
    forwardedFromE164: input.ctx.forwardedFrom,
    livekitRoomName: null,
  });
  if (!started.ok || !started.messageId) {
    logMctbEventOnly("call_control_voicemail_start_failed", {
      callControlId,
      workspaceId: input.ctx.workspaceId,
      error: started.error || "unknown",
      livekitRoomCreated: false,
    });
    const { hangupCall } = await import("@/lib/smart-routing/telnyx-provider");
    await hangupCall(callControlId).catch(() => undefined);
    return { action: "voicemail_start_failed_hangup" };
  }

  voicemailMessageByCall.set(callControlId, {
    workspaceId: input.ctx.workspaceId,
    messageId: started.messageId,
  });
  voicemailPhaseByCall.set(callControlId, "greeting");

  const playback = await resolveMctbVoicemailFallbackPlayback(
    input.ctx.workspaceId,
    input.ctx.transovoE164,
  );

  if (playback.playUrl) {
    const { playbackOnCall } = await import("@/lib/smart-routing/telnyx-provider");
    await playbackOnCall(callControlId, playback.playUrl);
  } else {
    const { speakOnCall } = await import("@/lib/smart-routing/telnyx-provider");
    await speakOnCall(
      callControlId,
      playback.sayText || "Please leave a message after the tone.",
    );
  }

  logMctbEventOnly("call_control_voicemail_greeting_started", {
    callControlId,
    workspaceId: input.ctx.workspaceId,
    messageId: started.messageId,
    livekitRoomCreated: false,
  });

  return { action: "voicemail_fallback_greeting" };
}

async function startVoicemailRecording(callControlId: string): Promise<void> {
  if (voicemailPhaseByCall.get(callControlId) !== "greeting") return;
  voicemailPhaseByCall.set(callControlId, "recording");
  const { startRecording } = await import("@/lib/smart-routing/telnyx-provider");
  await startRecording(callControlId);
  logMctbEventOnly("call_control_voicemail_recording_started", {
    callControlId,
    livekitRoomCreated: false,
  });
}

export async function handleCallControlVoicemailMediaEnded(input: {
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean; action?: string }> {
  const callControlId = String(input.eventPayload.call_control_id || "");
  if (!callControlId || voicemailPhaseByCall.get(callControlId) !== "greeting") {
    return { handled: false };
  }
  await startVoicemailRecording(callControlId);
  return { handled: true, action: "voicemail_recording_started" };
}

export async function completeCallControlVoicemailRecording(input: {
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean; action?: string }> {
  const callControlId = String(input.eventPayload.call_control_id || "");
  const pending = voicemailMessageByCall.get(callControlId);
  if (!pending) return { handled: false };

  const url = String(
    (input.eventPayload.recording_urls as { mp3?: string })?.mp3 ??
      input.eventPayload.recording_url ??
      "",
  );
  if (!url) return { handled: false };

  const durationSeconds =
    Number(input.eventPayload.recording_duration_secs ?? input.eventPayload.duration_secs ?? 0) ||
    null;

  const { attachVoicemailRecordingAndTranscribe } = await import("@/lib/phone/voicemail-service");
  await attachVoicemailRecordingAndTranscribe({
    workspaceId: pending.workspaceId,
    messageId: pending.messageId,
    recordingUrl: url,
    durationSeconds,
    upstreamProvider: "telnyx",
    alwaysTranscribe: true,
  });

  voicemailPhaseByCall.set(callControlId, "done");
  voicemailMessageByCall.delete(callControlId);

  const { hangupCall } = await import("@/lib/smart-routing/telnyx-provider");
  await hangupCall(callControlId).catch(() => undefined);

  logMctbEventOnly("call_control_voicemail_completed", {
    callControlId,
    workspaceId: pending.workspaceId,
    messageId: pending.messageId,
    livekitRoomCreated: false,
  });

  return { handled: true, action: "voicemail_recording_saved" };
}

export function clearCallControlVoicemailState(callControlId: string): void {
  voicemailMessageByCall.delete(callControlId);
  voicemailPhaseByCall.delete(callControlId);
}

export function resetCallControlVoicemailStateForTests(): void {
  voicemailMessageByCall.clear();
  voicemailPhaseByCall.clear();
}
