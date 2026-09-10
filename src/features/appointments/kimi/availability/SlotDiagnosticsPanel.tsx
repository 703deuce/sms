"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { SlotDiagnosticsPanelProps } from "@/features/appointments/kimi/availability/slot-diagnostics-types";

type BookingType = { id: string; name: string };

const REASON_LABELS: Record<string, string> = {
  past_notice_window: "Minimum booking notice not met",
  outside_weekly_hours: "Outside business hours",
  date_closed: "This date is closed",
  blackout_date: "Blackout date",
  booking_limit_daily: "Daily booking limit reached",
  booking_limit_weekly: "Weekly booking limit reached",
  booking_limit_monthly: "Monthly booking limit reached",
  booking_limit_type_daily: "Daily limit for this booking type reached",
  external_calendar_busy: "Blocked by connected calendar",
  staff_unavailable: "Selected staff member unavailable",
  collective_unavailable: "Not all required staff are available",
  capacity_full: "At capacity",
  existing_appointment: "Another appointment occupies this time",
  weekend_closed: "Weekends are not bookable",
  off_hours: "Outside allowed booking hours",
  invalid_start_interval: "Not on the allowed start-time grid",
};

function defaultDatetimeLocal(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function SlotDiagnosticsPanel({
  context,
  staffOptions = [],
  variant = "page",
  onOpenFullPage,
}: SlotDiagnosticsPanelProps) {
  const [types, setTypes] = useState<BookingType[]>([]);
  const [serviceName, setServiceName] = useState(context?.serviceName || "");
  const [startsAt, setStartsAt] = useState(context?.startsAt || defaultDatetimeLocal());
  const [staffId, setStaffId] = useState(context?.staffId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    available: boolean;
    reasons: string[];
    startsAt: string;
    endsAt: string;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/appointments/types")
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.data || []) as BookingType[];
        setTypes(rows);
        if (context?.serviceName) {
          setServiceName(context.serviceName);
        } else if (rows[0]?.name) {
          setServiceName(rows[0].name);
        }
      })
      .catch(() => setTypes([]));
  }, [context?.serviceName]);

  useEffect(() => {
    if (context?.startsAt) setStartsAt(context.startsAt);
    if (context?.staffId) setStaffId(context.staffId);
  }, [context?.startsAt, context?.staffId]);

  const check = useCallback(async () => {
    if (!serviceName || !startsAt) {
      setError("Select a booking type and date/time.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ serviceName, startsAt });
      if (staffId.trim()) params.set("staffId", staffId.trim());
      const res = await fetch(`/api/appointments/diagnostics/slots?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not check slot");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }, [serviceName, startsAt, staffId]);

  const wrapperClass =
    variant === "page" ? "avail-card p-6 space-y-4" : "space-y-4";

  return (
    <section className={wrapperClass} aria-labelledby="slot-diagnostics-heading">
      <div>
        <h2 id="slot-diagnostics-heading" className="text-[15px] font-bold text-[#1a1830]">
          Diagnose availability
        </h2>
        <p className="text-[12px] text-[#8a87a0] mt-1">
          See why a specific time is or is not offered to customers. Uses the same rules as public
          booking.
        </p>
        {variant === "drawer" && onOpenFullPage ? (
          <button
            type="button"
            className="mt-2 text-[12px] font-medium text-[#5b4bff] hover:underline"
            onClick={onOpenFullPage}
          >
            Open full diagnostics page →
          </button>
        ) : null}
        {variant === "drawer" && !onOpenFullPage ? (
          <Link
            href="/appointments/availability"
            className="mt-2 inline-block text-[12px] font-medium text-[#5b4bff] hover:underline"
          >
            Open full diagnostics page →
          </Link>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">Booking type</span>
          <select
            className="input"
            value={serviceName}
            disabled={Boolean(context?.lockServiceName)}
            onChange={(e) => setServiceName(e.target.value)}
          >
            {types.length === 0 && serviceName ? (
              <option value={serviceName}>{serviceName}</option>
            ) : types.length === 0 ? (
              <option value="">No booking types</option>
            ) : (
              types.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">Date and time</span>
          <input
            type="datetime-local"
            className="input"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] sm:col-span-2">
          <span className="font-medium">Staff member (optional)</span>
          {staffOptions.length > 0 ? (
            <select className="input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Any eligible staff</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.name}</option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="Only if checking a specific staff member"
            />
          )}
        </label>
      </div>
      <Button type="button" size="sm" disabled={loading} onClick={() => void check()}>
        {loading ? "Checking…" : "Check slot"}
      </Button>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      {result ? (
        <div className="rounded-lg border bg-[#faf9fc] p-4 space-y-3" aria-live="polite">
          <p className="text-sm font-semibold">
            {result.available ? "Available" : "Unavailable"}
            {" — "}
            {new Date(result.startsAt).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          {result.available ? (
            <p className="text-sm text-green-800">This time passes all current scheduling rules.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm text-[#1a1830] space-y-1">
              {result.reasons.map((r) => (
                <li key={r}>{REASON_LABELS[r] || r}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
