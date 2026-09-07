"use client";

import { useMemo, useState } from "react";
import {
  BookingType,
  Slot,
  availableDayOffsets,
  locationOptions,
  slotsByDay,
  staffOptions,
  workspace,
} from "../mock-data";
import { ArrowLeft, ChevronLeft, ChevronRight, Globe2, MapPin, Repeat, User, Users } from "lucide-react";

type RecurringMode = "once" | "weekly" | "biweekly" | "monthly";

function dayLabel(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    day: d.getDate(),
    month: d.toLocaleDateString(undefined, { month: "short" }),
    full: d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
    key: d.toDateString(),
  };
}

export function DateTimeStep({
  type,
  onBack,
  onContinue,
}: {
  type: BookingType;
  onBack: () => void;
  onContinue: (payload: {
    startsAt: string;
    staffId: string;
    locationId: string;
    recurringMode: RecurringMode;
    recurringOccurrences: number;
    attendeeCount: number;
    durationMinutes: number;
  }) => void;
}) {
  const [dayIdx, setDayIdx] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [staffId, setStaffId] = useState(type.staffAssignment === "specific" ? type.staffIds?.[0] || "" : "");
  const [locationId, setLocationId] = useState(type.locationIds?.[0] || "");
  const [recurringMode, setRecurringMode] = useState<RecurringMode>("once");
  const [occurrences, setOccurrences] = useState(4);
  const [attendees, setAttendees] = useState(1);
  const [durationId, setDurationId] = useState(type.durationOptions?.[0]?.id || "");

  const offset = availableDayOffsets[dayIdx];
  const info = dayLabel(offset);
  const slots: Slot[] = slotsByDay[offset] || [];

  const staffChoices = useMemo(() => {
    if (type.staffAssignment !== "specific") return [];
    return (type.staffIds || []).map((id) => staffOptions.find((s) => s.id === id)).filter(Boolean) as typeof staffOptions;
  }, [type]);

  const locationChoices = useMemo(
    () => (type.locationIds || []).map((id) => locationOptions.find((l) => l.id === id)).filter(Boolean) as typeof locationOptions,
    [type],
  );

  const durationMinutes = type.durationOptions?.find((d) => d.id === durationId)?.minutes || type.durationMinutes;
  const canContinue = Boolean(selectedSlot);

  const recurringOptions: Array<{ value: RecurringMode; label: string }> = [
    { value: "once", label: "One time" },
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Every 2 weeks" },
    { value: "monthly", label: "Monthly" },
  ];

  return (
    <div className="tv-fade-up">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All services
      </button>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left: booking details */}
        <aside className="lg:border-r lg:border-border lg:pr-6">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Selected service</p>
            <h2 className="font-display mt-1.5 text-[17px] font-semibold text-foreground">{type.name}</h2>
            <div className="mt-3 space-y-2 text-[13px] text-muted-foreground">
              <p className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 shrink-0" /> {durationMinutes} min · {workspace.timezoneLabel}
              </p>
              {type.location ? (
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" /> {type.location}
                </p>
              ) : null}
              {type.priceDisplay ? (
                <p className="inline-flex rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                  {type.priceDisplay}
                </p>
              ) : null}
            </div>

            {type.durationOptions && type.durationOptions.length > 1 ? (
              <div className="mt-5">
                <p className="mb-2 text-[12px] font-semibold text-foreground">Duration</p>
                <div className="space-y-1.5">
                  {type.durationOptions.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDurationId(d.id)}
                      aria-pressed={durationId === d.id}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                        durationId === d.id
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {staffChoices.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 text-[12px] font-semibold text-foreground">Provider</p>
                <div className="space-y-1.5">
                  {staffChoices.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStaffId(s.id)}
                      aria-pressed={staffId === s.id}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        staffId === s.id ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/60"
                      }`}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {s.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                      </span>
                      <span>
                        <span className="block text-[13px] font-medium text-foreground">{s.name}</span>
                        {s.role ? <span className="block text-[11px] text-muted-foreground">{s.role}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {locationChoices.length > 1 ? (
              <div className="mt-5">
                <p className="mb-2 text-[12px] font-semibold text-foreground">Location</p>
                <div className="space-y-1.5">
                  {locationChoices.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLocationId(l.id)}
                      aria-pressed={locationId === l.id}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        locationId === l.id ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/60"
                      }`}
                    >
                      <span className="block text-[13px] font-medium text-foreground">{l.name}</span>
                      {l.address ? <span className="block text-[11px] text-muted-foreground">{l.address}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {type.groupBooking?.enabled ? (
              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                  <Users className="h-3.5 w-3.5" /> Attendees
                </p>
                <div className="flex items-center gap-2">
                  {Array.from({ length: type.groupBooking.maxAttendees }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setAttendees(n)}
                      aria-pressed={attendees === n}
                      className={`h-9 w-9 rounded-lg border text-[13px] font-semibold transition-colors ${
                        attendees === n
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {type.recurring?.enabled ? (
              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                  <Repeat className="h-3.5 w-3.5" /> Repeat
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {recurringOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRecurringMode(opt.value)}
                      aria-pressed={recurringMode === opt.value}
                      className={`rounded-lg border px-2.5 py-2 text-[12px] font-medium transition-colors ${
                        recurringMode === opt.value
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {recurringMode !== "once" ? (
                  <div className="mt-2.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <label htmlFor="occ">Occurrences</label>
                    <select
                      id="occ"
                      value={occurrences}
                      onChange={(e) => setOccurrences(Number(e.target.value))}
                      className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px]"
                    >
                      {[2, 3, 4, 6, 8, 12].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>

        {/* Right: date + slots */}
        <section aria-label="Choose date and time">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h3 className="font-display text-[14px] font-semibold text-foreground">Select a date</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDayIdx((i) => Math.max(0, i - 1))}
                  disabled={dayIdx === 0}
                  aria-label="Previous day"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDayIdx((i) => Math.min(availableDayOffsets.length - 1, i + 1))}
                  disabled={dayIdx === availableDayOffsets.length - 1}
                  aria-label="Next day"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto px-5 py-4" role="tablist" aria-label="Available days">
              {availableDayOffsets.map((off, i) => {
                const l = dayLabel(off);
                const active = i === dayIdx;
                return (
                  <button
                    key={off}
                    role="tab"
                    aria-selected={active}
                    onClick={() => { setDayIdx(i); setSelectedSlot(""); }}
                    className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 transition-colors ${
                      active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card hover:bg-muted/60"
                    }`}
                  >
                    <span className={`text-[11px] font-medium ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {l.weekday}
                    </span>
                    <span className="font-display mt-0.5 text-[17px] font-bold leading-none">{l.day}</span>
                    <span className={`mt-0.5 text-[11px] ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {l.month}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold text-foreground">
                  Available times · <span className="font-normal text-muted-foreground">{info.full}</span>
                </h4>
                <span className="text-[11px] text-muted-foreground">{workspace.timezoneLabel}</span>
              </div>
              {slots.length === 0 ? (
                <div className="rounded-lg bg-muted/50 px-4 py-8 text-center text-[13px] text-muted-foreground">
                  No openings on this day. Try another date or join the waitlist.
                </div>
              ) : (
                <div className="tv-slot-scroll grid max-h-[320px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {slots.map((slot) => {
                    const t = new Date(slot.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                    const active = selectedSlot === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        onClick={() => setSelectedSlot(slot.startsAt)}
                        aria-pressed={active}
                        className={`rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition-all ${
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/50"
                        }`}
                      >
                        {t}
                        {slot.remaining && slot.capacity ? (
                          <span className={`block text-[10px] font-medium ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {slot.remaining} of {slot.capacity} left
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
              <button
                onClick={onBack}
                className="rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60"
              >
                Back
              </button>
              <button
                onClick={() =>
                  onContinue({
                    startsAt: selectedSlot,
                    staffId,
                    locationId,
                    recurringMode,
                    recurringOccurrences: occurrences,
                    attendeeCount: attendees,
                    durationMinutes,
                  })
                }
                disabled={!canContinue}
                className="rounded-lg px-5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                Continue
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
