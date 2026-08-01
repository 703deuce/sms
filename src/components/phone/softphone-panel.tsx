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
  RotateCcw,
  Star,
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
  warmTransferPending?: boolean;
};

type IncomingCall = {
  id: string;
  from: string;
  to: string;
  webrtcCall?: unknown;
};

type ContactRow = {
  id: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  customFields?: Record<string, unknown> | null;
  tagMembers?: { tag: { name: string } }[];
};

type RecentCall = {
  id: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  startedAt: string;
};

type PresenceRow = {
  userId: string;
  status: string;
  customLabel?: string | null;
  queueAvailable?: boolean;
};

type UserSettingsRow = {
  userId: string;
  extension?: string | null;
  forwardToCellular?: string | null;
};

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

const PRESENCE_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "away", label: "Away" },
  { value: "busy", label: "Busy" },
  { value: "on_call", label: "On call" },
  { value: "dnd", label: "Do not disturb" },
  { value: "offline", label: "Offline" },
];

type FavoriteEntry = { id: string; phone: string; name: string };

const LS_FAVORITES = "softphone:favorites";
const LS_LAST_DIALED = "softphone:lastDialed";
const LS_AUDIO_IN = "softphone:audioInput";
const LS_AUDIO_OUT = "softphone:audioOutput";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function contactName(c: ContactRow) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return name || c.company || c.phone;
}

function readFavorites(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(LS_FAVORITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((e) => typeof e === "object" && e.phone)) {
      return parsed as FavoriteEntry[];
    }
    // legacy: array of ids only
    if (Array.isArray(parsed) && parsed.every((e) => typeof e === "string")) {
      return (parsed as string[]).map((id) => ({ id, phone: "", name: id }));
    }
    return [];
  } catch {
    return [];
  }
}

