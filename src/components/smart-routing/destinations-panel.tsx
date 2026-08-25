"use client";

import { Button } from "@/components/ui/button";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { destinationAvailabilityLabel } from "@/lib/smart-routing/destination-availability";
import { toSmartRoutingCustomerError } from "@/lib/smart-routing/customer-errors";
import { Loader2 } from "lucide-react";
import { useState } from "react";

type Destination = {
  id: string;
  label: string;
  phoneNumber: string | null;
  active: boolean;
  destinationType: string;
  availabilityStatus?: string;
  unavailableUntil?: string | null;
  answerConfirmationEnabled?: boolean;
  assignedUserId?: string | null;
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

  async function patch(id: string, data: Record<string, unknown>) {
    const res = await fetch("/api/smart-routing/destinations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(toSmartRoutingCustomerError(json.error || "Could not update destination"));
      return;
    }
    setError("");
    onUpdated();
  }

  return (
    <div className="space-y-4" id="destinations">
      <div>
        <h2 className="font-medium">People & destinations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the phones your team already uses. Toggle Answer Confirmation when routing to personal
          cell phones so carrier voicemail does not steal business calls.
        </p>
      </div>

      {destinations.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Add team members or external phones to route calls to.
        </p>
      ) : (
        <ul className="space-y-3">
          {destinations.map((d) => {
            const statusLabel = destinationAvailabilityLabel(d);
            return (
              <li
                key={d.id}
                className="rounded-lg border px-3 py-3 text-sm space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{d.label}</p>
                    <p className="text-muted-foreground">
                      {d.phoneNumber ? fmtPhoneDisplay(d.phoneNumber) : "No number"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#4b5563]">{statusLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void patch(d.id, { active: !d.active })}
                    >
                      {d.active ? "Disable" : "Enable"}
                    </Button>
                    {d.active && statusLabel === "Available" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void patch(d.id, { pausePreset: "1h" })}
                      >
                        Pause 1h
                      </Button>
                    ) : null}
                    {statusLabel === "Temporarily unavailable" || statusLabel === "Unavailable" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void patch(d.id, { pausePreset: "manual", resume: true })}
                      >
                        Resume
                      </Button>
                    ) : null}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(d.answerConfirmationEnabled)}
                    onChange={(e) =>
                      void patch(d.id, { answerConfirmationEnabled: e.target.checked })
                    }
                  />
                  <span>
                    <strong>Answer Confirmation</strong> — require Press 1 to accept before connecting
                    the caller
                  </span>
                </label>
              </li>
            );
          })}
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
