/**
 * Browser WebRTC call-quality helpers for Telnyx AI test calls.
 * High-quality defaults: Opus @ 48 kHz, EC/NS/AGC, adaptive stabilize, MOS grades.
 */

export type ConnectionGrade = "excellent" | "good" | "poor" | "unknown";

export type NetworkWarning = {
  code: "mos" | "packet_loss" | "jitter" | "rtt" | "codec";
  message: string;
};

export type WebrtcQualitySnapshot = {
  negotiatedCodec: string | null;
  preferredCodec: string | null;
  opusNegotiated: boolean | null;
  mos: number | null;
  mosLabel: string | null;
  connectionGrade: ConnectionGrade;
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  bitrateKbps: number | null;
  inboundBytes: number | null;
  outboundBytes: number | null;
  inboundAudioLevel: number | null;
  iceState: string | null;
  connectionState: string | null;
  mediaReadyAtMs: number | null;
  firstAudioAtMs: number | null;
  greetingGateMs: number | null;
  stabilizeMs: number | null;
  inputDeviceLabel: string | null;
  outputDeviceLabel: string | null;
  inputLooksBluetooth: boolean;
  outputLooksBluetooth: boolean;
  highQualityAudio: boolean;
  warnings: NetworkWarning[];
  sampledAt: string;
};

/** Warn when call quality is likely to sound bad. */
export const NETWORK_THRESHOLDS = {
  mosMin: 4.0,
  packetLossPctMax: 1,
  jitterMsMax: 20,
  rttMsMax: 150,
} as const;

/** Adaptive speech bitrate target for Opus (browser may negotiate around this). */
export const OPUS_TARGET_BITRATE = {
  minKbps: 32,
  maxKbps: 64,
  preferKbps: 48,
} as const;

/** Adaptive startup buffer bounds (ms). */
export const MEDIA_STABILIZE = {
  minMs: 0,
  fastMs: 100,
  maxMs: 500,
} as const;

/** @deprecated Prefer adaptiveStabilizeMs — kept for callers that want a mid default. */
export const MEDIA_STABILIZE_MS = 350;

export type HighQualityAudioSettings = {
  preferOpus: boolean;
  sampleRateHz: 48000;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  warmMicrophone: boolean;
  waitForMediaReady: boolean;
  adaptiveJitterBuffer: boolean;
  packetLossConcealment: boolean;
  voiceEnhancement: boolean;
  browserDiagnostics: boolean;
  targetBitrateKbps: number;
};

export const HIGH_QUALITY_AUDIO_DEFAULTS: HighQualityAudioSettings = {
  preferOpus: true,
  sampleRateHz: 48000,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  warmMicrophone: true,
  waitForMediaReady: true,
  adaptiveJitterBuffer: true,
  packetLossConcealment: true,
  voiceEnhancement: true,
  browserDiagnostics: true,
  targetBitrateKbps: OPUS_TARGET_BITRATE.preferKbps,
};

export function audioConstraintsForSettings(
  hq: boolean,
  deviceId?: string,
): MediaTrackConstraints {
  const base: MediaTrackConstraints = hq
    ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      }
    : {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
        channelCount: 1,
      };
  if (deviceId) {
    return { ...base, deviceId: { exact: deviceId } };
  }
  return base;
}

/** Backward-compatible HQ constraints. */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints =
  audioConstraintsForSettings(true);

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
 * User-facing connection grade (Excellent / Good / Poor).
 * Driven by MOS + hard network thresholds.
 */
