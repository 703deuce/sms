"use client";

import { AuthorizedCallersPanel } from "@/components/smart-routing/authorized-callers-panel";
import { BusinessCallbackGuide } from "@/components/smart-routing/business-callback-guide";
import { CallerIdVerificationPanel } from "@/components/smart-routing/caller-id-verification-panel";
import { CloseNowControl } from "@/components/smart-routing/close-now-control";
import { DestinationsPanel } from "@/components/smart-routing/destinations-panel";
import { ForwardingSetupPanel } from "@/components/smart-routing/forwarding-setup-panel";
import { SetupStepper } from "@/components/smart-routing/setup-stepper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import type { SetupReadiness } from "@/lib/smart-routing/setup-readiness";
import { Check } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SetupPayload = {
  settings: {
    publicBusinessE164: string | null;
    routingNumberE164: string | null;
    assignedPhoneNumberId: string | null;
    callbackNumberE164: string | null;
    assignedCallbackPhoneNumberId: string | null;
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
  destinations: Array<{
    id: string;
    label: string;
    phoneNumber: string | null;
    active: boolean;
    destinationType: string;
  }>;
  flows: Array<{ id: string; name: string; status: string; type: string }>;
  forwarding: Array<{
    carrier: string;
    modes: Record<string, { label: string; dialCode: string; notes?: string }>;
  }> | null;
  readiness: SetupReadiness;
  scheduleOverride: { mode?: string; expiresAt?: string } | null;
  forwardingTest: {
    detected: boolean;
    at?: string;
    forwardedFrom?: string | null;
    callerNumber?: string | null;
  };
  recentInbound: { at: string; outcome: string | null } | null;
  recentOutbound: {
    at: string;
    destination: string;
    businessCallerId: string | null;
  } | null;
};

export function SmartRoutingSetupView() {
  const [data, setData] = useState<SetupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [routingPhoneId, setRoutingPhoneId] = useState("");
  const [callbackPhoneId, setCallbackPhoneId] = useState("");
  const [callbackTestConfirmed, setCallbackTestConfirmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-routing/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json.data as SetupPayload);
      setBusinessNumber(json.data.settings.publicBusinessE164 || "");
      setRoutingPhoneId(json.data.settings.assignedPhoneNumberId || "");
      setCallbackPhoneId(json.data.settings.assignedCallbackPhoneNumberId || "");
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

  async function saveRoutingNumber() {
    setMessage("");
    const res = await fetch("/api/smart-routing/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedPhoneNumberId: routingPhoneId || null }),
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || "Save failed");
    else setMessage("Routing number saved.");
    await load();
  }

  async function saveCallbackNumber() {
    setMessage("");
    const res = await fetch("/api/smart-routing/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedCallbackPhoneNumberId: callbackPhoneId || null }),
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || "Save failed");
    else setMessage("Business Callback Number saved.");
    await load();
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading Smart Routing setup…</p>;
  }

  const routingE164 =
    data?.settings.routingNumberE164 ||
    data?.phoneNumbers.find((p) => p.id === routingPhoneId)?.e164;
  const callbackE164 =
    data?.settings.callbackNumberE164 ||
    data?.phoneNumbers.find((p) => p.id === callbackPhoneId)?.e164;
  const activeFlow = data?.flows.find((f) => f.status === "active");
  const verified = data?.callerId.status === "verified";
  const forwardingDetected =
    data?.forwardingTest.detected ||
    data?.readiness.steps.find((s) => s.key === "forwarding_detected")?.complete;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Smart Routing setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Keep your existing business number and phones. Complete these steps to route calls
          professionally and return business calls from your verified caller ID — no app required.
        </p>
        <p className="mt-2 text-xs text-amber-800 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          Live phone verification on a real business line is still required before production use.
        </p>
      </div>

      {data?.readiness ? (
        <SetupStepper steps={data.readiness.steps} ready={data.readiness.ready} />
      ) : null}

      <CloseNowControl scheduleOverride={data?.scheduleOverride ?? null} onUpdated={load} />

      <Card className="space-y-4 p-5" id="business-number">
        <h2 className="font-medium">1. Your business number</h2>
        <p className="text-sm text-muted-foreground">
          This is the number your customers already call. You keep this number with your current
          carrier — Transovo does not own or port it.
        </p>
        <input
          className="h-10 w-full rounded-lg border px-3 text-sm"
          placeholder="+1 703 555 1000"
          value={businessNumber}
          onChange={(e) => setBusinessNumber(e.target.value)}
        />
        <Button onClick={() => void saveBasics()}>Save business number</Button>
      </Card>

      <Card className="space-y-4 p-5" id="routing-number">
        <h2 className="font-medium">Your Routing Number</h2>
        <p className="text-sm text-muted-foreground">
          Forward your existing business number to this number. Incoming customer calls are routed
          through your Smart Routing setup. Do not advertise this as your public business number.
        </p>
        <select
          className="h-10 w-full rounded-lg border px-3 text-sm"
          value={routingPhoneId}
          onChange={(e) => setRoutingPhoneId(e.target.value)}
        >
          <option value="">Select routing number…</option>
          {data?.phoneNumbers
            .filter((p) => p.id !== callbackPhoneId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {fmtPhoneDisplay(p.e164)} {p.friendlyName ? `(${p.friendlyName})` : ""}
              </option>
            ))}
        </select>
        {routingE164 ? (
          <p className="text-sm font-semibold">{fmtPhoneDisplay(routingE164)}</p>
        ) : null}
        <Button variant="outline" onClick={() => void saveRoutingNumber()}>
          Save routing number
        </Button>
      </Card>

      <Card className="space-y-4 p-5" id="callback-number">
        <h2 className="font-medium">Your Business Callback Number</h2>
        <p className="text-sm text-muted-foreground">
          Authorized team members call this number to return customer calls from your verified
          business caller ID.{" "}
          <strong>Do not forward customer calls here.</strong>
        </p>
        <select
          className="h-10 w-full rounded-lg border px-3 text-sm"
          value={callbackPhoneId}
          onChange={(e) => setCallbackPhoneId(e.target.value)}
        >
          <option value="">Select Business Callback Number…</option>
          {data?.phoneNumbers
            .filter((p) => p.id !== routingPhoneId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {fmtPhoneDisplay(p.e164)} {p.friendlyName ? `(${p.friendlyName})` : ""}
              </option>
            ))}
        </select>
        {callbackE164 ? (
          <p className="text-sm font-semibold">{fmtPhoneDisplay(callbackE164)}</p>
        ) : null}
        <Button variant="outline" onClick={() => void saveCallbackNumber()}>
          Save Business Callback Number
        </Button>
      </Card>

      <Card className="p-5">
        <CallerIdVerificationPanel
          businessNumber={businessNumber}
          callerId={data?.callerId ?? { status: "not_verified", publicBusinessE164: null, method: null }}
          onVerified={load}
        />
      </Card>

      {routingE164 && businessNumber ? (
        <Card className="p-5">
          <ForwardingSetupPanel
            businessNumber={businessNumber}
            routingNumber={routingE164}
            forwardingGuides={data?.forwarding ?? null}
            forwardingDetected={Boolean(forwardingDetected)}
            forwardingTest={data?.forwardingTest ?? { detected: false }}
            flowId={activeFlow?.id}
            onUpdated={load}
          />
        </Card>
      ) : null}

      <Card className="p-5">
        <DestinationsPanel destinations={data?.destinations ?? []} onUpdated={load} />
      </Card>

      <Card className="space-y-6 p-5">
        <AuthorizedCallersPanel
          callers={data?.authorizedCallers ?? []}
          onUpdated={load}
        />
        {routingE164 ? (
          <BusinessCallbackGuide
            businessNumber={businessNumber}
            routingNumber={routingE164}
            callbackNumber={callbackE164 || ""}
            verified={verified}
          />
        ) : null}
      </Card>

      <Card className="space-y-4 p-5" id="test">
        <h2 className="font-medium">Test & go live</h2>
        <div className="space-y-3">
          <div className="rounded-lg border p-4" id="test-incoming">
            <h3 className="text-sm font-semibold">Incoming Routing Test</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Call your public business number from another phone after forwarding to{" "}
              {routingE164 ? fmtPhoneDisplay(routingE164) : "your Routing Number"}. Verify the
              customer menu plays and the original caller is preserved on destination phones.
            </p>
            {data?.recentInbound ? (
              <p className="mt-2 flex items-center gap-1 text-sm text-emerald-700">
                <Check className="h-4 w-4" />
                Recent call detected ({new Date(data.recentInbound.at).toLocaleString()})
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No incoming calls detected yet.</p>
            )}
            {activeFlow ? (
              <Link
                href={`/smart-routing/${activeFlow.id}/test`}
                className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Open flow test page →
              </Link>
            ) : null}
          </div>

          <div className="rounded-lg border p-4" id="test-callback">
            <h3 className="text-sm font-semibold">Business Callback Test</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>
                Call{" "}
                {callbackE164
                  ? fmtPhoneDisplay(callbackE164)
                  : "your Business Callback Number"}{" "}
                from an authorized phone.
              </li>
              <li>Enter your PIN.</li>
              <li>Press 4 and enter a test phone number.</li>
              <li>Confirm the destination sees your verified business number.</li>
            </ol>
            {data?.recentOutbound ? (
              <p className="mt-2 flex items-center gap-1 text-sm text-emerald-700">
                <Check className="h-4 w-4" />
                Recent callback to {fmtPhoneDisplay(data.recentOutbound.destination)}
              </p>
            ) : callbackTestConfirmed ? (
              <p className="mt-2 text-sm text-emerald-700">Test marked complete.</p>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setCallbackTestConfirmed(true)}
              >
                I completed the test
              </Button>
            )}
          </div>
        </div>

        {data?.readiness?.ready ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Smart Routing is ready. Publish and monitor activity from the overview.
          </div>
        ) : null}
        <Link href="/smart-routing" className="text-sm font-semibold text-primary hover:underline">
          Back to Smart Routing overview →
        </Link>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
