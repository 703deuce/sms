"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CLASS_SERIES_OFFERING_UI,
  type ClassSeriesOfferingKind,
} from "@/lib/appointments/class-series-offering";

type ClassSeries = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  priceCents?: number;
  isFree?: boolean;
  showRemainingSpots?: boolean;
  waitlistEnabled?: boolean;
  confirmationMessage?: string | null;
  placeLabel?: string | null;
  registrationClosedReason?: string | null;
};
type ClassOccurrence = {
  id: string;
  seriesId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  enrolled: number;
  remaining: number;
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

export function PublicGroupEnrollmentClient({
  slug,
  businessName,
  offeringKind,
}: {
  slug: string;
  businessName: string;
  offeringKind: ClassSeriesOfferingKind;
}) {
  const copy = CLASS_SERIES_OFFERING_UI[offeringKind];
  const apiBase = `/api/public/book/${slug}/${copy.publicPathSuffix}`;
  const seatsApiBase = `/api/public/book/${slug}/classes/seats`;

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
  const [packagePrompt, setPackagePrompt] = useState<{
    occurrenceId: string;
    packages: Array<{ id: string; productName: string; creditsRemaining: number }>;
    seat?: { seatMapId: string; rowIndex: number; colIndex: number; seatLabel: string };
  } | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to load ${copy.pageTitle.toLowerCase()}`);
      setSeries(json.data?.series || []);
      setOccurrences(json.data?.occurrences || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [apiBase, copy.pageTitle]);

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
        `${seatsApiBase}?occurrenceId=${encodeURIComponent(occ.id)}`,
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

  async function loadPackages(occurrenceId: string) {
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "entitlements",
        occurrenceId,
        firstName,
        lastName,
        phone,
        email: email || undefined,
      }),
    });
    const json = await res.json();
    return (json.data?.packages || []) as Array<{
      id: string;
      productName: string;
      creditsRemaining: number;
    }>;
  }

  async function enroll(
    occurrenceId: string,
    seat?: { seatMapId: string; rowIndex: number; colIndex: number; seatLabel: string },
    packageBalanceId?: string,
    skipPackageLookup = false,
  ) {
    const occurrence = occurrences.find((o) => o.id === occurrenceId);
    const confirmation = occurrence
      ? series.find((s) => s.id === occurrence.seriesId)?.confirmationMessage
      : null;
    if (!firstName.trim() || !phone.trim()) {
      setError("First name and phone are required.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let packageId = packageBalanceId;
      if (!packageId && !skipPackageLookup) {
        const packages = await loadPackages(occurrenceId);
        if (packages.length === 1) packageId = packages[0].id;
        if (packages.length > 1) {
          setPackagePrompt({ occurrenceId, packages, seat });
          setSelectedPackageId(packages[0].id);
          setBusy(false);
          return;
        }
      }

      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceId,
          firstName,
          lastName,
          phone,
          email: email || undefined,
          packageBalanceId: packageId || undefined,
          seatMapId: seat?.seatMapId,
          rowIndex: seat?.rowIndex,
          colIndex: seat?.colIndex,
          seatLabel: seat?.seatLabel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      const seatLabel = seat?.seatLabel ? ` Seat ${seat.seatLabel} reserved.` : "";
      // Only an online workshop returns one, and only to the person who has
      // just taken a place.
      const joinLine = json.data?.joinUrl ? ` Join here: ${json.data.joinUrl}` : "";
      const packageLine = json.data?.packageApplied ? " One package credit was applied." : "";
      setMessage(
        (json.data?.waitlisted
          ? offeringKind === "workshop"
            ? "This workshop is full, so you are on the waitlist. We will contact you if a place opens."
            : "That session is full, so you are on the waitlist. We will contact you if a place opens."
          : // A class with its own confirmation wording replaces the generic
            // line entirely, which is the point of setting one.
            confirmation ||
            (offeringKind === "workshop"
              ? `You are registered for this workshop.${seatLabel} We will send a confirmation if messaging is enabled.`
              : `You are enrolled.${seatLabel} We will send a confirmation if messaging is enabled.`)) +
          packageLine +
          joinLine,
      );
      setPackagePrompt(null);
      setSeatPickerOpen(false);
      setPendingOccurrence(null);
      setSelectedSeat(null);
      setSeatMap(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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

  const seriesMap = new Map(series.map((s) => [s.id, s]));
  const emptyLabel =
    offeringKind === "workshop" ? "No upcoming workshops." : "No upcoming class sessions.";
  const loadingLabel =
    offeringKind === "workshop" ? "Loading upcoming workshops…" : "Loading upcoming classes…";
  const sessionFallback = offeringKind === "workshop" ? "Workshop" : "Class";

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{copy.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{businessName}</p>
      </header>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Your details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted-foreground">First name *</span>
            <input
              className="mt-1 h-9 w-full rounded-md border px-2"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Last name</span>
            <input
              className="mt-1 h-9 w-full rounded-md border px-2"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Phone *</span>
            <input
              className="mt-1 h-9 w-full rounded-md border px-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Email</span>
            <input
              type="email"
              className="mt-1 h-9 w-full rounded-md border px-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>
      </section>

      {message ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {packagePrompt ? (
        <section className="rounded-lg border p-4 space-y-3" aria-label="Use a package">
          <h2 className="text-sm font-semibold">Use a package</h2>
          <p className="text-sm text-muted-foreground">
            You have more than one package that works for this booking. Choose which credit to use.
          </p>
          <label className="text-sm block">
            <span className="text-muted-foreground">Package</span>
            <select
              className="mt-1 h-9 w-full rounded-md border px-2"
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
            >
              {packagePrompt.packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.productName} · {pkg.creditsRemaining} left
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm"
              onClick={() => {
                void enroll(packagePrompt.occurrenceId, packagePrompt.seat, undefined, true);
                setPackagePrompt(null);
              }}
            >
              Pay normally
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => {
                void enroll(
                  packagePrompt.occurrenceId,
                  packagePrompt.seat,
                  selectedPackageId,
                );
                setPackagePrompt(null);
              }}
            >
              Use package
            </button>
          </div>
        </section>
      ) : null}

      {seatPickerOpen && pendingOccurrence ? (
        <section className="rounded-lg border p-4 space-y-4" aria-label="Choose your seat">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Choose your seat</h2>
              <p className="text-xs text-muted-foreground">
                {seriesMap.get(pendingOccurrence.seriesId)?.name} ·{" "}
                {formatWhen(pendingOccurrence.startsAt)}
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
                    selectedSeat?.rowIndex === seat.rowIndex &&
                    selectedSeat?.colIndex === seat.colIndex;
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
                {busy
                  ? "Registering…"
                  : selectedSeat
                    ? `${copy.registerVerb} in seat ${selectedSeat.label}`
                    : "Select a seat"}
              </button>
            </>
          )}
        </section>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{loadingLabel}</p>
      ) : occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {occurrences.map((occ) => {
            const s = seriesMap.get(occ.seriesId);
            const full = occ.remaining <= 0;
            const closed = s?.registrationClosedReason || null;
            const waitlistable = full && s?.waitlistEnabled === true;
            const price = s?.isFree === false && s.priceCents ? `$${(s.priceCents / 100).toFixed(2)}` : "Free";
            const facts = [
              // Remaining seats are only shown when the class says to show them.
              s?.showRemainingSpots === false
                ? full
                  ? "Full"
                  : null
                : full
                  ? "Full"
                  : `${occ.remaining} spot${occ.remaining === 1 ? "" : "s"} left`,
              price,
              occ.requiresSeatSelection ? "Seat selection required" : null,
            ].filter(Boolean);
            return (
              <li key={occ.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{s?.name || sessionFallback}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatWhen(occ.startsAt)}
                    {s?.placeLabel ? ` · ${s.placeLabel}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {closed || facts.join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || Boolean(closed) || (full && !waitlistable)}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  onClick={() => {
                    if (occ.requiresSeatSelection && occ.seatMapId) {
                      void openSeatPicker(occ);
                      return;
                    }
                    void enroll(occ.id);
                  }}
                >
                  {waitlistable
                    ? "Join waitlist"
                    : occ.requiresSeatSelection
                      ? "Choose seat"
                      : copy.registerVerb}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
