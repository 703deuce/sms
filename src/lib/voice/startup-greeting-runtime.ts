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

export async function stopPlaybackOnCall(callControlId: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) return;
  await telnyxRequest(`/calls/${callControlId}/actions/playback_stop`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start the pre-AI mask. For Transovo connection greeting (audio_url + concurrent),
 * this returns immediately after playback_start so AI can initialize in parallel.
 * Pass wait:false to never block; otherwise uses resolveStartupWaitMs.
 */
export async function playStartupGreetingMask(input: {
  workspaceId: string;
  callId: string;
  callControlId: string;
  config: VoiceAgentConfig;
  /** When false, start playback/speak and return without waiting (concurrent AI). */
  wait?: boolean;
}): Promise<{
  played: boolean;
  waitMs: number;
  mode: StartupGreetingConfig["mode"];
  concurrent: boolean;
}> {
  const mask = startupGreetingFromConfig(input.config);
  if (!shouldPlayPreAiMask(mask)) {
    return { played: false, waitMs: 0, mode: mask.mode, concurrent: false };
  }

  const prisma = getPrisma();
  const startedAt = Date.now();
  if (mask.mode === "audio_url" && mask.audioUrl) {
    await playbackOnCall(input.callControlId, mask.audioUrl);
  } else {
    await speakOnCall(input.callControlId, mask.text.trim());
  }

  // Connection greeting: play under AI init — never wait out the full clip.
  const concurrent =
    mask.connectionGreeting === "transovo_default" ||
    input.wait === false ||
    (mask.mode === "audio_url" && mask.delayMs === 0);

  const waitMs = concurrent || input.wait === false ? 0 : resolveStartupWaitMs(mask);
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
          concurrent,
          startedAt,
        } as object,
      },
    })
    .catch(() => undefined);

  if (waitMs > 0) await sleep(waitMs);

  if (!concurrent) {
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
  }

  return { played: true, waitMs, mode: mask.mode, concurrent };
}
