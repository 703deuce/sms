"use client";

import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import type { PhoneNumber } from "@/lib/types";
import { useEffect, useState } from "react";

export function PhoneSettingsClient({
  phoneNumbers,
  initialCallerId,
}: {
  phoneNumbers: PhoneNumber[];
  initialCallerId?: string | null;
}) {
  const [callerId, setCallerId] = useState(initialCallerId || phoneNumbers[0]?.number || "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/phone/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.defaultCallerIdNumber) setCallerId(j.data.defaultCallerIdNumber);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/phone/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultCallerIdNumber: callerId || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Phone settings"
        description="Default outbound caller ID for human agent calls."
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      />
      <PhoneSubNav />
      <Card>
        <CardTitle>Caller ID</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Select which workspace number appears when agents place outbound calls.
        </p>
        <div className="mt-4 max-w-md">
          <Label htmlFor="defaultCallerId">Default caller ID number</Label>
          <select
            id="defaultCallerId"
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
        {saved ? <p className="mt-3 text-sm text-primary">Settings saved.</p> : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>
    </div>
  );
}
