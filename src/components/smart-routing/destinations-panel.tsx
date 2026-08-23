"use client";

import { Button } from "@/components/ui/button";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { toSmartRoutingCustomerError } from "@/lib/smart-routing/customer-errors";
import { Loader2 } from "lucide-react";
import { useState } from "react";

type Destination = {
  id: string;
  label: string;
  phoneNumber: string | null;
  active: boolean;
  destinationType: string;
};

export function DestinationsPanel({
  destinations,
  onUpdated,
}: {
  destinations: Destination[];
  onUpdated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/smart-routing/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, phoneNumber: phone, destinationType: "external_phone" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(toSmartRoutingCustomerError(json.error || "Could not add destination"));
        return;
      }
      setLabel("");
      setPhone("");
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    await fetch("/api/smart-routing/destinations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    onUpdated();
  }

  return (
    <div className="space-y-4" id="destinations">
      <div>
        <h2 className="font-medium">People & destinations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the phones your team already uses. They do not need to be paid phone-system users.
        </p>
      </div>

      {destinations.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Add team members or external phones to route calls to.
        </p>
      ) : (
        <ul className="space-y-2">
          {destinations.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{d.label}</p>
                <p className="text-muted-foreground">
                  {d.phoneNumber ? fmtPhoneDisplay(d.phoneNumber) : "No number"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void toggle(d.id, !d.active)}
              >
                {d.active ? "Disable" : "Enable"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="h-10 rounded-lg border px-3 text-sm"
          placeholder="Name or role (e.g. Service)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="h-10 rounded-lg border px-3 text-sm"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <Button variant="outline" disabled={loading} onClick={() => void add()}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Add destination
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
