"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { toErrorMessage } from "@/lib/errors";
import {
  AUDIO_CONSTRAINTS,
  MEDIA_STABILIZE_MS,
  getPeerConnectionStats,
  looksLikeBluetooth,
  parseRtcStatsReport,
  pickPreferredOpusCodec,
  type PreferredAudioCodec,
  type WebrtcQualitySnapshot,
} from "@/lib/voice/webrtc-quality";
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

const emptyQuality = (): WebrtcQualitySnapshot => ({
  negotiatedCodec: null,
  preferredCodec: null,
  opusNegotiated: null,
  mos: null,
  mosLabel: null,
  rttMs: null,
  jitterMs: null,
  packetLossPct: null,
  inboundBytes: null,
  outboundBytes: null,
  inboundAudioLevel: null,
  iceState: null,
  connectionState: null,
  mediaReadyAtMs: null,
  firstAudioAtMs: null,
  greetingGateMs: null,
  inputDeviceLabel: null,
  outputDeviceLabel: null,
  inputLooksBluetooth: false,
  outputLooksBluetooth: false,
  sampledAt: new Date().toISOString(),
});

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
}: {
  agentId: string;
  telnyxAssistantId?: string | null;
  voiceLabel?: string;
  status?: string;
  unsavedChanges?: boolean;
  onNeedBuild?: () => void;
  onSaveDraft?: () => Promise<void> | void;
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
          audio: { ...AUDIO_CONSTRAINTS },
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
    void clientRef.current
      ?.setAudioSettings?.({
        micId: selectedMic,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      })
      .catch(() => undefined);
  }, [selectedMic, inCall]);

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

  async function waitForMediaReady(call: CallHandle, connectStartedAt: number) {
    const deadline = Date.now() + 12000;
    let sawInbound = false;
    while (Date.now() < deadline && mountedRef.current) {
      const report = await getPeerConnectionStats(call);
      if (report) {
        const parsed = parseRtcStatsReport(report, qualityRef.current);
        patchQuality({
          ...parsed,
          preferredCodec: preferredOpusRef.current?.mimeType || "audio/opus",
          inputDeviceLabel: selectedMicLabel,
          outputDeviceLabel: selectedSpeakerLabel,
          inputLooksBluetooth: micIsBluetooth,
          outputLooksBluetooth: speakerIsBluetooth,
        });
        if ((parsed.inboundBytes || 0) > 0 || (parsed.inboundAudioLevel || 0) > 0) {
          sawInbound = true;
          if (qualityRef.current.firstAudioAtMs == null) {
            patchQuality({ firstAudioAtMs: Date.now() - connectStartedAt });
          }
        }
        const peer = call.peer?.instance as RTCPeerConnection | undefined;
        if (peer?.connectionState) {
          patchQuality({ connectionState: peer.connectionState });
        }
        if (peer?.iceConnectionState) {
          patchQuality({ iceState: peer.iceConnectionState });
        }
        if (
          peer?.connectionState === "connected" ||
          peer?.iceConnectionState === "connected" ||
          peer?.iceConnectionState === "completed" ||
          sawInbound
        ) {
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    const mediaReadyAtMs = Date.now() - connectStartedAt;
    patchQuality({ mediaReadyAtMs });
    await new Promise((r) => setTimeout(r, MEDIA_STABILIZE_MS));
    patchQuality({
      greetingGateMs: Date.now() - connectStartedAt,
      mediaReadyAtMs,
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
    qualityRef.current = emptyQuality();
    setQuality(qualityRef.current);
    mediaReadyRef.current = false;

    if (!telnyxAssistantId && !assistantId) {
      setError("Build & test first so Telnyx can sync the assistant.");
      onNeedBuild?.();
      setPhase("failed");
      return;
    }

    if (unsavedChanges) {
      try {
        await onSaveDraft?.();
      } catch {
        setError("Save the agent before starting a live test.");
        setPhase("failed");
        return;
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser does not support microphone access for voice testing.",
      );
      setPhase("failed");
      return;
    }

    setPhase("connecting");
    const connectStartedAt = Date.now();
    try {
      // Keep mic warm so AGC/NS settle before the AI greeting path starts.
      warmStreamRef.current?.getTracks().forEach((t) => t.stop());
      warmStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...AUDIO_CONSTRAINTS,
          deviceId: selectedMic ? { exact: selectedMic } : undefined,
        },
      });
      setMicPermission("granted");
      await listDevices(true);
    } catch {
      setMicPermission("denied");
      setPhase("failed");
      setError("Microphone access is required to test this voice agent.");
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

      const opus = preferredOpusRef.current || pickPreferredOpusCodec();
      preferredOpusRef.current = opus;
      patchQuality({
        preferredCodec: opus?.mimeType || "audio/opus",
        inputDeviceLabel: selectedMicLabel,
        outputDeviceLabel: selectedSpeakerLabel,
        inputLooksBluetooth: micIsBluetooth,
        outputLooksBluetooth: speakerIsBluetooth,
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
          noiseSuppression: true,
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
      // Brief settle after signaling READY before placing the AI call.
      await new Promise((r) => setTimeout(r, MEDIA_STABILIZE_MS));

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

      if (remoteAudioRef.current) {
        void remoteAudioRef.current.play().catch(() => undefined);
      }

      setPhase("media_ready");
      await waitForMediaReady(call, connectStartedAt);
      if (!mountedRef.current) return;
      setPhase("listening");

      statsTimerRef.current = setInterval(() => {
        void pollQuality();
      }, 1500);
    } catch (err) {
      const message = friendlyError(err);
      setPhase("failed");
      setError(message);
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
      const parsed = parseRtcStatsReport(report, qualityRef.current);
      const peer = call?.peer?.instance as RTCPeerConnection | undefined;
      patchQuality({
        ...parsed,
        preferredCodec: preferredOpusRef.current?.mimeType || "audio/opus",
        connectionState: peer?.connectionState || parsed.connectionState || null,
        iceState: peer?.iceConnectionState || parsed.iceState || null,
        inputDeviceLabel: selectedMicLabel,
        outputDeviceLabel: selectedSpeakerLabel,
        inputLooksBluetooth: micIsBluetooth,
        outputLooksBluetooth: speakerIsBluetooth,
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
        <div className="rounded border border-border bg-background/70 p-3 font-mono text-[11px] text-muted-foreground">
          <p className="mb-1 font-sans text-xs font-semibold text-foreground">
            Live call quality
          </p>
          <p>Status: {phase}</p>
          <p>
            Codec: preferred {quality.preferredCodec || "audio/opus"} · negotiated{" "}
            {quality.negotiatedCodec || "—"} · Opus{" "}
            {quality.opusNegotiated == null
              ? "—"
              : quality.opusNegotiated
                ? "yes"
                : "NO (check path)"}
          </p>
          <p>
            MOS: {quality.mos != null ? `${quality.mos} (${quality.mosLabel})` : "—"} ·
            RTT: {quality.rttMs != null ? `${quality.rttMs} ms` : "—"} · Jitter:{" "}
            {quality.jitterMs != null ? `${quality.jitterMs} ms` : "—"} · Loss:{" "}
            {quality.packetLossPct != null ? `${quality.packetLossPct}%` : "—"}
          </p>
          <p>
            Bytes in/out: {quality.inboundBytes ?? "—"} / {quality.outboundBytes ?? "—"}
          </p>
          <p>
            ICE: {quality.iceState || "—"} · PC: {quality.connectionState || "—"}
          </p>
          <p>
            Media-ready:{" "}
            {quality.mediaReadyAtMs != null ? `${quality.mediaReadyAtMs} ms` : "—"} ·
            First audio:{" "}
            {quality.firstAudioAtMs != null ? `${quality.firstAudioAtMs} ms` : "—"} ·
            Greeting gate:{" "}
            {quality.greetingGateMs != null ? `${quality.greetingGateMs} ms` : "—"}
          </p>
          <p>
            Mic: {quality.inputDeviceLabel || selectedMicLabel}
            {quality.inputLooksBluetooth ? " (Bluetooth)" : ""}
          </p>
          <p>
            Speaker: {quality.outputDeviceLabel || selectedSpeakerLabel}
            {quality.outputLooksBluetooth ? " (Bluetooth)" : ""}
          </p>
          <p>Assistant: {assistantId || "—"}</p>
          <p>Session: {sessionId || "—"}</p>
          <p>Conversation: {conversationId || "—"}</p>
          {startedAt ? (
            <p>Elapsed: {Math.round((Date.now() - startedAt) / 1000)}s</p>
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
          {result.quality ? (
            <p className="text-xs text-muted-foreground">
              Final MOS {result.quality.mos ?? "—"} ({result.quality.mosLabel || "n/a"}) ·
              codec {result.quality.negotiatedCodec || "—"} · loss{" "}
              {result.quality.packetLossPct ?? "—"}%
            </p>
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
