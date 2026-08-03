"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { toErrorMessage } from "@/lib/errors";
import { VoiceQualityReportCard } from "@/components/voice/voice-quality-report-card";
import {
  HIGH_QUALITY_AUDIO_DEFAULTS,
  MEDIA_STABILIZE,
  adaptiveStabilizeMs,
  applyHighQualitySenderPrefs,
  audioConstraintsForSettings,
  connectionGradeLabel,
  getPeerConnectionStats,
  isCleanInboundAudio,
  looksLikeBluetooth,
  parseRtcStatsReport,
  pickPreferredOpusCodec,
  type PreferredAudioCodec,
  type WebrtcQualitySnapshot,
} from "@/lib/voice/webrtc-quality";
import {
  buildVoiceQualityReport,
  emptyTimeline,
  type MediaTimeline,
  type VoiceQualityReport,
} from "@/lib/voice/voice-quality-report";
import { useCallback, useEffect, useRef, useState } from "react";

type CallPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "media_ready"
  | "listening"
  | "agent_speaking"
  | "user_speaking"
  | "reconnecting"
  | "ended"
  | "failed";

type DeviceOption = { deviceId: string; label: string };

type TestResult = {
  durationSec: number;
  conversationId: string | null;
  sessionId: string | null;
  assistantId: string | null;
  voiceDisplayName: string | null;
  transcript: Array<{ role: string; content: string }>;
  synced: boolean | null;
  quality: WebrtcQualitySnapshot | null;
  qualityReport: VoiceQualityReport | null;
};

type CallHandle = {
  hangup?: () => void;
  muteAudio?: () => void;
  unmuteAudio?: () => void;
  setAudioInDevice?: (id: string) => Promise<unknown>;
  setSpeaker?: (id: string) => Promise<unknown>;
  getStats?: unknown;
  peer?: {
    instance?: RTCPeerConnection | { getStats?: () => Promise<RTCStatsReport> };
    getStats?: () => Promise<RTCStatsReport>;
  };
};

const emptyQuality = (highQualityAudio = true): WebrtcQualitySnapshot => ({
  negotiatedCodec: null,
  preferredCodec: null,
  opusNegotiated: null,
  sampleRateHz: null,
  mos: null,
  mosLabel: null,
  connectionGrade: "unknown",
  rttMs: null,
  jitterMs: null,
  packetLossPct: null,
  bitrateKbps: null,
  inboundBytes: null,
  outboundBytes: null,
  inboundAudioLevel: null,
  iceState: null,
  connectionState: null,
  dtlsState: null,
  mediaReadyAtMs: null,
  firstAudioAtMs: null,
  firstInboundPacketAtMs: null,
  firstOutboundPacketAtMs: null,
  firstCleanAudioAtMs: null,
  iceConnectedAtMs: null,
  dtlsConnectedAtMs: null,
  mediaFlowingAtMs: null,
  remoteUnmutedAtMs: null,
  greetingGateMs: null,
  stabilizeMs: null,
  transcodesEstimate: 1,
  inputDeviceLabel: null,
  outputDeviceLabel: null,
  inputLooksBluetooth: false,
  outputLooksBluetooth: false,
  highQualityAudio,
  warnings: [],
  sampledAt: new Date().toISOString(),
});

const HQ_STORAGE_KEY = "transovo.voice.highQualityAudio";

/**
 * Real browser ↔ Telnyx AI assistant voice call (same assistant as phone deploy).
 * Uses @telnyx/webrtc anonymous_login — not browser STT/TTS or a separate LLM loop.
 */
