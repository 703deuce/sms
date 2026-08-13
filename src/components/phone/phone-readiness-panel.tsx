"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ServerReadiness = {
  checkedAt: string;
  telnyx: {
    apiKey: boolean;
    connectionId: boolean;
    publicKeyPresent: boolean;
    phoneConfigured: boolean;
  };
  numbers: { activeCount: number };
  presence: { status: string; updatedAt: string } | null;
  userSettings: {
    dndEnabled: boolean;
    ringDesktop: boolean;
    ringMobile: boolean;
    hasCellularForward: boolean;
  } | null;
  lastCall: { id: string; status: string; startedAt: string; mediaMode: string } | null;
  pushSubscriptionCount: number;
  deviceCount?: number;
  checks: {
    hasActiveNumber: boolean;
    telnyxReady: boolean;
    notInDnd: boolean;
    presenceFresh: boolean;
    incomingCallPush: boolean;
  };
};

type Check = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "pending";
  detail: string;
};

function chip(status: Check["status"]) {
  if (status === "pass") return "Active";
  if (status === "warn") return "Paused";
  if (status === "fail") return "Failed";
  return "Pending";
}

export function PhoneReadinessPanel() {
  const [server, setServer] = useState<ServerReadiness | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [micActive, setMicActive] = useState(false);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setError("");
    const next: Check[] = [];

    // Browser online
    next.push({
      id: "online",
      label: "Device online",
      status: navigator.onLine ? "pass" : "fail",
      detail: navigator.onLine ? "Browser reports online" : "Browser is offline",
    });

    // Network effective type
    const conn = (navigator as Navigator & {
      connection?: { effectiveType?: string; rtt?: number; downlink?: number };
    }).connection;
    const effective = conn?.effectiveType || "unknown";
    const unstable = effective === "2g" || effective === "slow-2g";
    next.push({
      id: "network",
      label: "Network quality (browser)",
      status: unstable ? "fail" : effective === "3g" ? "warn" : "pass",
      detail: unstable
        ? `Connection looks unstable for live calls (${effective}). Fast download is not enough if latency/jitter is high.`
        : `effectiveType=${effective}${conn?.rtt != null ? `, rtt≈${conn.rtt}ms` : ""}${conn?.downlink != null ? `, downlink≈${conn.downlink}Mb/s` : ""}`,
    });

    // Microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      next.push({
        id: "mic",
        label: "Microphone permission",
        status: "pass",
        detail: "Microphone access granted",
      });
      // brief level sample
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      await new Promise((r) => setTimeout(r, 400));
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i];
      const level = sum / data.length / 255;
      setMicLevel(level);
      setMicActive(true);
      next.push({
        id: "mic_level",
        label: "Microphone signal",
        status: level > 0.02 ? "pass" : "warn",
        detail:
          level > 0.02
            ? `Signal detected (level ${(level * 100).toFixed(0)}%)`
            : "Mic open but quiet — speak to verify input",
      });
      stream.getTracks().forEach((t) => t.stop());
      await ctx.close().catch(() => undefined);
      setMicActive(false);
    } catch (e) {
      next.push({
        id: "mic",
        label: "Microphone permission",
        status: "fail",
        detail: e instanceof Error ? e.message : "Microphone blocked",
      });
    }

    // Notification permission (browser)
    const notif =
      typeof Notification !== "undefined" ? Notification.permission : "unsupported";
    next.push({
      id: "notifications",
      label: "Browser notifications",
      status: notif === "granted" ? "pass" : notif === "denied" ? "fail" : "warn",
      detail:
        notif === "granted"
          ? "Notification permission granted"
          : notif === "denied"
            ? "Notifications blocked — inbound ring banners may be missed"
            : "Notification permission not granted yet",
    });

    // App round-trip
    const t0 = performance.now();
    try {
      const res = await fetch("/api/phone/readiness");
      const json = await res.json();
      const ms = Math.round(performance.now() - t0);
      setRttMs(ms);
      if (!res.ok) throw new Error(json.error || "Readiness API failed");
      const data = json.data as ServerReadiness;
      setServer(data);

      next.push({
        id: "api_rtt",
        label: "App API latency",
        status: ms < 400 ? "pass" : ms < 900 ? "warn" : "fail",
        detail: `${ms}ms round-trip to Transovo`,
      });
      next.push({
        id: "telnyx",
        label: "Telnyx telephony configured",
        status: data.checks.telnyxReady ? "pass" : "fail",
        detail: data.checks.telnyxReady
          ? "API key + connection + public key present"
          : "Missing TELNYX_API_KEY, TELNYX_CONNECTION_ID, or TELNYX_PUBLIC_KEY",
      });
      next.push({
        id: "number",
        label: "Active business number",
        status: data.checks.hasActiveNumber ? "pass" : "fail",
        detail: data.checks.hasActiveNumber
          ? `${data.numbers.activeCount} active number(s)`
          : "No active number — inbound/outbound will fail",
      });
      next.push({
        id: "dnd",
        label: "Availability (not DND)",
        status: data.checks.notInDnd ? "pass" : "warn",
        detail: data.checks.notInDnd
          ? `Presence: ${data.presence?.status || "unknown"}`
          : "Do Not Disturb is on — inbound may forward or miss",
      });
      next.push({
        id: "push",
        label: "Incoming-call push readiness",
        status: data.checks.incomingCallPush ? "pass" : "warn",
        detail: data.checks.incomingCallPush
          ? `Devices + VAPID push ready (${data.deviceCount ?? 0} device(s), ${data.pushSubscriptionCount} sub(s))`
          : `Need active softphone device registration + browser push subscription (devices: ${data.deviceCount ?? 0}, push: ${data.pushSubscriptionCount}). Open /phone once and allow notifications.`,
      });
      if (data.lastCall) {
        next.push({
          id: "last_call",
          label: "Last softphone call",
          status: "pass",
          detail: `${data.lastCall.status} · ${data.lastCall.mediaMode} · ${new Date(data.lastCall.startedAt).toLocaleString()}`,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Readiness check failed");
      next.push({
        id: "api",
        label: "Server readiness",
        status: "fail",
        detail: e instanceof Error ? e.message : "Failed",
      });
    }

    setChecks(next);
    setRunning(false);
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <CardTitle>Phone Readiness Test</CardTitle>
        <p className="text-sm text-muted-foreground">
          Prove the phone layer before relying on AI. This checks the browser, network,
          microphone, Telnyx config, and availability — the same failure modes customers
          report across OpenPhone, Dialpad, Nextiva, and RingCentral.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void run()} disabled={running}>
            {running ? "Running…" : "Re-run checks"}
          </Button>
          <Link
            href="/phone"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            Open softphone
          </Link>
          {rttMs != null ? (
            <span className="text-xs text-muted-foreground">API RTT {rttMs}ms</span>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-sm">
          {failed === 0 && warned === 0
            ? "All critical checks look good."
            : `${failed} failed · ${warned} warnings`}
        </p>
        {micActive || micLevel > 0 ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-violet-500"
              style={{ width: `${Math.min(100, micLevel * 100)}%` }}
            />
          </div>
        ) : null}
      </Card>

      <Card className="space-y-2">
        <CardTitle>Checklist</CardTitle>
        <ul className="divide-y divide-border">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
              <StatusChip status={chip(c.status)} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2">
        <CardTitle>Manual test calls</CardTitle>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Place an outbound test from the{" "}
            <Link className="underline" href="/phone">
              softphone
            </Link>
            . Confirm two-way audio within ~1 second of answer.
          </li>
          <li>
            From another phone, dial your business number. Confirm the softphone shows an
            Answer control immediately and does not disappear.
          </li>
          <li>
            Put a call on hold, then resume. Then try a warm transfer and confirm the UI
            shows: caller held → employee contacted → completed / returned.
          </li>
        </ol>
        {server?.lastCall ? (
          <p className="text-xs text-muted-foreground">
            Last call path:{" "}
            <Link className="underline" href={`/phone/calls/${server.lastCall.id}`}>
              view diagnostics
            </Link>
          </p>
        ) : null}
      </Card>
    </div>
  );
}
