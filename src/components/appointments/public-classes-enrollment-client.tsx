"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCapacityLabel } from "@/components/appointments/public-capacity-display";

type ClassSeries = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  capacityDisplay?: string;
};
type ClassOccurrence = {
  id: string;
  seriesId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  enrolled: number;
  remaining: number;
  instructor?: string | null;
  location?: string | null;
  priceCents?: number | null;
  capacityDisplay?: string;
  waitlistEnabled?: boolean;
  seatMapId?: string | null;
  seatMapName?: string | null;
  requiresSeatSelection?: boolean;
};

type SeatCell = {
  rowIndex: number;
  colIndex: number;
  label: string;
  status: "available" | "reserved" | "blocked";
};

type SeatMapData = {
  id: string;
  name: string;
  rows: number;
  columns: number;
  seats: SeatCell[];
};

export function PublicClassesEnrollmentClient({
  slug,
  businessName,
}: {
  slug: string;
  businessName: string;
}) {
  const [series, setSeries] = useState<ClassSeries[]>([]);
  const [occurrences, setOccurrences] = useState<ClassOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [seatPickerOpen, setSeatPickerOpen] = useState(false);
  const [pendingOccurrence, setPendingOccurrence] = useState<ClassOccurrence | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMapData | null>(null);
  const [seatMapLoading, setSeatMapLoading] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<SeatCell | null>(null);
  const [partySize, setPartySize] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/book/${slug}/classes`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load classes");
      setSeries(json.data?.series || []);
      setOccurrences(json.data?.occurrences || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openSeatPicker(occ: ClassOccurrence) {
    if (!firstName.trim() || !phone.trim()) {
      setError("First name and phone are required before choosing a seat.");
      return;
    }
    setError(null);
    setPendingOccurrence(occ);
    setSelectedSeat(null);
    setSeatPickerOpen(true);
    setSeatMapLoading(true);
    try {
      const res = await fetch(
        `/api/public/book/${slug}/classes/seats?occurrenceId=${encodeURIComponent(occ.id)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load seat map");
      setSeatMap(json.data as SeatMapData | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seat map unavailable");
      setSeatPickerOpen(false);
      setPendingOccurrence(null);
    } finally {
      setSeatMapLoading(false);
    }
  }

  async function enroll(
    occurrenceId: string,
    seat?: { seatMapId: string; rowIndex: number; colIndex: number; seatLabel: string },
    waitlist = false,
  ) {
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
          seatMapId: seat?.seatMapId,
          rowIndex: seat?.rowIndex,
          colIndex: seat?.colIndex,
          seatLabel: seat?.seatLabel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Enrollment failed");
      const seatLabel = seat?.seatLabel ? ` Seat ${seat.seatLabel} reserved.` : "";
      setMessage(
        waitlist
          ? "You're on the waitlist. We'll notify you if a spot opens."
          : `You're registered.${seatLabel} We'll send a confirmation if messaging is enabled.`,
      );
      setSeatPickerOpen(false);
      setPendingOccurrence(null);
      setSelectedSeat(null);
      setSeatMap(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  function formatWhen(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatMoney(cents: number) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
  }

  const seriesMap = new Map(series.map((s) => [s.id, s]));

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Classes</h1>
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
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {seatPickerOpen && pendingOccurrence ? (
        <section className="rounded-lg border p-4 space-y-4" aria-label="Choose your seat">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Choose your seat</h2>
              <p className="text-xs text-muted-foreground">
                {seriesMap.get(pendingOccurrence.seriesId)?.name} · {formatWhen(pendingOccurrence.startsAt)}
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-muted-foreground underline"
              onClick={() => {
                setSeatPickerOpen(false);
                setPendingOccurrence(null);
                setSelectedSeat(null);
              }}
            >
              Cancel
            </button>
          </div>
          {seatMapLoading ? (
            <p className="text-sm text-muted-foreground">Loading seat map…</p>
          ) : !seatMap ? (
            <p className="text-sm text-muted-foreground">No seat map configured for this session.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{seatMap.name}</p>
              <div
                className="inline-grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${seatMap.columns}, minmax(2.5rem, 1fr))` }}
              >
                {seatMap.seats.map((seat) => {
                  const selected =
                    selectedSeat?.rowIndex === seat.rowIndex && selectedSeat?.colIndex === seat.colIndex;
                  const disabled = seat.status !== "available";
                  return (
                    <button
                      key={`${seat.rowIndex}-${seat.colIndex}`}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      title={seat.status}
                      className={`rounded border px-2 py-2 text-xs font-medium ${
                        disabled
                          ? "cursor-not-allowed border-muted bg-muted text-muted-foreground"
                          : selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary"
                      }`}
                      onClick={() => setSelectedSeat(seat)}
                    >
                      {seat.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={busy || !selectedSeat}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                onClick={() => {
                  if (!selectedSeat || !pendingOccurrence.seatMapId) return;
                  void enroll(pendingOccurrence.id, {
                    seatMapId: pendingOccurrence.seatMapId,
                    rowIndex: selectedSeat.rowIndex,
                    colIndex: selectedSeat.colIndex,
                    seatLabel: selectedSeat.label,
                  });
                }}
              >
                {busy ? "Enrolling…" : selectedSeat ? `Enroll in seat ${selectedSeat.label}` : "Select a seat"}
              </button>
            </>
          )}
        </section>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading upcoming classes…</p>
      ) : occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming class sessions.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {occurrences.map((occ) => {
            const s = seriesMap.get(occ.seriesId);
            const full = occ.remaining <= 0 || occ.remaining < partySize;
            const capacityLabel = formatCapacityLabel(
              occ.capacityDisplay || s?.capacityDisplay || "exact",
              occ.remaining,
              occ.capacity,
              full,
            );
            return (
              <li key={occ.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{s?.name || "Class"}</p>
                  <p className="text-sm text-muted-foreground">{formatWhen(occ.startsAt)}</p>
                  <p className="text-xs text-muted-foreground">
                    {[occ.instructor, occ.location].filter(Boolean).join(" · ")}
                    {occ.priceCents ? ` · ${formatMoney(occ.priceCents)}` : ""}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {capacityLabel}
                    {occ.requiresSeatSelection ? " · Seat selection required" : ""}
                  </p>
                </div>
                {!full ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                    onClick={() => {
                      if (occ.requiresSeatSelection && occ.seatMapId) {
                        void openSeatPicker(occ);
                        return;
                      }
                      void enroll(occ.id);
                    }}
                  >
                    {occ.requiresSeatSelection ? "Choose seat" : "Join"}
                  </button>
                ) : occ.waitlistEnabled ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                    onClick={() => void enroll(occ.id, undefined, true)}
                  >
                    Join waitlist
                  </button>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">Full</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
