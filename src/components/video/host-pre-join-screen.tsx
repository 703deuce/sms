"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { VideoInvitePanel } from "@/components/video/video-invite-panel";
import { Loader2, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { TransovoVideoClient } from "@/lib/transovo-video/client/transovo-video-client";

export type HostPreJoinInfo = {
  title: string | null;
  scheduledStartAt: string | null;
  businessName: string;
  hostDisplayName: string;
  recordingNotice?: string | null;
};

export type HostJoinPayload = {
  participantId: string;
  role: string;
  roomId: string;
  clientToken: string;
  refreshToken?: string;
  context?: string;
  settings: Record<string, unknown>;
};

type Props = {
  info: HostPreJoinInfo;
  onJoined: (payload: HostJoinPayload) => void;
  onJoinRequest: () => Promise<HostJoinPayload>;
  invite?: {
    videoMeetingId: string;
    token: string;
    title?: string | null;
    scheduledStartAt?: string | null;
  };
};

export function HostPreJoinScreen({ info, onJoined, onJoinRequest, invite }: Props) {
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [devices, setDevices] = useState<{
    audioinput: MediaDeviceInfo[];
    videoinput: MediaDeviceInfo[];
    audiooutput: MediaDeviceInfo[];
  }>({ audioinput: [], videoinput: [], audiooutput: [] });
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [speakerDeviceId, setSpeakerDeviceId] = useState("");
  const [error, setError] = useState("");
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
        setDevices({
          audioinput: lists.audioinput,
          videoinput: lists.videoinput,
          audiooutput: lists.audiooutput,
        });
        if (lists.audioinput[0]) setAudioDeviceId(lists.audioinput[0].deviceId);
        if (lists.videoinput[0]) setVideoDeviceId(lists.videoinput[0].deviceId);
        if (lists.audiooutput[0]) setSpeakerDeviceId(lists.audiooutput[0].deviceId);
      } catch {
        setPermissionError(
          "Camera or microphone access is blocked. Check browser permissions, then try again.",
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

  async function join() {
    setError("");
    setJoining(true);
    try {
      const payload = await onJoinRequest();
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      onJoined(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join");
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
        <p className="text-sm text-muted-foreground">{info.businessName}</p>
        <h1 className="mt-1 text-2xl font-semibold">{info.title || "Transovo Video"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Joining as {info.hostDisplayName}</p>
        {scheduled ? <p className="mt-1 text-sm text-muted-foreground">{scheduled}</p> : null}
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-medium">Ready to join?</h2>
        {info.recordingNotice ? (
          <p className="mt-2 text-sm text-amber-700">{info.recordingNotice}</p>
        ) : null}
        {permissionError ? <p className="mt-2 text-sm text-amber-700">{permissionError}</p> : null}

        {invite ? (
          <div className="mt-4">
            <VideoInvitePanel
              videoMeetingId={invite.videoMeetingId}
              token={invite.token}
              title={invite.title ?? info.title}
              scheduledStartAt={invite.scheduledStartAt ?? info.scheduledStartAt}
              layout="card"
            />
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl bg-slate-950">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="host-camera">
              Camera
            </label>
            <select
              id="host-camera"
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
            <label className="text-xs font-medium text-muted-foreground" htmlFor="host-mic">
              Microphone
            </label>
            <select
              id="host-mic"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={audioDeviceId}
              onChange={(e) => setAudioDeviceId(e.target.value)}
            >
              {devices.audioinput.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="host-speaker">
              Speaker
            </label>
            <select
              id="host-speaker"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={speakerDeviceId}
              onChange={(e) => setSpeakerDeviceId(e.target.value)}
            >
              {devices.audiooutput.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || "Speaker"}</option>
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

        <Button className="mt-5 w-full" disabled={joining} onClick={() => void join()}>
          {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join meeting"}
        </Button>
      </div>
    </div>
  );
}
