"use client";

import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/errors";
import { useCallback, useEffect, useRef, useState } from "react";

type LiveProbe = {
  sessionId: string;
  source: string;
  configVersion: string;
  agentName: string;
  liveVoiceId: string;
  intakeFieldKeys: string[];
  bookingStrategy: string;
  liveModel: string;
  backendModel: string;
};

type Phase = "idle" | "connecting" | "connected" | "ended" | "failed";

export function VoiceV3BrowserCall({
  agentId,
  voiceLabel,
  onSessionSuccess,
  onSessionFailure,
  onNeedSave,
}: {
  agentId: string;
  voiceLabel?: string;
  onSessionSuccess?: (probe: LiveProbe) => void;
  onSessionFailure?: (message: string) => void;
  onNeedSave?: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [probe, setProbe] = useState<LiveProbe | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const cleanup = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    if (sessionId) {
      void fetch(`/api/voice/agents/${agentId}/v3-wizard-live-test`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => undefined);
    }
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  }, [agentId]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  async function startCall() {
    setError("");
    setProbe(null);
    setPhase("connecting");
    try {
      if (onNeedSave) {
        await onNeedSave();
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (audioRef.current && stream) {
          audioRef.current.srcObject = stream;
          void audioRef.current.play().catch(() => undefined);
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (!offer.sdp) {
        throw new Error("Could not create WebRTC offer");
      }

      const res = await fetch(`/api/voice/agents/${agentId}/v3-wizard-live-test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerSdp: offer.sdp }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Live test session failed");
      }

      const data = json.data as LiveProbe & { answerSdp: string };
      sessionIdRef.current = data.sessionId;
      await pc.setRemoteDescription({ type: "answer", sdp: data.answerSdp });

      const liveProbe: LiveProbe = {
        sessionId: data.sessionId,
        source: data.source,
        configVersion: data.configVersion,
        agentName: data.agentName,
        liveVoiceId: data.liveVoiceId,
        intakeFieldKeys: data.intakeFieldKeys,
        bookingStrategy: data.bookingStrategy,
        liveModel: data.liveModel,
        backendModel: data.backendModel,
      };
      setProbe(liveProbe);
      setPhase("connected");
      onSessionSuccess?.(liveProbe);
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      setPhase("failed");
      onSessionFailure?.(message);
      await cleanup();
    }
  }

  async function endCall() {
    await cleanup();
    setPhase("ended");
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Voice V3 live browser test</p>
          <p className="text-xs text-muted-foreground">
            OpenAI GPT-Live + Astra delegation — draft wizard config
            {voiceLabel ? ` · ${voiceLabel}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {phase === "connected" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void endCall()}>
              End call
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={phase === "connecting"}
              onClick={() => void startCall()}
            >
              {phase === "connecting" ? "Connecting…" : "Start V3 live test"}
            </Button>
          )}
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {probe ? (
        <dl className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">source</dt>
            <dd>{probe.source}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">configVersion</dt>
            <dd className="truncate">{probe.configVersion}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">agentName</dt>
            <dd>{probe.agentName}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">liveVoiceId</dt>
            <dd>{probe.liveVoiceId}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">live session</dt>
            <dd className="truncate">{probe.sessionId}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">models</dt>
            <dd>{probe.liveModel} → {probe.backendModel}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-foreground">intakeFieldKeys</dt>
            <dd>{probe.intakeFieldKeys.join(", ") || "—"}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
