"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCapacityLabel } from "@/components/appointments/public-capacity-display";

type EventOccurrence = {
  id: string;
  seriesId: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  enrolled: number;
  remaining: number;
  instructor?: string | null;
  location?: string | null;
  priceCents?: number | null;
  capacityDisplay: string;
  waitlistEnabled: boolean;
};

function formatWhen(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  return `${date} · ${time}`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function PublicEventsEnrollmentClient({
  slug,
  businessName,
}: {
  slug: string;
  businessName: string;
}) {
  const [events, setEvents] = useState<EventOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/book/${slug}/events`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load events");
      setEvents(json.data?.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function register(occurrenceId: string, waitlist = false) {
    if (!firstName.trim() || !phone.trim()) {
      setError("First name and phone are required.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/book/${slug}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceId,
          firstName,
          lastName,
          phone,
          email: email || undefined,
          partySize,
          waitlist,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      setMessage(
        waitlist
          ? "You're on the waitlist. We'll notify you if a spot opens."
          : "You're registered. We'll send a confirmation if messaging is enabled.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Events &amp; workshops</h1>
        <p className="mt-1 text-sm text-muted-foreground">{businessName}</p>
      </header>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Your details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted-foreground">First name *</span>
            <input className="mt-1 h-9 w-full rounded-md border px-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Last name</span>
            <input className="mt-1 h-9 w-full rounded-md border px-2" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Phone *</span>
            <input className="mt-1 h-9 w-full rounded-md border px-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Email</span>
            <input type="email" className="mt-1 h-9 w-full rounded-md border px-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-muted-foreground">How many people?</span>
          <div className="mt-1 flex items-center gap-2">
            <button type="button" className="h-8 w-8 rounded border" onClick={() => setPartySize((n) => Math.max(1, n - 1))} aria-label="Decrease party size">−</button>
            <span className="min-w-[2rem] text-center font-medium">{partySize}</span>
            <button type="button" className="h-8 w-8 rounded border" onClick={() => setPartySize((n) => n + 1)} aria-label="Increase party size">+</button>
          </div>
        </label>
      </section>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming events.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {events.map((ev) => {
            const full = ev.remaining <= 0;
            const capacityLabel = formatCapacityLabel(ev.capacityDisplay, ev.remaining, ev.capacity, full);
            return (
              <li key={ev.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{ev.title}</p>
                    {ev.description ? <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{ev.description}</p> : null}
                    <p className="mt-1 text-sm text-muted-foreground">{formatWhen(ev.startsAt, ev.endsAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {[ev.instructor, ev.location].filter(Boolean).join(" · ")}
                      {ev.priceCents ? ` · ${formatMoney(ev.priceCents)}` : ""}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">{capacityLabel}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!full ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        onClick={() => void register(ev.id)}
                      >
                        Register
                      </button>
                    ) : ev.waitlistEnabled ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                        onClick={() => void register(ev.id, true)}
                      >
                        Join waitlist
                      </button>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">Sold out</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
