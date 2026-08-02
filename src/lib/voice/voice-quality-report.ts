/**
 * Post-call Voice Quality Report — shared by browser WebRTC tests and PSTN diagnostics.
 */

import {
  connectionGrade,
  connectionGradeLabel,
  type ConnectionGrade,
  type WebrtcQualitySnapshot,
} from "@/lib/voice/webrtc-quality";

export type MediaTimeline = {
  connectStartedAtMs: number | null;
  iceConnectedAtMs: number | null;
  dtlsConnectedAtMs: number | null;
  mediaFlowingAtMs: number | null;
  firstInboundPacketAtMs: number | null;
  firstOutboundPacketAtMs: number | null;
  firstAiAudioAtMs: number | null;
  firstCleanAudioAtMs: number | null;
  remoteUnmutedAtMs: number | null;
  greetingMaskStartedAtMs: number | null;
  greetingMaskEndedAtMs: number | null;
  aiHandoffAtMs: number | null;
};

export type VoiceQualityReport = {
  codec: string | null;
  preferredCodec: string | null;
  opusNegotiated: boolean | null;
  sampleRateHz: number | null;
  mos: number | null;
  packetLossPct: number | null;
  jitterMs: number | null;
  rttMs: number | null;
  averageBitrateKbps: number | null;
  timeUntilCleanAudioSec: number | null;
  /** Estimated encode/decode hops in Transovo’s control path (not carrier internals). */
  transcodes: number | null;
  voiceModel: string | null;
  inputDevice: string | null;
  outputDevice: string | null;
  connectionGrade: ConnectionGrade;
  connectionLabel: string;
  stars: number;
  overallLabel: string;
  timeline: MediaTimeline;
  channel: "browser_webrtc" | "pstn" | "unknown";
  notes: string[];
};

export function emptyTimeline(): MediaTimeline {
  return {
    connectStartedAtMs: null,
    iceConnectedAtMs: null,
    dtlsConnectedAtMs: null,
    mediaFlowingAtMs: null,
    firstInboundPacketAtMs: null,
    firstOutboundPacketAtMs: null,
    firstAiAudioAtMs: null,
    firstCleanAudioAtMs: null,
    remoteUnmutedAtMs: null,
    greetingMaskStartedAtMs: null,
    greetingMaskEndedAtMs: null,
    aiHandoffAtMs: null,
  };
}

export function starsFromGrade(grade: ConnectionGrade, mos: number | null): number {
  if (grade === "excellent" || (mos != null && mos > 4.2)) return 5;
  if (grade === "good" || (mos != null && mos >= 4.0)) return 4;
  if (mos != null && mos >= 3.7) return 3;
  if (grade === "poor" || (mos != null && mos >= 3.1)) return 2;
  if (mos != null) return 1;
  return 0;
}

export function buildVoiceQualityReport(input: {
  quality: Partial<WebrtcQualitySnapshot> | null | undefined;
  timeline?: Partial<MediaTimeline> | null;
  voiceModel?: string | null;
  channel?: VoiceQualityReport["channel"];
  sampleRateHz?: number | null;
  transcodes?: number | null;
  notes?: string[];
}): VoiceQualityReport {
  const q = input.quality || {};
  const grade =
    q.connectionGrade ||
    connectionGrade({
      mos: q.mos ?? null,
      rttMs: q.rttMs ?? null,
      jitterMs: q.jitterMs ?? null,
      packetLossPct: q.packetLossPct ?? null,
      opusNegotiated: q.opusNegotiated,
    });
  const timeline = { ...emptyTimeline(), ...(input.timeline || {}) };
  const cleanMs =
    timeline.firstCleanAudioAtMs ??
    q.firstCleanAudioAtMs ??
    q.firstAudioAtMs ??
    null;
  const notes = [...(input.notes || [])];
  if (q.opusNegotiated === false) {
    notes.push("Opus was not negotiated — expect narrower/muffled audio.");
  }
  if (cleanMs != null && cleanMs > 2000) {
    notes.push(
      `Clean audio took ${(cleanMs / 1000).toFixed(2)}s — startup masking or media gate needs attention.`,
    );
  }
  if (input.channel === "pstn") {
    notes.push("PSTN paths are often slightly narrower than browser Opus; that is normal.");
  }

  return {
    codec: q.negotiatedCodec ?? null,
    preferredCodec: q.preferredCodec ?? null,
    opusNegotiated: q.opusNegotiated ?? null,
    sampleRateHz: input.sampleRateHz ?? q.sampleRateHz ?? null,
    mos: q.mos ?? null,
    packetLossPct: q.packetLossPct ?? null,
    jitterMs: q.jitterMs ?? null,
    rttMs: q.rttMs ?? null,
    averageBitrateKbps: q.bitrateKbps ?? null,
    timeUntilCleanAudioSec:
      cleanMs != null ? Math.round((cleanMs / 1000) * 100) / 100 : null,
    transcodes: input.transcodes ?? q.transcodesEstimate ?? null,
    voiceModel: input.voiceModel ?? null,
    inputDevice: q.inputDeviceLabel ?? null,
    outputDevice: q.outputDeviceLabel ?? null,
    connectionGrade: grade,
    connectionLabel: connectionGradeLabel(grade),
    stars: starsFromGrade(grade, q.mos ?? null),
    overallLabel: connectionGradeLabel(grade),
    timeline,
    channel: input.channel || "unknown",
    notes,
  };
}
