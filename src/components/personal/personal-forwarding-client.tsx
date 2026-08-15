"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import type { PhoneNumber } from "@/lib/types";
import { formatPhone } from "@/lib/utils";
import { useEffect, useState } from "react";

type ForwardingRule = {
  id: string;
  phoneNumberId: string | null;
  targetValue: string;
  active: boolean;
  ringSeconds: number;
};

export function PersonalForwardingClient({
  numbers,
  initialNumberId,
}: {
  numbers: PhoneNumber[];
  initialNumberId?: string;
}) {
  const [rules, setRules] = useState<ForwardingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(initialNumberId || numbers[0]?.id || "");
  const [destination, setDestination] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/phone/forwarding")
      .then((r) => r.json())
      .then((j) => setRules(j.data || []))
      .finally(() => setLoading(false));
  }, []);

  const selected = numbers.find((n) => n.id === selectedId);

  useEffect(() => {
    if (selected?.voiceForwardTo) setDestination(selected.voiceForwardTo);
  }, [selected]);

  if (numbers.length === 0) {
    return (
      <EmptyState
        title="No numbers to forward"
        description="Choose a number and send its calls to any phone you already use."
        actionLabel="Get a Number"
        actionHref="/personal/numbers/premium"
      />
    );
  }

  async function save() {
    setMessage(null);
    try {
      await fetch("/api/phone/forwarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumberId: selectedId,
          targetType: "external",
          targetValue: destination,
          mode: "always",
          active: enabled,
          ringSeconds: 25,
        }),
      });
      await fetch(`/api/numbers/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceForwardTo: enabled ? destination : null }),
      });
      setMessage("Forwarding updated.");
    } catch {
      setMessage("Could not update forwarding.");
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Simple call forwarding — send incoming calls to your mobile or any phone.
      </p>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      <div className="surface max-w-lg space-y-4 rounded-xl p-5">
        <div>
          <Label>Your Transovo number</Label>
          <select
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {numbers.map((n) => (
              <option key={n.id} value={n.id}>{formatPhone(n.number)}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Forward to</Label>
          <Input
            className="mt-1"
            placeholder="+1 555 0100"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Forwarding enabled
        </label>
        <Button onClick={save}>Save forwarding</Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {rules.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {rules.length} forwarding rule(s) on this workspace.
        </p>
      ) : null}
    </div>
  );
}