export function connectionGrade(input: {
  mos: number | null;
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  opusNegotiated?: boolean | null;
}): ConnectionGrade {
  const { mos, rttMs, jitterMs, packetLossPct } = input;
  if (
    mos == null &&
    rttMs == null &&
    jitterMs == null &&
    packetLossPct == null
  ) {
    return "unknown";
  }
  const loss = packetLossPct ?? 0;
  const jitter = jitterMs ?? 0;
  const rtt = rttMs ?? 0;
  if (
    loss > NETWORK_THRESHOLDS.packetLossPctMax * 3 ||
    jitter > NETWORK_THRESHOLDS.jitterMsMax * 2.5 ||
    rtt > NETWORK_THRESHOLDS.rttMsMax * 2 ||
    (mos != null && mos < 3.7)
  ) {
    return "poor";
  }
  if (
    loss > NETWORK_THRESHOLDS.packetLossPctMax ||
    jitter > NETWORK_THRESHOLDS.jitterMsMax ||
    rtt > NETWORK_THRESHOLDS.rttMsMax ||
    (mos != null && mos < NETWORK_THRESHOLDS.mosMin)
  ) {
    return "good";
  }
  if (mos != null && mos >= 4.1) return "excellent";
  if (mos != null && mos >= NETWORK_THRESHOLDS.mosMin) return "good";
  // Metrics present and under thresholds but MOS unknown → good baseline.
  if (rttMs != null || packetLossPct != null) return "excellent";
  return "unknown";
}

export function connectionGradeLabel(grade: ConnectionGrade): string {
  switch (grade) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "poor":
      return "Poor";
    default:
      return "Measuring…";
  }
}