export function AgentBrowserCall({
  agentId,
  telnyxAssistantId,
  voiceLabel,
  status,
  unsavedChanges,
  onNeedBuild,
  onSaveDraft,
  onSessionSuccess,
  onSessionFailure,
}: {
  agentId: string;
  telnyxAssistantId?: string | null;
  voiceLabel?: string;
  status?: string;
  unsavedChanges?: boolean;
  onNeedBuild?: () => void;
  onSaveDraft?: () => Promise<void> | void;
  /** Fired when a live WebRTC session reaches connected / media_ready. */
  onSessionSuccess?: () => void;
  /** Fired when WebRTC connect fails. */
  onSessionFailure?: (message?: string) => void;
}) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [micPermission, setMicPermission] = useState<
    "unknown" | "granted" | "denied" | "prompt"
  >("unknown");
  const [inputs, setInputs] = useState<DeviceOption[]>([]);
  const [outputs, setOutputs] = useState<DeviceOption[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [showDebug, setShowDebug] = useState(true);
  const [quality, setQuality] = useState<WebrtcQualitySnapshot>(emptyQuality);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string | null>(
    telnyxAssistantId || null,
  );
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [testVars, setTestVars] = useState({
    test_caller_name: "Browser Tester",
    test_caller_phone: "",
  });
  const [result, setResult] = useState<TestResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastSynced, setLastSynced] = useState<boolean | null>(null);
  const [compareChecklist, setCompareChecklist] = useState({
    laptop: false,
    wired: false,
    bluetooth: false,
    pstn: false,
  });
  const [highQualityAudio, setHighQualityAudio] = useState(true);
  const highQualityRef = useRef(true);
  const statsSampleAtRef = useRef<number | null>(null);
  const timelineRef = useRef<MediaTimeline>(emptyTimeline());
  const remoteMutedUntilCleanRef = useRef(true);

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const clientRef = useRef<{
    disconnect?: () => void;
    newCall?: (opts: Record<string, unknown>) => CallHandle;
    on?: (ev: string, cb: (...args: unknown[]) => void) => void;
    remoteElement?: HTMLAudioElement | null;
    setAudioSettings?: (opts: Record<string, unknown>) => Promise<unknown>;
  } | null>(null);
  const callRef = useRef<CallHandle | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishingRef = useRef(false);
  const mountedRef = useRef(true);
  const warmStreamRef = useRef<MediaStream | null>(null);
  const qualityRef = useRef<WebrtcQualitySnapshot>(emptyQuality());
  const mediaReadyRef = useRef(false);
  const preferredOpusRef = useRef<PreferredAudioCodec | undefined>(undefined);

  const ready = Boolean(telnyxAssistantId || assistantId);
  const inCall =
    phase === "connecting" ||
    phase === "connected" ||
    phase === "media_ready" ||
    phase === "listening" ||
    phase === "agent_speaking" ||
    phase === "user_speaking" ||
    phase === "reconnecting";

  const selectedMicLabel =
    inputs.find((d) => d.deviceId === selectedMic)?.label || selectedMic || "default";
  const selectedSpeakerLabel =
    outputs.find((d) => d.deviceId === selectedSpeaker)?.label ||
    selectedSpeaker ||
    "default";
  const micIsBluetooth = looksLikeBluetooth(selectedMicLabel);
  const speakerIsBluetooth = looksLikeBluetooth(selectedSpeakerLabel);

  const listDevices = useCallback(async (requestPermission: boolean) => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    if (requestPermission) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraintsForSettings(highQualityRef.current),
        });
        stream.getTracks().forEach((t) => t.stop());
        if (mountedRef.current) setMicPermission("granted");
      } catch {
        if (mountedRef.current) setMicPermission("denied");
        return;
      }
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!mountedRef.current) return;
    const mics = devices
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${i + 1}`,
      }));
    const speakers = devices
      .filter((d) => d.kind === "audiooutput")
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Speaker ${i + 1}`,
      }));
    setInputs(mics);
    setOutputs(speakers);
    setSelectedMic((prev) =>
      prev && mics.some((m) => m.deviceId === prev) ? prev : mics[0]?.deviceId || "",
    );
    setSelectedSpeaker((prev) =>
      prev && speakers.some((s) => s.deviceId === prev)
        ? prev
        : speakers[0]?.deviceId || "",
    );
  }, []);

  useEffect(() => {
    setAssistantId(telnyxAssistantId || null);
  }, [telnyxAssistantId]);

  useEffect(() => {
    mountedRef.current = true;
    preferredOpusRef.current = pickPreferredOpusCodec();
    try {
      const stored = localStorage.getItem(HQ_STORAGE_KEY);
      if (stored === "0") {
        setHighQualityAudio(false);
        highQualityRef.current = false;
      }
    } catch {
      // ignore
    }
    void listDevices(false);
    const onDeviceChange = () => void listDevices(micPermission === "granted");
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          if (!mountedRef.current) return;
          setMicPermission(status.state as typeof micPermission);
          status.onchange = () => {
            if (mountedRef.current) {
              setMicPermission(status.state as typeof micPermission);
            }
          };
        })
        .catch(() => undefined);
    }
    return () => {
      mountedRef.current = false;
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        onDeviceChange,
      );
      void teardownCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el) return;
    el.volume = volume;
    if (selectedSpeaker && "setSinkId" in el) {
      void (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> })
        .setSinkId(selectedSpeaker)
        .catch(() => undefined);
    }
  }, [volume, selectedSpeaker]);

  useEffect(() => {
    if (!inCall || !selectedMic) return;
    // Avoid auto-switching devices mid-session after first media-ready.
    if (mediaReadyRef.current) return;
    void callRef.current?.setAudioInDevice?.(selectedMic).catch(() => undefined);
    const hq = highQualityRef.current;
    void clientRef.current
      ?.setAudioSettings?.({
        micId: selectedMic,
        echoCancellation: hq || HIGH_QUALITY_AUDIO_DEFAULTS.echoCancellation,
        noiseSuppression: hq,
        autoGainControl: hq || HIGH_QUALITY_AUDIO_DEFAULTS.autoGainControl,
      })
      .catch(() => undefined);
  }, [selectedMic, inCall]);

  function setHighQuality(next: boolean) {
    setHighQualityAudio(next);
    highQualityRef.current = next;
    try {
      localStorage.setItem(HQ_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
    patchQuality({ highQualityAudio: next });
  }

  async function endSession(opts?: {
    error?: string | null;
    conversationId?: string | null;
  }) {
    const sid = sessionIdRef.current;
    if (!sid) return null;
    const durationSec =
      startedAtRef.current != null
        ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
        : 0;
    const res = await fetch(`/api/voice/agents/${agentId}/test-session`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        durationSec,
        conversationId:
          opts?.conversationId ?? conversationIdRef.current ?? null,
        error: opts?.error ?? null,
        quality: qualityRef.current,
        qualityReport: buildVoiceQualityReport({
          quality: qualityRef.current,
          timeline: timelineRef.current,
          voiceModel: voiceLabel || null,
          channel: "browser_webrtc",
          sampleRateHz: qualityRef.current.sampleRateHz,
          transcodes: qualityRef.current.transcodesEstimate ?? 1,
        }),
        timeline: timelineRef.current,
      }),
    }).catch(() => null);
    if (!res) return null;
    const j = await res.json().catch(() => ({}));
    return (j.data || null) as {
      transcript?: Array<{ role: string; content: string }>;
      localConversationId?: string | null;
    } | null;
  }

  async function teardownCall() {
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
    try {
      callRef.current?.hangup?.();
    } catch {
      // ignore
    }
    try {
      clientRef.current?.disconnect?.();
    } catch {
      // ignore
    }
    warmStreamRef.current?.getTracks().forEach((t) => t.stop());
    warmStreamRef.current = null;
    callRef.current = null;
    clientRef.current = null;
    mediaReadyRef.current = false;
  }

  function mapCallState(state: string) {
    const s = state.toLowerCase();
    if (s === "hangup" || s === "destroy" || s === "purge" || s === "done") {
      return "ended" as const;
    }
    if (s === "connecting" || s === "trying" || s === "requesting") {
      return "connecting" as const;
    }
    if (s === "ringing" || s === "early") return "connected" as const;
    if (s.includes("hold") || s === "recovering") return "reconnecting" as const;
    if (s === "active" || s === "answered" || s === "bound") {
      return "media_ready" as const;
    }
    return null;
  }

  function extractConversationId(notification: unknown): string | null {
    const n = notification as Record<string, unknown>;
    const call = (n.call || {}) as Record<string, unknown>;
    const options = (call.options || {}) as Record<string, unknown>;
    const candidates = [
      call.conversation_id,
      call.conversationId,
      call.ai_conversation_id,
      options.conversation_id,
      (call.customHeaders as Record<string, unknown> | undefined)?.conversation_id,
      (n.params as Record<string, unknown> | undefined)?.conversation_id,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
    return null;
  }

  function patchQuality(partial: Partial<WebrtcQualitySnapshot>) {
    const next = {
      ...qualityRef.current,
      ...partial,
      sampledAt: new Date().toISOString(),
    };
    qualityRef.current = next;
    if (mountedRef.current) setQuality(next);
  }

  function setRemoteMuted(muted: boolean) {
    const el = remoteAudioRef.current;
    if (!el) return;
    el.muted = muted;
  }

  async function waitForMediaReady(call: CallHandle, connectStartedAt: number) {
    const hq = highQualityRef.current;
    const deadline = Date.now() + 12000;
    let sawInbound = false;
    let iceState: string | null = null;
    let connectionState: string | null = null;
    let dtlsState: string | null = null;
    let prevInboundBytes: number | null = null;
    const waitStarted = Date.now();

    // Hide startup static — keep Telnyx remote audio muted until clean.
    remoteMutedUntilCleanRef.current = true;
    setRemoteMuted(true);

    while (Date.now() < deadline && mountedRef.current) {
      const peer = call.peer?.instance as RTCPeerConnection | undefined;
      if (peer) {
        applyHighQualitySenderPrefs(peer, hq);
        connectionState = peer.connectionState || connectionState;
        iceState = peer.iceConnectionState || iceState;
      }
      const report = await getPeerConnectionStats(call);
      if (report) {
        const parsed = parseRtcStatsReport(report, qualityRef.current, {
          highQualityAudio: hq,
          prevSampleAtMs: statsSampleAtRef.current ?? undefined,
        });
        statsSampleAtRef.current = Date.now();
        iceState = parsed.iceState || iceState;
        connectionState = parsed.connectionState || connectionState;
        dtlsState = parsed.dtlsState || dtlsState;

        const elapsed = Date.now() - connectStartedAt;
        if (
          (iceState === "connected" || iceState === "completed") &&
          timelineRef.current.iceConnectedAtMs == null
        ) {
          timelineRef.current.iceConnectedAtMs = elapsed;
        }
        if (
          (dtlsState === "connected" || dtlsState === "completed") &&
          timelineRef.current.dtlsConnectedAtMs == null
        ) {
          timelineRef.current.dtlsConnectedAtMs = elapsed;
        }
        if (
          (parsed.inboundBytes || 0) > 0 &&
          timelineRef.current.firstInboundPacketAtMs == null
        ) {
          timelineRef.current.firstInboundPacketAtMs = elapsed;
        }
        if (
          (parsed.outboundBytes || 0) > 0 &&
          timelineRef.current.firstOutboundPacketAtMs == null
        ) {
          timelineRef.current.firstOutboundPacketAtMs = elapsed;
        }
        if (
          ((parsed.inboundBytes || 0) > 0 || (parsed.outboundBytes || 0) > 0) &&
          timelineRef.current.mediaFlowingAtMs == null
        ) {
          timelineRef.current.mediaFlowingAtMs = elapsed;
        }

        patchQuality({
          ...parsed,
          preferredCodec: preferredOpusRef.current?.mimeType || "audio/opus",
          iceState,
          connectionState,
          dtlsState,
          iceConnectedAtMs: timelineRef.current.iceConnectedAtMs,
          dtlsConnectedAtMs: timelineRef.current.dtlsConnectedAtMs,
          mediaFlowingAtMs: timelineRef.current.mediaFlowingAtMs,
          firstInboundPacketAtMs: timelineRef.current.firstInboundPacketAtMs,
          firstOutboundPacketAtMs: timelineRef.current.firstOutboundPacketAtMs,
          inputDeviceLabel: selectedMicLabel,
          outputDeviceLabel: selectedSpeakerLabel,
          inputLooksBluetooth: micIsBluetooth,
          outputLooksBluetooth: speakerIsBluetooth,
          highQualityAudio: hq,
          transcodesEstimate: 1,
        });
        if ((parsed.inboundBytes || 0) > 0 || (parsed.inboundAudioLevel || 0) > 0) {
          sawInbound = true;
          if (qualityRef.current.firstAudioAtMs == null) {
            const firstAudioAtMs = elapsed;
            timelineRef.current.firstAiAudioAtMs = firstAudioAtMs;
            patchQuality({ firstAudioAtMs });
          }
        }
        if (
          connectionState === "connected" ||
          iceState === "connected" ||
          iceState === "completed" ||
          sawInbound
        ) {
          break;
        }
        prevInboundBytes = parsed.inboundBytes ?? prevInboundBytes;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    const mediaReadyAtMs = Date.now() - connectStartedAt;
    const waitedMs = Date.now() - waitStarted;
    const stabilizeMs = hq
      ? adaptiveStabilizeMs({
          highQuality: true,
          iceState,
          connectionState,
          sawInboundAudio: sawInbound,
          rttMs: qualityRef.current.rttMs,
          jitterMs: qualityRef.current.jitterMs,
          waitedMs,
        })
      : MEDIA_STABILIZE.fastMs;

    patchQuality({ mediaReadyAtMs, stabilizeMs });
    if (stabilizeMs > 0) {
      await new Promise((r) => setTimeout(r, stabilizeMs));
    }

    // Extra clean-audio poll (cap ~1.5s) before unmuting remote AI audio.
    const cleanDeadline = Date.now() + (hq ? 1500 : 300);
    while (Date.now() < cleanDeadline && mountedRef.current) {
      const report = await getPeerConnectionStats(call);
      if (report) {
        const parsed = parseRtcStatsReport(report, qualityRef.current, {
          highQualityAudio: hq,
          prevSampleAtMs: statsSampleAtRef.current ?? undefined,
        });
        statsSampleAtRef.current = Date.now();
        const clean = isCleanInboundAudio({
          inboundBytes: parsed.inboundBytes ?? null,
          prevInboundBytes,
          inboundAudioLevel: parsed.inboundAudioLevel ?? null,
          iceState: parsed.iceState || iceState,
          connectionState: parsed.connectionState || connectionState,
          dtlsState: parsed.dtlsState || dtlsState,
        });
        prevInboundBytes = parsed.inboundBytes ?? prevInboundBytes;
        if (clean || (parsed.inboundBytes || 0) > 2000) {
          const firstCleanAudioAtMs = Date.now() - connectStartedAt;
          timelineRef.current.firstCleanAudioAtMs = firstCleanAudioAtMs;
          patchQuality({ firstCleanAudioAtMs, ...parsed });
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    if (timelineRef.current.firstCleanAudioAtMs == null) {
      timelineRef.current.firstCleanAudioAtMs = Date.now() - connectStartedAt;
      patchQuality({ firstCleanAudioAtMs: timelineRef.current.firstCleanAudioAtMs });
    }

    const remoteUnmutedAtMs = Date.now() - connectStartedAt;
    timelineRef.current.remoteUnmutedAtMs = remoteUnmutedAtMs;
    remoteMutedUntilCleanRef.current = false;
    setRemoteMuted(false);
    void remoteAudioRef.current?.play().catch(() => undefined);

    patchQuality({
      greetingGateMs: remoteUnmutedAtMs,
      mediaReadyAtMs,
      stabilizeMs,
      remoteUnmutedAtMs,
      firstCleanAudioAtMs: timelineRef.current.firstCleanAudioAtMs,
      iceConnectedAtMs: timelineRef.current.iceConnectedAtMs,
      dtlsConnectedAtMs: timelineRef.current.dtlsConnectedAtMs,
      mediaFlowingAtMs: timelineRef.current.mediaFlowingAtMs,
      firstInboundPacketAtMs: timelineRef.current.firstInboundPacketAtMs,
      firstOutboundPacketAtMs: timelineRef.current.firstOutboundPacketAtMs,
      firstAudioAtMs:
        qualityRef.current.firstAudioAtMs ?? timelineRef.current.firstAiAudioAtMs,
      transcodesEstimate: 1,
    });
    mediaReadyRef.current = true;
  }

  async function startCall() {
    if (inCall || finishingRef.current) return;
    setError("");
    setResult(null);
    setConversationId(null);
    conversationIdRef.current = null;
    finishingRef.current = false;
    setLastSynced(null);
    qualityRef.current = emptyQuality(highQualityRef.current);
    setQuality(qualityRef.current);
    mediaReadyRef.current = false;
    statsSampleAtRef.current = null;
    timelineRef.current = emptyTimeline();
    timelineRef.current.connectStartedAtMs = 0;
    remoteMutedUntilCleanRef.current = true;
    setRemoteMuted(true);

    if (!telnyxAssistantId && !assistantId) {
      setError("Build & test first so Telnyx can sync the assistant.");
      onNeedBuild?.();
      setPhase("failed");
      onSessionFailure?.("Build & test first so Telnyx can sync the assistant.");
      return;
    }

    if (unsavedChanges) {
      try {
        await onSaveDraft?.();
      } catch {
        setError("Save the agent before starting a live test.");
        setPhase("failed");
        onSessionFailure?.("Save the agent before starting a live test.");
        return;
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser does not support microphone access for voice testing.",
      );
      setPhase("failed");
      onSessionFailure?.(
        "This browser does not support microphone access for voice testing.",
      );
      return;
    }

    setPhase("connecting");
    const connectStartedAt = Date.now();
    try {
      // Keep mic warm so AGC/NS settle before the AI greeting path starts.
      const hq = highQualityRef.current;
      if (hq || HIGH_QUALITY_AUDIO_DEFAULTS.warmMicrophone) {
        warmStreamRef.current?.getTracks().forEach((t) => t.stop());
        warmStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraintsForSettings(hq, selectedMic || undefined),
        });
      } else {
        // Still need permission + a live track for the call.
        warmStreamRef.current?.getTracks().forEach((t) => t.stop());
        warmStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraintsForSettings(false, selectedMic || undefined),
        });
      }
      setMicPermission("granted");
      await listDevices(true);
    } catch {
      setMicPermission("denied");
      setPhase("failed");
      setError("Microphone access is required to test this voice agent.");
      onSessionFailure?.("Microphone access is required to test this voice agent.");
      return;
    }

    try {
      const sessionRes = await fetch(
        `/api/voice/agents/${agentId}/test-session`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sync: true,
            testVariables: {
              telnyx_conversation_channel: "web_call",
              test_caller_name: testVars.test_caller_name || "Browser Tester",
              ...(testVars.test_caller_phone
                ? { test_caller_phone: testVars.test_caller_phone }
                : {}),
            },
          }),
        },
      );
      const sessionJson = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(
          toErrorMessage(
            sessionJson.error ?? sessionJson,
            sessionJson.code === "not_built"
              ? "Build & test first so Telnyx can sync the assistant."
              : "Could not authorize test session",
          ),
        );
      }

      const session = sessionJson.data as {
        sessionId: string;
        telnyxAssistantId: string;
        webrtc: {
          target_type: "ai_assistant";
          target_id: string;
          target_params?: Record<string, string>;
        };
        voice?: { displayName?: string };
        synced?: boolean;
        expiresAt: string;
      };

      if (!session.webrtc?.target_id) {
        throw new Error("Build & test first so Telnyx can sync the assistant.");
      }

      sessionIdRef.current = session.sessionId;
      setSessionId(session.sessionId);
      setAssistantId(session.webrtc.target_id);
      setLastSynced(Boolean(session.synced));
      startedAtRef.current = Date.now();
      setStartedAt(startedAtRef.current);

      const hq = highQualityRef.current;
      const opus = hq
        ? preferredOpusRef.current || pickPreferredOpusCodec()
        : preferredOpusRef.current || pickPreferredOpusCodec();
      preferredOpusRef.current = opus;
      patchQuality({
        preferredCodec: opus?.mimeType || "audio/opus",
        inputDeviceLabel: selectedMicLabel,
        outputDeviceLabel: selectedSpeakerLabel,
        inputLooksBluetooth: micIsBluetooth,
        outputLooksBluetooth: speakerIsBluetooth,
        highQualityAudio: hq,
      });

      const { TelnyxRTC } = await import("@telnyx/webrtc");
      const client = new TelnyxRTC({
        anonymous_login: {
          target_id: session.webrtc.target_id,
          target_type: "ai_assistant",
        },
      });
      clientRef.current = client as unknown as typeof clientRef.current;
      if (remoteAudioRef.current) {
        (client as { remoteElement?: HTMLAudioElement }).remoteElement =
          remoteAudioRef.current;
        // Unlock audio playback before the greeting arrives.
        void remoteAudioRef.current.play().catch(() => undefined);
      }

      await client
        .setAudioSettings?.({
          ...(selectedMic ? { micId: selectedMic } : {}),
          echoCancellation: true,
          noiseSuppression: hq,
          autoGainControl: true,
        })
        .catch(() => undefined);

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(
          () => reject(new Error("WebRTC connect timeout")),
          25000,
        );
        client.on("telnyx.ready", () => {
          clearTimeout(t);
          resolve();
        });
        client.on("telnyx.error", (err: unknown) => {
          clearTimeout(t);
          reject(
            err instanceof Error
              ? err
              : new Error(toErrorMessage(err, "WebRTC connection failed")),
          );
        });
        client.connect();
      });

      if (!mountedRef.current) {
        client.disconnect?.();
        return;
      }

      setPhase("connected");
      // Tiny settle after signaling READY — adaptive gate runs after media-ready.
      await new Promise((r) =>
        setTimeout(r, highQualityRef.current ? MEDIA_STABILIZE.fastMs : 0),
      );

      client.on("telnyx.notification", (notification: unknown) => {
        const n = notification as {
          type?: string;
          call?: { state?: string };
        };
        const cid = extractConversationId(notification);
        if (cid) {
          conversationIdRef.current = cid;
          setConversationId(cid);
        }
        if (n.type !== "callUpdate" || !n.call) return;
        const mapped = mapCallState(String(n.call.state || ""));
        if (mapped === "ended") {
          void finishCall();
          return;
        }
        if (mapped === "media_ready") {
          // Do not jump straight to "listening" — waitForMediaReady gates that.
          if (!mediaReadyRef.current) setPhase("media_ready");
          return;
        }
        if (mapped) setPhase(mapped);
      });

      const call = client.newCall({
        destinationNumber: "",
        remoteElement: remoteAudioRef.current || undefined,
        audio: true,
        // Reuse the pre-warmed mic so AGC/NS are not cold-starting on the greeting.
        ...(warmStreamRef.current ? { localStream: warmStreamRef.current } : {}),
        ...(opus ? { preferred_codecs: [opus] } : {}),
        ...(selectedMic ? { micId: selectedMic } : {}),
        ...(selectedSpeaker ? { speakerId: selectedSpeaker } : {}),
      });
      callRef.current = call;
      // Ownership transferred to the call; do not stop tracks here.
      warmStreamRef.current = null;
      setMuted(false);

      const peer = call.peer?.instance as RTCPeerConnection | undefined;
      applyHighQualitySenderPrefs(peer, hq);

      // Keep remote muted until waitForMediaReady marks audio clean.
      setRemoteMuted(true);
      if (remoteAudioRef.current) {
        void remoteAudioRef.current.play().catch(() => undefined);
      }

      setPhase("media_ready");
      if (hq || HIGH_QUALITY_AUDIO_DEFAULTS.waitForMediaReady) {
        await waitForMediaReady(call, connectStartedAt);
      } else {
        mediaReadyRef.current = true;
        patchQuality({
          mediaReadyAtMs: Date.now() - connectStartedAt,
          greetingGateMs: Date.now() - connectStartedAt,
          stabilizeMs: 0,
        });
      }
      if (!mountedRef.current) return;
      setPhase("listening");
      onSessionSuccess?.();

      statsTimerRef.current = setInterval(() => {
        void pollQuality();
      }, 1500);
    } catch (err) {
      const message = friendlyError(err);
      setPhase("failed");
      setError(message);
      onSessionFailure?.(message);
      await endSession({ error: message });
      await teardownCall();
      sessionIdRef.current = null;
      setSessionId(null);
      startedAtRef.current = null;
      setStartedAt(null);
    }
  }

  async function pollQuality() {
    const call = callRef.current;
    try {
      const report = await getPeerConnectionStats(call);
      if (!report) return;
      const parsed = parseRtcStatsReport(report, qualityRef.current, {
        highQualityAudio: highQualityRef.current,
        prevSampleAtMs: statsSampleAtRef.current ?? undefined,
      });
      statsSampleAtRef.current = Date.now();
      const peer = call?.peer?.instance as RTCPeerConnection | undefined;
      if (peer) applyHighQualitySenderPrefs(peer, highQualityRef.current);
      patchQuality({
        ...parsed,
        preferredCodec: preferredOpusRef.current?.mimeType || "audio/opus",
        connectionState: peer?.connectionState || parsed.connectionState || null,
        iceState: peer?.iceConnectionState || parsed.iceState || null,
        inputDeviceLabel: selectedMicLabel,
        outputDeviceLabel: selectedSpeakerLabel,
        inputLooksBluetooth: micIsBluetooth,
        outputLooksBluetooth: speakerIsBluetooth,
        highQualityAudio: highQualityRef.current,
        firstAudioAtMs:
          qualityRef.current.firstAudioAtMs ??
          ((parsed.inboundBytes || 0) > 0 && startedAtRef.current
            ? Date.now() - startedAtRef.current
            : null),
      });
    } catch {
      // stats optional
    }
  }

  async function finishCall(failedMessage?: string) {
    if (finishingRef.current) return;
    finishingRef.current = true;

    const durationSec =
      startedAtRef.current != null
        ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
        : 0;
    const cid = conversationIdRef.current;
    const sid = sessionIdRef.current;
    const finalQuality = { ...qualityRef.current };
    const qualityReport = buildVoiceQualityReport({
      quality: finalQuality,
      timeline: timelineRef.current,
      voiceModel: voiceLabel || null,
      channel: "browser_webrtc",
      sampleRateHz: finalQuality.sampleRateHz,
      transcodes: finalQuality.transcodesEstimate ?? 1,
      notes: [
        "Browser path prefers a single Opus↔PCM hop at Telnyx AI — avoid extra local encode loops.",
        ...(finalQuality.warnings || []).map((w) => w.message),
      ],
    });
    const ended = await endSession({
      error: failedMessage || null,
      conversationId: cid,
    });
    await teardownCall();
    if (!mountedRef.current) return;
    setResult({
      durationSec,
      conversationId: cid,
      sessionId: sid,
      assistantId,
      voiceDisplayName: voiceLabel || null,
      transcript: ended?.transcript || [],
      synced: lastSynced,
      quality: finalQuality,
      qualityReport,
    });
    sessionIdRef.current = null;
    setSessionId(null);
    startedAtRef.current = null;
    setStartedAt(null);
    setMuted(false);
    setPhase(failedMessage ? "failed" : "ended");
    if (failedMessage) setError(failedMessage);
    finishingRef.current = false;
  }

  function hangup() {
    void finishCall();
  }

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    if (muted) {
      call.unmuteAudio?.();
      setMuted(false);
    } else {
      call.muteAudio?.();
      setMuted(true);
    }
  }

  const phaseLabel: Record<CallPhase, string> = {
    idle: "Ready",
    connecting: "Connecting…",
    connected: "Connected",
    media_ready: "Media ready — stabilizing…",
    listening: "Listening — speak now",
    agent_speaking: "Agent speaking",
    user_speaking: "You’re speaking",
    reconnecting: "Reconnecting…",
    ended: "Ended",
    failed: "Failed",
  };

  return (
    <Card className="space-y-4 border-emerald-800/25 bg-emerald-50/30 p-5 dark:bg-emerald-950/20">
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle>Test Voice Agent</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Live WebRTC call to the <strong>same Telnyx AI Assistant</strong>{" "}
            you&apos;ll deploy to a phone number — mic in, selected voice out.
            Opus preferred; greeting waits until media is ready.
          </p>
          {voiceLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Voice: {voiceLabel}
            </p>
          ) : null}
        </div>
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>

      {unsavedChanges ? (
        <p className="rounded border border-amber-500/40 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          You have unsaved changes. Starting a test will save the draft and sync
          to Telnyx so the call matches what callers will hear.
        </p>
      ) : null}

      {!ready ? (
        <p className="text-sm text-amber-800">
          Click <strong>Build &amp; test</strong> first to sync the assistant,
          then Test Voice Agent.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Test caller name</Label>
          <Input
            value={testVars.test_caller_name}
            disabled={inCall}
            onChange={(e) =>
              setTestVars((v) => ({ ...v, test_caller_name: e.target.value }))
            }
          />
        </div>
        <div>
          <Label>Test caller phone (optional)</Label>
          <Input
            value={testVars.test_caller_phone}
            disabled={inCall}
            placeholder="+1…"
            onChange={(e) =>
              setTestVars((v) => ({ ...v, test_caller_phone: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Microphone</Label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={selectedMic}
            disabled={inputs.length === 0 || (inCall && mediaReadyRef.current)}
            onChange={(e) => setSelectedMic(e.target.value)}
          >
            {inputs.length === 0 ? (
              <option value="">No microphone found</option>
            ) : (
              inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                  {looksLikeBluetooth(d.label) ? " · Bluetooth" : ""}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Active: {selectedMicLabel} · permission {micPermission}
          </p>
        </div>
        <div>
          <Label>Speaker</Label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={selectedSpeaker}
            disabled={outputs.length === 0}
            onChange={(e) => setSelectedSpeaker(e.target.value)}
          >
            {outputs.length === 0 ? (
              <option value="">Default output</option>
            ) : (
              outputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                  {looksLikeBluetooth(d.label) ? " · Bluetooth" : ""}
                </option>
              ))
            )}
          </select>
          <div className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="rounded border border-border bg-background/60 p-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={highQualityAudio}
            disabled={inCall}
            onChange={(e) => setHighQuality(e.target.checked)}
          />
          <span>
            <span className="font-medium">High Quality Audio</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Prefer Opus · 48 kHz · echo cancellation · noise suppression · AGC ·
              warm mic · wait for media-ready · adaptive startup buffer ·
              diagnostics
            </span>
          </span>
        </label>
        {highQualityAudio ? (
          <ul className="mt-2 grid gap-0.5 text-[11px] text-muted-foreground sm:grid-cols-2">
            <li>✓ Prefer Opus (32–64 kbps speech)</li>
            <li>✓ 48 kHz capture</li>
            <li>✓ Echo cancellation / NS / AGC</li>
            <li>✓ Adaptive jitter + PLC (browser)</li>
            <li>✓ Warm microphone</li>
            <li>✓ Adaptive media-ready gate (0–500 ms)</li>
          </ul>
        ) : null}
      </div>

      {micIsBluetooth || speakerIsBluetooth ? (
        <p className="rounded border border-amber-500/40 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Bluetooth detected ({micIsBluetooth ? "mic" : ""}
          {micIsBluetooth && speakerIsBluetooth ? " + " : ""}
          {speakerIsBluetooth ? "speaker" : ""}). Hands-free call mode often
          sounds muffled vs a wired headset — compare with a wired USB headset
          for baseline quality.
        </p>
      ) : null}

      <div className="rounded border border-border bg-background/60 p-3 text-xs">
        <p className="mb-2 font-medium">Quality comparison checklist</p>
        <p className="mb-2 text-muted-foreground">
          Same assistant + voice. Check each path after a short call.
        </p>
        <div className="grid gap-1 sm:grid-cols-2">
          {(
            [
              ["laptop", "Browser · laptop mic/speakers"],
              ["wired", "Browser · wired headset"],
              ["bluetooth", "Browser · Bluetooth / AirPods"],
              ["pstn", "Real cellphone → your Telnyx number"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={compareChecklist[key]}
                onChange={(e) =>
                  setCompareChecklist((c) => ({ ...c, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        This test conversation may be recorded by Telnyx for quality and
        transcript. Labeled as a browser test — not mixed into production
        analytics by default.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {inCall ? (
          <>
            <Button variant="danger" onClick={hangup}>
              {phase === "connecting" ? "Cancel" : "End call"}
            </Button>
            {phase !== "connecting" && phase !== "media_ready" ? (
              <Button variant="outline" size="sm" onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </Button>
            ) : null}
            <span className="text-sm font-medium text-emerald-700">
              {phaseLabel[phase]}
            </span>
          </>
        ) : (
          <>
            <Button disabled={!ready} onClick={() => void startCall()}>
              Test Voice Agent
            </Button>
            {phase === "ended" || phase === "failed" ? (
              <Button variant="outline" onClick={() => void startCall()}>
                Restart test
              </Button>
            ) : null}
          </>
        )}
        {status === "TESTING" ? (
          <span className="text-xs text-muted-foreground">Testing build</span>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowDebug((v) => !v)}
        >
          {showDebug ? "Hide metrics" : "Show metrics"}
        </Button>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      {(showDebug || inCall) && (
        <div className="space-y-2 rounded border border-border bg-background/70 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-foreground">Live call quality</p>
            <ConnectionBadge grade={quality.connectionGrade} />
          </div>
          <div className="grid gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
            <p>
              Codec:{" "}
              <span className="text-foreground">
                {quality.negotiatedCodec || quality.preferredCodec || "Opus"}
              </span>
              {quality.opusNegotiated === false ? " (not Opus)" : ""}
            </p>
            <p>
              MOS:{" "}
              <span className="text-foreground">
                {quality.mos != null ? quality.mos.toFixed(2) : "—"}
              </span>
            </p>
            <p>
              Packet Loss:{" "}
              <span className="text-foreground">
                {quality.packetLossPct != null ? `${quality.packetLossPct}%` : "—"}
              </span>
            </p>
            <p>
              Jitter:{" "}
              <span className="text-foreground">
                {quality.jitterMs != null ? `${quality.jitterMs} ms` : "—"}
              </span>
            </p>
            <p>
              RTT:{" "}
              <span className="text-foreground">
                {quality.rttMs != null ? `${quality.rttMs} ms` : "—"}
              </span>
            </p>
            <p>
              Bitrate:{" "}
              <span className="text-foreground">
                {quality.bitrateKbps != null ? `${quality.bitrateKbps} kbps` : "—"}
              </span>
            </p>
            <p>
              Microphone:{" "}
              <span className="text-foreground">
                {quality.inputDeviceLabel || selectedMicLabel}
                {quality.inputLooksBluetooth ? " · Bluetooth" : ""}
              </span>
            </p>
            <p>
              Speaker:{" "}
              <span className="text-foreground">
                {quality.outputDeviceLabel || selectedSpeakerLabel}
                {quality.outputLooksBluetooth ? " · Bluetooth" : ""}
              </span>
            </p>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            Connection: {connectionGradeLabel(quality.connectionGrade)} · Phase{" "}
            {phase}
            {quality.stabilizeMs != null
              ? ` · Stabilize ${quality.stabilizeMs} ms`
              : ""}
            {quality.mediaReadyAtMs != null
              ? ` · Media-ready ${quality.mediaReadyAtMs} ms`
              : ""}
            {quality.firstAudioAtMs != null
              ? ` · First audio ${quality.firstAudioAtMs} ms`
              : ""}
          </p>
          {quality.warnings?.length ? (
            <ul className="space-y-1 rounded border border-amber-500/30 bg-amber-50/70 px-2 py-1.5 text-[11px] text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
              {quality.warnings.map((w) => (
                <li key={w.code}>Warn: {w.message}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Phone (PSTN) calls are usually slightly narrower than browser Opus —
            that is normal. Cell↔cell is limited by the carrier codec.
          </p>
          {showDebug ? (
            <div className="font-mono text-[10px] text-muted-foreground">
              <p>
                Bytes in/out: {quality.inboundBytes ?? "—"} /{" "}
                {quality.outboundBytes ?? "—"} · ICE {quality.iceState || "—"} ·
                PC {quality.connectionState || "—"}
              </p>
              <p>Assistant: {assistantId || "—"}</p>
              <p>Session: {sessionId || "—"}</p>
              <p>Conversation: {conversationId || "—"}</p>
            </div>
          ) : null}
        </div>
      )}

      {result ? (
        <div className="space-y-2 rounded border border-border bg-background/80 p-3 text-sm">
          <p className="font-medium">Test conversation result</p>
          <p className="text-xs text-muted-foreground">
            Duration {result.durationSec}s
            {result.conversationId
              ? ` · Telnyx conversation ${result.conversationId}`
              : " · Conversation id will appear when Telnyx reports it"}
          </p>
          {result.voiceDisplayName ? (
            <p className="text-xs text-muted-foreground">
              Voice: {result.voiceDisplayName}
            </p>
          ) : null}
          {result.qualityReport ? (
            <VoiceQualityReportCard report={result.qualityReport} />
          ) : result.quality ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <ConnectionBadge grade={result.quality.connectionGrade} />
              <span>
                MOS {result.quality.mos ?? "—"} · codec{" "}
                {result.quality.negotiatedCodec || "—"} · loss{" "}
                {result.quality.packetLossPct ?? "—"}%
                {result.quality.bitrateKbps != null
                  ? ` · ${result.quality.bitrateKbps} kbps`
                  : ""}
              </span>
            </div>
          ) : null}
          {result.transcript.length ? (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-border bg-muted/20 p-2 text-xs">
              {result.transcript.map((m, i) => (
                <div key={i}>
                  <span className="uppercase text-muted-foreground">{m.role}</span>
                  <p>{m.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Transcript appears here when Telnyx returns conversation messages
              for this test call.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!result.conversationId}
              onClick={() => {
                if (!result.conversationId) return;
                window.open(
                  `/voice/conversations?q=${encodeURIComponent(result.conversationId)}`,
                  "_blank",
                );
              }}
            >
              Open transcript
            </Button>
            <Button size="sm" variant="outline" onClick={() => void startCall()}>
              Re-run
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function friendlyError(err: unknown) {
  const raw = toErrorMessage(
    err,
    "The browser could not connect to the voice service. Try again.",
  );
  const lower = raw.toLowerCase();
  if (lower.includes("permission") || lower.includes("notallowed")) {
    return "Microphone access is required to test this voice agent.";
  }
  if (
    lower.includes("timeout") ||
    lower.includes("ice") ||
    lower.includes("webrtc") ||
    lower.includes("socket")
  ) {
    return "The browser could not connect to the voice service. Check your network and try again.";
  }
  if (
    lower.includes("not_built") ||
    lower.includes("build & test") ||
    lower.includes("save the agent")
  ) {
    return raw.includes("Build")
      ? raw
      : "Save the agent before starting a live test.";
  }
  if (lower.includes("rate_limited") || lower.includes("too many test")) {
    return "Too many test sessions — wait a minute and try again.";
  }
  if (
    lower.includes("authentication failed") ||
    lower.includes("login_failed") ||
    lower.includes("web_calls_disabled") ||
    lower.includes("enable browser voice")
  ) {
    return "Browser voice authentication failed. Rebuild the agent so Telnyx enables web calls, then try again.";
  }
  if (lower.includes("temporarily unavailable") || lower.includes("voice is")) {
    return "This voice is temporarily unavailable. Choose another voice.";
  }
  if (raw === "[object Object]") {
    return "The browser could not connect to the voice service. Try again.";
  }
  return raw;
}

function ConnectionBadge({
  grade,
}: {
  grade: WebrtcQualitySnapshot["connectionGrade"];
}) {
  const label = connectionGradeLabel(grade);
  const styles =
    grade === "excellent"
      ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
      : grade === "good"
        ? "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        : grade === "poor"
          ? "border-rose-500/40 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          : "border-border bg-muted text-muted-foreground";
  const dot =
    grade === "excellent"
      ? "bg-emerald-500"
      : grade === "good"
        ? "bg-amber-500"
        : grade === "poor"
          ? "bg-rose-500"
          : "bg-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
