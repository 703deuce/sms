"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AvailabilityState = {
  availabilityStatus?: string;
  unavailableUntil?: string | null;
  label?: string;
};

export function PauseCallsControl({ className }: { className?: string }) {
  const [state, setState] = useState<AvailabilityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-routing/availability", { cache: "no-store" });
      const json = await res.json();
      setState(res.ok ? (json.data as AvailabilityState) : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pause(preset: "manual" | "1h" | "tomorrow") {
    setBusy(true);
    try {
      const res = await fetch("/api/smart-routing/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", preset }),
      });
      if (!res.ok) return;
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    setBusy(true);
    try {
      const res = await fetch("/api/smart-routing/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      if (!res.ok) return;
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading availability…</p>;
  }

  if (!state) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Link your user to a destination in People & Destinations to pause calls to your phone.
      </p>
    );
  }

  const paused =
    state.availabilityStatus === "unavailable" &&
    (!state.unavailableUntil || new Date(state.unavailableUntil) > new Date());

  return (
    <div
      className={cn(
        "rounded-xl border border-[#e5e7eb] bg-white p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">Pause calls to me</h3>
          <p className="mt-1 text-xs text-[#6b7280]">
            {state.label ? `Routing destination: ${state.label}` : "Your routing destination"}
            {paused && state.unavailableUntil
              ? ` · until ${new Date(state.unavailableUntil).toLocaleString()}`
              : null}
          </p>
        </div>
        {paused ? (
          <Button size="sm" disabled={busy} onClick={() => void resume()}>
            <Play className="mr-1 h-3.5 w-3.5" />
            Resume calls
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void pause("1h")}>
              <Pause className="mr-1 h-3.5 w-3.5" />
              1 hour
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void pause("tomorrow")}>
              Until tomorrow
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void pause("manual")}>
              Pause until I turn back on
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