export function collectNetworkWarnings(
  snap: Pick<
    WebrtcQualitySnapshot,
    | "mos"
    | "rttMs"
    | "jitterMs"
    | "packetLossPct"
    | "opusNegotiated"
    | "preferredCodec"
  >,
): NetworkWarning[] {
  const warnings: NetworkWarning[] = [];
  if (snap.mos != null && snap.mos < NETWORK_THRESHOLDS.mosMin) {
    warnings.push({
      code: "mos",
      message: `MOS ${snap.mos} is below ${NETWORK_THRESHOLDS.mosMin} — call may sound dull or choppy.`,
    });
  }
  if (
    snap.packetLossPct != null &&
    snap.packetLossPct > NETWORK_THRESHOLDS.packetLossPctMax
  ) {
    warnings.push({
      code: "packet_loss",
      message: `Packet loss ${snap.packetLossPct}% exceeds ${NETWORK_THRESHOLDS.packetLossPctMax}% — expect dropouts.`,
    });
  }
  if (snap.jitterMs != null && snap.jitterMs > NETWORK_THRESHOLDS.jitterMsMax) {
    warnings.push({
      code: "jitter",
      message: `Jitter ${snap.jitterMs} ms exceeds ${NETWORK_THRESHOLDS.jitterMsMax} ms — timing may wobble.`,
    });
  }
  if (snap.rttMs != null && snap.rttMs > NETWORK_THRESHOLDS.rttMsMax) {
    warnings.push({
      code: "rtt",
      message: `RTT ${snap.rttMs} ms exceeds ${NETWORK_THRESHOLDS.rttMsMax} ms — replies may feel laggy.`,
    });
  }
  if (snap.opusNegotiated === false) {
    warnings.push({
      code: "codec",
      message:
        "Opus was not negotiated — narrowband G.711 can sound muffled vs Opus.",
    });
  }
  return warnings;
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

/**
 * Adaptive buffer after media-ready:
 * - Stable ICE + inbound audio → 0–100 ms
 * - Still settling → up to ~500 ms
 */
export function adaptiveStabilizeMs(input: {
  highQuality: boolean;
  iceState: string | null;
  connectionState: string | null;
  sawInboundAudio: boolean;
  rttMs: number | null;
  jitterMs: number | null;
  waitedMs: number;
}): number {
  if (!input.highQuality) return MEDIA_STABILIZE.fastMs;

  const iceOk =
    input.iceState === "connected" ||
    input.iceState === "completed" ||
    input.connectionState === "connected";
  const metricsCalm =
    (input.rttMs == null || input.rttMs < 120) &&
    (input.jitterMs == null || input.jitterMs < 15);

  if (iceOk && input.sawInboundAudio && metricsCalm) {
    // Already stable — stay responsive.
    return MEDIA_STABILIZE.minMs;
  }
  if (iceOk && input.sawInboundAudio) {
    return MEDIA_STABILIZE.fastMs;
  }
  if (iceOk) {
    // Connected but no inbound yet — brief settle for AGC/NS.
    return Math.min(MEDIA_STABILIZE.maxMs, 250);
  }
  // ICE still settling or unknown — use remaining headroom up to max.
  const remaining = Math.max(0, MEDIA_STABILIZE.maxMs - Math.min(input.waitedMs, MEDIA_STABILIZE.maxMs));
  return Math.min(MEDIA_STABILIZE.maxMs, Math.max(MEDIA_STABILIZE.fastMs, remaining || 400));
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

/**
 * Prefer Opus on senders when the browser allows codec preference APIs.
 * Target speech bitrate ~32–64 kbps when supported.
 */
export function applyHighQualitySenderPrefs(
  pc: RTCPeerConnection | null | undefined,
  hq: boolean,
): void {
  if (!pc || !hq) return;
  const opus = pickPreferredOpusCodec();
  try {
    for (const transceiver of pc.getTransceivers?.() || []) {
      if (transceiver.receiver?.track?.kind !== "audio" && transceiver.sender?.track?.kind !== "audio") {
        continue;
      }
      if (opus && typeof transceiver.setCodecPreferences === "function") {
        const caps =
          (
            RTCRtpReceiver as unknown as {
              getCapabilities?: (kind: string) => { codecs?: PreferredAudioCodec[] } | null;
            }
          ).getCapabilities?.("audio")?.codecs || [];
        const ordered = [
          ...caps.filter((c) => c.mimeType.toLowerCase().includes("opus")),
          ...caps.filter((c) => !c.mimeType.toLowerCase().includes("opus")),
        ];
        if (ordered.length) {
          transceiver.setCodecPreferences(
            ordered as Parameters<RTCRtpTransceiver["setCodecPreferences"]>[0],
          );
        }
      }
      const params = transceiver.sender?.getParameters?.();
      if (params?.encodings?.length) {
        const next = {
          ...params,
          encodings: params.encodings.map((enc) => ({
            ...enc,
            maxBitrate: OPUS_TARGET_BITRATE.maxKbps * 1000,
          })),
        };
        void transceiver.sender.setParameters(next).catch(() => undefined);
      }
    }
  } catch {
    // Optional — negotiation may already be complete.
  }
}

export function parseRtcStatsReport(
  report: RTCStatsReport,
  prev?: Partial<WebrtcQualitySnapshot>,
  opts?: { highQualityAudio?: boolean; prevSampleAtMs?: number },
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
  let targetBitrate: number | null = null;
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
      if (typeof row.availableOutgoingBitrate === "number") {
        targetBitrate = row.availableOutgoingBitrate;
      }
    }
    if (row.type === "transport") {
      if (typeof row.iceState === "string") iceState = row.iceState;
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
      if (typeof row.targetBitrate === "number") targetBitrate = row.targetBitrate;
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

  let bitrateKbps: number | null = prev?.bitrateKbps ?? null;
  const prevIn = prev?.inboundBytes;
  const prevOut = prev?.outboundBytes;
  const prevAt = opts?.prevSampleAtMs;
  if (
    prevAt != null &&
    inboundBytes != null &&
    outboundBytes != null &&
    prevIn != null &&
    prevOut != null
  ) {
    const dtSec = (Date.now() - prevAt) / 1000;
    if (dtSec > 0.2) {
      const bytesDelta = Math.max(0, inboundBytes - prevIn) + Math.max(0, outboundBytes - prevOut);
      bitrateKbps = Math.round(((bytesDelta * 8) / dtSec / 1000) * 10) / 10;
    }
  } else if (targetBitrate != null) {
    bitrateKbps = Math.round((targetBitrate / 1000) * 10) / 10;
  }

  const highQualityAudio = opts?.highQualityAudio ?? prev?.highQualityAudio ?? true;
  const grade = connectionGrade({
    mos,
    rttMs,
    jitterMs,
    packetLossPct,
    opusNegotiated,
  });
  const warnings = collectNetworkWarnings({
    mos,
    rttMs,
    jitterMs,
    packetLossPct,
    opusNegotiated,
    preferredCodec: prev?.preferredCodec ?? null,
  });

  return {
    negotiatedCodec,
    opusNegotiated,
    mos,
    mosLabel: mosLabel(mos),
    connectionGrade: grade,
    rttMs,
    jitterMs,
    packetLossPct,
    bitrateKbps,
    inboundBytes,
    outboundBytes,
    inboundAudioLevel,
    iceState,
    connectionState,
    highQualityAudio,
    warnings,
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
