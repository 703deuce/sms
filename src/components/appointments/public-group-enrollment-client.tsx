"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  CLASS_SERIES_OFFERING_UI,
  type ClassSeriesOfferingKind,
} from "@/lib/appointments/class-series-offering";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";
import { PublicFlowStepRail } from "@/components/appointments/scheduling-opus/public-flow-step-rail";
import { StorePurchaseSuccessPanel } from "@/components/appointments/scheduling-opus/store-purchase-success-panel";
import { OpusPublicBookingLoading } from "@/newui-transplant/components/public-booking/opus-public-booking-states";

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
  paymentMode?: string | null;
  requireFullSeries?: boolean;
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
  const searchParams = useSearchParams();

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
  const [entitlementPrompt, setEntitlementPrompt] = useState<{
    mode: "occurrence" | "course";
    occurrenceId?: string;
    seriesId?: string;
    packages: Array<{ id: string; productName: string; creditsRemaining: number }>;
    memberships: Array<{ id: string; productName: string; creditsRemaining: number }>;
    seat?: { seatMapId: string; rowIndex: number; colIndex: number; seatLabel: string };
  } | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [flowStep, setFlowStep] = useState<0 | 1>(0);
  const detailsComplete = Boolean(firstName.trim() && phone.trim());

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

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkout !== "success" || !sessionId) return;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fulfillCheckout", sessionId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not complete registration");
        setMessage("Payment received. You are registered.");
        await load();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Payment succeeded but registration is pending. The business will follow up.",
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [apiBase, load, searchParams]);

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

  async function loadEntitlements(input: { occurrenceId?: string; seriesId?: string }) {
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "entitlements",
        occurrenceId: input.occurrenceId,
        seriesId: input.seriesId,
        firstName,
        lastName,
        phone,
        email: email || undefined,
      }),
    });
    const json = await res.json();
    return {
      packages: (json.data?.packages || []) as Array<{
        id: string;
        productName: string;
        creditsRemaining: number;
      }>,
      memberships: (json.data?.memberships || []) as Array<{
        id: string;
        productName: string;
        creditsRemaining: number;
      }>,
    };
  }

  async function startPaidCheckout(input: {
    occurrenceId?: string;
    seriesId?: string;
    enrollFullSeries?: boolean;
    packageBalanceId?: string;
    membershipSubscriptionId?: string;
  }) {
    if (!firstName.trim() || !phone.trim()) {
      setError("First name and phone are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "startCheckout",
          firstName,
          lastName,
          phone,
          email: email || undefined,
          ...input,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Checkout failed");
      if (json.data?.directEnroll) {
        if (input.occurrenceId) {
          await enroll(input.occurrenceId, undefined, input.packageBalanceId, true);
        } else if (input.seriesId) {
          await enrollCourse(input.seriesId, input.packageBalanceId, input.membershipSubscriptionId);
        }
        return;
      }
      if (json.data?.checkoutUrl) {
        window.location.href = json.data.checkoutUrl as string;
        return;
      }
      throw new Error("Checkout could not be started");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function enrollCourse(
    seriesId: string,
    packageBalanceId?: string,
    membershipSubscriptionId?: string,
  ) {
    const s = seriesMap.get(seriesId);
    if (!firstName.trim() || !phone.trim()) {
      setError("First name and phone are required.");
      return;
    }
    const needsPay =
      s?.paymentMode === "pay_at_registration" && !packageBalanceId && !membershipSubscriptionId;
    if (needsPay) {
      await startPaidCheckout({ seriesId, enrollFullSeries: true });
      return;
    }
    if (!packageBalanceId && !membershipSubscriptionId) {
      const ent = await loadEntitlements({ seriesId });
      const total = ent.packages.length + ent.memberships.length;
      if (total === 1) {
        if (ent.packages[0]) packageBalanceId = ent.packages[0].id;
        else if (ent.memberships[0]) membershipSubscriptionId = ent.memberships[0].id;
      } else if (total > 1) {
        setEntitlementPrompt({
          mode: "course",
          seriesId,
          packages: ent.packages,
          memberships: ent.memberships,
        });
        setSelectedPackageId(ent.packages[0]?.id || "");
        setSelectedMembershipId(ent.memberships[0]?.id || "");
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          enrollFullSeries: true,
          firstName,
          lastName,
          phone,
          email: email || undefined,
          packageBalanceId,
          membershipSubscriptionId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      setMessage(s?.confirmationMessage || "You are enrolled in the full course.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function enroll(
    occurrenceId: string,
    seat?: { seatMapId: string; rowIndex: number; colIndex: number; seatLabel: string },
    packageBalanceId?: string,
    skipPackageLookup = false,
  ) {
    if (!firstName.trim() || !phone.trim()) {
      setError("First name and phone are required.");
      return;
    }
    const occurrence = occurrences.find((o) => o.id === occurrenceId);
    const s = occurrence ? seriesMap.get(occurrence.seriesId) : null;
    const confirmation = s?.confirmationMessage ?? null;
    const needsPay =
      s?.paymentMode === "pay_at_registration" && !packageBalanceId && !skipPackageLookup;
    if (needsPay && !seat) {
      await startPaidCheckout({ occurrenceId });
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let packageId = packageBalanceId;
      let membershipId: string | undefined;
      if (!packageId && !skipPackageLookup) {
        const ent = await loadEntitlements({ occurrenceId });
        const total = ent.packages.length + ent.memberships.length;
        if (ent.packages.length === 1 && ent.memberships.length === 0) {
          packageId = ent.packages[0].id;
        } else if (ent.memberships.length === 1 && ent.packages.length === 0) {
          membershipId = ent.memberships[0].id;
        } else if (total > 1) {
          setEntitlementPrompt({
            mode: "occurrence",
            occurrenceId,
            packages: ent.packages,
            memberships: ent.memberships,
            seat,
          });
          setSelectedPackageId(ent.packages[0]?.id || "");
          setSelectedMembershipId(ent.memberships[0]?.id || "");
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
          membershipSubscriptionId: membershipId,
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

  const seriesMap = useMemo(() => new Map(series.map((s) => [s.id, s])), [series]);
  const fullCourseSeries = useMemo(
    () => series.filter((s) => s.requireFullSeries && !s.registrationClosedReason),
    [series],
  );
  const emptyLabel =
    offeringKind === "workshop" ? "No upcoming workshops." : "No upcoming class sessions.";
  const loadingLabel =
    offeringKind === "workshop" ? "Loading upcoming workshops…" : "Loading upcoming classes…";
  const sessionFallback = offeringKind === "workshop" ? "Workshop" : "Class";

  if (loading && series.length === 0 && occurrences.length === 0) {
    return (
      <main className="mx-auto max-w-[1120px] px-4 py-8">
        <OpusPublicBookingLoading />
      </main>
    );
  }

  if (message && !entitlementPrompt && !seatPickerOpen) {
    return (
      <main className="mx-auto max-w-[1120px] space-y-6 px-4 py-8 md:px-8">
        <header>
          <h1 className="text-2xl font-semibold">{copy.pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{businessName}</p>
        </header>
        <StorePurchaseSuccessPanel slug={slug} benefits={[message]} />
        <Button type="button" variant="outline" onClick={() => { setMessage(null); setFlowStep(1); }}>
          Register for another session
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1120px] space-y-6 px-4 py-8 md:px-8">
      <header>
        <h1 className="text-2xl font-semibold">{copy.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{businessName}</p>
      </header>

      <PublicFlowStepRail
        steps={[
          { id: "details", label: "Your details" },
          { id: "sessions", label: "Choose session" },
          { id: "confirm", label: "Confirm" },
        ]}
        currentIndex={flowStep}
      />

      <section className={`${OPUS_CARD} space-y-3 p-5`}>
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
        {flowStep === 0 ? (
          <div className="flex justify-end pt-2">
            <Button type="button" disabled={!detailsComplete} onClick={() => setFlowStep(1)}>
              Continue to sessions
            </Button>
          </div>
        ) : (
          <div className="flex justify-start pt-2">
            <Button type="button" variant="outline" onClick={() => setFlowStep(0)}>
              Edit your details
            </Button>
          </div>
        )}
      </section>

      {error ? (
        <p
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {flowStep === 1 && entitlementPrompt ? (
        <section className={`${OPUS_CARD} space-y-3 p-5`} aria-label="Apply a benefit">
          <h2 className="text-sm font-semibold">Use a package or membership</h2>
          <p className="text-sm text-muted-foreground">
            You have more than one benefit that works for this registration. Choose how to apply it.
          </p>
          {entitlementPrompt.packages.length > 0 ? (
            <label className="text-sm block">
              <span className="text-muted-foreground">Package</span>
              <select
                className="mt-1 h-9 w-full rounded-md border px-2"
                value={selectedPackageId}
                onChange={(e) => {
                  setSelectedPackageId(e.target.value);
                  setSelectedMembershipId("");
                }}
              >
                <option value="">—</option>
                {entitlementPrompt.packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.productName} · {pkg.creditsRemaining} left
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {entitlementPrompt.memberships.length > 0 ? (
            <label className="text-sm block">
              <span className="text-muted-foreground">Membership</span>
              <select
                className="mt-1 h-9 w-full rounded-md border px-2"
                value={selectedMembershipId}
                onChange={(e) => {
                  setSelectedMembershipId(e.target.value);
                  setSelectedPackageId("");
                }}
              >
                <option value="">—</option>
                {entitlementPrompt.memberships.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.productName} · {m.creditsRemaining} class credit{m.creditsRemaining === 1 ? "" : "s"} left
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (entitlementPrompt.mode === "occurrence" && entitlementPrompt.occurrenceId) {
                  void enroll(entitlementPrompt.occurrenceId, entitlementPrompt.seat, undefined, true);
                } else if (entitlementPrompt.seriesId) {
                  void enrollCourse(entitlementPrompt.seriesId);
                }
                setEntitlementPrompt(null);
              }}
            >
              Pay normally
            </Button>
            <Button
              type="button"
              disabled={!selectedPackageId && !selectedMembershipId}
              onClick={() => {
                if (entitlementPrompt.mode === "occurrence" && entitlementPrompt.occurrenceId) {
                  void enroll(
                    entitlementPrompt.occurrenceId,
                    entitlementPrompt.seat,
                    selectedPackageId || undefined,
                  );
                } else if (entitlementPrompt.seriesId) {
                  void enrollCourse(
                    entitlementPrompt.seriesId,
                    selectedPackageId || undefined,
                    selectedMembershipId || undefined,
                  );
                }
                setEntitlementPrompt(null);
              }}
            >
              Apply benefit
            </Button>
          </div>
        </section>
      ) : null}

      {flowStep === 1 && seatPickerOpen && pendingOccurrence ? (
        <section className={`${OPUS_CARD} space-y-4 p-5`} aria-label="Choose your seat">
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

      {flowStep === 1 && fullCourseSeries.length > 0 ? (
        <section className={`${OPUS_CARD} space-y-3 p-5`}>
          <h2 className="text-sm font-semibold">Full courses</h2>
          <p className="text-sm text-muted-foreground">
            One purchase enrolls you in every scheduled session.
          </p>
          <ul className="space-y-3">
            {fullCourseSeries.map((s) => {
              const price =
                s.isFree === false && s.priceCents
                  ? `$${(s.priceCents / 100).toFixed(2)}`
                  : "Free";
              const paid = s.paymentMode === "pay_at_registration";
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {price}
                      {paid ? " · Pay & register" : s.paymentMode === "package_only" ? " · Package required" : ""}
                    </p>
                  </div>
                  <Button type="button" disabled={busy} onClick={() => void enrollCourse(s.id)}>
                    {paid ? "Pay & register" : copy.registerVerb}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {flowStep === 1 && loading ? (
        <p className="text-sm text-muted-foreground">{loadingLabel}</p>
      ) : flowStep === 1 && occurrences.length === 0 ? (
        <p className={`${OPUS_CARD} p-5 text-sm text-muted-foreground`}>{emptyLabel}</p>
      ) : flowStep === 1 ? (
        <ul className={`${OPUS_CARD} divide-y overflow-hidden`}>
          {occurrences.map((occ) => {
            const s = seriesMap.get(occ.seriesId);
            const full = occ.remaining <= 0;
            const closed = s?.registrationClosedReason || null;
            const waitlistable = full && s?.waitlistEnabled === true;
            const price =
              s?.isFree === false && s.priceCents ? `$${(s.priceCents / 100).toFixed(2)}` : "Free";
            const paidDropIn = s?.paymentMode === "pay_at_registration";
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
                <Button
                  type="button"
                  disabled={busy || Boolean(closed) || (full && !waitlistable)}
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
                      : paidDropIn
                        ? "Pay & register"
                        : copy.registerVerb}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
