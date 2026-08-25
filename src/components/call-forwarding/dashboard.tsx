"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";

type SetupData = {
  entitled: boolean;
  active: boolean;
  assignedNumber?: { id: string; e164: string } | null;
  callSettings?: {
    forwardTargets: string[];
    callScreeningEnabled: boolean;
    forwardRingSeconds: number;
  } | null;
  settings?: {
    controlNumberE164: string | null;
    smsOutboundEnabled: boolean;
  } | null;
  phoneNumbers: Array<{ id: string; e164: string; friendlyName: string | null }>;
  usage: { minutesUsed: number; includedMinutes: number };
  readiness: { hasNumber: boolean; hasDestination: boolean; active: boolean };
  recentInbound: Array<{ id: string; from: string; status: string; startedAt: string }>;
  recentOutbound: Array<{ id: string; destinationE164: string; result: string | null; createdAt: string }>;
};

export function CallForwardingDashboard() {
  const [data, setData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [destination, setDestination] = useState("");
  const [callScreening, setCallScreening] = useState(false);
  const [ringSeconds, setRingSeconds] = useState(25);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/call-forwarding/setup")
      .then((r) => r.json())
      .then((json) => {
        const d = json.data as SetupData;
        setData(d);
        if (d?.assignedNumber?.id) setPhoneNumberId(d.assignedNumber.id);
        if (d?.callSettings?.forwardTargets?.[0]) setDestination(d.callSettings.forwardTargets[0]);
        if (d?.callSettings) {
          setCallScreening(d.callSettings.callScreeningEnabled);
          setRingSeconds(d.callSettings.forwardRingSeconds);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/call-forwarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumberId: phoneNumberId || undefined,
          destination,
          callScreeningEnabled: callScreening,
          forwardRingSeconds: ringSeconds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setData(json.data);
      setMessage("Forwarding settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {!data?.entitled ? (
        <Card>
          <CardTitle>Subscribe to Call Forwarding</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Get a business number that rings your existing phone. $29.99/month — unlimited normal-business calling.
          </p>
          <Link href="/settings/billing?upgrade=call_forwarding" className="mt-4 inline-block">
            <Button>View plans</Button>
          </Link>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Status</CardTitle>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Business number</dt>
            <dd className="font-medium">
              {data?.assignedNumber?.e164 ? fmtPhoneDisplay(data.assignedNumber.e164) : "Not assigned"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Forwarding</dt>
            <dd className="font-medium">{data?.active ? "Active" : "Not active"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Destination</dt>
            <dd className="font-medium">
              {data?.callSettings?.forwardTargets?.[0]
                ? fmtPhoneDisplay(data.callSettings.forwardTargets[0])
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Usage this period</dt>
            <dd className="font-medium">
              {data?.usage.minutesUsed ?? 0} min (fair-use tracking)
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardTitle>Forwarding setup</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cfNumber">Business number</Label>
            <Select
              id="cfNumber"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            >
              <option value="">Select number</option>
              {data?.phoneNumbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {fmtPhoneDisplay(n.e164)}
                </option>
              ))}
            </Select>
            <Link href="/voice/numbers/buy" className="mt-1 text-xs text-primary hover:underline">
              Buy a number
            </Link>
          </div>
          <div>
            <Label htmlFor="cfDest">Forward to</Label>
            <Input
              id="cfDest"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="+1 703 555 1212"
            />
          </div>
          <div>
            <Label htmlFor="cfRing">Ring duration (seconds)</Label>
            <Input
              id="cfRing"
              type="number"
              min={15}
              max={45}
              value={ringSeconds}
              onChange={(e) => setRingSeconds(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end gap-2">
            <input
              id="cfScreen"
              type="checkbox"
              checked={callScreening}
              onChange={(e) => setCallScreening(e.target.checked)}
            />
            <Label htmlFor="cfScreen">Require Press 1 to accept (personal voicemail protection)</Label>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save & enable"}</Button>
          <Link href="/call-forwarding/hours">
            <Button variant="outline">Business hours</Button>
          </Link>
          <Link href="/call-forwarding/outbound">
            <Button variant="outline">Outbound calling</Button>
          </Link>
        </div>
        {message ? <p className="mt-2 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </Card>

      <Card>
        <CardTitle>Recent calls</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {data?.recentInbound?.map((c) => (
            <li key={c.id}>
              Inbound from {fmtPhoneDisplay(c.from)} — {c.status}
            </li>
          ))}
          {data?.recentOutbound?.map((c) => (
            <li key={c.id}>
              Outbound to {fmtPhoneDisplay(c.destinationE164)} — {c.result ?? "pending"}
            </li>
          ))}
          {!data?.recentInbound?.length && !data?.recentOutbound?.length ? (
            <li className="text-muted-foreground">No recent activity yet.</li>
          ) : null}
        </ul>
        <Link href="/voice/voicemail" className="mt-3 text-sm text-primary hover:underline">
          Voicemail →
        </Link>
      </Card>
    </div>
  );
}