function writeFavorites(entries: FavoriteEntry[]) {
  localStorage.setItem(LS_FAVORITES, JSON.stringify(entries));
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
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [waitingIncoming, setWaitingIncoming] = useState<IncomingCall[]>([]);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [showDtmf, setShowDtmf] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [transferMode, setTransferMode] = useState<"blind" | "warm">("blind");
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
  const [customStatus, setCustomStatus] = useState("");
  const [parkSlot, setParkSlot] = useState("");
  const [conferenceId, setConferenceId] = useState("");
  const [conferenceAddTo, setConferenceAddTo] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactRow[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [lastDialed, setLastDialed] = useState("");
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [presenceList, setPresenceList] = useState<PresenceRow[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettingsRow[]>([]);
  const [screenPop, setScreenPop] = useState<ContactRow | null>(null);

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");

  const telnyxClientRef = useRef<unknown>(null);
  const webrtcCallsRef = useRef<Map<string, unknown>>(new Map());
  const activeCallsRef = useRef<ActiveCall[]>([]);
  const activeLineIdRef = useRef<string | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const presenceManualRef = useRef(false);

  const activeCall = activeCalls.find((c) => c.id === activeLineId) ?? null;

  activeCallsRef.current = activeCalls;
  activeLineIdRef.current = activeLineId;

  const updateCall = useCallback((id: string, patch: Partial<ActiveCall>) => {
    setActiveCalls((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeCall = useCallback((id: string) => {
    webrtcCallsRef.current.delete(id);
    setActiveCalls((prev) => prev.filter((c) => c.id !== id));
    setActiveLineId((prev) => (prev === id ? null : prev));
  }, []);

  const applyAudioDevices = useCallback(async () => {
    const audioEl = remoteAudioRef.current;
    if (audioEl && selectedSpeaker && "setSinkId" in audioEl) {
      try {
        await (audioEl as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(
          selectedSpeaker,
        );
      } catch {
        // sink not supported or device unavailable
      }
    }
    const client = telnyxClientRef.current as {
      setAudioSettings?: (s: { micId?: string }) => Promise<unknown>;
      speaker?: string;
    } | null;
    if (client?.setAudioSettings && selectedMic) {
      await client.setAudioSettings({ micId: selectedMic }).catch(() => undefined);
    }
    if (client && selectedSpeaker) {
      try {
        client.speaker = selectedSpeaker;
      } catch {
        // ignore
      }
    }
    const lineId = activeLineIdRef.current;
    const webrtcCall = lineId ? webrtcCallsRef.current.get(lineId) : null;
    if (webrtcCall && selectedSpeaker) {
      const call = webrtcCall as { setAudioOutDevice?: (id: string) => Promise<boolean> };
      await call.setAudioOutDevice?.(selectedSpeaker).catch(() => undefined);
    }
    if (webrtcCall && selectedMic) {
      const call = webrtcCall as { setAudioInDevice?: (id: string) => Promise<void> };
      await call.setAudioInDevice?.(selectedMic).catch(() => undefined);
    }
  }, [selectedMic, selectedSpeaker]);

  useEffect(() => {
    applyAudioDevices();
  }, [applyAudioDevices, activeLineId]);

  useEffect(() => {
    setFavorites(readFavorites());
    const last = localStorage.getItem(LS_LAST_DIALED);
    if (last) {
      setDialNumber(last);
      setLastDialed(last);
    }
    setSelectedMic(localStorage.getItem(LS_AUDIO_IN) || "");
    setSelectedSpeaker(localStorage.getItem(LS_AUDIO_OUT) || "");

    async function loadDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
    }
    loadDevices().catch(() => undefined);
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
  }, []);

  useEffect(() => {
    fetch("/api/phone/calls?limit=10")
      .then((r) => r.json())
      .then((j) => setRecentCalls(j.data || []))
      .catch(() => undefined);

    fetch("/api/phone/presence")
      .then((r) => r.json())
      .then((j) => setPresenceList(j.data || []))
      .catch(() => undefined);

    fetch("/api/phone/admin")
      .then((r) => r.json())
      .then((j) => setUserSettings(j.data?.settings || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!contactQuery.trim()) {
      setContactResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/contacts?q=${encodeURIComponent(contactQuery.trim())}`)
        .then((r) => r.json())
        .then((j) => setContactResults(j.data || []))
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [contactQuery]);

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
              const callId = call.id || `webrtc-${Date.now()}`;

              if (call.state === "ringing" && call.direction === "inbound") {
                const hasActive = activeCallsRef.current.length > 0;
                const incomingCall: IncomingCall = {
                  id: callId,
                  from: call.remoteCallerNumber || "Unknown",
                  to: call.localCallerNumber || callerId,
                  webrtcCall: call,
                };
                webrtcCallsRef.current.set(callId, call);
                if (hasActive) {
                  setWaitingIncoming((prev) => [...prev, incomingCall]);
                } else {
                  setIncoming(incomingCall);
                }
                return;
              }

              if (call.state === "active" || call.state === "answered") {
                webrtcCallsRef.current.set(callId, call);
                const exists = activeCallsRef.current.some((c) => c.id === callId);
                if (!exists) {
                  const newCall: ActiveCall = {
                    id: callId,
                    from: call.localCallerNumber || callerId,
                    to: call.remoteCallerNumber || dialNumber,
                    status: "in_progress",
                    muted: false,
                    onHold: false,
                    mediaMode: "webrtc",
                    startedAt: Date.now(),
                  };
                  setActiveCalls((prev) => [...prev, newCall]);
                  setActiveLineId(callId);
                  setIncoming(null);
                  setWaitingIncoming((prev) => prev.filter((w) => w.id !== callId));
                }
              }

              if (call.state === "hangup" || call.state === "destroy") {
                webrtcCallsRef.current.delete(callId);
                setActiveCalls((prev) => prev.filter((c) => c.id !== callId));
                setWaitingIncoming((prev) => prev.filter((w) => w.id !== callId));
                if (activeLineIdRef.current === callId) {
                  setActiveLineId(null);
                  setShowDtmf(false);
                }
                if (incoming?.id === callId) setIncoming(null);
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

  useEffect(() => {
    if (activeCalls.length > 0 || webrtcConnected) return;
    let cancelled = false;
    const check = () => {
      fetch("/api/phone/calls?direction=inbound&status=ringing&limit=3")
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          const rows = j.data || [];
          if (rows.length === 0) {
            if (!activeCallsRef.current.length) setIncoming(null);
            return;
          }
          const first = rows[0];
          const call: IncomingCall = { id: first.id, from: first.from, to: first.to };
          if (activeCallsRef.current.length > 0) {
            setWaitingIncoming((prev) => {
              if (prev.some((p) => p.id === call.id)) return prev;
              return [...prev, call];
            });
          } else {
            setIncoming(call);
          }
        })
        .catch(() => undefined);
    };
    check();
    const t = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeCalls.length, webrtcConnected]);

  useEffect(() => {
    if (!activeCall) {
      setElapsed(0);
      return;
    }
    const startedAt = activeCall.startedAt;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [activeCall]);

  useEffect(() => {
    if (activeCall) {
      setCallNotes(activeCall.notes || "");
    } else {
      setCallNotes("");
    }
  }, [activeCall?.id, activeCall?.notes]);

  useEffect(() => {
    fetch("/api/phone/presence")
      .then((r) => r.json())
      .then((j) => {
        const rows = j.data || [];
        const mine = rows[0];
        if (mine?.status) setPresenceStatus(mine.status);
        if (mine?.customLabel) setCustomStatus(mine.customLabel);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onCall = activeCalls.length > 0;
    if (onCall && !presenceManualRef.current && presenceStatus !== "dnd") {
      if (presenceStatus !== "on_call") {
        updatePresence("on_call", customStatus);
      }
    } else if (!onCall && presenceStatus === "on_call" && !presenceManualRef.current) {
      updatePresence("available", customStatus);
    }
  }, [activeCalls.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const phone = incoming?.from || waitingIncoming[0]?.from;
    if (!phone) {
      setScreenPop(null);
      return;
    }
    fetch(`/api/contacts?phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((j) => setScreenPop((j.data || [])[0] || null))
      .catch(() => setScreenPop(null));
  }, [incoming?.from, waitingIncoming]);

  async function updatePresence(status: string, label?: string) {
    setPresenceStatus(status);
  if (status !== "on_call") presenceManualRef.current = true;
    await fetch("/api/phone/presence", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        customLabel: label || customStatus || undefined,
        queueAvailable: status !== "dnd" && status !== "on_call",
      }),
    }).catch(() => undefined);
  }

  async function patchCallById(callId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/phone/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Action failed");
    return json.data;
  }

  async function answerIncomingCall(call: IncomingCall, holdCurrent = false) {
    setError("");
    try {
      if (holdCurrent && activeLineId) {
        await toggleHoldForLine(activeLineId, true);
      }

      if (call.webrtcCall || webrtcConnected) {
        const webrtcCall = (call.webrtcCall || webrtcCallsRef.current.get(call.id)) as {
          answer?: (opts?: { remoteElement?: HTMLAudioElement }) => void;
        } | null;
        const audioEl = remoteAudioRef.current;
        if (webrtcCall?.answer) {
          await webrtcCall.answer(audioEl ? { remoteElement: audioEl } : undefined);
        }
        webrtcCallsRef.current.set(call.id, webrtcCall);
        const newCall: ActiveCall = {
          id: call.id,
          from: call.to,
          to: call.from,
          status: "in_progress",
          muted: false,
          onHold: false,
          mediaMode: "webrtc",
          startedAt: Date.now(),
        };
        setActiveCalls((prev) => [...prev, newCall]);
        setActiveLineId(call.id);
        setIncoming(null);
        setWaitingIncoming((prev) => prev.filter((w) => w.id !== call.id));
        return;
      }

      const res = await fetch(`/api/phone/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Answer failed");
      const newCall: ActiveCall = {
        id: call.id,
        from: call.from,
        to: call.to,
        status: "in_progress",
        muted: false,
        onHold: false,
        mediaMode: "call_control",
        startedAt: Date.now(),
      };
      setActiveCalls((prev) => [...prev, newCall]);
      setActiveLineId(call.id);
      setIncoming(null);
      setWaitingIncoming((prev) => prev.filter((w) => w.id !== call.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Answer failed");
    }
  }

  async function answerIncoming() {
    if (!incoming) return;
    await answerIncomingCall(incoming, false);
  }

  async function answerWaiting(call: IncomingCall) {
    await answerIncomingCall(call, true);
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
    webrtcCallsRef.current.delete(incoming.id);
  }

  async function declineWaiting(call: IncomingCall) {
    const wc = call.webrtcCall as { hangup?: () => void } | undefined;
    if (wc?.hangup) wc.hangup();
    else {
      await fetch(`/api/phone/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hangup: true, disposition: "missed:declined" }),
      }).catch(() => undefined);
    }
    setWaitingIncoming((prev) => prev.filter((w) => w.id !== call.id));
    webrtcCallsRef.current.delete(call.id);
  }

  const pressKey = useCallback(
    (key: string) => {
      if (!activeCall) {
        setDialNumber((n) => n + key);
        return;
      }
      if (activeCall.mediaMode === "webrtc") {
        const call = webrtcCallsRef.current.get(activeCall.id) as { dtmf?: (d: string) => void };
        call?.dtmf?.(key);
        return;
      }
      patchCallById(activeCall.id, { dtmf: key }).catch(() => undefined);
    },
    [activeCall],
  );

  function dialTo(number: string) {
    setDialNumber(number);
    setLastDialed(number);
    localStorage.setItem(LS_LAST_DIALED, number);
  }

  async function startCall() {
    if (!dialNumber.trim()) return;
    if (useCallMyPhone && !myPhone.trim()) {
      setError("Enter your phone number for Call my phone.");
      return;
    }
    setLoading(true);
    setError("");
    const dest = dialNumber.trim();
    localStorage.setItem(LS_LAST_DIALED, dest);
    setLastDialed(dest);
    try {
      const from = callerId;

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
        const callId = (call as { id?: string }).id || `webrtc-${Date.now()}`;
        webrtcCallsRef.current.set(callId, call);
        const newCall: ActiveCall = {
          id: callId,
          from,
          to: dest,
          status: "ringing",
          muted: false,
          onHold: false,
          mediaMode: "webrtc",
          startedAt: Date.now(),
        };
        setActiveCalls((prev) => [...prev, newCall]);
        setActiveLineId(callId);
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
      const mediaMode: MediaMode = useCallMyPhone ? "call_my_phone" : "call_control";
      const newCall: ActiveCall = {
        id: json.data.id,
        from: json.data.from,
        to: json.data.to,
        status: json.data.status,
        muted: false,
        onHold: false,
        mediaMode,
        startedAt: Date.now(),
      };
      setActiveCalls((prev) => [...prev, newCall]);
      setActiveLineId(json.data.id);
      setRecording(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dial failed");
    } finally {
      setLoading(false);
    }
  }

  async function redial() {
    const last = lastDialed || localStorage.getItem(LS_LAST_DIALED);
    if (!last) return;
    setDialNumber(last);
    if (!activeCalls.length) await startCall();
  }

  async function toggleHoldForLine(callId: string, forceHold?: boolean) {
    const call = activeCalls.find((c) => c.id === callId);
    if (!call) return;
    const onHold = forceHold ?? !call.onHold;
    if (call.mediaMode === "webrtc") {
      const wc = webrtcCallsRef.current.get(callId) as {
        hold?: () => void;
        unhold?: () => void;
      };
      if (onHold) await wc?.hold?.();
      else await wc?.unhold?.();
      updateCall(callId, { onHold, status: onHold ? "on_hold" : "in_progress" });
      return;
    }
    const data = await patchCallById(callId, { onHold });
    updateCall(callId, {
      onHold: data?.onHold ?? onHold,
      status: data?.status ?? call.status,
    });
  }

  async function switchLine(callId: string) {
    if (activeLineId && activeLineId !== callId) {
      await toggleHoldForLine(activeLineId, true);
    }
    const target = activeCalls.find((c) => c.id === callId);
    if (target?.onHold) {
      await toggleHoldForLine(callId, false);
    }
    setActiveLineId(callId);
    await patchCallById(callId, { switchLine: true }).catch(() => undefined);
    const wc = webrtcCallsRef.current.get(callId);
    const audioEl = remoteAudioRef.current;
    if (wc && audioEl) {
      const client = telnyxClientRef.current as { remoteElement?: HTMLAudioElement } | null;
      if (client) client.remoteElement = audioEl;
    }
  }

  async function hangup() {
    if (!activeCall) return;
    try {
      if (activeCall.mediaMode === "webrtc") {
        const call = webrtcCallsRef.current.get(activeCall.id) as { hangup?: () => void };
        await call?.hangup?.();
      } else {
        await patchCallById(activeCall.id, { hangup: true });
      }
    } catch {
      // still clear UI
    }
    removeCall(activeCall.id);
    setShowDtmf(false);
    setConferenceId("");
  }

  async function toggleMute() {
    if (!activeCall) return;
    const muted = !activeCall.muted;
    if (activeCall.mediaMode === "webrtc") {
      const call = webrtcCallsRef.current.get(activeCall.id) as {
        muteAudio?: () => void;
        unmuteAudio?: () => void;
      };
      if (muted) call?.muteAudio?.();
      else call?.unmuteAudio?.();
      updateCall(activeCall.id, { muted });
      return;
    }
    const data = await patchCallById(activeCall.id, { muted });
    updateCall(activeCall.id, { muted: data?.muted ?? muted });
  }

  async function toggleHold() {
    if (!activeCall) return;
    await toggleHoldForLine(activeCall.id);
  }

  async function blindTransfer() {
    if (!activeCall || !transferTo.trim()) return;
    try {
      const note = warmTransferNote.trim();
      if (note) {
        await patchCallById(activeCall.id, {
          notes: `${callNotes}\n[Transfer note: ${note}]`.trim(),
        });
      }
      await patchCallById(activeCall.id, { transferTo: transferTo.trim() });
      setTransferTo("");
      setWarmTransferNote("");
      removeCall(activeCall.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    }
  }

  async function startWarmTransfer() {
    if (!activeCall || !transferTo.trim()) return;
    try {
      const note = warmTransferNote.trim();
      await patchCallById(activeCall.id, {
        warmTransferTo: transferTo.trim(),
        consult: true,
        notes: note || undefined,
      });
      updateCall(activeCall.id, { warmTransferPending: true, onHold: true, status: "on_hold" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Warm transfer failed");
    }
  }

  async function completeWarmTransfer() {
    if (!activeCall) return;
    try {
      await patchCallById(activeCall.id, { completeWarmTransfer: true });
      setTransferTo("");
      setWarmTransferNote("");
      removeCall(activeCall.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Complete transfer failed");
    }
  }

  async function cancelWarmTransfer() {
    if (!activeCall) return;
    try {
      await patchCallById(activeCall.id, { cancelWarmTransfer: true });
      updateCall(activeCall.id, {
        warmTransferPending: false,
        onHold: false,
        status: "in_progress",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel transfer failed");
    }
  }

  async function saveNotes() {
    if (!activeCall) return;
    try {
      await patchCallById(activeCall.id, { notes: callNotes });
      updateCall(activeCall.id, { notes: callNotes });
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
      removeCall(activeCall.id);
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
      await patchCallById(activeCall.id, { record: next });
      setRecording(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recording failed");
    }
  }

  function toggleFavorite(contact: ContactRow) {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === contact.id);
      const next = exists
        ? prev.filter((f) => f.id !== contact.id)
        : [
            ...prev,
            {
              id: contact.id,
              phone: contact.phone,
              name: contactName(contact),
            },
          ];
      writeFavorites(next);
      return next;
    });
  }

  function transferTargetForUser(userId: string) {
    const settings = userSettings.find((s) => s.userId === userId);
    return settings?.forwardToCellular || settings?.extension || "";
  }

  const favoriteContacts = favorites;
  const hasDialBlock = activeCalls.length > 0;

  const modeLabel =
    webrtcMode === "telnyx" && webrtcConnected
      ? "Telnyx WebRTC"
      : webrtcMode === "telnyx"
        ? "Telnyx (connecting…)"
        : webrtcMode === "api"
          ? "Call Control API"
          : "Mock (no Telnyx key)";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {(incoming || waitingIncoming.length > 0) && (
        <Card className="lg:col-span-3 border-primary/40 bg-primary/5">
          {incoming && (
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
          )}
          {waitingIncoming.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Call waiting</p>
              {waitingIncoming.map((w) => (
                <div key={w.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">{w.from} → {w.to}</span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => answerWaiting(w)}>Answer (hold current)</Button>
                    <Button size="sm" variant="outline" onClick={() => declineWaiting(w)}>Decline</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {screenPop && (
            <div className="mt-3 rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground">CRM screen-pop</p>
              <p className="text-sm font-semibold">{contactName(screenPop)}</p>
              <p className="text-xs text-muted-foreground">{screenPop.phone}</p>
              {screenPop.tagMembers?.length ? (
                <p className="mt-1 text-xs">
                  Tags: {screenPop.tagMembers.map((t) => t.tag.name).join(", ")}
                </p>
              ) : null}
              {screenPop.customFields && Object.keys(screenPop.customFields).length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Notes: {JSON.stringify(screenPop.customFields)}
                </p>
              ) : null}
            </div>
          )}
        </Card>
      )}

      <Card className="lg:col-span-2">
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Browser dialer
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Mode: {modeLabel}</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="presence">Presence</Label>
            <select
              id="presence"
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={presenceStatus}
              onChange={(e) => updatePresence(e.target.value, customStatus)}
            >
              {PRESENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="customStatus">Custom status</Label>
            <Input
              id="customStatus"
              className="mt-1.5"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              onBlur={() => updatePresence(presenceStatus, customStatus)}
              placeholder="e.g. Lunch break"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="micSelect">Microphone</Label>
            <select
              id="micSelect"
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={selectedMic}
              onChange={(e) => {
                setSelectedMic(e.target.value);
                localStorage.setItem(LS_AUDIO_IN, e.target.value);
              }}
            >
              <option value="">Default</option>
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="speakerSelect">Speaker</Label>
            <select
              id="speakerSelect"
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={selectedSpeaker}
              onChange={(e) => {
                setSelectedSpeaker(e.target.value);
                localStorage.setItem(LS_AUDIO_OUT, e.target.value);
              }}
            >
              <option value="">Default</option>
              {audioOutputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Speaker ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {phoneNumbers.length > 0 ? (
          <div className="mt-4">
            <Label htmlFor="callerId">Caller ID</Label>
            <select
              id="callerId"
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
              disabled={hasDialBlock}
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
            disabled={hasDialBlock}
          />
        </div>

        <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={useCallMyPhone}
            disabled={hasDialBlock}
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
              disabled={hasDialBlock}
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
              disabled={hasDialBlock && !showDtmf}
            >
              {key}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {!hasDialBlock ? (
            <>
              <Button onClick={startCall} disabled={loading || !dialNumber.trim()} className="gap-2">
                <Phone className="h-4 w-4" />
                {loading ? "Calling…" : "Call"}
              </Button>
              <Button
                variant="outline"
                onClick={redial}
                disabled={!lastDialed}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Redial
              </Button>
            </>
          ) : activeCall ? (
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
          ) : null}
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

            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={transferMode === "blind" ? "primary" : "outline"}
                  onClick={() => setTransferMode("blind")}
                >
                  Blind transfer
                </Button>
                <Button
                  size="sm"
                  variant={transferMode === "warm" ? "primary" : "outline"}
                  onClick={() => setTransferMode("warm")}
                >
                  Warm transfer
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
                  <Label htmlFor="warmNote">Transfer note</Label>
                  <Input
                    id="warmNote"
                    className="mt-1"
                    value={warmTransferNote}
                    onChange={(e) => setWarmTransferNote(e.target.value)}
                    placeholder="Context for agent…"
                  />
                </div>
                {transferMode === "blind" ? (
                  <Button variant="outline" size="sm" onClick={blindTransfer} className="gap-1">
                    <PhoneForwarded className="h-4 w-4" />
                    Transfer
                  </Button>
                ) : activeCall.warmTransferPending ? (
                  <>
                    <Button variant="outline" size="sm" onClick={completeWarmTransfer}>
                      Complete transfer
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelWarmTransfer}>
                      Cancel transfer
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={startWarmTransfer} className="gap-1">
                    <PhoneForwarded className="h-4 w-4" />
                    Start consult
                  </Button>
                )}
              </div>
              {presenceList.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Transfer targets (presence)</p>
                  <div className="flex flex-wrap gap-1">
                    {presenceList.map((p) => {
                      const target = transferTargetForUser(p.userId);
                      return (
                        <button
                          key={p.userId}
                          type="button"
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() => target && setTransferTo(target)}
                        >
                          {p.customLabel || p.userId.slice(0, 8)} · {p.status}
                          {target ? ` (${target})` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
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

        {!hasDialBlock ? (
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
        <CardTitle>Lines & sidebar</CardTitle>

        <div className="mt-4 space-y-2">
          <Label>Active lines ({activeCalls.length})</Label>
          {activeCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active calls.</p>
          ) : (
            activeCalls.map((line) => (
              <button
                key={line.id}
                type="button"
                onClick={() => switchLine(line.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  line.id === activeLineId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                  line.onHold && "border-amber-200 bg-amber-50/50",
                )}
              >
                <p className="text-sm font-semibold">{line.to}</p>
                <p className="text-xs text-muted-foreground">From {line.from}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {line.onHold ? "on hold" : line.status}
                  {line.warmTransferPending ? " · warm transfer" : ""}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <Label htmlFor="contactSearch">Contacts</Label>
          <Input
            id="contactSearch"
            className="mt-1.5"
            value={contactQuery}
            onChange={(e) => setContactQuery(e.target.value)}
            placeholder="Search name or number…"
          />
          {favoriteContacts.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Favorites</p>
              {favoriteContacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                  <button
                    type="button"
                    className="text-sm hover:underline"
                    onClick={() => dialTo(c.phone)}
                  >
                    {c.name || c.phone}
                  </button>
                  <button type="button" onClick={() => toggleFavorite({ id: c.id, phone: c.phone, firstName: c.name })} aria-label="Unfavorite">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {contactResults.length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {contactResults.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-sm hover:underline"
                    onClick={() => dialTo(c.phone)}
                  >
                    {contactName(c)} · {c.phone}
                  </button>
                  <button type="button" onClick={() => toggleFavorite(c)} aria-label="Favorite">
                    <Star
                      className={cn(
                        "h-4 w-4",
                        favorites.some((f) => f.id === c.id)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <Label>Recent calls</Label>
          {recentCalls.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No recent calls.</p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {recentCalls.map((rc) => {
                const number = rc.direction === "outbound" ? rc.to : rc.from;
                return (
                  <li key={rc.id}>
                    <button
                      type="button"
                      className="text-sm hover:underline"
                      onClick={() => dialTo(number)}
                    >
                      {number} · {rc.direction} · {rc.status}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {activeCall ? (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-lg font-semibold">{activeCall.to}</p>
            <p className="text-sm text-muted-foreground">From {activeCall.from}</p>
            <p className="mt-2 font-mono text-2xl tabular-nums">{formatDuration(elapsed)}</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
