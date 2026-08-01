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
  /** Always the HumanCall DB id when available (required for park/transfer/API). */
  id: string;
  from: string;
  to: string;
  status: string;
  muted: boolean;
  onHold: boolean;
  mediaMode: MediaMode;
  startedAt: number;
  notes?: string;
  /** TelnyxRTC call id when media is WebRTC (may differ from HumanCall id). */
  webrtcId?: string | null;
  warmTransferPending?: boolean;
  /** Explicit warm-transfer lifecycle for support-grade UX. */
  transferPhase?:
    | "idle"
    | "holding_caller"
    | "ringing_consult"
    | "consult_answered"
    | "completing"
    | "completed"
    | "failed"
    | "cancelled";
  transcriptText?: string | null;
  aiSummary?: string | null;
  recording?: boolean;
  /** Browser media intentionally detached (flip / warm-complete); ignore WebRTC hangup UI teardown. */
  mediaDetached?: boolean;
};

type IncomingCall = {
  id: string;
  from: string;
  to: string;
  webrtcCall?: unknown;
  /** Set when inbound came from WebRTC invite before HumanCall match. */
  webrtcId?: string;
  humanCallId?: string;
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
const LS_DEVICE_KEY = "softphone:deviceKey";

function getOrCreateDeviceKey() {
  try {
    let key = localStorage.getItem(LS_DEVICE_KEY);
    if (!key) {
      key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(LS_DEVICE_KEY, key);
    }
    return key;
  } catch {
    return `dev_${Date.now()}`;
  }
}

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
  const [anonymousDial, setAnonymousDial] = useState(false);
  const [flipNumber, setFlipNumber] = useState("");
  const [whisperText, setWhisperText] = useState("");
  const [networkQuality, setNetworkQuality] = useState("unknown");
  const [reconnectHint, setReconnectHint] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");

  const telnyxClientRef = useRef<unknown>(null);
  /** Keyed by HumanCall id (preferred) and also by raw WebRTC call id. */
  const webrtcCallsRef = useRef<Map<string, unknown>>(new Map());
  const webrtcToHumanRef = useRef<Map<string, string>>(new Map());
  /** Parked WebRTC handles keyed by park slot code for retrieve. */
  const parkedWebrtcRef = useRef<Map<string, { humanCallId: string; handle: unknown; webrtcId?: string }>>(
    new Map(),
  );
  const activeCallsRef = useRef<ActiveCall[]>([]);
  const activeLineIdRef = useRef<string | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const presenceManualRef = useRef(false);
  const pendingDialRef = useRef<string | null>(null);
  /** HumanCall ids whose WebRTC media was intentionally hung up (flip / warm / blind). */
  const detachedMediaRef = useRef<Set<string>>(new Set());
  const sessionUserIdRef = useRef<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [controlLinkedIds, setControlLinkedIds] = useState<Record<string, boolean>>({});

  const activeCall = activeCalls.find((c) => c.id === activeLineId) ?? null;

  activeCallsRef.current = activeCalls;
  activeLineIdRef.current = activeLineId;

  const updateCall = useCallback((id: string, patch: Partial<ActiveCall>) => {
    setActiveCalls((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeCall = useCallback((id: string) => {
    webrtcCallsRef.current.delete(id);
    detachedMediaRef.current.delete(id);
    setActiveCalls((prev) => {
      const next = prev.filter((c) => c.id !== id);
      setActiveLineId((current) => {
        if (current !== id) return current;
        const promote = next.find((c) => !c.onHold) || next[0] || null;
        return promote?.id ?? null;
      });
      return next;
    });
  }, []);

  function detachWebrtcMedia(humanCallId: string, webrtcId?: string | null) {
    detachedMediaRef.current.add(humanCallId);
    webrtcCallsRef.current.delete(humanCallId);
    if (webrtcId) {
      webrtcCallsRef.current.delete(webrtcId);
      webrtcToHumanRef.current.delete(webrtcId);
    }
  }

  function myCellularNumber() {
    const mine =
      (sessionUserId && userSettings.find((s) => s.userId === sessionUserId)) ||
      userSettings.find((s) => s.forwardToCellular);
    return myPhone.trim() || mine?.forwardToCellular || "";
  }

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

    // Register this browser as a softphone device + enable incoming-call push.
    const deviceKey = getOrCreateDeviceKey();
    fetch("/api/phone/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceKey,
        label: "Browser softphone",
        platform: "browser",
        userAgent: navigator.userAgent,
      }),
    }).catch(() => undefined);
    import("@/lib/push/client-subscribe")
      .then(({ subscribeToPush }) => subscribeToPush().catch(() => undefined))
      .catch(() => undefined);

    // Click-to-call / deep-link: /phone?dial=+1... or /phone?incoming=<callId>
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const dialParam = params.get("dial");
      const incomingParam = params.get("incoming");
      if (dialParam) {
        setDialNumber(dialParam);
        setLastDialed(dialParam);
        localStorage.setItem(LS_LAST_DIALED, dialParam);
        pendingDialRef.current = dialParam;
        // Clear query so refresh doesn't re-dial.
        const url = new URL(window.location.href);
        url.searchParams.delete("dial");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
      if (incomingParam) {
        fetch(`/api/phone/calls/${incomingParam}`)
          .then((r) => r.json())
          .then((j) => {
            const row = j.data;
            if (!row) return;
            setIncoming({
              id: row.id,
              from: row.from,
              to: row.to,
            });
          })
          .catch(() => undefined);
        fetch("/api/phone/devices/ack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceKey, humanCallId: incomingParam }),
        }).catch(() => undefined);
        const url = new URL(window.location.href);
        url.searchParams.delete("incoming");
        window.history.replaceState({}, "", url.pathname + url.search);
      }

      const onSwMessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; humanCallId?: string } | null;
        if (data?.type !== "incoming_call_click" || !data.humanCallId) return;
        const key = getOrCreateDeviceKey();
        fetch("/api/phone/devices/ack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceKey: key, humanCallId: data.humanCallId }),
        }).catch(() => undefined);
        fetch(`/api/phone/calls/${data.humanCallId}`)
          .then((r) => r.json())
          .then((j) => {
            const row = j.data;
            if (!row) return;
            setIncoming({ id: row.id, from: row.from, to: row.to });
          })
          .catch(() => undefined);
      };
      navigator.serviceWorker?.addEventListener?.("message", onSwMessage);
      (window as Window & { __softphoneSwCleanup?: () => void }).__softphoneSwCleanup = () => {
        navigator.serviceWorker?.removeEventListener?.("message", onSwMessage);
      };
    }

    async function loadDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        // Unlock device labels in Chrome — requires a prior getUserMedia grant.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Permission denied — still enumerate (labels may be blank).
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
    }
    loadDevices().catch(() => undefined);
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);

    const conn = (navigator as Navigator & {
      connection?: { effectiveType?: string; addEventListener?: (t: string, fn: () => void) => void; removeEventListener?: (t: string, fn: () => void) => void };
    }).connection;
    const updateNet = () => {
      const t = conn?.effectiveType || "unknown";
      setNetworkQuality(t);
      setReconnectHint(t === "2g" || t === "slow-2g" ? "Poor network — call may reconnect" : "");
    };
    updateNet();
    conn?.addEventListener?.("change", updateNet);

    const onOnline = () => {
      setReconnectHint("Back online — softphone reconnecting…");
      setTimeout(() => setReconnectHint(""), 4000);
    };
    const onOffline = () => setReconnectHint("Offline — waiting to reconnect");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
      conn?.removeEventListener?.("change", updateNet);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      (window as Window & { __softphoneSwCleanup?: () => void }).__softphoneSwCleanup?.();
    };
  }, []);

  useEffect(() => {
    fetch("/api/phone/calls?limit=10")
      .then((r) => r.json())
      .then((j) => setRecentCalls(j.data || []))
      .catch(() => undefined);

    fetch("/api/phone/presence")
      .then((r) => r.json())
      .then((j) => {
        setPresenceList(j.data || []);
        if (j.me) {
          sessionUserIdRef.current = j.me;
          setSessionUserId(j.me);
        }
        if (j.mine?.status) setPresenceStatus(j.mine.status);
      })
      .catch(() => undefined);

    fetch("/api/phone/admin")
      .then((r) => r.json())
      .then((j) => {
        const settings = (j.data?.settings || []) as UserSettingsRow[];
        setUserSettings(settings);
        const me = j.me || sessionUserIdRef.current;
        if (me) {
          sessionUserIdRef.current = me;
          setSessionUserId(me);
        }
        const mine = settings.find((s) => s.userId === me) || settings.find((s) => s.forwardToCellular);
        if (mine?.forwardToCellular) {
          setMyPhone((prev) => prev || mine.forwardToCellular || "");
          setFlipNumber((prev) => prev || mine.forwardToCellular || "");
        }
      })
      .catch(() => undefined);

    const presenceTimer = setInterval(() => {
      fetch("/api/phone/presence")
        .then((r) => r.json())
        .then((j) => setPresenceList(j.data || []))
        .catch(() => undefined);
    }, 30_000);
    return () => clearInterval(presenceTimer);
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
                telnyxIDs?: { telnyxCallControlId?: string };
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
              const webrtcId = call.id || `webrtc-${Date.now()}`;
              const humanId = webrtcToHumanRef.current.get(webrtcId);
              const lineId = humanId || webrtcId;
              const controlId = call.telnyxIDs?.telnyxCallControlId;

              if (humanId && controlId) {
                fetch(`/api/phone/calls/${humanId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    telnyxCallControlId: controlId,
                    webrtcCallId: webrtcId,
                  }),
                })
                  .then(() =>
                    setControlLinkedIds((prev) => ({ ...prev, [humanId]: true })),
                  )
                  .catch(() => undefined);
              }

              if (call.state === "ringing" && call.direction === "inbound") {
                const hasActive = activeCallsRef.current.length > 0;
                const from = call.remoteCallerNumber || "Unknown";
                const to = call.localCallerNumber || callerId;
                webrtcCallsRef.current.set(webrtcId, call);
                // Match an existing HumanCall ringing/queued for this caller.
                fetch(
                  `/api/phone/calls?direction=inbound&status=ringing,queued&limit=5`,
                )
                  .then((r) => r.json())
                  .then((j) => {
                    const rows = (j.data || []) as Array<{
                      id: string;
                      from: string;
                      to: string;
                    }>;
                    const digits = from.replace(/\D/g, "").slice(-10);
                    const match =
                      rows.find((r) => r.from === from) ||
                      (digits
                        ? rows.find((r) => String(r.from || "").replace(/\D/g, "").endsWith(digits))
                        : undefined);
                    // Never fall back to an unrelated ringing call.
                    const incomingCall: IncomingCall = {
                      id: match?.id || webrtcId,
                      from: match?.from || from,
                      to: match?.to || to,
                      webrtcCall: call,
                      webrtcId,
                      humanCallId: match?.id,
                    };
                    if (match?.id) {
                      webrtcToHumanRef.current.set(webrtcId, match.id);
                      webrtcCallsRef.current.set(match.id, call);
                    }
                    if (hasActive) {
                      setWaitingIncoming((prev) => {
                        if (prev.some((p) => p.id === incomingCall.id || p.webrtcId === webrtcId)) {
                          return prev;
                        }
                        return [...prev, incomingCall];
                      });
                    } else {
                      setIncoming(incomingCall);
                    }
                  })
                  .catch(() => {
                    const incomingCall: IncomingCall = {
                      id: webrtcId,
                      from,
                      to,
                      webrtcCall: call,
                      webrtcId,
                    };
                    if (hasActive) {
                      setWaitingIncoming((prev) => [...prev, incomingCall]);
                    } else {
                      setIncoming(incomingCall);
                    }
                  });
                return;
              }

              if (call.state === "active" || call.state === "answered") {
                webrtcCallsRef.current.set(webrtcId, call);
                if (humanId) webrtcCallsRef.current.set(humanId, call);
                const exists = activeCallsRef.current.some(
                  (c) => c.id === lineId || c.webrtcId === webrtcId,
                );
                if (!exists && humanId) {
                  const newCall: ActiveCall = {
                    id: humanId,
                    from: call.localCallerNumber || callerId,
                    to: call.remoteCallerNumber || dialNumber,
                    status: "in_progress",
                    muted: false,
                    onHold: false,
                    mediaMode: "webrtc",
                    webrtcId,
                    startedAt: Date.now(),
                  };
                  setActiveCalls((prev) => [...prev, newCall]);
                  setActiveLineId(humanId);
                  setIncoming(null);
                  setWaitingIncoming((prev) =>
                    prev.filter((w) => w.id !== humanId && w.webrtcId !== webrtcId),
                  );
                }
              }

              if (call.state === "hangup" || call.state === "destroy") {
                // Intentional detach (flip / warm-complete / blind transfer) — keep HumanCall UI.
                if (humanId && detachedMediaRef.current.has(humanId)) {
                  webrtcCallsRef.current.delete(webrtcId);
                  webrtcCallsRef.current.delete(humanId);
                  webrtcToHumanRef.current.delete(webrtcId);
                  updateCall(humanId, { webrtcId: null, mediaDetached: true });
                  return;
                }
                webrtcCallsRef.current.delete(webrtcId);
                if (humanId) webrtcCallsRef.current.delete(humanId);
                setActiveCalls((prev) => {
                  const next = prev.filter(
                    (c) => c.id !== lineId && c.webrtcId !== webrtcId,
                  );
                  if (
                    activeLineIdRef.current === lineId ||
                    activeLineIdRef.current === webrtcId
                  ) {
                    const promote = next.find((c) => !c.onHold) || next[0] || null;
                    setActiveLineId(promote?.id ?? null);
                    if (!promote) setShowDtmf(false);
                  }
                  return next;
                });
                setWaitingIncoming((prev) =>
                  prev.filter((w) => w.id !== lineId && w.webrtcId !== webrtcId),
                );
                setIncoming((prev) =>
                  prev && (prev.id === lineId || prev.webrtcId === webrtcId) ? null : prev,
                );
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
    let cancelled = false;
    const check = () => {
      fetch("/api/phone/calls?direction=inbound&status=ringing,queued&limit=5")
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          const rows = (j.data || []) as Array<{ id: string; from: string; to: string }>;
          const activeIds = new Set(activeCallsRef.current.map((c) => c.id));
          const available = rows.filter((r) => !activeIds.has(r.id));
          if (available.length === 0) {
            // Keep a WebRTC-only banner; clear Call Control banner only when gone.
            setIncoming((prev) => (prev?.webrtcCall ? prev : null));
            setWaitingIncoming((prev) => prev.filter((w) => Boolean(w.webrtcCall)));
            return;
          }
          const availableIds = new Set(available.map((r) => r.id));
          setWaitingIncoming((prev) =>
            prev.filter((w) => Boolean(w.webrtcCall) || availableIds.has(w.id)),
          );
          const first = available[0]!;
          const call: IncomingCall = {
            id: first.id,
            from: first.from,
            to: first.to,
            humanCallId: first.id,
          };
          if (activeCallsRef.current.length > 0) {
            setWaitingIncoming((prev) => {
              if (prev.some((p) => p.id === call.id)) return prev;
              return [...prev, call];
            });
          } else {
            setIncoming((prev) => {
              if (prev?.webrtcCall && prev.id === call.id) {
                return { ...prev, ...call, webrtcCall: prev.webrtcCall };
              }
              if (prev?.webrtcCall && !prev.humanCallId) return prev;
              return call;
            });
          }
        })
        .catch(() => undefined);
    };
    check();
    const t = setInterval(check, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Click-to-call: wait for WebRTC when available, else Call Control after short settle.
  useEffect(() => {
    if (!pendingDialRef.current) return;
    const ready = webrtcConnected || webrtcMode === "mock" || webrtcMode === "api";
    if (!ready && webrtcMode === "telnyx") return;
    const dest = pendingDialRef.current;
    pendingDialRef.current = null;
    const t = setTimeout(() => {
      const btn = document.getElementById("softphone-start-call");
      if (btn) btn.click();
      else {
        setDialNumber(dest);
      }
    }, webrtcConnected ? 200 : 600);
    return () => clearTimeout(t);
  }, [webrtcConnected, webrtcMode]);

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
        const mine = j.mine || (j.data || []).find((r: PresenceRow) => r.userId === j.me);
        if (mine?.status) setPresenceStatus(mine.status);
        if (mine?.customLabel) setCustomStatus(mine.customLabel);
      })
      .catch(() => undefined);
  }, []);

  // Warm-transfer consult answered + live transcript poll while on a call.
  useEffect(() => {
    const pending = activeCalls.find((c) => c.warmTransferPending);
    const liveId = activeLineId || activeCalls[0]?.id;
    if (!pending && !liveId) return;
    let cancelled = false;
    const tick = () => {
      const id = pending?.id || liveId;
      if (!id) return;
      fetch(`/api/phone/calls/${id}`)
        .then((r) => r.json())
        .then((j) => {
          if (cancelled || !j.data) return;
          const notes = String(j.data.notes || "");
          if (pending && notes.includes("[warm_consult_answered]")) {
            updateCall(pending.id, { transferPhase: "consult_answered" });
          }
          if (j.data.telnyxCallControlId) {
            setControlLinkedIds((prev) => ({ ...prev, [id]: true }));
          }
          if (j.data.transcriptText) {
            updateCall(id, { transcriptText: String(j.data.transcriptText) });
            if (id === activeLineIdRef.current) {
              setLiveTranscript(String(j.data.transcriptText));
            }
          }
          if (j.data.aiSummary) {
            updateCall(id, { aiSummary: String(j.data.aiSummary) });
            if (id === activeLineIdRef.current) {
              setAiSummary(String(j.data.aiSummary));
            }
          }
        })
        .catch(() => undefined);
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeCalls.map((c) => `${c.id}:${c.warmTransferPending}:${c.transferPhase}`).join("|"), activeLineId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const line = activeCalls.find((c) => c.id === activeLineId);
    setLiveTranscript(line?.transcriptText || "");
    setAiSummary(line?.aiSummary || "");
    setRecording(Boolean(line?.recording));
    setCallNotes(line?.notes || "");
  }, [activeLineId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onCall = activeCalls.length > 0;
    if (onCall && !presenceManualRef.current && presenceStatus !== "dnd") {
      if (presenceStatus !== "on_call") {
        void updatePresence("on_call", customStatus, { auto: true });
      }
    } else if (!onCall && presenceStatus === "on_call" && !presenceManualRef.current) {
      void updatePresence("available", customStatus, { auto: true });
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

  async function updatePresence(
    status: string,
    label?: string,
    opts?: { auto?: boolean },
  ) {
    setPresenceStatus(status);
    // Only user-driven presence changes block auto on_call / available restore.
    if (!opts?.auto) presenceManualRef.current = true;
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

      const webrtcHandle = (call.webrtcCall ||
        (call.webrtcId ? webrtcCallsRef.current.get(call.webrtcId) : null) ||
        webrtcCallsRef.current.get(call.id)) as {
        answer?: (opts?: { remoteElement?: HTMLAudioElement }) => void;
        id?: string;
      } | null;

      // Only use the WebRTC answer path when we have a real SDK call handle.
      if (webrtcHandle?.answer) {
        const audioEl = remoteAudioRef.current;
        await webrtcHandle.answer(audioEl ? { remoteElement: audioEl } : undefined);
        const webrtcId = call.webrtcId || webrtcHandle.id || call.id;
        let humanCallId = call.humanCallId || call.id;
        // If banner still uses raw WebRTC id, create/link a HumanCall for API actions.
        if (!call.humanCallId && String(humanCallId).startsWith("webrtc")) {
          const reg = await fetch("/api/phone/calls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: call.from,
              from: call.to || callerId,
              mediaMode: "webrtc",
              webrtcCallId: webrtcId,
              direction: "inbound",
            }),
          });
          const regJson = await reg.json();
          if (reg.ok && regJson.data?.id) humanCallId = regJson.data.id;
        } else {
          await fetch(`/api/phone/calls/${humanCallId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answer: true }),
          }).catch(() => undefined);
        }
        webrtcToHumanRef.current.set(webrtcId, humanCallId);
        webrtcCallsRef.current.set(humanCallId, webrtcHandle);
        webrtcCallsRef.current.set(webrtcId, webrtcHandle);
        const newCall: ActiveCall = {
          id: humanCallId,
          from: call.to,
          to: call.from,
          status: "in_progress",
          muted: false,
          onHold: false,
          mediaMode: "webrtc",
          webrtcId,
          startedAt: Date.now(),
        };
        setActiveCalls((prev) => [...prev, newCall]);
        setActiveLineId(humanCallId);
        setIncoming(null);
        setWaitingIncoming((prev) =>
          prev.filter((w) => w.id !== call.id && w.webrtcId !== webrtcId),
        );
        return;
      }

      // Call Control answer without a WebRTC invite for THIS call: bridge to agent cell.
      // webrtcConnected alone is not enough — another line may own the SDK session.
      const bridgeTo = myCellularNumber();
      if (!bridgeTo) {
        throw new Error(
          "No browser audio for this call. Wait for the WebRTC invite, or enter your number under Call my phone, then answer.",
        );
      }

      const res = await fetch(`/api/phone/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Answer failed");

      let mediaMode: MediaMode = "call_control";
      await patchCallById(call.id, { flipTo: bridgeTo });
      mediaMode = "call_my_phone";
      setError("Answered — ringing your phone to connect audio.");

      setControlLinkedIds((prev) => ({ ...prev, [call.id]: true }));
      const newCall: ActiveCall = {
        id: call.id,
        from: call.from,
        to: call.to,
        status: "in_progress",
        muted: false,
        onHold: mediaMode === "call_my_phone",
        mediaMode,
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
    call?.hangup?.();
    const humanId = incoming.humanCallId || incoming.id;
    if (humanId && !String(humanId).startsWith("webrtc")) {
      await fetch(`/api/phone/calls/${humanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hangup: true, disposition: "missed:declined" }),
      }).catch(() => undefined);
    }
    setIncoming(null);
    webrtcCallsRef.current.delete(incoming.id);
    if (incoming.webrtcId) webrtcCallsRef.current.delete(incoming.webrtcId);
  }

  async function declineWaiting(call: IncomingCall) {
    const wc = call.webrtcCall as { hangup?: () => void } | undefined;
    wc?.hangup?.();
    const humanId = call.humanCallId || call.id;
    if (humanId && !String(humanId).startsWith("webrtc")) {
      await fetch(`/api/phone/calls/${humanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hangup: true, disposition: "missed:declined" }),
      }).catch(() => undefined);
    }
    setWaitingIncoming((prev) => prev.filter((w) => w.id !== call.id));
    webrtcCallsRef.current.delete(call.id);
    if (call.webrtcId) webrtcCallsRef.current.delete(call.webrtcId);
  }

  const pressKey = useCallback(
    (key: string) => {
      if (!activeCall) {
        setDialNumber((n) => n + key);
        return;
      }
      if (activeCall.mediaMode === "webrtc") {
        const call = (webrtcCallsRef.current.get(activeCall.id) ||
          (activeCall.webrtcId ? webrtcCallsRef.current.get(activeCall.webrtcId) : null)) as {
          dtmf?: (d: string) => void;
        } | null;
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

  async function startCall(overrideNumber?: string) {
    const dest = (overrideNumber ?? dialNumber).trim();
    if (!dest) return;
    if (useCallMyPhone && !myPhone.trim() && !myCellularNumber()) {
      setError("Enter your phone number for Call my phone.");
      return;
    }
    // Multi-line: hold the active line before placing another outbound call.
    if (activeLineId && activeCallsRef.current.length > 0) {
      const current = activeCallsRef.current.find((c) => c.id === activeLineId);
      if (current && !current.onHold) {
        await toggleHoldForLine(activeLineId, true);
      }
    }
    setLoading(true);
    setError("");
    setDialNumber(dest);
    localStorage.setItem(LS_LAST_DIALED, dest);
    setLastDialed(dest);
    try {
      const from = callerId;

      if (webrtcConnected && !useCallMyPhone && telnyxClientRef.current) {
        // Always create a HumanCall first so park/transfer/record APIs have a real id.
        const reg = await fetch("/api/phone/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: dest,
            from,
            anonymous: anonymousDial,
            mediaMode: "webrtc",
          }),
        });
        const regJson = await reg.json();
        if (!reg.ok) throw new Error(regJson.error || "Failed to register call");
        const humanCallId = regJson.data.id as string;

        const client = telnyxClientRef.current as {
          newCall: (opts: {
            destinationNumber: string;
            callerNumber?: string;
            remoteElement?: HTMLAudioElement;
            clientState?: string;
          }) => unknown;
        };
        const audioEl = remoteAudioRef.current;
        const callOpts: {
          destinationNumber: string;
          callerNumber?: string;
          remoteElement?: HTMLAudioElement;
          callerName?: string;
          clientState?: string;
        } = {
          destinationNumber: dest,
          callerNumber: from,
          ...(audioEl ? { remoteElement: audioEl } : {}),
          clientState: btoa(
            JSON.stringify({
              humanCallId,
              kind: "human",
              anonymous: anonymousDial,
            }),
          ),
        };
        if (anonymousDial) {
          callOpts.callerName = "Anonymous";
        }
        const call = client.newCall(callOpts);
        const webrtcId = (call as { id?: string }).id || `webrtc-${Date.now()}`;
        webrtcToHumanRef.current.set(webrtcId, humanCallId);
        webrtcCallsRef.current.set(webrtcId, call);
        webrtcCallsRef.current.set(humanCallId, call);
        await fetch(`/api/phone/calls/${humanCallId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webrtcCallId: webrtcId,
            notes: `webrtc:${webrtcId}${anonymousDial ? " [anonymous_dial]" : ""}`,
          }),
        }).catch(() => undefined);
        const newCall: ActiveCall = {
          id: humanCallId,
          from: regJson.data.from || from,
          to: regJson.data.to || dest,
          status: "ringing",
          muted: false,
          onHold: false,
          mediaMode: "webrtc",
          webrtcId,
          startedAt: Date.now(),
        };
        setActiveCalls((prev) => [...prev, newCall]);
        setActiveLineId(humanCallId);
        setRecording(false);
        return;
      }

      if (!useCallMyPhone && (webrtcMode === "telnyx" || webrtcMode === "api")) {
        setError(
          "Browser softphone audio is not connected yet. Wait for WebRTC, or enable Call my phone.",
        );
        return;
      }
      if (!useCallMyPhone && webrtcMode === "mock") {
        // Mock / no Telnyx key — Call Control path is OK for local testing.
      } else if (!useCallMyPhone) {
        setError("Enable Call my phone or wait for browser WebRTC before dialing.");
        return;
      }

      const res = await fetch("/api/phone/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: dest,
          from,
          anonymous: anonymousDial,
          ...(useCallMyPhone ? { callMyPhone: myPhone.trim() || myCellularNumber() } : {}),
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
    // Multi-line: redial places another outbound (startCall auto-holds the active line).
    await startCall(last);
  }

  function webrtcHandleFor(callId: string, webrtcId?: string | null) {
    return (
      webrtcCallsRef.current.get(callId) ||
      (webrtcId ? webrtcCallsRef.current.get(webrtcId) : null) ||
      null
    );
  }

  async function toggleHoldForLine(callId: string, forceHold?: boolean) {
    const call = activeCalls.find((c) => c.id === callId);
    if (!call) return;
    const onHold = forceHold ?? !call.onHold;
    if (call.mediaMode === "webrtc") {
      const wc = webrtcHandleFor(callId, call.webrtcId) as {
        hold?: () => void;
        unhold?: () => void;
      } | null;
      if (onHold) await wc?.hold?.();
      else await wc?.unhold?.();
      updateCall(callId, { onHold, status: onHold ? "on_hold" : "in_progress" });
      await patchCallById(callId, { onHold }).catch(() => undefined);
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
        const call = webrtcHandleFor(activeCall.id, activeCall.webrtcId) as {
          hangup?: () => void;
        } | null;
        await call?.hangup?.();
      }
      // Always complete the HumanCall row so history/disposition stay correct.
      await patchCallById(activeCall.id, { hangup: true }).catch(() => undefined);
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
      const call = webrtcHandleFor(activeCall.id, activeCall.webrtcId) as {
        muteAudio?: () => void;
        unmuteAudio?: () => void;
      } | null;
      if (muted) call?.muteAudio?.();
      else call?.unmuteAudio?.();
      updateCall(activeCall.id, { muted });
      await patchCallById(activeCall.id, { muted }).catch(() => undefined);
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
    if (activeCall.mediaMode === "webrtc" && !controlLinkedIds[activeCall.id]) {
      setError("Wait until call control is linked, then transfer.");
      return;
    }
    try {
      const note = warmTransferNote.trim();
      if (note) {
        await patchCallById(activeCall.id, {
          notes: `${callNotes}\n[Transfer note: ${note}]`.trim(),
        });
      }
      await patchCallById(activeCall.id, { transferTo: transferTo.trim() });
      const wc = webrtcHandleFor(activeCall.id, activeCall.webrtcId) as {
        hangup?: () => void;
      } | null;
      detachWebrtcMedia(activeCall.id, activeCall.webrtcId);
      await wc?.hangup?.();
      setTransferTo("");
      setWarmTransferNote("");
      removeCall(activeCall.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    }
  }

  async function startWarmTransfer() {
    if (!activeCall || !transferTo.trim()) return;
    if (activeCall.mediaMode === "webrtc" && !controlLinkedIds[activeCall.id]) {
      setError("Wait until call control is linked, then start warm transfer.");
      return;
    }
    try {
      const note = warmTransferNote.trim();
      await patchCallById(activeCall.id, {
        warmTransferTo: transferTo.trim(),
        consult: true,
        notes: note || undefined,
      });
      updateCall(activeCall.id, {
        warmTransferPending: true,
        onHold: true,
        status: "on_hold",
        transferPhase: "ringing_consult",
      });
    } catch (e) {
      updateCall(activeCall.id, { transferPhase: "failed", warmTransferPending: false });
      setError(e instanceof Error ? e.message : "Warm transfer failed");
    }
  }

  async function completeWarmTransfer() {
    if (!activeCall) return;
    if (activeCall.transferPhase !== "consult_answered") {
      setError("Wait until the employee answers before completing the transfer.");
      return;
    }
    try {
      updateCall(activeCall.id, { transferPhase: "completing" });
      await patchCallById(activeCall.id, { completeWarmTransfer: true });
      const wc = webrtcHandleFor(activeCall.id, activeCall.webrtcId) as {
        hangup?: () => void;
      } | null;
      detachWebrtcMedia(activeCall.id, activeCall.webrtcId);
      await wc?.hangup?.();
      updateCall(activeCall.id, { transferPhase: "completed", warmTransferPending: false });
      setTransferTo("");
      setWarmTransferNote("");
      removeCall(activeCall.id);
    } catch (e) {
      updateCall(activeCall.id, { transferPhase: "failed" });
      setError(e instanceof Error ? e.message : "Complete transfer failed");
    }
  }

  async function cancelWarmTransfer() {
    if (!activeCall) return;
    try {
      await patchCallById(activeCall.id, { cancelWarmTransfer: true });
      if (activeCall.mediaMode === "webrtc") {
        const wc = webrtcHandleFor(activeCall.id, activeCall.webrtcId) as {
          unhold?: () => void;
        } | null;
        await wc?.unhold?.();
      }
      updateCall(activeCall.id, {
        warmTransferPending: false,
        onHold: false,
        status: "in_progress",
        transferPhase: "cancelled",
      });
    } catch (e) {
      updateCall(activeCall.id, { transferPhase: "failed" });
      setError(e instanceof Error ? e.message : "Cancel transfer failed");
    }
  }

  function transferPhaseLabel(phase?: ActiveCall["transferPhase"]) {
    switch (phase) {
      case "holding_caller":
        return "Caller on hold";
      case "ringing_consult":
        return "Caller on hold · contacting employee";
      case "consult_answered":
        return "Employee answered · caller still held";
      case "completing":
        return "Bridging transfer…";
      case "completed":
        return "Transfer completed";
      case "cancelled":
        return "Transfer cancelled · caller returned to you";
      case "failed":
        return "Transfer failed — caller should still be with you";
      default:
        return null;
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
    if (activeCall.mediaMode === "webrtc" && !controlLinkedIds[activeCall.id]) {
      setError("Wait until call control is linked, then park.");
      return;
    }
    try {
      const res = await fetch("/api/phone/park", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanCallId: activeCall.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Park failed");
      const slotCode = String(json.data?.slotCode || json.data?.code || "");
      setParkSlot(slotCode);
      const handle = webrtcHandleFor(activeCall.id, activeCall.webrtcId);
      if (slotCode && handle) {
        parkedWebrtcRef.current.set(slotCode, {
          humanCallId: activeCall.id,
          handle,
          webrtcId: activeCall.webrtcId || undefined,
        });
        // Keep media held locally while parked.
        const wc = handle as { hold?: () => void };
        await wc.hold?.();
      }
      removeCall(activeCall.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Park failed");
    }
  }

  async function retrievePark() {
    if (!parkSlot.trim()) return;
    try {
      const slotCode = parkSlot.trim();
      const res = await fetch("/api/phone/park", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retrieve", slotCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retrieve failed");
      const human = json.data?.humanCall;
      const parked = parkedWebrtcRef.current.get(slotCode);
      if (parked?.handle) {
        webrtcCallsRef.current.set(parked.humanCallId, parked.handle);
        if (parked.webrtcId) {
          webrtcCallsRef.current.set(parked.webrtcId, parked.handle);
          webrtcToHumanRef.current.set(parked.webrtcId, parked.humanCallId);
        }
        const wc = parked.handle as { unhold?: () => void };
        await wc.unhold?.();
        parkedWebrtcRef.current.delete(slotCode);
      }
      if (human?.id) {
        let mediaMode: MediaMode = parked?.handle
          ? "webrtc"
          : (human.mediaMode as MediaMode) || "call_control";
        // Other browser/device: unhold Call Control but need cellular/flip for audio.
        if (!parked?.handle) {
          const bridgeTo = myCellularNumber();
          if (bridgeTo && human.telnyxCallControlId) {
            await patchCallById(human.id, { flipTo: bridgeTo }).catch(() => undefined);
            mediaMode = "call_my_phone";
            setError("Park retrieved — ringing your phone for audio.");
          } else {
            setError(
              "Park retrieved on Call Control. Use this browser’s park slot, or set Call my phone / flip number for audio.",
            );
          }
        }
        const restored: ActiveCall = {
          id: human.id,
          from: human.from,
          to: human.to,
          status: human.status || "in_progress",
          muted: Boolean(human.muted),
          onHold: mediaMode === "call_my_phone",
          mediaMode,
          webrtcId: parked?.webrtcId || null,
          startedAt: Date.now(),
          notes: human.notes || undefined,
        };
        setActiveCalls((prev) => {
          if (prev.some((c) => c.id === restored.id)) return prev;
          return [...prev, restored];
        });
        setActiveLineId(human.id);
        if (human.telnyxCallControlId) {
          setControlLinkedIds((prev) => ({ ...prev, [human.id]: true }));
        }
      }
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

  async function mergeHeldLine() {
    if (!activeCall) return;
    const other = activeCalls.find((c) => c.id !== activeCall.id && c.onHold);
    if (!other) {
      setError("Hold a second line, then merge.");
      return;
    }
    try {
      const res = await fetch("/api/phone/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mergeCallIds: [activeCall.id, other.id] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Merge failed");
      setConferenceId(json.data?.conference?.id || "");
      updateCall(other.id, { onHold: false, status: "in_progress" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    }
  }

  async function flipCall() {
    const dest = flipNumber.trim() || myCellularNumber();
    if (!activeCall || !dest) return;
    if (activeCall.mediaMode === "webrtc" && !controlLinkedIds[activeCall.id]) {
      setError("Wait until call control is linked, then flip.");
      return;
    }
    try {
      await patchCallById(activeCall.id, { flipTo: dest });
      // Hang up browser media — audio continues on the flipped device after bridge.
      const wc = webrtcHandleFor(activeCall.id, activeCall.webrtcId) as {
        hangup?: () => void;
      } | null;
      detachWebrtcMedia(activeCall.id, activeCall.webrtcId);
      await wc?.hangup?.();
      updateCall(activeCall.id, {
        onHold: true,
        status: "on_hold",
        mediaMode: "call_my_phone",
        webrtcId: null,
        mediaDetached: true,
      });
      setError("Flipping — answer on the other device to take the call.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Call flip failed");
    }
  }

  async function sendWhisper() {
    if (!activeCall || !whisperText.trim()) return;
    if (!controlLinkedIds[activeCall.id] && activeCall.mediaMode === "webrtc") {
      setError("Wait until call control is linked, then send the coach note.");
      return;
    }
    try {
      await patchCallById(activeCall.id, { whisper: whisperText.trim() });
      setWhisperText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coach note failed");
    }
  }

  async function blockCaller() {
    if (!activeCall) return;
    try {
      await patchCallById(activeCall.id, { blockCaller: true });
      removeCall(activeCall.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Block failed");
    }
  }

  async function refreshAiNotes() {
    if (!activeCall) return;
    if (activeCall.mediaMode === "webrtc" && !controlLinkedIds[activeCall.id]) {
      setError("Wait until call control is linked for live transcription.");
      return;
    }
    try {
      await patchCallById(activeCall.id, { startTranscription: true }).catch(() => undefined);
      const res = await fetch(`/api/phone/calls/${activeCall.id}`);
      const json = await res.json();
      const row = json.data;
      if (row?.transcriptText) setLiveTranscript(row.transcriptText);
      if (row?.transcriptText && String(row.transcriptText).trim().length > 40) {
        const sum = await patchCallById(activeCall.id, { generateAiSummary: true });
        setAiSummary(sum?.aiSummary || "");
      } else {
        setError("Transcript still short — keep the call going, then refresh notes.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI notes failed");
    }
  }

  async function toggleRecord() {
    if (!activeCall) return;
    if (activeCall.mediaMode === "webrtc" && !controlLinkedIds[activeCall.id]) {
      setError("Wait until call control is linked, then record.");
      return;
    }
    const next = !Boolean(activeCall.recording);
    try {
      await patchCallById(activeCall.id, { record: next });
      updateCall(activeCall.id, { recording: next });
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
  const onACall = activeCalls.length > 0;
  const controlReady = activeCall
    ? activeCall.mediaMode !== "webrtc" || Boolean(controlLinkedIds[activeCall.id])
    : true;

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
        <p className="mt-1 text-xs text-muted-foreground">
          Mode: {modeLabel}
          {" · "}
          Network: {networkQuality}
        </p>
        {reconnectHint ? (
          <p className="mt-1 text-xs text-amber-700">{reconnectHint}</p>
        ) : null}

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
          />
        </div>

        <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={useCallMyPhone}
            onChange={(e) => setUseCallMyPhone(e.target.checked)}
          />
          <span>
            Call my phone first, then bridge to the destination (for users without browser audio).
          </span>
        </label>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={anonymousDial}
            onChange={(e) => setAnonymousDial(e.target.checked)}
          />
          <span className="text-sm">Anonymous / private caller ID</span>
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
            >
              {key}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {activeCall && activeCall.mediaMode === "webrtc" && !controlReady ? (
          <p className="mt-2 text-xs text-amber-700">
            Linking call control… park, transfer, record, and flip unlock when ready.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            id="softphone-start-call"
            onClick={() => void startCall()}
            disabled={loading || !dialNumber.trim()}
            className="gap-2"
          >
            <Phone className="h-4 w-4" />
            {loading ? "Calling…" : onACall ? "Call (new line)" : "Call"}
          </Button>
          <Button
            variant="outline"
            onClick={redial}
            disabled={!lastDialed || loading}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Redial
          </Button>
          {activeCall ? (
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
              <Button
                variant="outline"
                onClick={toggleRecord}
                disabled={!controlReady}
                className="gap-2"
              >
                {recording ? "Stop rec" : "Record"}
              </Button>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={blindTransfer}
                    className="gap-1"
                    disabled={!controlReady}
                  >
                    <PhoneForwarded className="h-4 w-4" />
                    Transfer
                  </Button>
                ) : activeCall.warmTransferPending ? (
                  <div className="w-full space-y-2">
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {transferPhaseLabel(activeCall.transferPhase) ||
                        "Caller on hold · contacting employee"}
                      . Do not close this panel — the customer stays held until you complete
                      or cancel.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={completeWarmTransfer}
                        disabled={activeCall.transferPhase !== "consult_answered"}
                      >
                        Complete transfer
                      </Button>
                      <Button variant="outline" size="sm" onClick={cancelWarmTransfer}>
                        Cancel — return caller to me
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startWarmTransfer}
                    className="gap-1"
                    disabled={!controlReady}
                  >
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
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
                          disabled={!target}
                          onClick={() => target && setTransferTo(target)}
                          title={target ? undefined : "No extension or cellular on file"}
                        >
                          {p.customLabel || p.userId.slice(0, 8)} · {p.status}
                          {target ? ` (${target})` : " (no number)"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={parkCall} disabled={!controlReady}>
                Park call
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={createConference}
                className="gap-1"
                disabled={!controlReady}
              >
                <Users className="h-3 w-3" />
                Start conference
              </Button>
              <Button variant="outline" size="sm" onClick={mergeHeldLine} disabled={!controlReady}>
                Merge held line
              </Button>
              <Button variant="outline" size="sm" onClick={blockCaller}>
                Block caller
              </Button>
              <Button variant="outline" size="sm" onClick={refreshAiNotes} disabled={!controlReady}>
                AI notes
              </Button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Call flip to device</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={flipNumber}
                    onChange={(e) => setFlipNumber(e.target.value)}
                    placeholder="+1 your cell"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={flipCall}
                    disabled={!controlReady}
                  >
                    Flip
                  </Button>
                </div>
              </div>
              <div>
                <Label>Coach note (spoken to call)</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={whisperText}
                    onChange={(e) => setWhisperText(e.target.value)}
                    placeholder="Short note spoken while caller is briefly held…"
                    disabled={!controlReady}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={sendWhisper}
                    disabled={!controlReady}
                  >
                    Speak note
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Speaks a spoken note on the live leg (not a private supervisor channel).
                </p>
              </div>
            </div>

            {(liveTranscript || aiSummary) && (
              <div className="mt-3 rounded-lg border border-border p-3 text-sm">
                {aiSummary ? (
                  <p className="font-medium">AI summary: {aiSummary}</p>
                ) : null}
                {liveTranscript ? (
                  <p className="mt-1 max-h-24 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap">
                    {liveTranscript}
                  </p>
                ) : null}
              </div>
            )}

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
