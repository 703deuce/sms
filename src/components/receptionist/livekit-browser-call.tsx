"use client";

import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/errors";
import { useCallback, useEffect, useRef, useState } from "react";

type LiveKitTestSession = {
  sessionId: string;
  livekit: {
    url: string;
    token: string;
    roomName: string;
    participantIdentity: string;
  };
};

/**
 * Browser ↔ LiveKit room test using the same inbound worker as production SIP.
 */
export function LiveKitBrowserCall({
  agentId,
  voiceLabel,
}: {
  agentId: string;
  voiceLabel?: string;
}) {
  const [phase, setPhase] = useState<"idle" | "connecting" | "connected" | "ended" | "failed">(
    "idle",
  );
  const [error, setError] = useState("");
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hangup = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      await room.disconnect().catch(() => undefined);
      roomRef.current = null;
    }
    setPhase("ended");
  }, []);

  useEffect(() => {
    return () => {
      void hangup();
    };
  }, [hangup]);

  async function startCall() {
    setError("");
    setPhase("connecting");
    try {
      const sessionRes = await fetch(`/api/voice/agents/${agentId}/test-session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sync: false }),
      });
      const sessionJson = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(toErrorMessage(sessionJson.error, "Could not start LiveKit test"));
      }

      const session = sessionJson.data as LiveKitTestSession;
      if (!session.livekit?.url || !session.livekit?.token) {
        throw new Error("LiveKit test session missing connection details");
      }

      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
          void audioRef.current.play().catch(() => undefined);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setPhase("ended");
      });

      await room.connect(session.livekit.url, session.livekit.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      setPhase("connected");
    } catch (err) {
      setPhase("failed");
      setError(err instanceof Error ? err.message : "Call failed");
    }
  }

  return (
    <div className="space-y-3">
      <audio ref={audioRef} autoPlay className="hidden" />
      <p className="text-sm text-muted-foreground">
        Live browser test via LiveKit{voiceLabel ? ` · ${voiceLabel}` : ""}.
      </p>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2">
        {phase === "idle" || phase === "ended" || phase === "failed" ? (
          <Button type="button" onClick={() => startCall()} className="bg-primary hover:bg-primary-hover">
            Start test call
          </Button>
        ) : null}
        {phase === "connecting" ? (
          <Button type="button" disabled variant="outline">Connecting…</Button>
        ) : null}
        {phase === "connected" ? (
          <Button type="button" variant="outline" onClick={() => hangup()}>End call</Button>
        ) : null}
      </div>
      {phase === "connected" ? (
        <p className="text-xs text-primary font-medium">Connected — speak to your receptionist.</p>
      ) : null}
    </div>
  );
}
