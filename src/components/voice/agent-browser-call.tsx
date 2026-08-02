"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";

type CallState = "idle" | "connecting" | "live" | "ended" | "error";

/**
 * Real browser ↔ Telnyx AI assistant voice call (same assistant as phone deploy).
 * Uses @telnyx/webrtc anonymous_login — not browser speechRecognition / speechSynthesis.
 */
export function AgentBrowserCall({
  agentId,
  telnyxAssistantId,
  voiceLabel,
  status,
  onNeedBuild,
}: {
  agentId: string;
  telnyxAssistantId?: string | null;
  voiceLabel?: string;
  status?: string;
  onNeedBuild?: () => void;
}) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const clientRef = useRef<{
    disconnect?: () => void;
    newCall?: (opts: Record<string, unknown>) => {
      hangup?: () => void;
      muteAudio?: () => void;
      unmuteAudio?: () => void;
    };
    on?: (ev: string, cb: (...args: unknown[]) => void) => void;
    remoteElement?: HTMLAudioElement | null;
  } | null>(null);
  const callRef = useRef<{
    hangup?: () => void;
    muteAudio?: () => void;
    unmuteAudio?: () => void;
  } | null>(null);

  const ready = Boolean(telnyxAssistantId);

  useEffect(() => {
    return () => {
      try {
        callRef.current?.hangup?.();
        clientRef.current?.disconnect?.();
      } catch {
        // ignore
      }
    };
  }, []);

  async function startCall() {
    if (!telnyxAssistantId) {
      setError("Build & test first so the Telnyx assistant exists.");
      onNeedBuild?.();
      return;
    }
    setError("");
    setCallState("connecting");
    try {
      // Ensure assistant allows anonymous web calls (same id as phone).
      await fetch("/api/voice/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "enable_web_calls", agentId }),
      }).catch(() => undefined);

      const { TelnyxRTC } = await import("@telnyx/webrtc");
      const client = new TelnyxRTC({
        anonymous_login: {
          target_id: telnyxAssistantId,
          target_type: "ai_assistant",
        },
      });
      clientRef.current = client as unknown as typeof clientRef.current;
      if (remoteAudioRef.current) {
        (client as { remoteElement?: HTMLAudioElement }).remoteElement =
          remoteAudioRef.current;
      }

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("WebRTC connect timeout")), 20000);
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

      client.on("telnyx.notification", (notification: unknown) => {
        const n = notification as {
          type?: string;
          call?: { state?: string; hangup?: () => void };
        };
        if (n.type !== "callUpdate" || !n.call) return;
        const state = String(n.call.state || "");
        if (state === "active" || state === "answered") setCallState("live");
        if (state === "hangup" || state === "destroy" || state === "purge") {
          setCallState("ended");
          callRef.current = null;
        }
      });

      const codecs =
        typeof RTCRtpReceiver !== "undefined"
          ? RTCRtpReceiver.getCapabilities("audio")?.codecs || []
          : [];
      const opus = codecs.find((c) => c.mimeType.toLowerCase().includes("opus"));

      const call = client.newCall({
        destinationNumber: "",
        remoteElement: remoteAudioRef.current || undefined,
        audio: true,
        ...(opus ? { preferred_codecs: [opus] } : {}),
      });
      callRef.current = call;
      setCallState("live");
    } catch (err) {
      setCallState("error");
      setError(
        err instanceof Error
          ? err.message
          : "Could not start browser call — check mic permission and rebuild the agent.",
      );
      try {
        clientRef.current?.disconnect?.();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }
  }

  function hangup() {
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
    setMuted(false);
    setCallState((s) => (s === "live" || s === "connecting" ? "ended" : s));
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

  return (
    <Card className="space-y-3 border-emerald-800/25 bg-emerald-50/30 p-5 dark:bg-emerald-950/20">
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle>Test call (browser)</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Talk to the <strong>same Telnyx agent</strong> you&apos;ll deploy to a number —
            mic in, Ultra voice out. Not text chat.
          </p>
          {voiceLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">Voice: {voiceLabel}</p>
          ) : null}
        </div>
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>

      {!ready ? (
        <p className="text-sm text-amber-800">
          Click <strong>Build &amp; test</strong> first to sync the assistant, then Call.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {callState === "live" || callState === "connecting" ? (
          <>
            <Button variant="danger" onClick={hangup}>
              {callState === "connecting" ? "Cancel" : "Hang up"}
            </Button>
            {callState === "live" ? (
              <Button variant="outline" size="sm" onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </Button>
            ) : null}
            <span className="text-sm font-medium text-emerald-700">
              {callState === "connecting" ? "Connecting…" : "Live — speak now"}
            </span>
          </>
        ) : (
          <Button disabled={!ready} onClick={() => void startCall()}>
            Call agent
          </Button>
        )}
        {status === "TESTING" ? (
          <span className="text-xs text-muted-foreground">Testing build</span>
        ) : null}
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {callState === "ended" ? (
        <p className="text-xs text-muted-foreground">Call ended. Call again or Deploy to number.</p>
      ) : null}
    </Card>
  );
}
