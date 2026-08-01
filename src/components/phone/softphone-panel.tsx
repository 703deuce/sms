"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { PhoneNumber } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Grid3X3,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneForwarded,
  PhoneOff,
  Play,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type MediaMode = "webrtc" | "call_control" | "call_my_phone";

type ActiveCall = {
  id: string;
  from: string;
  to: string;
  status: string;
  muted: boolean;
  onHold: boolean;
  mediaMode: MediaMode;
  startedAt: number;
  notes?: string;
};

type IncomingCall = {
  id: string;
  from: string;
  to: string;
  webrtcCall?: unknown;
};

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

const PRESENCE_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "away", label: "Away" },
  { value: "busy", label: "Busy" },
  { value: "on_call", label: "On call" },
  { value: "offline", label: "Offline" },
];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SoftphonePanel({
  phoneNumbers,
  defaultCallerId,
}: {
  phoneNumbers: PhoneNumber[];
  defaultCallerId?: string | null;
}) {
  const [dialNumber, setDialNumber] = useState("");
  const [callerId, setCallerId] = useState(defaultCallerId || phoneNumbers[0]?.number || "");
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [showDtmf, setShowDtmf] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [warmTransferNote, setWarmTransferNote] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [useCallMyPhone, setUseCallMyPhone] = useState(false);
  const [recording, setRecording] = useState(false);
  const [webrtcMode, setWebrtcMode] = useState<string>("mock");
  const [webrtcConnected, setWebrtcConnected] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [presenceStatus, setPresenceStatus] = useState("available");
  const [parkSlot, setParkSlot] = useState("");
  const [conferenceId, setConferenceId] = useState("");
  const [conferenceAddTo, setConferenceAddTo] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const telnyxClientRef = useRef<unknown>(null);
  const webrtcCallRef = useRef<unknown>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  activeCallRef.current = activeCall;

  useEffect(() => {
    fetch("/api/phone/webrtc-token")
      .then((r) => r.json())
      .then(async (j) => {
        const mode = j.data?.mode || "mock";
        setWebrtcMode(mode);
        const token = j.data?.loginToken;
        if (mode === "telnyx" && token) {
          try {
            const { TelnyxRTC } = await import("@telnyx/webrtc");
            const client = new TelnyxRTC({ login_token: token });
            const audioEl = remoteAudioRef.current;
            if (audioEl) client.remoteElement = audioEl;

            client.on("telnyx.ready", () => setWebrtcConnected(true));
            client.on("telnyx.error", (err: unknown) => {
              console.warn("[softphone] WebRTC error", err);
            });
            client.on("telnyx.notification", (notification: {
              type?: string;
              call?: {
                id?: string;
                state?: string;
                direction?: string;
                remoteCallerNumber?: string;
                localCallerNumber?: string;
                answer?: (opts?: { remoteElement?: HTMLAudioElement }) => void;
                hangup?: () => void;
                muteAudio?: () => void;
                unmuteAudio?: () => void;
                hold?: () => void;
                unhold?: () => void;
                dtmf?: (digits: string) => void;
              };
            }) => {
              const call = notification.call;
              if (!call || notification.type !== "callUpdate") return;

              if (call.state === "ringing" && call.direction === "inbound") {
                if (activeCallRef.current) return;
                webrtcCallRef.current = call;
                setIncoming({
                  id: call.id || `webrtc-${Date.now()}`,
                  from: call.remoteCallerNumber || "Unknown",
                  to: call.localCallerNumber || callerId,
                  webrtcCall: call,
                });
              }

              if (call.state === "active" || call.state === "answered") {
                webrtcCallRef.current = call;
                if (!activeCallRef.current) {
                  setActiveCall({
                    id: call.id || `webrtc-${Date.now()}`,
                    from: call.localCallerNumber || callerId,
                    to: call.remoteCallerNumber || dialNumber,
                    status: "in_progress",
                    muted: false,
                    onHold: false,
                    mediaMode: "webrtc",
                    startedAt: Date.now(),
                  });
                  setIncoming(null);
                }
              }

              if (call.state === "hangup" || call.state === "destroy") {
                if (webrtcCallRef.current === call) {
                  webrtcCallRef.current = null;
                  setActiveCall(null);
                  setIncoming(null);
                  setShowDtmf(false);
                }
              }
            });

            client.connect();
            telnyxClientRef.current = client;
          } catch {
            setWebrtcMode("api");
          }
        }
      })
      .catch(() => undefined);

    return () => {
      const client = telnyxClientRef.current as { disconnect?: () => void } | null;
      client?.disconnect?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for ringing inbound calls (Call Control fallback when WebRTC not handling).
  useEffect(() => {
    if (activeCall || webrtcConnected) return;
    let cancelled = false;
    const check = () => {
      fetch("/api/phone/calls?direction=inbound&status=ringing&limit=1")
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          const call = (j.data || [])[0];
          setIncoming(call ? { id: call.id, from: call.from, to: call.to } : null);
        })
        .catch(() => undefined);
    };
    check();
    const t = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeCall, webrtcConnected]);

  // Call timer
  useEffect(() => {
    if (!activeCall) {
      setElapsed(0);
      return;
    }
    const startedAt = activeCall.startedAt;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [activeCall]);

  // Load presence on mount
  useEffect(() => {
    fetch("/api/phone/presence")
      .then((r) => r.json())
      .then((j) => {
        const rows = j.data || [];
        const mine = rows[0];
        if (mine?.status) setPresenceStatus(mine.status);
      })
      .catch(() => undefined);
  }, []);

  async function updatePresence(status: string) {
    setPresenceStatus(status);
    await fetch("/api/phone/presence", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
  }

  async function answerIncoming() {
    if (!incoming) return;
    setError("");
    try {
      if (incoming.webrtcCall || webrtcConnected) {
        const call = (incoming.webrtcCall || webrtcCallRef.current) as {
          answer?: (opts?: { remoteElement?: HTMLAudioElement }) => void;
        } | null;
        const audioEl = remoteAudioRef.current;
        if (call?.answer) {
          await call.answer(audioEl ? { remoteElement: audioEl } : undefined);
        }
        webrtcCallRef.current = call;
        setActiveCall({
          id: incoming.id,
          from: incoming.to,
          to: incoming.from,
          status: "in_progress",
          muted: false,
          onHold: false,
          mediaMode: "webrtc",
          startedAt: Date.now(),
        });
        setIncoming(null);
        return;
      }

      const res = await fetch(`/api/phone/calls/${incoming.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Answer failed");
      setActiveCall({
        id: incoming.id,
        from: incoming.from,
        to: incoming.to,
        status: "in_progress",
        muted: false,
        onHold: false,
        mediaMode: "call_control",
        startedAt: Date.now(),
      });
      setIncoming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Answer failed");
    }
  }

  async function declineIncoming() {
    if (!incoming) return;
    const call = incoming.webrtcCall as { hangup?: () => void } | undefined;
    if (call?.hangup) {
      call.hangup();
    } else {
      await fetch(`/api/phone/calls/${incoming.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hangup: true, disposition: "missed:declined" }),
      }).catch(() => undefined);
    }
    setIncoming(null);
    webrtcCallRef.current = null;
  }

  const pressKey = useCallback((key: string) => {
    setDialNumber((n) => n + key);
    if (activeCall?.mediaMode === "webrtc" && webrtcCallRef.current) {
      const call = webrtcCallRef.current as { dtmf?: (d: string) => void };
      call.dtmf?.(key);
      return;
    }
    if (activeCall) {
      fetch(`/api/phone/calls/${activeCall.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dtmf: key }),
      }).catch(() => undefined);
    }
  }, [activeCall]);

  async function startCall() {
    if (!dialNumber.trim()) return;
    if (useCallMyPhone && !myPhone.trim()) {
      setError("Enter your phone number for Call my phone.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const dest = dialNumber.trim();
      const from = callerId;

      // WebRTC outbound (skip when bridging via personal phone).
      if (webrtcConnected && !useCallMyPhone && telnyxClientRef.current) {
        const client = telnyxClientRef.current as {
          newCall: (opts: {
            destinationNumber: string;
            callerNumber?: string;
            remoteElement?: HTMLAudioElement;
          }) => unknown;
        };
        const audioEl = remoteAudioRef.current;
        const call = client.newCall({
          destinationNumber: dest,
          callerNumber: from,
          ...(audioEl ? { remoteElement: audioEl } : {}),
        });
        webrtcCallRef.current = call;
        const callId =
          (call as { id?: string }).id || `webrtc-${Date.now()}`;
        setActiveCall({
          id: callId,
          from,
          to: dest,
          status: "ringing",
          muted: false,
          onHold: false,
          mediaMode: "webrtc",
          startedAt: Date.now(),
        });
        setRecording(false);
        return;
      }

      const res = await fetch("/api/phone/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: dest,
          from,
          ...(useCallMyPhone ? { callMyPhone: myPhone.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Dial failed");
      const mediaMode: MediaMode = useCallMyPhone
        ? "call_my_phone"
        : "call_control";
      setActiveCall({
        id: json.data.id,
        from: json.data.from,
        to: json.data.to,
        status: json.data.status,
        muted: false,
        onHold: false,
        mediaMode,
        startedAt: Date.now(),
      });
      setRecording(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dial failed");
    } finally {
      setLoading(false);
    }
  }

  async function patchCall(patch: Record<string, unknown>) {
    if (!activeCall) return;
    const res = await fetch(`/api/phone/calls/${activeCall.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Action failed");
    return json.data;
  }

  function clearCallState() {
    setActiveCall(null);
    setShowDtmf(false);
    webrtcCallRef.current = null;
    setConferenceId("");
  }

  async function hangup() {
    if (!activeCall) return;
    try {
      if (activeCall.mediaMode === "webrtc" && webrtcCallRef.current) {
        const call = webrtcCallRef.current as { hangup?: () => void };
        await call.hangup?.();
      } else {
        await patchCall({ hangup: true });
      }
    } catch {
      // still clear UI
    }
    clearCallState();
  }

  async function toggleMute() {
    if (!activeCall) return;
    const muted = !activeCall.muted;
    if (activeCall.mediaMode === "webrtc" && webrtcCallRef.current) {
      const call = webrtcCallRef.current as {
        muteAudio?: () => void;
        unmuteAudio?: () => void;
      };
      if (muted) call.muteAudio?.();
      else call.unmuteAudio?.();
      setActiveCall({ ...activeCall, muted });
      return;
    }
    const data = await patchCall({ muted });
    setActiveCall({ ...activeCall, muted: data?.muted ?? muted });
  }

  async function toggleHold() {
    if (!activeCall) return;
    const onHold = !activeCall.onHold;
    if (activeCall.mediaMode === "webrtc" && webrtcCallRef.current) {
      const call = webrtcCallRef.current as {
        hold?: () => void;
        unhold?: () => void;
      };
      if (onHold) await call.hold?.();
      else await call.unhold?.();
      setActiveCall({
        ...activeCall,
        onHold,
        status: onHold ? "on_hold" : "in_progress",
      });
      return;
    }
    const data = await patchCall({ onHold });
    setActiveCall({
      ...activeCall,
      onHold: data?.onHold ?? onHold,
      status: data?.status ?? activeCall.status,
    });
  }

  async function transfer() {
    if (!activeCall || !transferTo.trim()) return;
    try {
      const note = warmTransferNote.trim();
      if (note) {
        await patchCall({
          notes: `${callNotes}\n[Warm transfer note: ${note}]`.trim(),
        });
      }
      if (activeCall.mediaMode !== "webrtc") {
        await patchCall({ transferTo: transferTo.trim() });
      } else {
        await patchCall({ transferTo: transferTo.trim() });
      }
      setTransferTo("");
      setWarmTransferNote("");
      clearCallState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    }
  }

  async function saveNotes() {
    if (!activeCall) return;
    try {
      await patchCall({ notes: callNotes });
      setActiveCall({ ...activeCall, notes: callNotes });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notes save failed");
    }
  }

  async function parkCall() {
    if (!activeCall) return;
    try {
      const res = await fetch("/api/phone/park", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanCallId: activeCall.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Park failed");
      setParkSlot(json.data?.slotCode || json.data?.code || "");
      clearCallState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Park failed");
    }
  }

  async function retrievePark() {
    if (!parkSlot.trim()) return;
    try {
      const res = await fetch("/api/phone/park", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retrieve", slotCode: parkSlot.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retrieve failed");
      setParkSlot("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retrieve failed");
    }
  }

  async function createConference() {
    if (!activeCall) return;
    try {
      const res = await fetch("/api/phone/conference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", humanCallId: activeCall.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Conference create failed");
      setConferenceId(json.data?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conference create failed");
    }
  }

  async function addToConference() {
    if (!conferenceId || !conferenceAddTo.trim()) return;
    try {
      const res = await fetch("/api/phone/conference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          conferenceId,
          to: conferenceAddTo.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Add participant failed");
      setConferenceAddTo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add participant failed");
    }
  }

  async function toggleRecord() {
    if (!activeCall || activeCall.mediaMode === "webrtc") return;
    const next = !recording;
    try {
      await patchCall({ record: next });
      setRecording(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recording failed");
    }
  }

  const modeLabel =
    webrtcMode === "telnyx" && webrtcConnected
      ? "Telnyx WebRTC"
      : webrtcMode === "telnyx"
        ? "Telnyx (connecting…)"
        : webrtcMode === "api"
          ? "Call Control API"
          : "Mock (no Telnyx key)";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {incoming && !activeCall ? (
        <Card className="lg:col-span-2 border-primary/40 bg-primary/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Phone className="h-5 w-5 animate-pulse text-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold">Incoming call</p>
                <p className="text-xs text-muted-foreground">
                  {incoming.from} → {incoming.to}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={answerIncoming} className="gap-2">
                <Phone className="h-4 w-4" /> Answer
              </Button>
              <Button variant="danger" onClick={declineIncoming} className="gap-2">
                <PhoneOff className="h-4 w-4" /> Decline
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Browser dialer
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Mode: {modeLabel}</p>

        <div className="mt-3">
          <Label htmlFor="presence">Presence</Label>
          <select
            id="presence"
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={presenceStatus}
            onChange={(e) => updatePresence(e.target.value)}
          >
            {PRESENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {phoneNumbers.length > 0 ? (
          <div className="mt-4">
            <Label htmlFor="callerId">Caller ID</Label>
            <select
              id="callerId"
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
              disabled={Boolean(activeCall)}
            >
              {phoneNumbers.map((pn) => (
                <option key={pn.id} value={pn.number}>
                  {pn.friendlyName ? `${pn.friendlyName} · ` : ""}{pn.number}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mt-4">
          <Label htmlFor="dialNumber">Number</Label>
          <Input
            id="dialNumber"
            type="tel"
            className="mt-1.5 text-lg font-mono tracking-wide"
            value={dialNumber}
            onChange={(e) => setDialNumber(e.target.value)}
            placeholder="+1..."
            disabled={Boolean(activeCall)}
          />
        </div>

        <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={useCallMyPhone}
            disabled={Boolean(activeCall)}
            onChange={(e) => setUseCallMyPhone(e.target.checked)}
          />
          <span>
            Call my phone first, then bridge to the destination (for users without browser audio).
          </span>
        </label>
        {useCallMyPhone ? (
          <div className="mt-2">
            <Label htmlFor="myPhone">Your phone</Label>
            <Input
              id="myPhone"
              type="tel"
              className="mt-1.5 font-mono"
              value={myPhone}
              onChange={(e) => setMyPhone(e.target.value)}
              placeholder="+1 your cell"
              disabled={Boolean(activeCall)}
            />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-3">
          {PAD_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="flex h-12 items-center justify-center rounded-lg border border-border bg-muted/50 text-lg font-semibold hover:bg-muted"
              onClick={() => pressKey(key)}
              disabled={Boolean(activeCall) && !showDtmf}
            >
              {key}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {!activeCall ? (
            <Button onClick={startCall} disabled={loading || !dialNumber.trim()} className="gap-2">
              <Phone className="h-4 w-4" />
              {loading ? "Calling…" : "Call"}
            </Button>
          ) : (
            <>
              <Button variant="danger" onClick={hangup} className="gap-2">
                <PhoneOff className="h-4 w-4" />
                Hang up
              </Button>
              <Button variant="outline" onClick={toggleMute} className="gap-2">
                {activeCall.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {activeCall.muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="outline" onClick={toggleHold} className="gap-2">
                {activeCall.onHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {activeCall.onHold ? "Resume" : "Hold"}
              </Button>
              {activeCall.mediaMode !== "webrtc" ? (
                <Button variant="outline" onClick={toggleRecord} className="gap-2">
                  {recording ? "Stop rec" : "Record"}
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => setShowDtmf((v) => !v)}
                className="gap-2"
              >
                <Grid3X3 className="h-4 w-4" />
                DTMF
              </Button>
            </>
          )}
        </div>

        {activeCall ? (
          <div className="mt-4 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {activeCall.status === "on_hold" ? "On hold · " : ""}
                {activeCall.from} → {activeCall.to}
              </p>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                {formatDuration(elapsed)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Media: {activeCall.mediaMode.replace("_", " ")}
            </p>

            <div>
              <Label htmlFor="callNotes">Call notes</Label>
              <Textarea
                id="callNotes"
                rows={2}
                className="mt-1"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Notes saved to call record…"
              />
              <Button variant="outline" size="sm" className="mt-2" onClick={saveNotes}>
                Save notes
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1">
                <Label htmlFor="transferTo">Transfer to</Label>
                <Input
                  id="transferTo"
                  type="tel"
                  className="mt-1"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  placeholder="+1..."
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <Label htmlFor="warmNote">Warm transfer note</Label>
                <Input
                  id="warmNote"
                  className="mt-1"
                  value={warmTransferNote}
                  onChange={(e) => setWarmTransferNote(e.target.value)}
                  placeholder="Context for agent…"
                />
              </div>
              <Button variant="outline" size="sm" onClick={transfer} className="gap-1">
                <PhoneForwarded className="h-4 w-4" />
                Transfer
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={parkCall}>
                Park call
              </Button>
              <Button variant="outline" size="sm" onClick={createConference} className="gap-1">
                <Users className="h-3 w-3" />
                Start conference
              </Button>
            </div>

            {conferenceId ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1">
                  <Label>Add to conference</Label>
                  <Input
                    className="mt-1"
                    value={conferenceAddTo}
                    onChange={(e) => setConferenceAddTo(e.target.value)}
                    placeholder="+1..."
                  />
                </div>
                <Button variant="outline" size="sm" onClick={addToConference}>
                  Add
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeCall && showDtmf ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">DTMF keypad</p>
            <div className="grid grid-cols-3 gap-2">
              {PAD_KEYS.map((key) => (
                <button
                  key={`dtmf-${key}`}
                  type="button"
                  className="flex h-10 items-center justify-center rounded-lg border border-border text-sm font-semibold hover:bg-muted"
                  onClick={() => pressKey(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!activeCall ? (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="min-w-[120px] flex-1">
              <Label htmlFor="parkSlot">Retrieve parked call</Label>
              <Input
                id="parkSlot"
                className="mt-1 font-mono"
                value={parkSlot}
                onChange={(e) => setParkSlot(e.target.value)}
                placeholder="Slot code"
              />
            </div>
            <Button variant="outline" size="sm" onClick={retrievePark}>
              Retrieve
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Active line</CardTitle>
        {activeCall ? (
          <div className="mt-4 space-y-2">
            <div
              className={cn(
                "rounded-lg p-4",
                activeCall.onHold
                  ? "border border-amber-200 bg-amber-50"
                  : "border border-primary/20 bg-primary/5",
              )}
            >
              <p className="text-lg font-semibold">{activeCall.to}</p>
              <p className="text-sm text-muted-foreground">From {activeCall.from}</p>
              <p className="mt-2 font-mono text-2xl tabular-nums">{formatDuration(elapsed)}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {activeCall.status}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No active call. Enter a number and press Call.
          </p>
        )}
      </Card>
    </div>
  );
}
