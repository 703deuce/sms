"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
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
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ActiveCall = {
  id: string;
  from: string;
  to: string;
  status: string;
  muted: boolean;
  onHold: boolean;
};

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

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
  const [showDtmf, setShowDtmf] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [webrtcMode, setWebrtcMode] = useState<string>("mock");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const telnyxClientRef = useRef<{ disconnect?: () => void } | null>(null);

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
            client.connect();
            telnyxClientRef.current = client;
          } catch {
            // Fall back to call-control API mode
            setWebrtcMode("api");
          }
        }
      })
      .catch(() => undefined);

    return () => {
      telnyxClientRef.current?.disconnect?.();
    };
  }, []);

  const pressKey = useCallback((key: string) => {
    setDialNumber((n) => n + key);
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
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/phone/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: dialNumber.trim(), from: callerId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Dial failed");
      setActiveCall({
        id: json.data.id,
        from: json.data.from,
        to: json.data.to,
        status: json.data.status,
        muted: false,
        onHold: false,
      });
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

  async function hangup() {
    if (!activeCall) return;
    try {
      await patchCall({ hangup: true });
    } catch {
      // still clear UI
    }
    setActiveCall(null);
    setShowDtmf(false);
  }

  async function toggleMute() {
    if (!activeCall) return;
    const muted = !activeCall.muted;
    const data = await patchCall({ muted });
    setActiveCall({ ...activeCall, muted: data?.muted ?? muted });
  }

  async function toggleHold() {
    if (!activeCall) return;
    const onHold = !activeCall.onHold;
    const data = await patchCall({ onHold });
    setActiveCall({ ...activeCall, onHold: data?.onHold ?? onHold, status: data?.status ?? activeCall.status });
  }

  async function transfer() {
    if (!activeCall || !transferTo.trim()) return;
    try {
      await patchCall({ transferTo: transferTo.trim() });
      setTransferTo("");
      setActiveCall(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Browser dialer
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Mode: {webrtcMode === "telnyx" ? "Telnyx WebRTC" : webrtcMode === "api" ? "Call Control API" : "Mock (no Telnyx key)"}
        </p>

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

        <div className="mt-4 grid grid-cols-3 gap-2">
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
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">
              {activeCall.status === "on_hold" ? "On hold · " : ""}
              {activeCall.from} → {activeCall.to}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
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
              <Button variant="outline" size="sm" onClick={transfer} className="gap-1">
                <PhoneForwarded className="h-4 w-4" />
                Transfer
              </Button>
            </div>
          </div>
        ) : null}

        {activeCall && showDtmf ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">DTMF keypad</p>
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
      </Card>

      <Card>
        <CardTitle>Active line</CardTitle>
        {activeCall ? (
          <div className="mt-4 space-y-2">
            <div className={cn("rounded-lg p-4", activeCall.onHold ? "bg-amber-50 border border-amber-200" : "bg-primary/5 border border-primary/20")}>
              <p className="text-lg font-semibold">{activeCall.to}</p>
              <p className="text-sm text-muted-foreground">From {activeCall.from}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">{activeCall.status}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No active call. Enter a number and press Call.</p>
        )}
      </Card>
    </div>
  );
}
