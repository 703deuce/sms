"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";

type Caller = { id: string; name: string; phoneE164: string; active: boolean };
type PhoneOption = { id: string; e164: string; friendlyName?: string | null };

export function CallForwardingOutboundView() {
  const [controlNumber, setControlNumber] = useState<string | null>(null);
  const [controlPhoneNumberId, setControlPhoneNumberId] = useState<string | null>(null);
  const [smsOutboundEnabled, setSmsOutboundEnabled] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneOption[]>([]);
  const [callers, setCallers] = useState<Caller[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [savingSms, setSavingSms] = useState(false);

  useEffect(() => {
    fetch("/api/call-forwarding/setup")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data;
        setControlNumber(data?.settings?.controlNumberE164 ?? null);
        setControlPhoneNumberId(data?.settings?.controlPhoneNumberId ?? null);
        setSmsOutboundEnabled(Boolean(data?.settings?.smsOutboundEnabled));
        setPhoneNumbers(
          (data?.phoneNumbers ?? []).map((p: PhoneOption) => ({
            id: p.id,
            e164: p.e164,
            friendlyName: p.friendlyName,
          })),
        );
      });
    fetch("/api/call-forwarding/authorized-callers")
      .then((r) => r.json())
      .then((json) => setCallers(json.data ?? []));
  }, []);

  async function addCaller() {
    const res = await fetch("/api/call-forwarding/authorized-callers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phoneE164: phone }),
    });
    const json = await res.json();
    if (res.ok) {
      setCallers((prev) => [...prev, json.data]);
      setName("");
      setPhone("");
      setMessage("Authorized employee added.");
    }
  }

  async function removeCaller(id: string) {
    const res = await fetch("/api/call-forwarding/authorized-callers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setCallers((prev) => prev.filter((c) => c.id !== id));
      setMessage("Removed authorized employee.");
    }
  }

  async function saveSmsSettings() {
    setSavingSms(true);
    setMessage("");
    try {
      const res = await fetch("/api/call-forwarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smsOutboundEnabled,
          controlPhoneNumberId: controlPhoneNumberId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setControlNumber(json.data?.settings?.controlNumberE164 ?? controlNumber);
      setMessage("SMS outbound settings saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingSms(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>No-app outbound calling</CardTitle>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Save your Transovo control number:{" "}
            {controlNumber ? fmtPhoneDisplay(controlNumber) : "assign below"}
          </li>
          <li>Text it the customer number you want to call (e.g. 7035551212)</li>
          <li>Answer when Transovo calls you</li>
          <li>Press 1 to connect — customer sees your business caller ID</li>
        </ol>
      </Card>

      <Card>
        <CardTitle>SMS outbound settings</CardTitle>
        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={smsOutboundEnabled}
              onChange={(e) => setSmsOutboundEnabled(e.target.checked)}
            />
            Enable text-to-call for authorized employees
          </label>
          <div>
            <Label>Control number (receives employee SMS commands)</Label>
            <select
              className="mt-1 flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
              value={controlPhoneNumberId ?? ""}
              onChange={(e) => setControlPhoneNumberId(e.target.value || null)}
            >
              <option value="">Select a number</option>
              {phoneNumbers.map((pn) => (
                <option key={pn.id} value={pn.id}>
                  {pn.friendlyName ? `${pn.friendlyName} — ` : ""}
                  {fmtPhoneDisplay(pn.e164)}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={saveSmsSettings} disabled={savingSms}>
            {savingSms ? "Saving…" : "Save SMS settings"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Authorized employees</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {callers.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span>{c.name} — {fmtPhoneDisplay(c.phoneE164)}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeCaller(c.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" />
          </div>
          <div className="flex items-end">
            <Button onClick={addCaller}>Add</Button>
          </div>
        </div>
        {message ? <p className="mt-2 text-sm text-green-700">{message}</p> : null}
      </Card>
    </div>
  );
}
