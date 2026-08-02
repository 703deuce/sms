/**
 * PSTN-specific audio helpers: inbound-only noise suppression, output gain mapping,
 * and diagnostics snapshot fields for carrier/transcode A/B tests.
 */

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";

/** Assistant playback gain relative to 0 dB (hosted path; best-effort). */
export type OutputGainDb = 0 | -3 | -6;

export function normalizeOutputGainDb(raw: unknown): OutputGainDb {
  const n = Number(raw);
  if (n === -6) return -6;
  if (n === -3) return -3;
  return 0;
}

/** Linear amplitude from dB (for APIs that take 0–1 / multiplier). */
export function gainDbToLinear(db: OutputGainDb): number {
  if (db === 0) return 1;
  return Math.round(Math.pow(10, db / 20) * 1000) / 1000;
}

/**
 * Start inbound-only noise suppression so caller noise is cleaned for STT
 * without processing the clean outbound AI voice.
 */
export async function startInboundNoiseSuppression(callControlId: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) {
    return { mode: "mock" as const };
  }
  await telnyxRequest(`/calls/${callControlId}/actions/suppression_start`, {
    method: "POST",
    body: {
      direction: "inbound",
      // STT-oriented engine when available; Telnyx falls back if unsupported.
      noise_suppression_engine: "AiCoustics",
    },
  }).catch(async () => {
    // Fallback without engine pin.
    await telnyxRequest(`/calls/${callControlId}/actions/suppression_start`, {
      method: "POST",
      body: { direction: "inbound" },
    }).catch(() => undefined);
  });
  return { mode: "telnyx" as const, direction: "inbound" as const };
}

export type PstnAudioDiagnostics = {
  channel: "pstn";
  callControlId: string;
  outputGainDb: OutputGainDb;
  outputGainLinear: number;
  noiseSuppression: "inbound" | "off";
  startupGreetingMode: string;
  transcodesEstimate: number;
  notes: string[];
};

export function buildPstnAudioDiagnostics(input: {
  callControlId: string;
  outputGainDb: OutputGainDb;
  startupGreetingMode: string;
  noiseSuppressionInbound: boolean;
}): PstnAudioDiagnostics {
  const notes = [
    "Browser WebRTC (Opus) can sound clean while PSTN uses narrowband PCMU/PCMA — that conversion can add faint interference.",
    "Do not raise bitrate to fix PSTN artifacts; test output gain (−3 / −6 dB) and carrier routes first.",
    "Avoid G.729 and extra MP3→PCM→μ-law chains.",
  ];
  if (input.outputGainDb < 0) {
    notes.push(
      `Assistant output gain set to ${input.outputGainDb} dB (linear ${gainDbToLinear(input.outputGainDb)}) for clipping A/B.`,
    );
  }
  return {
    channel: "pstn",
    callControlId: input.callControlId,
    outputGainDb: input.outputGainDb,
    outputGainLinear: gainDbToLinear(input.outputGainDb),
    noiseSuppression: input.noiseSuppressionInbound ? "inbound" : "off",
    startupGreetingMode: input.startupGreetingMode,
    transcodesEstimate: 1,
    notes,
  };
}
