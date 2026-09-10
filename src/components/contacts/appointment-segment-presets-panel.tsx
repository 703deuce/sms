"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const PRESETS = [
  { id: "booked_tomorrow", label: "Booked tomorrow" },
  { id: "membership_customers", label: "Membership customers" },
  { id: "low_credits", label: "Low package credits" },
  { id: "inactive_60_days", label: "Inactive 60+ days" },
  { id: "booking_type", label: "By booking type" },
] as const;

type ContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

export function AppointmentSegmentPresetsPanel() {
  const [preset, setPreset] = useState<string>(PRESETS[0].id);
  const [bookingTypeName, setBookingTypeName] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ preset });
      if (preset === "booking_type" && bookingTypeName.trim()) {
        params.set("bookingTypeName", bookingTypeName.trim());
      }
      const res = await fetch(`/api/appointments/service-booking/appointment-segments?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load segment");
      setContacts(json.data?.contacts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [preset, bookingTypeName]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mx-6 mb-6 rounded-xl border border-border bg-card p-4" aria-labelledby="appt-segment-presets-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="appt-segment-presets-title" className="text-sm font-semibold text-foreground">
            Appointment-derived presets
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quick customer lists from appointment history. Save reusable rules in{" "}
            <Link href="/contacts/segments" className="text-primary underline">Segments</Link>.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-muted-foreground">Preset</span>
          <select
            className="mt-1 block h-9 rounded-md border px-2"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        {preset === "booking_type" ? (
          <label className="text-sm">
            <span className="text-muted-foreground">Booking type name</span>
            <input
              className="mt-1 block h-9 rounded-md border px-2"
              value={bookingTypeName}
              onChange={(e) => setBookingTypeName(e.target.value)}
            />
          </label>
        ) : null}
        <button
          type="button"
          className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">{contacts.length.toLocaleString()} matching contacts</p>
      {contacts.length > 0 ? (
        <ul className="mt-2 max-h-40 overflow-y-auto text-sm">
          {contacts.slice(0, 8).map((c) => (
            <li key={c.id}>
              <Link href={`/contacts/${c.id}`} className="text-primary hover:underline">
                {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || c.email || c.id}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
