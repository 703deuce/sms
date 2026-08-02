/**
 * Runtime: play pre-AI startup greeting mask on a Call Control leg.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  resolveStartupWaitMs,
  shouldPlayPreAiMask,
  startupGreetingFromConfig,
  type StartupGreetingConfig,
} from "@/lib/voice/startup-greeting";

async function speakOnCall(callControlId: string, text: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) return;
  await telnyxRequest(`/calls/${callControlId}/actions/speak`, {
    method: "POST",
    body: { payload: text, voice: "female", language: "en-US" },
  }).catch(() => undefined);
}

async function playbackOnCall(callControlId: string, audioUrl: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) return;
  await telnyxRequest(`/calls/${callControlId}/actions/playback_start`, {
    method: "POST",
    body: { audio_url: audioUrl },
  }).catch(() => undefined);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function playStartupGreetingMask(input: {
  workspaceId: string;
  callId: string;
  callControlId: string;
  config: VoiceAgentConfig;
}): Promise<{
  played: boolean;
  waitMs: number;
  mode: StartupGreetingConfig["mode"];
}> {
  const mask = startupGreetingFromConfig(input.config);
  if (!shouldPlayPreAiMask(mask)) {
    return { played: false, waitMs: 0, mode: mask.mode };
  }

  const prisma = getPrisma();
  const startedAt = Date.now();
  if (mask.mode === "audio_url" && mask.audioUrl) {
    await playbackOnCall(input.callControlId, mask.audioUrl);
  } else {
    await speakOnCall(input.callControlId, mask.text.trim());
  }
  const waitMs = resolveStartupWaitMs(mask);
  await prisma.voiceCallEvent
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        eventType: "media.startup_greeting_mask",
        payload: {
          mode: mask.mode,
          text: mask.mode === "tts" ? mask.text : null,
          audioUrl: mask.mode === "audio_url" ? mask.audioUrl : null,
          waitMs,
          startedAt,
        } as object,
      },
    })
    .catch(() => undefined);

  if (waitMs > 0) await sleep(waitMs);

  await prisma.voiceCallEvent
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        eventType: "media.startup_greeting_mask_ended",
        payload: {
          mode: mask.mode,
          waitedMs: Date.now() - startedAt,
          aiHandoffAt: Date.now(),
        } as object,
      },
    })
    .catch(() => undefined);

  return { played: true, waitMs, mode: mask.mode };
}
