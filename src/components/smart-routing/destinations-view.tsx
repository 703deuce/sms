"use client";

import { DestinationsPanel } from "@/components/smart-routing/destinations-panel";
import { SrPageShell } from "@/components/smart-routing/shared";
import { useCallback, useEffect, useState } from "react";

type Destination = {
  id: string;
  label: string;
  phoneNumber: string | null;
  active: boolean;
  destinationType: string;
};

export function SmartRoutingDestinationsView() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-routing/setup", { cache: "no-store" });
      const json = await res.json();
      setDestinations(json.data?.destinations ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SrPageShell
      title="People & Destinations"
      description="Manage employee phones, office lines, and ring groups. Call flows reference these destinations — update a number here instead of reopening the flow editor."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading destinations…</p>
      ) : (
        <div className="rounded-xl border bg-white p-5">
          <DestinationsPanel destinations={destinations} onUpdated={load} />
        </div>
      )}
    </SrPageShell>
  );
}
