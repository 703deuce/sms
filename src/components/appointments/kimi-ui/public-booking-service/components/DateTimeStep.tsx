import { useEffect, useState } from "react";
import type { BookingType, Slot, StaffOption, LocationOption, DurationOption } from "../mock-data";
import { availableDays, slotsByDay } from "../mock-data";
import { Button } from "./ui";
import { cn, formatSlotTime, formatFullDate, formatPrice } from "./utils";
import { ArrowLeft, CalendarCheck, ChevronRight, Globe2, ListPlus, Sparkles } from "lucide-react";
import { PublicDayTimeSlotPicker } from "@/newui-transplant/components/public-booking/public-day-time-slot-picker";

export function DateTimeStep({
  type,
  timezone,
  staffOptions,
  locationOptions,
  waitlistEnabled,
  aiEnabled,
  startsAt,
  selectedStaffId,
  selectedLocationId,
  onSelectStaff,
  onSelectLocation,
  onSelectSlot,
  onContinue,
  onBack,
  onWaitlist,
  onAi,
  externalSlots,
  externalLoadingSlots,
  onAddAnotherService,
  additionalServiceNames = [],
  additionalServices = [],
  lineStaffIds = {},
  onLineStaffChange,
  onAddToSessionCart,
  sessionLineCount = 0,
}: {
  type: BookingType;
  timezone: string;
  staffOptions: StaffOption[];
  locationOptions: LocationOption[];
  waitlistEnabled: boolean;
  aiEnabled: boolean;
  startsAt: string;
  selectedStaffId: string;
  selectedLocationId: string;
  onSelectStaff: (id: string) => void;
  onSelectLocation: (id: string) => void;
  onSelectSlot: (iso: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onWaitlist: () => void;
  onAi: () => void;
  externalSlots?: Slot[] | null;
  externalLoadingSlots?: boolean;
  onAddAnotherService?: () => void;
  additionalServiceNames?: string[];
  additionalServices?: Array<{
    id: string;
    name: string;
    staffAssignment?: string;
    staffIds?: string[];
  }>;
  lineStaffIds?: Record<string, string>;
  onLineStaffChange?: (serviceId: string, staffId: string) => void;
  onAddToSessionCart?: () => void;
  sessionLineCount?: number;
}) {
  const useLiveSlots = externalSlots !== undefined;
  const [selectedDay, setSelectedDay] = useState(
    useLiveSlots ? "" : availableDays[0].date,
  );
  const [dayOffset, setDayOffset] = useState(0);
  const [slots, setSlots] = useState<Slot[] | null>(useLiveSlots ? externalSlots ?? [] : null);
  const [duration, setDuration] = useState<DurationOption | null>(
    (type.durationOptions || []).find((d) => d.active) || (type.durationOptions || [])[0] || null,
  );
  const staffMode = type.config?.staffAssignment as string | undefined;
  const showStaff =
    (staffMode === "customer_chooses" || staffMode === "customer_choice") && staffOptions.length > 0;
  const showLocations =
    locationOptions.length >= 1 &&
    Boolean(
      (type.config as { locationIds?: string[] } | undefined)?.locationIds?.length ||
        type.config?.location ||
        locationOptions.length > 0,
    );
  const showDurations = (type.durationOptions || []).length > 1;
  // A pay-in-person service carries its amount as a display string, a charged
  // one carries it on the payment config.
  const headlinePrice = type.config?.priceDisplay || formatPrice(type.config?.payment);

  // Sandbox: simulate availability fetch per selected day
  useEffect(() => {
    if (useLiveSlots) {
      setSlots(externalSlots ?? []);
      return;
    }
    setSlots(null);
    const key = selectedDay.slice(0, 10);
    const timer = setTimeout(() => {
      setSlots(slotsByDay[key] || []);
    }, 450);
    return () => clearTimeout(timer);
  }, [selectedDay, selectedStaffId, selectedLocationId, duration, useLiveSlots, externalSlots]);

  return (
    <div className="fade-in">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All services
      </button>

      <h1 className="font-display text-[20px] font-semibold tracking-tight text-foreground">
        {type.name}
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {duration?.minutes || type.durationMinutes} minutes · {type.config?.location || "In person"}
        {headlinePrice ? ` · ${headlinePrice}` : ""}
      </p>
      {/* A deep link skips the service list, so this is the only place the
          description and price are shown before someone picks a time. */}
      {type.config?.description ? (
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          {type.config.description}
        </p>
      ) : null}

      {showDurations ? (
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-foreground">Appointment length</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(type.durationOptions || []).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setDuration(opt);
                  onSelectSlot("");
                }}
                aria-pressed={duration?.id === opt.id}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-[13px] font-semibold transition-all",
                  duration?.id === opt.id
                    ? "border-primary/50 bg-primary/5 text-primary ring-2 ring-primary/15"
                    : "border-border bg-card text-foreground hover:border-primary/30",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showStaff ? (
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-foreground">Choose a provider</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onSelectStaff("")}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-[13px] font-semibold transition-all",
                !selectedStaffId
                  ? "border-primary/50 bg-primary/5 text-primary ring-2 ring-primary/15"
                  : "border-border bg-card text-foreground hover:border-primary/30",
              )}
            >
              First available
              <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">Fastest booking</span>
            </button>
            {staffOptions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectStaff(s.id)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-[13px] font-semibold transition-all",
                  selectedStaffId === s.id
                    ? "border-primary/50 bg-primary/5 text-primary ring-2 ring-primary/15"
                    : "border-border bg-card text-foreground hover:border-primary/30",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {additionalServices.length > 0 ? (
        <div className="mt-5 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[13px] font-semibold text-foreground">Additional services</p>
          <ul className="mt-2 space-y-3">
            {additionalServices.map((svc) => (
              <li key={svc.id} className="text-sm">
                <div className="font-medium text-foreground">{svc.name}</div>
                {(svc.staffAssignment === "customer_chooses" || svc.staffAssignment === "customer_choice") &&
                onLineStaffChange ? (
                  <label className="mt-1 flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">Staff for this service</span>
                    <select
                      className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
                      value={lineStaffIds[svc.id] || ""}
                      onChange={(e) => onLineStaffChange(svc.id, e.target.value)}
                    >
                      <option value="">Select staff</option>
                      {(svc.staffIds?.length
                        ? staffOptions.filter((s) => svc.staffIds!.includes(s.id))
                        : staffOptions
                      ).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : additionalServiceNames.length > 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Also booking: {additionalServiceNames.join(", ")}
        </p>
      ) : null}

      {showLocations ? (
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-foreground">Location</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {locationOptions.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onSelectLocation(l.id)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-all",
                  selectedLocationId === l.id
                    ? "border-primary/50 bg-primary/5 ring-2 ring-primary/15"
                    : "border-border bg-card hover:border-primary/30",
                )}
              >
                <span className="text-[13px] font-semibold text-foreground">{l.name}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{l.address}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {useLiveSlots ? (
        <div className="mt-6">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5 shrink-0" />
            Times shown in {timezone.replace("_", " ")}
          </p>
          {externalLoadingSlots ? (
            <div className="mt-4 flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              Loading available times…
            </div>
          ) : (externalSlots?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
              <CalendarCheck className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">No open times in the next two weeks</p>
              {waitlistEnabled ? (
                <Button variant="outline" size="sm" className="mt-3" onClick={onWaitlist}>
                  <ListPlus className="h-3.5 w-3.5" /> Join waitlist
                </Button>
              ) : null}
            </div>
          ) : (
            <PublicDayTimeSlotPicker
              slots={externalSlots || []}
              timezone={timezone}
              selectedStartsAt={startsAt}
              onSelectStartsAt={onSelectSlot}
            />
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button size="lg" className="flex-1" disabled={!startsAt} onClick={onContinue}>
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
            {onAddAnotherService ? (
              <Button variant="outline" size="lg" type="button" onClick={onAddAnotherService}>
                <ListPlus className="h-4 w-4" /> Add service
              </Button>
            ) : null}
            {onAddToSessionCart ? (
              <Button variant="outline" size="lg" type="button" disabled={!startsAt} onClick={onAddToSessionCart}>
                <ListPlus className="h-4 w-4" /> Add to cart{sessionLineCount > 0 ? ` (${sessionLineCount})` : ""}
              </Button>
            ) : null}
            {aiEnabled ? (
              <Button variant="outline" size="lg" onClick={onAi}>
                <Sparkles className="h-4 w-4 text-primary" /> Ask the assistant
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr]">
        {/* Date picker column */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-foreground">Select a date</p>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Previous days"
                onClick={() => setDayOffset((v) => Math.max(0, v - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={dayOffset === 0}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next days"
                onClick={() => setDayOffset((v) => v + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
              >
                ›
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 md:grid-cols-2">
            {availableDays.map((d) => {
              const active = selectedDay === d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setSelectedDay(d.date);
                    onSelectSlot("");
                  }}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-center rounded-lg border px-2 py-2 transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-foreground hover:border-primary/40",
                  )}
                >
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wide", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {d.weekday}
                  </span>
                  <span className="text-[15px] font-bold leading-tight">{d.dayNum}</span>
                  <span className={cn("text-[10px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {d.count > 0 ? `${d.count} open` : "None"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5 shrink-0" />
            Times shown in {timezone.replace("_", " ")}
          </p>
        </div>

        {/* Slots column */}
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            Available times · {formatFullDate(selectedDay, timezone).split(",")[0]}
          </p>
          {slots === null ? (
            <div
              className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              aria-busy="true"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton-shimmer h-10 rounded-lg" />
              ))}
            </div>
          ) : slots.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {slots.map((slot) => {
                const active = startsAt === slot.startsAt;
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => onSelectSlot(slot.startsAt)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-[13px] font-semibold transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-foreground hover:border-primary hover:text-primary",
                    )}
                  >
                    {formatSlotTime(slot.startsAt, timezone)}
                    {slot.capacity && slot.capacity > 1 ? (
                      <span className={cn("mt-0.5 block text-[10px] font-normal", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {slot.remaining} left
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
              <CalendarCheck className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">No openings this day</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Try another date or join the waitlist and we'll text you when something opens.
              </p>
              {waitlistEnabled ? (
                <Button variant="outline" size="sm" className="mt-3" onClick={onWaitlist}>
                  <ListPlus className="h-3.5 w-3.5" /> Join waitlist
                </Button>
              ) : null}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button size="lg" className="flex-1" disabled={!startsAt} onClick={onContinue}>
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
            {onAddAnotherService ? (
              <Button variant="outline" size="lg" type="button" onClick={onAddAnotherService}>
                <ListPlus className="h-4 w-4" /> Add service
              </Button>
            ) : null}
            {onAddToSessionCart ? (
              <Button variant="outline" size="lg" type="button" disabled={!startsAt} onClick={onAddToSessionCart}>
                <ListPlus className="h-4 w-4" /> Add to cart{sessionLineCount > 0 ? ` (${sessionLineCount})` : ""}
              </Button>
            ) : null}
            {aiEnabled ? (
              <Button variant="outline" size="lg" onClick={onAi}>
                <Sparkles className="h-4 w-4 text-primary" /> Ask the assistant
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
