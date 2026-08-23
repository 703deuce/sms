"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SetupPayload = {
  settings: {
    publicBusinessE164: string | null;
    routingNumberE164: string | null;
    assignedPhoneNumberId: string | null;
    routingMode: string;
    outboundEnabled: boolean;
  };
  callerId: {
    status: string;
    publicBusinessE164: string | null;
    method: string | null;
  };
  authorizedCallers: Array<{
    id: string;
    name: string;
    phoneE164: string;
    active: boolean;
    outboundEnabled: boolean;
  }>;
  phoneNumbers: Array<{ id: string; e164: string; friendlyName: string | null }>;
  forwarding: Array<{
    carrier: string;
    modes: Record<string, { label: string; dialCode: string; notes?: string }>;
  }> | null;
};

export function SmartRoutingSetupView() {
  const [data, setData] = useState<SetupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [routingPhoneId, setRoutingPhoneId] = useState("");
  const [verifyMethod, setVerifyMethod] = useState<"sms" | "call">("sms");
  const [verifyCode, setVerifyCode] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerPhone, setCallerPhone] = useState("");
  const [callerPin, setCallerPin] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-routing/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json.data as SetupPayload);
      setBusinessNumber(json.data.settings.publicBusinessE164 || "");
      setRoutingPhoneId(json.data.settings.assignedPhoneNumberId || "");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBasics() {
    setMessage("");
    const res = await fetch("/api/smart-routing/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicBusinessE164: businessNumber,
        assignedPhoneNumberId: routingPhoneId || null,
        routingMode: "front_door",
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "Save failed");
      return;
    }
    setMessage("Saved.");
    await load();
  }

  async function startVerification() {
    setMessage("");
    const res = await fetch("/api/smart-routing/caller-id-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        phoneE164: businessNumber,
        method: verifyMethod,
      }),
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || "Verification start failed");
    else setMessage("Verification sent. Enter the code below.");
    await load();
  }

  async function submitVerificationCode() {
    const res = await fetch("/api/smart-routing/caller-id-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_code", code: verifyCode }),
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || "Code rejected");
    else setMessage("Business number verified.");
    await load();
  }

  async function addAuthorizedCaller() {
    const res = await fetch("/api/smart-routing/authorized-callers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: callerName,
        phoneE164: callerPhone,
        pin: callerPin,
      }),
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || "Could not add caller");
    else {
      setCallerName("");
      setCallerPhone("");
      setCallerPin("");
      setMessage("Authorized caller added.");
    }
    await load();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading Smart Routing setup…</p>;
  }

  const routingE164 =
    data?.settings.routingNumberE164 ||
    data?.phoneNumbers.find((p) => p.id === routingPhoneId)?.e164;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Smart Routing setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Keep your existing business number and phones. Add professional call routing and return
          business calls from your verified caller ID — no app required.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <h2 className="font-medium">1. Your business number</h2>
        <p className="text-sm text-muted-foreground">
          Your public number customers already know (not your private routing number).
        </p>
        <input
          className="h-10 w-full rounded-lg border px-3 text-sm"
          placeholder="+1 703 555 1000"
          value={businessNumber}
          onChange={(e) => setBusinessNumber(e.target.value)}
        />
        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Transovo routing number (private — do not advertise)
          </label>
          <select
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={routingPhoneId}
            onChange={(e) => setRoutingPhoneId(e.target.value)}
          >
            <option value="">Select routing number…</option>
            {data?.phoneNumbers.map((p) => (
              <option key={p.id} value={p.id}>
                {fmtPhoneDisplay(p.e164)} {p.friendlyName ? `(${p.friendlyName})` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => void saveBasics()}>Save</Button>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-medium">2. Verify business caller ID</h2>
        <p className="text-sm text-muted-foreground">
          Required so returned calls show your business number, not a personal cell.
        </p>
        <p className="text-sm">
          Status:{" "}
          <span className="font-semibold">{data?.callerId.status?.replace(/_/g, " ")}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-lg border px-2 text-sm"
            value={verifyMethod}
            onChange={(e) => setVerifyMethod(e.target.value as "sms" | "call")}
          >
            <option value="sms">Send text</option>
            <option value="call">Call me</option>
          </select>
          <Button variant="outline" onClick={() => void startVerification()}>
            Verify business number
          </Button>
        </div>
        <div className="flex gap-2">
          <input
            className="h-10 rounded-lg border px-3 text-sm"
            placeholder="Enter code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
          />
          <Button variant="outline" onClick={() => void submitVerificationCode()}>
            Submit code
          </Button>
        </div>
      </Card>

      {routingE164 ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-medium">3. Forward your existing number</h2>
          <p className="text-sm text-muted-foreground">
            Forward <strong>{fmtPhoneDisplay(businessNumber)}</strong> to your routing number{" "}
            <strong>{fmtPhoneDisplay(routingE164)}</strong> using your current carrier.
          </p>
          {data?.forwarding?.slice(0, 2).map((guide) => (
            <div key={guide.carrier} className="rounded-lg border p-3 text-sm">
              <p className="font-semibold">{guide.carrier}</p>
              <p className="mt-1 text-muted-foreground">
                {guide.modes.unconditional?.label}:{" "}
                <code className="text-xs">{guide.modes.unconditional?.dialCode}</code>
              </p>
            </div>
          ))}
          <Link href="/smart-routing/new" className="text-sm font-semibold text-primary hover:underline">
            Continue to build your call menu →
          </Link>
        </Card>
      ) : null}

      <Card className="space-y-4 p-5">
        <h2 className="font-medium">Business callback users</h2>
        <p className="text-sm text-muted-foreground">
          Team members call your private routing number, enter a PIN, and return calls showing your
          verified business caller ID. No mobile app required.
        </p>
        <ul className="space-y-2 text-sm">
          {data?.authorizedCallers.map((c) => (
            <li key={c.id} className="flex justify-between rounded border px-3 py-2">
              <span>{c.name} · {fmtPhoneDisplay(c.phoneE164)}</span>
              <span className="text-muted-foreground">{c.active ? "Active" : "Disabled"}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className="h-10 rounded-lg border px-3 text-sm"
            placeholder="Name"
            value={callerName}
            onChange={(e) => setCallerName(e.target.value)}
          />
          <input
            className="h-10 rounded-lg border px-3 text-sm"
            placeholder="Mobile number"
            value={callerPhone}
            onChange={(e) => setCallerPhone(e.target.value)}
          />
          <input
            className="h-10 rounded-lg border px-3 text-sm"
            placeholder="PIN (4–6 digits)"
            value={callerPin}
            onChange={(e) => setCallerPin(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => void addAuthorizedCaller()}>
          Add authorized caller
        </Button>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
