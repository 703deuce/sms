"use client";

import { useEffect, useState } from "react";

export type NextAvailable = {
  state: "idle" | "loading" | "ready" | "none" | "error";
  label: string;
  startsAt?: string;
};

function formatSlot(startsAt: string): string {
  const date = new Date(startsAt);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
}

/**
 * Reads the first bookable slot from the scheduling runtime rather than
 * guessing from the form. The value therefore already reflects duration,
 * phases, buffers, start-time rules and resource capacity.
 *
 * `signature` is the set of saved values that change availability; the lookup
 * re-runs when it changes so the strip cannot report a stale slot.
 */
export function useNextAvailable(
  serviceId: string | null,
  serviceName: string,
  enabled: boolean,
  signature: string,
): NextAvailable {
  const [result, setResult] = useState<NextAvailable>({ state: "idle", label: "—" });

  useEffect(() => {
    if (!serviceId || !serviceName.trim()) {
      setResult({ state: "idle", label: "—" });
      return;
    }
    if (!enabled) {
      setResult({ state: "none", label: "Not bookable" });
      return;
    }
    let cancelled = false;
    setResult({ state: "loading", label: "Checking…" });
    const params = new URLSearchParams({
      serviceId,
      serviceName,
      daysAhead: "14",
    });
    fetch(`/api/appointments/availability?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((json: { data?: { slots?: Array<{ startsAt: string }> } }) => {
        if (cancelled) return;
        const slot = json.data?.slots?.[0];
        if (!slot) {
          setResult({ state: "none", label: "No slots in 14 days" });
          return;
        }
        setResult({ state: "ready", label: formatSlot(slot.startsAt), startsAt: slot.startsAt });
      })
      .catch(() => {
        if (!cancelled) setResult({ state: "error", label: "Unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, serviceId, serviceName, signature]);

  return result;
}
