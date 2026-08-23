"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

type ScheduleOverride = { mode?: string; expiresAt?: string } | null;

export function CloseNowControl({
  scheduleOverride,
  onUpdated,
  className,
}: {
  scheduleOverride: ScheduleOverride;
  onUpdated: () => void;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState<"1h" | "tomorrow" | "custom">("tomorrow");
  const active =
    scheduleOverride?.mode === "closed_now" &&
    scheduleOverride.expiresAt &&
    new Date(scheduleOverride.expiresAt) > new Date();

  async function activate() {
    setLoading(true);
    try {
      let until: Date;
      if (duration === "1h") {
        until = new Date(Date.now() + 60 * 60 * 1000);
      } else if (duration === "tomorrow") {
        until = new Date();
        until.setDate(until.getDate() + 1);
        until.setHours(8, 0, 0, 0);
      } else {
        until = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      await fetch("/api/smart-routing/destinations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close_now", until: until.toISOString() }),
      });
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  async function reopen() {
    setLoading(true);
    try {
      await fetch("/api/smart-routing/destinations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_override" }),
      });
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  if (active && scheduleOverride?.expiresAt) {
    const untilLabel = new Date(scheduleOverride.expiresAt).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3",
          className,
        )}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Temporary closure active</p>
            <p className="text-xs text-amber-800">Until {untilLabel}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void reopen()}>
          Reopen now
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-[#e5e7eb] bg-white p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">Close now</h3>
          <p className="mt-1 text-xs text-[#6b7280]">
            Temporarily route calls using your after-hours behavior without editing your permanent
            schedule.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-lg border border-[#e5e7eb] px-2 text-xs"
            value={duration}
            onChange={(e) => setDuration(e.target.value as typeof duration)}
          >
            <option value="tomorrow">Until tomorrow 8 AM</option>
            <option value="1h">For 1 hour</option>
          </select>
          <Button size="sm" disabled={loading} onClick={() => void activate()}>
            Close now
          </Button>
        </div>
      </div>
    </div>
  );
}
