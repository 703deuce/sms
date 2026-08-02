"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useCallback, useEffect, useRef, useState } from "react";

type CallPhase =
  | "idle"
  | "connecting"
  | "connected"
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
};

type QualityStats = {
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
};

type CallHandle = {
  hangup?: () => void;
  muteAudio?: () => void;
  unmuteAudio?: () => void;
  setAudioInDevice?: (id: string) => Promise<unknown>;
  setSpeaker?: (id: string) => Promise<unknown>;
  // Telnyx Call.getStats is callback-based; peer connection may expose Promise stats.
  getStats?: unknown;
  peer?: {
    instance?: { getStats?: () => Promise<RTCStatsReport> };
    getStats?: () => Promise<RTCStatsReport>;
  };
};

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
  const [showDebug, setShowDebug] = useState(false);
  const [quality, setQuality] = useState<QualityStats>({
    rttMs: null,
    jitterMs: null,
    packetLossPct: null,
  });
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

  const ready = Boolean(telnyxAssistantId || assistantId);
  const inCall =
    phase === "connecting" ||
    phase === "connected" ||
    phase === "listening" ||
    phase === "agent_speaking" ||
    phase === "user_speaking" ||
    phase === "reconnecting";

  const listDevices = useCallback(async (requestPermission: boolean) => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    if (requestPermission) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
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
    // Enumerate without prompting; labels may be blank until Test Voice Agent.
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
    void callRef.current?.setAudioInDevice?.(selectedMic).catch(() => undefined);
    void clientRef.current
      ?.setAudioSettings?.({ micId: selectedMic })
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
    callRef.current = null;
    clientRef.current = null;
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
      return "listening" as const;
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

  async function startCall() {
    if (inCall || finishingRef.current) return;
    setError("");
    setResult(null);
    setConversationId(null);
    conversationIdRef.current = null;
    finishingRef.current = false;
    setLastSynced(null);

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
    try {
      await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMic ? { exact: selectedMic } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      }).then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        setMicPermission("granted");
      });
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
          sessionJson.error ||
            (sessionJson.code === "not_built"
              ? "Build & test first so Telnyx can sync the assistant."
              : "Could not authorize test session"),
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

      const { TelnyxRTC } = await import("@telnyx/webrtc");
      const client = new TelnyxRTC({
        anonymous_login: {
          target_id: session.webrtc.target_id,
          target_type: "ai_assistant",
          ...(session.webrtc.target_params
            ? { target_params: session.webrtc.target_params }
            : {}),
        },
      });
      clientRef.current = client as unknown as typeof clientRef.current;
      if (remoteAudioRef.current) {
        (client as { remoteElement?: HTMLAudioElement }).remoteElement =
          remoteAudioRef.current;
      }
      if (selectedMic) {
        await (client as { setAudioSettings?: (o: object) => Promise<unknown> })
          .setAudioSettings?.({ micId: selectedMic })
          .catch(() => undefined);
      }

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
          reject(err instanceof Error ? err : new Error(String(err)));
        });
        client.connect();
      });

      if (!mountedRef.current) {
        client.disconnect?.();
        return;
      }

      setPhase("connected");

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
        if (mapped) setPhase(mapped);
      });

      const codecs =
        typeof RTCRtpReceiver !== "undefined"
          ? RTCRtpReceiver.getCapabilities("audio")?.codecs || []
          : [];
      const opus = codecs.find((c) =>
        c.mimeType.toLowerCase().includes("opus"),
      );

      const call = client.newCall({
        destinationNumber: "",
        remoteElement: remoteAudioRef.current || undefined,
        audio: true,
        ...(opus ? { preferred_codecs: [opus] } : {}),
        ...(selectedMic ? { micId: selectedMic } : {}),
        ...(selectedSpeaker ? { speakerId: selectedSpeaker } : {}),
      });
      callRef.current = call;
      setPhase("listening");
      setMuted(false);

      if (remoteAudioRef.current) {
        void remoteAudioRef.current.play().catch(() => undefined);
      }

      statsTimerRef.current = setInterval(() => {
        void pollQuality();
      }, 2000);
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
      let report: RTCStatsReport | null = null;
      const peerStats =
        call?.peer?.instance?.getStats || call?.peer?.getStats;
      if (peerStats) {
        report = await peerStats.call(call.peer?.instance || call.peer);
      }
      if (!report || typeof report.forEach !== "function") return;
      let rttMs: number | null = null;
      let jitterMs: number | null = null;
      let packetsLost = 0;
      let packetsReceived = 0;
      report.forEach((s) => {
        const row = s as Record<string, unknown>;
        if (row.type === "candidate-pair" && row.state === "succeeded") {
          if (typeof row.currentRoundTripTime === "number") {
            rttMs = Math.round(row.currentRoundTripTime * 1000);
          }
        }
        if (row.type === "inbound-rtp" && row.kind === "audio") {
          if (typeof row.jitter === "number") {
            jitterMs = Math.round(row.jitter * 1000);
          }
          if (typeof row.packetsLost === "number") packetsLost = row.packetsLost;
          if (typeof row.packetsReceived === "number") {
            packetsReceived = row.packetsReceived;
          }
        }
      });
      const total = packetsLost + packetsReceived;
      if (!mountedRef.current) return;
      setQuality({
        rttMs,
        jitterMs,
        packetLossPct:
          total > 0 ? Math.round((packetsLost / total) * 1000) / 10 : null,
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
            Not text chat.
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
            disabled={inputs.length === 0}
            onChange={(e) => setSelectedMic(e.target.value)}
          >
            {inputs.length === 0 ? (
              <option value="">No microphone found</option>
            ) : (
              inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Mic permission: {micPermission}
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
            {phase !== "connecting" ? (
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
          {showDebug ? "Hide debug" : "Debug"}
        </Button>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      {showDebug ? (
        <div className="rounded border border-border bg-background/70 p-3 font-mono text-[11px] text-muted-foreground">
          <p>Status: {phase}</p>
          <p>Assistant: {assistantId || "—"}</p>
          <p>Session: {sessionId || "—"}</p>
          <p>Conversation: {conversationId || "—"}</p>
          <p>
            Synced before call:{" "}
            {lastSynced == null ? "—" : lastSynced ? "yes" : "no (may be stale)"}
          </p>
          <p>
            RTT: {quality.rttMs != null ? `${quality.rttMs} ms` : "—"} · Jitter:{" "}
            {quality.jitterMs != null ? `${quality.jitterMs} ms` : "—"} · Loss:{" "}
            {quality.packetLossPct != null ? `${quality.packetLossPct}%` : "—"}
          </p>
          <p>Mic: {selectedMic || "default"}</p>
          <p>Speaker: {selectedSpeaker || "default"}</p>
          {startedAt ? (
            <p>Elapsed: {Math.round((Date.now() - startedAt) / 1000)}s</p>
          ) : null}
        </div>
      ) : null}

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
  const raw = err instanceof Error ? err.message : String(err);
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
  if (lower.includes("temporarily unavailable") || lower.includes("voice is")) {
    return "This voice is temporarily unavailable. Choose another voice.";
  }
  return raw || "The browser could not connect to the voice service. Try again.";
}
