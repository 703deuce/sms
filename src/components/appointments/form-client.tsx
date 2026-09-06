"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CalendarClock, Check, ChevronRight, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type AppointmentType = { id: string; name: string; durationMinutes: number };
type Slot = { startsAt: string; endsAt: string };

function SectionHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold tabular-nums text-primary">
        {step}
      </span>
      <div>
        <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function AppointmentFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledStart = searchParams.get("startsAt") || "";
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [smsConsent, setSmsConsent] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedType = types.find((t) => t.id === serviceId);
  const selectedSlot = slots.find((s) => s.startsAt === startsAt);

  useEffect(() => {
    if (prefilledStart) setStartsAt(prefilledStart);
  }, [prefilledStart]);

  useEffect(() => {
    fetch("/api/appointments/types")
      .then((r) => r.json())
      .then((json) => {
        const list = json.data || [];
        setTypes(list);
        if (list[0]?.id) setServiceId(list[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedType) return;
    setLoadingSlots(true);
    fetch(
      `/api/appointments/availability?serviceName=${encodeURIComponent(selectedType.name)}&daysAhead=14`,
    )
      .then((r) => r.json())
      .then((json) => setSlots(json.data?.slots || []))
      .finally(() => setLoadingSlots(false));
  }, [selectedType?.id, selectedType?.name]);

  async function submit() {
    if (!selectedType || !startsAt || !phone.trim()) {
      setError("Service, time slot, and phone are required.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: selectedType.id,
        serviceName: selectedType.name,
        startsAt,
        firstName,
        lastName,
        phone,
        email,
        notes,
        smsConsent,
        status: "scheduled",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not create appointment");
      setSaving(false);
      return;
    }
    router.push(`/appointments/${json.data.appointmentId}`);
  }

  const summaryDate = startsAt
    ? new Date(startsAt).toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => router.push("/appointments")}
            className="font-medium transition-colors hover:text-foreground"
          >
            Appointments
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">New</span>
        </nav>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
          New Appointment
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Book a customer manually from the admin calendar.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main form */}
        <Card className="p-0">
          {/* Step 1: Service & time */}
          <div className="space-y-5 border-b border-border p-6">
            <SectionHeading
              step="1"
              title="Service & time"
              description="Choose an appointment type, then pick an open slot."
            />

            <div>
              <Label htmlFor="service">Appointment type</Label>
              <Select
                id="service"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setStartsAt("");
                }}
              >
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} · {type.durationMinutes} min
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Available times</Label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading availability…
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3.5">
                  <p className="text-[13px] font-medium text-amber-800">
                    No open slots in the next 14 days
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700/90">
                    Connect a calendar or adjust appointment type settings.
                  </p>
                </div>
              ) : (
                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {slots.map((slot) => {
                    const d = new Date(slot.startsAt);
                    const day = d.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    const time = d.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    const selected = startsAt === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        onClick={() => setStartsAt(slot.startsAt)}
                        className={cn(
                          "group flex flex-col rounded-[10px] border px-3 py-2.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                          selected
                            ? "border-primary bg-primary/[0.06] shadow-[0_0_0_1px_var(--primary)]"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex items-center justify-between text-[11px] font-medium",
                            selected ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {day}
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 text-[13px] font-semibold tabular-nums",
                            selected ? "text-primary" : "text-foreground",
                          )}
                        >
                          {time}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Customer */}
          <div className="space-y-5 border-b border-border p-6">
            <SectionHeading
              step="2"
              title="Customer"
              description="Who is this appointment for? Phone is required for reminders."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="first">First name</Label>
                <Input
                  id="first"
                  value={firstName}
                  placeholder="Jane"
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="last">Last name</Label>
                <Input
                  id="last"
                  value={lastName}
                  placeholder="Doe"
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">
                  Phone <span className="text-danger">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  placeholder="(555) 123-4567"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  placeholder="jane@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                placeholder="Internal notes for this visit (optional)"
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Step 3: Confirm */}
          <div className="space-y-4 p-6">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[var(--primary)]"
              />
              <span>
                <span className="block text-[13px] font-medium text-foreground">
                  Send SMS reminders
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Booking confirmation plus 24h and 2h reminder texts. Uncheck if the customer declined SMS.
                </span>
              </span>
            </label>

            {error ? (
              <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              {!startsAt && !loadingSlots ? (
                <p className="text-xs text-muted-foreground">
                  Select an available time above to enable booking.
                </p>
              ) : null}
              <Button onClick={submit} disabled={saving || !startsAt} size="lg">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Booking…
                  </>
                ) : (
                  "Create appointment"
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push("/appointments")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>

        {/* Summary aside */}
        <Card className="sticky top-6 space-y-4 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarClock className="h-4 w-4" />
            </span>
            <CardTitle>Summary</CardTitle>
          </div>
          <dl className="space-y-3 border-t border-border pt-4 text-[13px]">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Service
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {selectedType ? selectedType.name : "—"}
                {selectedType ? (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    · {selectedType.durationMinutes} min
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Time
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {summaryDate ?? (
                  <span className="font-normal text-muted-foreground">
                    No slot selected
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Customer
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {firstName || lastName ? (
                  `${firstName} ${lastName}`.trim()
                ) : (
                  <span className="font-normal text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                SMS reminders
              </dt>
              <dd className="mt-0.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    smsConsent
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-muted text-muted-foreground ring-1 ring-border",
                  )}
                >
                  {smsConsent ? "Enabled" : "Disabled"}
                </span>
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
