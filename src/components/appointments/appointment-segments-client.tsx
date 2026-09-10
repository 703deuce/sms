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

export function AppointmentSegmentsClient() {
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
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Appointment segments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recall and appointment-derived targeting presets. For reusable customer segments, use{" "}
          <Link href="/contacts/segments" className="text-primary underline">Contacts → Segments</Link>.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
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
              placeholder="e.g. Initial consult"
            />
          </label>
        ) : null}
        <button type="button" className="h-9 rounded-md border px-3 text-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <p className="text-sm text-muted-foreground">{contacts.length} contact{contacts.length === 1 ? "" : "s"}</p>
      )}

      <ul className="divide-y rounded-lg border">
        {contacts.length === 0 && !loading ? (
          <li className="p-4 text-sm text-muted-foreground">No contacts match this segment.</li>
        ) : (
          contacts.map((c) => {
            const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || "Contact";
            return (
              <li key={c.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                <div>
                  <Link href={`/contacts/${c.id}`} className="font-medium text-primary underline">
                    {name}
                  </Link>
                  <p className="text-muted-foreground">{c.email || c.phone}</p>
                </div>
                <Link href={`/conversations?contact=${c.id}`} className="text-primary underline">
                  Message
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
