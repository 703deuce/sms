"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message, State } from "@telnyx/video";
import { Button } from "@/components/ui/button";
import {
  CAMERA_STREAM_KEY,
  SCREEN_STREAM_KEY,
  TransovoVideoClient,
  type TransovoConnectionState,
} from "@/lib/transovo-video/client/transovo-video-client";
import {
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Link2,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { parseParticipantContext } from "@/lib/transovo-video/participant-context";
import { VideoInvitePanel } from "@/components/video/video-invite-panel";

type JoinPayload = {
  participantId: string;
  role: string;
  roomId: string;
  clientToken: string;
  refreshToken?: string;
  context?: string;
    settings: {
      chatEnabled?: boolean;
      guestScreenShare?: boolean;
      recordingActive?: boolean;
      postMeetingRedirect?: string | null;
      title?: string | null;
      videoMeetingId?: string;
    };
};

type ChatLine = { id: string; senderName: string; text: string; at: string };

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function ParticipantTile({
  name,
  videoTrack,
  muted,
  speaking,
  isHost,
}: {
  name: string;
  videoTrack?: MediaStreamTrack | null;
  muted?: boolean;
  speaking?: boolean;
  isHost?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (videoTrack) {
      ref.current.srcObject = new MediaStream([videoTrack]);
      ref.current.play().catch(() => undefined);
    } else {
      ref.current.srcObject = null;
    }
  }, [videoTrack]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-900 ${speaking ? "ring-2 ring-emerald-400" : ""}`}
    >
      {videoTrack ? (
        <video ref={ref} className="aspect-video w-full object-cover" playsInline />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-slate-800 text-2xl font-semibold text-white">
          {initials(name)}
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
        <span>{name}</span>
        {isHost ? <span className="text-amber-300">Host</span> : null}
        {muted ? <MicOff className="h-3 w-3" /> : null}
      </div>
    </div>
  );
}

export function MeetingRoom({
  token,
  join,
  businessName,
  showInviteLink = false,
  videoMeetingId,
  meetingTitle,
  scheduledStartAt,
}: {
  token: string;
  join: JoinPayload;
  businessName: string;
  showInviteLink?: boolean;
  videoMeetingId?: string;
  meetingTitle?: string | null;
  scheduledStartAt?: string | null;
}) {
  const clientRef = useRef<TransovoVideoClient | null>(null);
  const [connection, setConnection] = useState<TransovoConnectionState>("preparing");
  const [roomState, setRoomState] = useState<State | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [panel, setPanel] = useState<"chat" | "participants" | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [waitingGuests, setWaitingGuests] = useState<
    Array<{ id: string; displayName: string; state: string }>
  >([]);
  const [ended, setEnded] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [copiedInvite, setCopiedInvite] = useState(false);

  const guestUrl = useMemo(() => {
    if (typeof window === "undefined") return `/video/${token}`;
    return `${window.location.origin}/video/${token}`;
  }, [token]);

  async function copyInvite() {
    const title = join.settings.title || "Transovo Video meeting";
    const text = `${title}\nJoin: ${guestUrl}`;
    await navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 2000);
  }

  const elapsed = useMemo(() => {
    const secs = Math.floor((Date.now() - startedAt) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [startedAt, roomState]);

  const refreshState = useCallback(() => {
    const state = clientRef.current?.getState();
    if (state) setRoomState(state);
  }, []);

  useEffect(() => {
    let client: TransovoVideoClient | null = null;
    (async () => {
      client = new TransovoVideoClient({
        roomId: join.roomId,
        clientToken: join.clientToken,
        context: join.context,
        onStateChange: setConnection,
        onRemoteParticipantJoined: () => refreshState(),
        onRemoteParticipantLeft: () => refreshState(),
        onMessage: (participantId, message: Message) => {
          const ctx = parseParticipantContext(
            roomState?.participants.get(participantId)?.context,
          );
          setChat((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${prev.length}`,
              senderName: ctx.displayName || "Participant",
              text: message.payload,
              at: new Date().toISOString(),
            },
          ]);
        },
        onKicked: () => setKicked(true),
      });
      clientRef.current = client;
      await client.connect();
      await client.publishCameraMicrophone({ audio: true, video: true });
      refreshState();
      const state = client.getState();
      let localTelnyxId: string | undefined;
      if (state) {
        for (const p of state.participants.values()) {
          if (p.origin === "local") {
            localTelnyxId = p.id;
            break;
          }
        }
      }
      await fetch(`/api/video/public/${token}/connected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: join.participantId,
          providerParticipantId: localTelnyxId,
        }),
      }).catch(() => undefined);
    })().catch(() => setConnection("failed"));

    return () => {
      void client?.disconnect();
    };
  }, [join, refreshState, roomState?.participants, token]);

  useEffect(() => {
    const id = window.setInterval(refreshState, 2000);
    return () => window.clearInterval(id);
  }, [refreshState]);

  useEffect(() => {
    if (join.role !== "host") return;
    const loadWaiting = async () => {
      const res = await fetch(
        `/api/video/public/${token}/participants?hostParticipantId=${encodeURIComponent(join.participantId)}`,
      );
      const json = await res.json();
      const rows = (json.data?.participants || []) as Array<{
        id: string;
        displayName: string;
        state: string;
      }>;
      setWaitingGuests(rows.filter((p) => p.state === "waiting"));
    };
    void loadWaiting();
    const id = window.setInterval(() => void loadWaiting(), 4000);
    return () => window.clearInterval(id);
  }, [join.participantId, join.role, token]);

  const transovoByTelnyxId = useMemo(() => {
    const map = new Map<string, string>();
    if (!roomState) return map;
    for (const p of roomState.participants.values()) {
      const ctx = parseParticipantContext(p.context);
      if (ctx.transovoParticipantId) map.set(p.id, ctx.transovoParticipantId);
    }
    return map;
  }, [roomState]);

  const participants = useMemo(() => {
    if (!roomState) return [];
    return Array.from(roomState.participants.values()).map((p) => {
      const ctx = parseParticipantContext(p.context);
      const streams = clientRef.current?.getRoom()?.getParticipantStreams(p.id);
      let videoTrack: MediaStreamTrack | undefined;
      let muted = true;
      streams?.forEach((stream) => {
        if (stream.videoTrack) videoTrack = stream.videoTrack;
        if (stream.audioTrack) muted = !stream.isAudioEnabled;
      });
      return {
        id: p.id,
        transovoParticipantId: ctx.transovoParticipantId || transovoByTelnyxId.get(p.id),
        name: ctx.displayName || "Participant",
        isHost: ctx.role === "host",
        videoTrack,
        muted,
        speaking: activeSpeaker === p.id,
        origin: p.origin,
      };
    });
  }, [roomState, activeSpeaker, transovoByTelnyxId]);

  const screenSharer = useMemo(() => {
    if (!roomState || !clientRef.current) return null;
    for (const p of roomState.participants.values()) {
      const stream = clientRef.current.getRoom()?.getParticipantStream(p.id, SCREEN_STREAM_KEY);
      if (stream?.videoTrack) {
        const ctx = parseParticipantContext(p.context);
        return { id: p.id, name: ctx.displayName || "Presenter", videoTrack: stream.videoTrack };
      }
    }
    return null;
  }, [roomState]);

  async function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    await clientRef.current?.updateCameraMicrophone({ audio: next, video: cameraOn });
  }

  async function toggleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    await clientRef.current?.updateCameraMicrophone({ audio: micOn, video: next });
  }

  async function toggleShare() {
    if (sharing) {
      await clientRef.current?.stopScreenShare();
      setSharing(false);
      return;
    }
    await clientRef.current?.startScreenShare();
    setSharing(true);
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || !clientRef.current) return;
    await clientRef.current.sendChatMessage(text);
    await fetch(`/api/video/public/${token}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        participantId: join.participantId,
        senderName: parseParticipantContext(join.context).displayName || "You",
      }),
    }).catch(() => undefined);
    setChat((prev) => [
      ...prev,
      { id: `${Date.now()}-local`, senderName: "You", text, at: new Date().toISOString() },
    ]);
    setChatInput("");
  }

  async function hostAction(action: string, transovoParticipantId?: string) {
    if (join.role !== "host" || !transovoParticipantId) return;
    await fetch(`/api/video/public/${token}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        participantId: transovoParticipantId,
        hostParticipantId: join.participantId,
      }),
    }).catch(() => undefined);
  }

  async function endForEveryone() {
    if (join.role !== "host") {
      await leave();
      return;
    }
    await fetch(`/api/video/public/${token}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", hostParticipantId: join.participantId }),
    }).catch(() => undefined);
    await clientRef.current?.disconnect();
    setEnded(true);
  }

  async function leave() {
    await fetch(`/api/video/public/${token}/left`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: join.participantId }),
    }).catch(() => undefined);
    await clientRef.current?.disconnect();
    setEnded(true);
  }

  if (kicked) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">You were removed from the meeting.</h1>
        </div>
      </div>
    );
  }

  if (ended) {
    const redirect = join.settings.postMeetingRedirect;
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">Meeting ended</h1>
          <p className="text-muted-foreground">Thanks for joining.</p>
          {join.settings.recordingActive ? (
            <p className="text-sm text-muted-foreground">
              Your recording and meeting notes are being prepared.
            </p>
          ) : null}
          {redirect ? (
            <Button onClick={() => window.location.assign(redirect)}>Continue</Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs text-white/60">{businessName}</p>
          <h1 className="font-medium">{join.settings.title || "Transovo Video"}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/80">
          {showInviteLink || join.role === "host" ? (
            videoMeetingId ? (
              <VideoInvitePanel
                videoMeetingId={videoMeetingId}
                token={token}
                title={meetingTitle || join.settings.title}
                scheduledStartAt={scheduledStartAt}
                variant="dark"
              />
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void copyInvite()}
              >
                {copiedInvite ? (
                  "Copied"
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Copy invite link
                  </>
                )}
              </Button>
            )
          ) : null}
          {join.settings.recordingActive ? <span className="text-rose-300">● Recording</span> : null}
          <span>{elapsed}</span>
          <span className="capitalize">{connection}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-4">
          {connection === "connecting" || connection === "preparing" ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            </div>
          ) : screenSharer ? (
            <div className="grid h-full gap-3 lg:grid-cols-[2fr_1fr]">
              <ParticipantTile name={`${screenSharer.name} (screen)`} videoTrack={screenSharer.videoTrack} />
              <div className="grid gap-2 overflow-auto">
                {participants.map((p) => (
                  <ParticipantTile key={p.id} {...p} />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {participants.map((p) => (
                <ParticipantTile key={p.id} {...p} speaking={activeSpeaker === p.id} />
              ))}
            </div>
          )}
        </main>

        {panel ? (
          <aside className="w-full max-w-sm border-l border-white/10 bg-slate-900/80 p-4 sm:w-80">
            {panel === "chat" ? (
              <div className="flex h-full flex-col">
                <h2 className="mb-3 font-medium">Chat</h2>
                <div className="flex-1 space-y-2 overflow-auto text-sm">
                  {chat.map((line) => (
                    <div key={line.id}>
                      <p className="text-white/60">{line.senderName}</p>
                      <p>{line.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message everyone"
                  />
                  <Button size="sm" onClick={() => void sendChat()}>Send</Button>
                </div>
              </div>
            ) : (
              <div>
                {join.role === "host" && waitingGuests.length ? (
                  <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3">
                    <h3 className="mb-2 text-sm font-medium text-amber-200">Waiting room</h3>
                    <ul className="space-y-2">
                      {waitingGuests.map((guest) => (
                        <li key={guest.id} className="flex items-center justify-between gap-2">
                          <span>{guest.displayName}</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => void hostAction("admit", guest.id)}
                            >
                              Admit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void hostAction("decline", guest.id)}
                            >
                              Decline
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <h2 className="mb-3 font-medium">Participants ({participants.length})</h2>
                <ul className="space-y-2 text-sm">
                  {participants.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span>{p.name}</span>
                      <div className="flex items-center gap-2">
                        {p.isHost ? <span className="text-amber-300">Host</span> : null}
                        {join.role === "host" && !p.isHost && p.origin === "remote" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void hostAction("mute", p.transovoParticipantId)}
                          >
                            Mute
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <footer className="border-t border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2">
          <Button variant="outline" size="icon" onClick={() => void toggleMic()} aria-label="Microphone">
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => void toggleCamera()} aria-label="Camera">
            {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
          {join.settings.guestScreenShare || join.role === "host" ? (
            <Button variant="outline" size="icon" onClick={() => void toggleShare()} aria-label="Share screen">
              <MonitorUp className="h-4 w-4" />
            </Button>
          ) : null}
          <Button variant="outline" size="icon" onClick={() => setPanel(panel === "participants" ? null : "participants")} aria-label="Participants">
            <Users className="h-4 w-4" />
          </Button>
          {join.settings.chatEnabled ? (
            <Button variant="outline" size="icon" onClick={() => setPanel(panel === "chat" ? null : "chat")} aria-label="Chat">
              <MessageSquare className="h-4 w-4" />
            </Button>
          ) : null}
          {join.role === "host" ? (
            <Button variant="destructive" onClick={() => void endForEveryone()}>
              End for everyone
            </Button>
          ) : null}
          <Button variant="destructive" onClick={() => void leave()}>
            <PhoneOff className="mr-2 h-4 w-4" />
            Leave
          </Button>
        </div>
      </footer>
    </div>
  );
}
