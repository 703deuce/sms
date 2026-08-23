"use client";

import { Button } from "@/components/ui/button";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { toSmartRoutingCustomerError } from "@/lib/smart-routing/customer-errors";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

type AuthorizedCaller = {
  id: string;
  name: string;
  phoneE164: string;
  active: boolean;
  outboundEnabled: boolean;
};

export function AuthorizedCallersPanel({
  callers,
  onUpdated,
}: {
  callers: AuthorizedCaller[];
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState("");

  async function add() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/smart-routing/authorized-callers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name, phoneE164: phone, pin }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(toSmartRoutingCustomerError(json.error || "Could not add caller"));
        return;
      }
      setName("");
      setPhone("");
      setPin("");
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  async function update(id: string, patch: { active?: boolean }) {
    await fetch("/api/smart-routing/authorized-callers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, ...patch }),
    });
    onUpdated();
  }

  async function remove(id: string) {
    await fetch(`/api/smart-routing/authorized-callers?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    onUpdated();
  }

  async function doResetPin(id: string) {
    if (!resetPin) return;
    setLoading(true);
    try {
      const res = await fetch("/api/smart-routing/authorized-callers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_pin", id, pin: resetPin }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(toSmartRoutingCustomerError(json.error || "Reset failed"));
        return;
      }
      setResetId(null);
      setResetPin("");
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  const activeCount = callers.filter((c) => c.active && c.outboundEnabled).length;

  return (
    <div className="space-y-4" id="business-callback">
      <div>
        <h2 className="font-medium">Authorized callback users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Team members enter a PIN when calling your Routing Number to place a business callback.
          PINs are never shown after creation.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{activeCount} active</p>
      </div>

      {callers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Add someone who can return calls from your business number.
        </p>
      ) : (
        <ul className="space-y-2">
          {callers.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground">{fmtPhoneDisplay(c.phoneE164)}</p>
                <p className="text-xs text-muted-foreground">
                  Outbound calling: {c.outboundEnabled && c.active ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {resetId === c.id ? (
                  <>
                    <input
                      className="h-8 w-24 rounded border px-2 text-xs"
                      placeholder="New PIN"
                      value={resetPin}
                      onChange={(e) => setResetPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <Button size="sm" variant="outline" onClick={() => void doResetPin(c.id)}>
                      Save PIN
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setResetId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setResetId(c.id)}>
                      Reset PIN
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void update(c.id, { active: !c.active })}
                    >
                      {c.active ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className="h-10 rounded-lg border px-3 text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="h-10 rounded-lg border px-3 text-sm"
          placeholder="Mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="h-10 rounded-lg border px-3 text-sm"
          placeholder="PIN (4–6 digits)"
          value={pin}
          maxLength={6}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <Button variant="outline" disabled={loading} onClick={() => void add()}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Add authorized caller
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
