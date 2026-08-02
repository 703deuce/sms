/**
 * Browser WebRTC call-quality helpers for Telnyx AI test calls.
 * Parses RTCStats, estimates MOS, prefers Opus, detects Bluetooth devices.
 */

export type WebrtcQualitySnapshot = {
  negotiatedCodec: string | null;
  preferredCodec: string | null;
  opusNegotiated: boolean | null;
  mos: number | null;
  mosLabel: string | null;
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  inboundBytes: number | null;
  outboundBytes: number | null;
  inboundAudioLevel: number | null;
  iceState: string | null;
  connectionState: string | null;
  mediaReadyAtMs: number | null;
  firstAudioAtMs: number | null;
  greetingGateMs: number | null;
  inputDeviceLabel: string | null;
  outputDeviceLabel: string | null;
  inputLooksBluetooth: boolean;
  outputLooksBluetooth: boolean;
  sampledAt: string;
};

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  // Prefer wideband when the browser allows it (Opus path).
  channelCount: 1,
  sampleRate: 48000,
};

/** Short buffer after media-ready before we treat the call as “speak now”. */
export const MEDIA_STABILIZE_MS = 350;

export function looksLikeBluetooth(label: string | undefined | null) {
  if (!label) return false;
  return /airpods|bluetooth|buds|galaxy buds|jabra|bose|sony|headset \(bluetooth\)|hands[- ]?free/i.test(
    label,
  );
}

export function mosLabel(mos: number | null): string | null {
  if (mos == null || Number.isNaN(mos)) return null;
  if (mos > 4.2) return "excellent";
  if (mos >= 4.1) return "good";
  if (mos >= 3.7) return "fair";
  if (mos >= 3.1) return "poor";
  return "bad";
}

/**
 * Simplified E-model style MOS estimate from RTT / jitter / loss.
 * Good enough for in-console diagnostics, not a lab score.
 */
export function estimateMos(input: {
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
}): number | null {
  const rtt = input.rttMs;
  const jitter = input.jitterMs ?? 0;
  const loss = input.packetLossPct ?? 0;
  if (rtt == null) return null;
  const effectiveLatency = rtt + jitter * 2 + 10;
  let R = 93.2;
  if (effectiveLatency > 160) {
    R -= ((effectiveLatency - 120) / 40) * 10;
  } else if (effectiveLatency > 100) {
    R -= (effectiveLatency - 100) / 20;
  }
  R -= loss * 2.5;
  R = Math.max(0, Math.min(100, R));
  const mos = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
  return Math.round(Math.max(1, Math.min(4.5, mos)) * 100) / 100;
}

/** Browser RTCRtpCodecCapability — typed locally for Node/tsc without full DOM WebRTC. */
export type PreferredAudioCodec = {
  mimeType: string;
  clockRate?: number;
  channels?: number;
  sdpFmtpLine?: string;
};

export function pickPreferredOpusCodec(): PreferredAudioCodec | undefined {
  if (typeof RTCRtpReceiver === "undefined") return undefined;
  const codecs =
    (
      RTCRtpReceiver as unknown as {
        getCapabilities?: (kind: string) => { codecs?: PreferredAudioCodec[] } | null;
      }
    ).getCapabilities?.("audio")?.codecs || [];
  return (
    codecs.find((c) => c.mimeType.toLowerCase() === "audio/opus") ||
    codecs.find((c) => c.mimeType.toLowerCase().includes("opus"))
  );
}

export function parseRtcStatsReport(
  report: RTCStatsReport,
  prev?: Partial<WebrtcQualitySnapshot>,
): Partial<WebrtcQualitySnapshot> {
  let rttMs: number | null = null;
  let jitterMs: number | null = null;
  let packetsLost = 0;
  let packetsReceived = 0;
  let inboundBytes: number | null = null;
  let outboundBytes: number | null = null;
  let inboundAudioLevel: number | null = null;
  let negotiatedCodec: string | null = prev?.negotiatedCodec ?? null;
  let iceState: string | null = prev?.iceState ?? null;
  let connectionState: string | null = prev?.connectionState ?? null;
  const codecMap = new Map<string, string>();

  report.forEach((s) => {
    const row = s as Record<string, unknown>;
    if (row.type === "codec" && row.id && row.mimeType) {
      codecMap.set(String(row.id), String(row.mimeType));
    }
  });

  report.forEach((s) => {
    const row = s as Record<string, unknown>;
    if (row.type === "candidate-pair" && row.state === "succeeded") {
      if (typeof row.currentRoundTripTime === "number") {
        rttMs = Math.round(row.currentRoundTripTime * 1000);
      }
    }
    if (row.type === "transport") {
      if (typeof row.iceState === "string") iceState = row.iceState;
      // some browsers put dtlsState here
    }
    if (row.type === "peer-connection") {
      // not always present
    }
    if (row.type === "inbound-rtp" && (row.kind === "audio" || row.mediaType === "audio")) {
      if (typeof row.jitter === "number") jitterMs = Math.round(row.jitter * 1000);
      if (typeof row.packetsLost === "number") packetsLost = row.packetsLost;
      if (typeof row.packetsReceived === "number") packetsReceived = row.packetsReceived;
      if (typeof row.bytesReceived === "number") inboundBytes = row.bytesReceived;
      if (typeof row.audioLevel === "number") inboundAudioLevel = row.audioLevel;
      if (row.codecId && codecMap.has(String(row.codecId))) {
        negotiatedCodec = codecMap.get(String(row.codecId)) || negotiatedCodec;
      }
    }
    if (row.type === "outbound-rtp" && (row.kind === "audio" || row.mediaType === "audio")) {
      if (typeof row.bytesSent === "number") outboundBytes = row.bytesSent;
      if (!negotiatedCodec && row.codecId && codecMap.has(String(row.codecId))) {
        negotiatedCodec = codecMap.get(String(row.codecId)) || negotiatedCodec;
      }
    }
  });

  const total = packetsLost + packetsReceived;
  const packetLossPct =
    total > 0 ? Math.round((packetsLost / total) * 1000) / 10 : null;
  const mos = estimateMos({ rttMs, jitterMs, packetLossPct });
  const opusNegotiated =
    negotiatedCodec != null
      ? negotiatedCodec.toLowerCase().includes("opus")
      : null;

  return {
    negotiatedCodec,
    opusNegotiated,
    mos,
    mosLabel: mosLabel(mos),
    rttMs,
    jitterMs,
    packetLossPct,
    inboundBytes,
    outboundBytes,
    inboundAudioLevel,
    iceState,
    connectionState,
  };
}

export async function getPeerConnectionStats(
  call: {
    peer?: {
      instance?: RTCPeerConnection | { getStats?: () => Promise<RTCStatsReport> };
      getStats?: () => Promise<RTCStatsReport>;
    };
    getStats?: unknown;
  } | null,
): Promise<RTCStatsReport | null> {
  if (!call) return null;
  try {
    const peer = call.peer?.instance || call.peer;
    if (peer && typeof (peer as RTCPeerConnection).getStats === "function") {
      return await (peer as RTCPeerConnection).getStats();
    }
    if (typeof call.getStats === "function") {
      // Callback-style Telnyx helper
      return await new Promise<RTCStatsReport | null>((resolve) => {
        try {
          (call.getStats as (cb: (r: RTCStatsReport) => void) => void)((r) =>
            resolve(r || null),
          );
          setTimeout(() => resolve(null), 800);
        } catch {
          resolve(null);
        }
      });
    }
  } catch {
    return null;
  }
  return null;
}
