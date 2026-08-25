"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type Destination = { id: string; label: string };

export function RouteOverrideControl({
  destinations,
  onUpdated,
}: {
  destinations: Destination[];
  onUpdated?: () => void;
}) {
  const [destinationId, setDestinationId] = useState("");
  const [duration, setDuration] = useState<"1h" | "4h" | "tomorrow">("4h");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<{ destinationId?: string; until?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/smart-routing/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const override = j.data?.routeOverride as { destinationId?: string; expiresAt?: string } | null;
        if (override?.destinationId && override.expiresAt && new Date(override.expiresAt) > new Date()) {
          setActive({ destinationId: override.destinationId, until: override.expiresAt });
        }
      });
  }, []);

  async function apply() {
    if (!destinationId) return;
    setLoading(true);
    setError(null);
    try {
      let until = new Date();
      if (duration === "1h") until = new Date(Date.now() + 60 * 60 * 1000);
      else if (duration === "4h") until = new Date(Date.now() + 4 * 60 * 60 * 1000);
      else {
        until = new Date();
        until.setDate(until.getDate() + 1);
        until.setHours(8, 0, 0, 0);
      }
      const res = await fetch("/api/smart-routing/destinations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "route_override",
          destinationId,
          until: until.toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not apply route override");
        return;
      }
      setActive({ destinationId, until: until.toISOString() });
      onUpdated?.();
    } finally {
      setLoading(false);
    }
  }

  async function clear() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/smart-routing/destinations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_route_override" }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Could not clear route override");
        return;
      }
      setActive(null);
      onUpdated?.();
    } finally {
      setLoading(false);
    }
  }

  if (active?.until) {
    const label = destinations.find((d) => d.id === active.destinationId)?.label ?? "destination";
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm">
        <p className="font-semibold text-indigo-900">
          Temporary route: all calls → {label}
        </p>
        <p className="text-xs text-indigo-800">
          Until {new Date(active.until).toLocaleString()}
        </p>
        <Button size="sm" variant="outline" className="mt-2" disabled={loading} onClick={() => void clear()}>
          Clear override
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Temporary route override</h3>
        <p className="text-xs text-muted-foreground">
          Send all inbound calls to one person temporarily — on-call rotation, outage, or staff shortage.
        </p>
      </div>
      <select
        className="h-10 w-full rounded-lg border px-3 text-sm"
        value={destinationId}
        onChange={(e) => setDestinationId(e.target.value)}
      >
        <option value="">Choose destination…</option>
        {destinations.map((d) => (
          <option key={d.id} value={d.id}>{d.label}</option>
        ))}
      </select>
      <select
        className="h-9 rounded-lg border px-2 text-xs"
        value={duration}
        onChange={(e) => setDuration(e.target.value as typeof duration)}
      >
        <option value="1h">For 1 hour</option>
        <option value="4h">For 4 hours</option>
        <option value="tomorrow">Until tomorrow 8 AM</option>
      </select>
      <Button size="sm" disabled={loading || !destinationId} onClick={() => void apply()}>
        Apply temporary route
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
