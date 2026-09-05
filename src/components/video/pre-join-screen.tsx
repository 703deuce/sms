"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Loader2, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { TransovoVideoClient } from "@/lib/transovo-video/client/transovo-video-client";

export type PreJoinMeetingInfo = {
  token: string;
  title: string | null;
  scheduledStartAt: string | null;
  businessName: string;
  businessLogo?: string | null;
  requireGuestEmail: boolean;
  requireGuestName: boolean;
  passcodeRequired: boolean;
  recordingNotice: string | null;
};

type Props = {
  info: PreJoinMeetingInfo;
  onJoined: (payload: {
    participantId: string;
    role: string;
    roomId: string;
    clientToken: string;
    refreshToken?: string;
    context?: string;
    settings: Record<string, unknown>;
  }) => void;
};

export function PreJoinScreen({ info, onJoined }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [devices, setDevices] = useState<{
    audioinput: MediaDeviceInfo[];
    videoinput: MediaDeviceInfo[];
  }>({ audioinput: [], videoinput: [] });
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await TransovoVideoClient.createPreviewStream(cameraOn, micOn);
        if (!active) return;
        previewStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const lists = await new TransovoVideoClient({
          roomId: "",
          clientToken: "",
        }).listDevices();
        if (!active) return;
        setDevices({ audioinput: lists.audioinput, videoinput: lists.videoinput });
        if (lists.audioinput[0]) setAudioDeviceId(lists.audioinput[0].deviceId);
        if (lists.videoinput[0]) setVideoDeviceId(lists.videoinput[0].deviceId);
      } catch {
        setPermissionError(
          "Camera or microphone access is blocked. You can enable permissions in your browser settings or join without video.",
        );
      }
    })();
    return () => {
      active = false;
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const stream = previewStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = micOn;
    });
    stream.getVideoTracks().forEach((t) => {
      t.enabled = cameraOn;
    });
  }, [cameraOn, micOn]);

  useEffect(() => {
    if (!waiting) return;
    const poll = async () => {
      const res = await fetch(`/api/video/public/${info.token}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          email,
          passcode: passcode || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data && !json.data.waiting) {
        setWaiting(false);
        previewStreamRef.current?.getTracks().forEach((t) => t.stop());
        onJoined(json.data);
      }
    };
    const id = window.setInterval(() => void poll(), 3000);
    return () => window.clearInterval(id);
  }, [waiting, info.token, name, email, passcode, onJoined]);

  async function join() {
    setError("");
    setJoining(true);
    try {
      const res = await fetch(`/api/video/public/${info.token}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          email,
          passcode: passcode || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Unable to join");
        return;
      }
      if (json.data?.waiting) {
        setWaiting(true);
        return;
      }
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      onJoined(json.data);
    } finally {
      setJoining(false);
    }
  }

  const scheduled = info.scheduledStartAt
    ? new Date(info.scheduledStartAt).toLocaleString()
    : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <div className="text-center">
        {info.businessLogo ? (
          <img src={info.businessLogo} alt="" className="mx-auto mb-3 h-12 w-12 rounded-lg object-cover" />
        ) : null}
        <p className="text-sm text-muted-foreground">{info.businessName}</p>
        <h1 className="mt-1 text-2xl font-semibold">{info.title || "Transovo Video"}</h1>
        {scheduled ? <p className="mt-1 text-sm text-muted-foreground">{scheduled}</p> : null}
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-medium">Ready to join?</h2>
        {info.recordingNotice ? (
          <p className="mt-2 text-sm text-amber-700">{info.recordingNotice}</p>
        ) : null}
        {permissionError ? <p className="mt-2 text-sm text-amber-700">{permissionError}</p> : null}

        <div className="mt-4 overflow-hidden rounded-xl bg-slate-950">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          {info.requireGuestEmail ? (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          ) : null}
          {info.passcodeRequired ? (
            <div className="sm:col-span-2">
              <Label htmlFor="passcode">Meeting passcode</Label>
              <Input
                id="passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="camera">Camera</Label>
            <select
              id="camera"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={videoDeviceId}
              onChange={(e) => setVideoDeviceId(e.target.value)}
            >
              {devices.videoinput.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="microphone">Microphone</Label>
            <select
              id="microphone"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={audioDeviceId}
              onChange={(e) => setAudioDeviceId(e.target.value)}
            >
              {devices.audioinput.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setMicOn((v) => !v)}>
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            <span className="ml-2">{micOn ? "Mic on" : "Mic off"}</span>
          </Button>
          <Button type="button" variant="outline" onClick={() => setCameraOn((v) => !v)}>
            {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            <span className="ml-2">{cameraOn ? "Camera on" : "Camera off"}</span>
          </Button>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {waiting ? (
          <p className="mt-3 text-sm text-muted-foreground">Waiting for the host to admit you…</p>
        ) : null}

        <Button
          className="mt-5 w-full"
          disabled={joining || !name.trim() || (info.requireGuestEmail && !email.trim())}
          onClick={() => void join()}
        >
          {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Meeting"}
        </Button>
      </div>
    </div>
  );
}
