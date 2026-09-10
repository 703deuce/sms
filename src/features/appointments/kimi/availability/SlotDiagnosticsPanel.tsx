"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BookingType = { id: string; name: string };
type StaffOption = { id: string; name: string };
type LocationOption = { id: string; name: string };

const REASON_LABELS: Record<string, string> = {
  past_notice_window: "Minimum notice — this booking requires more advance notice",
  outside_weekly_hours: "Outside business hours",
  date_closed: "This date is closed",
  blackout_date: "Blackout date",
  booking_limit_daily: "Maximum appointments per day reached",
  booking_limit_weekly: "Maximum appointments per week reached",
  booking_limit_monthly: "Maximum appointments per month reached",
  booking_limit_type_daily: "Daily limit for this booking type reached",
  external_calendar_busy: "External calendar conflict — blocking event on connected calendar",
  staff_unavailable: "Selected staff member is already booked",
  collective_unavailable: "Not all required staff are available",
  capacity_full: "At capacity for this time",
  existing_appointment: "Another appointment occupies this time",
  weekend_closed: "Weekends are not bookable for this service",
  off_hours: "Outside allowed booking hours",
  invalid_start_interval: "Start-time rule — not on the allowed start-time grid",
  resource_unavailable: "Required room or equipment is unavailable",
};

export function SlotDiagnosticsPanel() {
  const [types, setTypes] = useState<BookingType[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [serviceName, setServiceName] = useState("");
  const [datePart, setDatePart] = useState("");
  const [timePart, setTimePart] = useState("");
  const [staffId, setStaffId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllReasons, setShowAllReasons] = useState(false);
  const [result, setResult] = useState<{
    available: boolean;
    reasons: string[];
    startsAt: string;
    endsAt: string;
  } | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/appointments/types").then((r) => r.json()),
      fetch("/api/appointments/staff").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/appointments/locations").then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([typesJson, staffJson, locJson]) => {
      const rows = (typesJson.data || []) as BookingType[];
      setTypes(rows);
      if (rows[0]?.name) setServiceName(rows[0].name);
      setStaff((staffJson.data || staffJson.staff || []) as StaffOption[]);
      setLocations((locJson.data || locJson.locations || []) as LocationOption[]);
    });
  }, []);

  const startsAt = datePart && timePart ? `${datePart}T${timePart}` : "";

  const check = useCallback(async () => {
    if (!serviceName || !startsAt) {
      setError("Select a booking type, date, and time.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setShowAllReasons(false);
    try {
      const params = new URLSearchParams({ serviceName, startsAt });
      if (staffId) params.set("staffId", staffId);
      if (locationId) params.set("locationId", locationId);
      const res = await fetch(`/api/appointments/diagnostics/slots?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not check slot");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }, [serviceName, startsAt, staffId, locationId]);

  const visibleReasons = result
    ? showAllReasons ? result.reasons : result.reasons.slice(0, 1)
    : [];

  return (
    <section className="avail-card p-6 space-y-4" aria-labelledby="slot-diagnostics-heading">
      <div>
        <h2 id="slot-diagnostics-heading" className="text-[15px] font-bold text-[#1a1830]">
          Check availability
        </h2>
        <p className="text-[12px] text-[#8a87a0] mt-1">
          Find out why a specific time is or isn&apos;t bookable.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">Booking type</span>
          <select className="input" value={serviceName} onChange={(e) => setServiceName(e.target.value)}>
            {types.length === 0 ? (
              <option value="">No booking types</option>
            ) : (
              types.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">Date</span>
          <input type="date" className="input" value={datePart} onChange={(e) => setDatePart(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">Time</span>
          <input type="time" className="input" value={timePart} onChange={(e) => setTimePart(e.target.value)} />
        </label>
        {staff.length > 0 ? (
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-medium">Staff (optional)</span>
            <select className="input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Any staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {locations.length > 0 ? (
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-medium">Location (optional)</span>
            <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Any location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <Button type="button" size="sm" disabled={loading} onClick={() => void check()}>
        {loading ? "Checking…" : "Check a time"}
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {result ? (
        <div className="rounded-lg border bg-[#faf9fc] p-4 space-y-3">
          <p className={`text-lg font-bold ${result.available ? "text-green-800" : "text-[#1a1830]"}`}>
            {result.available ? "Available" : "Unavailable"}
          </p>
          <p className="text-sm text-[#4a4763]">
            {result.available
              ? `This service can be booked at ${new Date(result.startsAt).toLocaleString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}.`
              : `This time is not bookable.`}
          </p>
          {!result.available && result.reasons.length > 0 ? (
            <div className="space-y-2">
              {visibleReasons.map((r) => (
                <div key={r} className="rounded-md border border-[#eceaf3] bg-white px-3 py-2 text-sm text-[#1a1830]">
                  {REASON_LABELS[r] || r}
                </div>
              ))}
              {result.reasons.length > 1 ? (
                <button
                  type="button"
                  className="text-[12px] font-medium text-[#5b4bff] hover:underline"
                  onClick={() => setShowAllReasons((v) => !v)}
                >
                  {showAllReasons ? "Show primary reason only" : `View all conflicts (${result.reasons.length})`}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
